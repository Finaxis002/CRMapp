import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import api from './api.js';
import { leadsService } from './leadsService.js';

const { CallTrackerModule } = NativeModules;
const callTrackerEmitter =
  Platform.OS === 'android' && CallTrackerModule
    ? new NativeEventEmitter(CallTrackerModule)
    : null;

let recordingSubscription = null;
let overlaySubscription = null;
const callRecordingListeners = new Set();

const normalizeFileUri = path => {
  if (!path) return path;
  if (path.startsWith('content://') || path.startsWith('file://')) return path;
  return `file://${path}`;
};

// ✅ Centralized MIME type sniffer
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

const generateRandomId = () => Math.random().toString(36).substring(2, 15);

// ══════════════════════════════════════════════
// OVERLAY NOTE/TASK QUEUE
// Overlay se mid-call add kiye notes/tasks yahan queue hote hain,
// aur call end confirm hone (real phone number milne) par flush hote hain.
// ══════════════════════════════════════════════
let pendingOverlayNotes = [];

const findLeadByPhoneLocal = async phoneNumber => {
  if (!phoneNumber) return null;
  try {
    const digitsOnly = String(phoneNumber).replace(/\D/g, '');
    const last10 = digitsOnly.slice(-10);

    let result = await leadsService.getLeads({ search: last10 }, 1, 5);
    let lead = result?.data?.[0];

    // Fallback: agar last-10-digit search se lead na mile, poora number try karo
    if (!lead && digitsOnly && digitsOnly !== last10) {
      result = await leadsService.getLeads({ search: digitsOnly }, 1, 5);
      lead = result?.data?.[0];
    }

    if (!lead) {
      console.warn('findLeadByPhoneLocal: no lead matched for', phoneNumber);
    }
    return lead || null;
  } catch (error) {
    console.warn('findLeadByPhoneLocal failed', error);
    return null;
  }
};

// Task ke liye due date zaroori hai (ActivityTypeTab.jsx isko required maanta hai).
// Overlay se call ke dauraan date pick karna practical nahi, isliye default
// "aaj, din khatam hone tak" (23:59:59) set kar dete hain.
const buildOverlayActivityPayload = (lead, note) => {
  const payload = {
    leadId: lead._id,
    type: note.type,
    text: note.text,
  };

  if (note.type === 'Task') {
    const due = new Date();
    due.setHours(23, 59, 59, 999);
    payload.taskDueDate = due;
  }

  return payload;
};

const flushPendingOverlayNotes = async phoneNumber => {
  if (pendingOverlayNotes.length === 0) return;
  const notesToFlush = pendingOverlayNotes;
  pendingOverlayNotes = [];

  const lead = await findLeadByPhoneLocal(phoneNumber);
  if (!lead?._id) {
    console.warn(
      'flushPendingOverlayNotes: no matching lead found for',
      phoneNumber,
      '- dropping',
      notesToFlush.length,
      'items',
    );
    return;
  }

  for (const note of notesToFlush) {
    try {
      const payload = buildOverlayActivityPayload(lead, note);
      await api.put(`/leads/${lead._id}`, { activities: [payload] });
      console.log(
        'flushPendingOverlayNotes: saved',
        note.type,
        'for lead',
        lead._id,
      );
    } catch (error) {
      console.warn(
        'flushPendingOverlayNotes: save failed',
        note,
        error?.response?.data || error?.message || error,
      );
    }
  }
};

const subscribeToOverlayEvents = () => {
  if (!callTrackerEmitter || overlaySubscription) return;
  overlaySubscription = callTrackerEmitter.addListener(
    'OverlayNoteSubmitted',
    event => {
      if (!event?.text) return;
      pendingOverlayNotes.push({
        type: event.type || 'Note',
        text: event.text,
        timestamp: event.timestamp || Date.now(),
      });
    },
  );
};

const handleRecordingCompleted = async event => {
  if (!event) return;

  // Call confirm ho gaya, real phone number mil gaya —
  // overlay se queue hue notes/tasks ab flush karo.
  await flushPendingOverlayNotes(event.phoneNumber);

  notifyCallRecordingListeners(event);

  const fallbackCallId =
    event.deviceCallId || `unknown_${Date.now()}_${generateRandomId()}`;

  const payload = {
    phoneNumber: event.phoneNumber || '',
    callType: event.callType || 'Incoming',
    duration: Number(event.duration || 0),
    callTimestamp: Number(event.callTimestamp || Date.now()),
    deviceCallId: fallbackCallId,
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
  if (!callTrackerEmitter) return;
  if (!recordingSubscription) {
    recordingSubscription = callTrackerEmitter.addListener(
      'CallRecordingCompleted',
      handleRecordingCompleted,
    );
  }
  subscribeToOverlayEvents();
};

// ══════════════════════════════════════════════
// OVERLAY PERMISSION ("Display over other apps")
// ══════════════════════════════════════════════
export async function hasOverlayPermission() {
  if (Platform.OS !== 'android' || !CallTrackerModule) return false;
  try {
    return await CallTrackerModule.hasOverlayPermission();
  } catch (error) {
    console.warn('hasOverlayPermission failed', error);
    return false;
  }
}

export async function requestOverlayPermission() {
  if (Platform.OS !== 'android' || !CallTrackerModule) return;
  try {
    await CallTrackerModule.requestOverlayPermission();
  } catch (error) {
    console.warn('requestOverlayPermission failed', error);
  }
}

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

    // Overlay permission alag se maangte hain (silent request nahi ho sakti,
    // Settings screen khulegi user ke liye) — isliye yahan sirf normal
    // runtime permissions ka result return kar rahe hain.
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

  const fileType = getAudioMimeType(filename);

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
