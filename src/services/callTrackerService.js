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
  return path.startsWith('file://') ? path : `file://${path}`;
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

const handleRecordingCompleted = async event => {
  if (!event?.recordingFilePath) return;

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
    await uploadCallRecording(payload);
  } catch (error) {
    console.warn('CallTracker upload failed', {
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

// ── FIX #1: permission request + check ─────────────────────────────────
// FOREGROUND_SERVICE is a normal (install-time) permission — NOT requested
// at runtime, so do NOT check it against requestMultiple results (that value
// is undefined → always false). POST_NOTIFICATIONS added for Android 13+.
export async function requestCallPermissions() {
  if (Platform.OS !== 'android') return false;

  const permissions = [
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];

  // Android 13+ (API 33) requires runtime POST_NOTIFICATIONS for the
  // foreground-service notification to show.
  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
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

    // POST_NOTIFICATIONS: if device is < API 33 it's not in the map, treat as ok.
    // Even if denied on 33+, we still allow tracking (notification just won't show).
    return coreGranted;
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

  // FIX #2: backend multer accepts .m4a (not .mp4). Native now outputs .m4a too.
  const formData = new FormData();
  formData.append('recording', {
    uri,
    name: filename,
    type: 'audio/mp4',
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
      phoneNumber,
      callType,
      duration,
      callTimestamp,
      deviceCallId,
      response: error?.response?.data || error?.message || error,
    });
    throw error;
  }
}
