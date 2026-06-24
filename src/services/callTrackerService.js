import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import api from './api.js';

const { CallTrackerModule } = NativeModules;
const callTrackerEmitter =
  Platform.OS === 'android' && CallTrackerModule
    ? new NativeEventEmitter(CallTrackerModule)
    : null;

let recordingSubscription = null;
const callRecordingListeners = new Set();

const normalizeFileUri = path => {
  if (!path) return path;
  if (path.startsWith('content://') || path.startsWith('file://')) return path;
  return `file://${path}`;
};

// ✅ NEW: Centralized MIME type sniffer
const getAudioMimeType = fileName => {
  if (!fileName) return 'audio/mp4';
  const name = fileName.toLowerCase();
  if (name.endsWith('.amr')) return 'audio/amr';
  if (name.endsWith('.3gp') || name.endsWith('.3gpp')) return 'audio/3gpp';
  if (name.endsWith('.mp3')) return 'audio/mpeg';
  if (name.endsWith('.wav')) return 'audio/wav';
  if (name.endsWith('.ogg')) return 'audio/ogg';
  if (name.endsWith('.aac')) return 'audio/aac';
  if (name.endsWith('.m4a')) return 'audio/mp4';
  return 'audio/mp4'; // safe default
};

export const addCallRecordingListener = callback => {
  if (typeof callback === 'function') {
    callRecordingListeners.add(callback);
  }
};

export const removeCallRecordingListener = callback => {
  if (typeof callback === 'function') {
    callRecordingListeners.delete(callback);
  }
};

const notifyCallRecordingListeners = event => {
  callRecordingListeners.forEach(callback => {
    try {
      callback(event);
    } catch (error) {
      console.warn('CallTracker listener error', error);
    }
  });
};

const syncCallLogMetadata = async payload => {
  if (!payload) return null;
  try {
    const response = await api.post('/call-logs', { logs: [payload] });
    return response.data?.data || null;
  } catch (error) {
    console.warn('syncCallLogMetadata failed', {
      error: error?.response?.data || error?.message || error,
      payload,
    });
    throw error;
  }
};

const handleRecordingCompleted = async event => {
  if (!event) return;

  notifyCallRecordingListeners(event);

  const payload = {
    phoneNumber: event.phoneNumber || '',
    callType: event.callType || 'Incoming',
    duration: Number(event.duration || 0),
    callTimestamp: Number(event.callTimestamp || Date.now()),
    deviceCallId: event.deviceCallId || undefined,
    recordingFilePath: event.recordingFilePath,
  };

  try {
    if (event.recordingFilePath) {
      await uploadCallRecording(payload);
    } else {
      console.log('No recording found, syncing metadata only');
      await syncCallLogMetadata(payload);
    }
  } catch (error) {
    console.warn('CallTracker sync failed', {
      error: error?.response?.data || error?.message || error,
      event,
    });
  }
};

const subscribeToRecordingEvents = () => {
  if (!callTrackerEmitter || recordingSubscription) return;
  recordingSubscription = callTrackerEmitter.addListener(
    'CallRecordingCompleted',
    handleRecordingCompleted,
  );
};

export async function requestCallPermissions() {
  if (Platform.OS !== 'android') return false;

  const permissions = [
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];

  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
  } else {
    permissions.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
  }

  try {
    const granted = await PermissionsAndroid.requestMultiple(permissions);

    const coreGranted =
      granted[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      granted[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
        PermissionsAndroid.RESULTS.GRANTED;

    const notificationsGranted =
      Platform.Version < 33 ||
      granted[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] ===
        PermissionsAndroid.RESULTS.GRANTED;

    const storageGranted =
      Platform.Version < 33 ||
      granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] ===
        PermissionsAndroid.RESULTS.GRANTED ||
      granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
        PermissionsAndroid.RESULTS.GRANTED;

    return coreGranted && notificationsGranted && storageGranted;
  } catch (error) {
    console.warn('CallTracker permission request failed', error);
    return false;
  }
}

export async function initCallTracker() {
  if (Platform.OS !== 'android' || !CallTrackerModule) return;
  try {
    await CallTrackerModule.initCallTracker();
    subscribeToRecordingEvents();
  } catch (error) {
    console.warn('CallTracker init failed', error);
  }
}

export async function startCallTracker() {
  if (Platform.OS !== 'android' || !CallTrackerModule) return;
  try {
    await CallTrackerModule.startCallTracker();
    subscribeToRecordingEvents();
  } catch (error) {
    console.warn('CallTracker start failed', error);
  }
}

export async function stopCallTracker() {
  if (Platform.OS !== 'android' || !CallTrackerModule) return;
  try {
    await CallTrackerModule.stopCallTracker();
  } catch (error) {
    console.warn('CallTracker stop failed', error);
  }
}

export async function uploadCallRecording({
  phoneNumber,
  callType,
  duration,
  callTimestamp,
  deviceCallId,
  recordingFilePath,
}) {
  if (Platform.OS !== 'android') return null;
  if (!recordingFilePath) return null;

  const uri = normalizeFileUri(recordingFilePath);
  const filename =
    uri.substring(uri.lastIndexOf('/') + 1) || 'call_recording.m4a';

  // ✅ Use centralized MIME detector
  const fileType = getAudioMimeType(filename);

  console.log('📤 Uploading recording:', { filename, fileType, uri });

  const formData = new FormData();
  formData.append('recording', {
    uri,
    name: filename,
    type: fileType,
  });
  formData.append('phoneNumber', phoneNumber);
  formData.append('callType', callType);
  formData.append('duration', String(duration));
  formData.append('callTimestamp', String(callTimestamp));
  if (deviceCallId) {
    formData.append('deviceCallId', deviceCallId);
  }

  try {
    const response = await api.post('/call-logs/sync-with-recording', formData);
    return response.data?.data || null;
  } catch (error) {
    console.warn('uploadCallRecording failed', {
      uri,
      filename,
      fileType,
      response: error?.response?.data || error?.message || error,
    });
    throw error;
  }
}
