import {
  Alert,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  AppState,
  ToastAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from './api.js';
import { leadsService } from './leadsService.js';

const { CallTrackerModule } = NativeModules;
const callTrackerEmitter =
  Platform.OS === 'android' && CallTrackerModule
    ? new NativeEventEmitter(CallTrackerModule)
    : null;

let recordingSubscription = null;
let overlaySubscription = null;
let overlayLeadSubscription = null;
let overlayCloseSubscription = null;
let overlayCloseHandler = null;
const callRecordingListeners = new Set();

export const registerOverlayCloseHandler = handler => {
  overlayCloseHandler = typeof handler === 'function' ? handler : null;
};

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

export const buildOverlayLeadPayload = (event, fallbackPhone = '') => {
  const name = String(event?.text || '').trim();
  const rawPhone = String(
    event?.phoneNumber || event?.phone || fallbackPhone || '',
  ).trim();
  const normalizedPhone = rawPhone.replace(/[^\d+]/g, '').trim();

  if (!name || !normalizedPhone) return null;

  return {
    name,
    phone: normalizedPhone,
    source: 'Cold Call',
    status: 'New',
    priority: 'Normal',
  };
};

const syncCallLogMetadata = async payload => {
  const response = await api.post('/call-logs', { logs: [payload] });
  return response.data?.data || null;
};

const generateRandomId = () => Math.random().toString(36).substring(2, 15);

const showOverlayFeedback = (title, message) => {
  const text = message || title || 'Done';

  if (Platform.OS === 'android') {
    try {
      ToastAndroid.showWithGravityAndOffset(
        `${title || 'Info'}: ${text}`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
        0,
        180,
      );
      return;
    } catch (error) {
      console.warn('Overlay Android toast failed', error);
    }
  }

  try {
    Alert.alert(title || 'Info', text);
  } catch (error) {
    console.warn('Overlay alert failed', error);
  }
};

// ══════════════════════════════════════════════
// OFFLINE-SAFE UPLOAD QUEUE
//
// Problem: if the device has no internet (or the upload otherwise fails)
// right when a call ends, the recording + call metadata used to be
// dropped silently (only a console.warn). This queue makes sure nothing
// is lost:
//   1. Every finished call is written to a persistent AsyncStorage queue
//      FIRST (write-ahead), before we even attempt the network call.
//   2. We then try to upload immediately.
//   3. If it fails, the item just stays in the queue.
//   4. The queue is retried automatically when:
//        - connectivity comes back (NetInfo listener)
//        - the app comes to the foreground (AppState listener)
//        - the tracker/app initializes (covers "app was killed while
//          offline" case)
//   5. On success the item is removed from the queue and the local
//      recording file (which lives in persistent storage, not cacheDir —
//      see native module) is deleted to free space.
// ══════════════════════════════════════════════

const PENDING_QUEUE_KEY = 'pending_call_logs_queue_v1';
let isProcessingQueue = false;
let queueListenersRegistered = false;

const readQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('readQueue: failed to parse pending queue, resetting', error);
    return [];
  }
};

const writeQueue = async queue => {
  try {
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn('writeQueue failed', error);
  }
};

const enqueuePendingCallLog = async item => {
  const queue = await readQueue();
  // De-dupe by deviceCallId in case of re-entrant calls
  const filtered = queue.filter(q => q.deviceCallId !== item.deviceCallId);
  filtered.push({ ...item, queuedAt: Date.now(), attempts: 0 });
  await writeQueue(filtered);
};

const removeFromQueue = async deviceCallId => {
  const queue = await readQueue();
  const next = queue.filter(q => q.deviceCallId !== deviceCallId);
  await writeQueue(next);
};

const bumpAttempt = async deviceCallId => {
  const queue = await readQueue();
  const next = queue.map(q =>
    q.deviceCallId === deviceCallId
      ? { ...q, attempts: (q.attempts || 0) + 1, lastAttemptAt: Date.now() }
      : q,
  );
  await writeQueue(next);
};

const deleteLocalRecordingFile = async filePath => {
  if (
    !filePath ||
    Platform.OS !== 'android' ||
    !CallTrackerModule?.deleteRecordingFile
  ) {
    return;
  }
  try {
    await CallTrackerModule.deleteRecordingFile(filePath);
  } catch (error) {
    console.warn('deleteLocalRecordingFile failed', filePath, error);
  }
};

// Attempts to sync a single queued item. Returns true on success.
const attemptUploadQueueItem = async item => {
  try {
    if (item.recordingFilePath) {
      await uploadCallRecording(item);
    } else {
      await syncCallLogMetadata(item);
    }
    return true;
  } catch (error) {
    console.warn('attemptUploadQueueItem failed', {
      deviceCallId: item.deviceCallId,
      error: error?.response?.data || error?.message || error,
    });
    return false;
  }
};

// Processes the whole persistent queue, one item at a time, so we don't
// hammer the network/backend if many calls piled up while offline.
export const processPendingCallLogsQueue = async () => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const netState = await NetInfo.fetch().catch(() => null);
    if (netState && netState.isConnected === false) {
      // Still offline — don't even try, avoid wasted attempts.
      return;
    }

    const queue = await readQueue();
    if (queue.length === 0) return;

    console.log(`Processing pending call log queue: ${queue.length} item(s)`);

    for (const item of queue) {
      const success = await attemptUploadQueueItem(item);
      if (success) {
        await removeFromQueue(item.deviceCallId);
        await deleteLocalRecordingFile(item.recordingFilePath);
      } else {
        await bumpAttempt(item.deviceCallId);
        // Keep going with the rest of the queue even if one item fails —
        // e.g. a stale/corrupt file shouldn't block newer, valid items.
      }
    }
  } catch (error) {
    console.warn('processPendingCallLogsQueue crashed', error);
  } finally {
    isProcessingQueue = false;
  }
};

// Registers listeners that automatically retry the queue once, on:
//  - network reconnect
//  - app returning to foreground
// Safe to call multiple times — it only registers once per app session.
export const initCallLogOfflineSync = () => {
  if (queueListenersRegistered) return;
  queueListenersRegistered = true;

  // Try immediately in case there's leftover data from a previous session
  // (e.g. app was killed while offline).
  processPendingCallLogsQueue();

  let wasConnected = true;
  NetInfo.addEventListener(state => {
    const isConnected = Boolean(
      state.isConnected && state.isInternetReachable !== false,
    );
    if (isConnected && !wasConnected) {
      console.log('Network restored — retrying pending call logs');
      processPendingCallLogsQueue();
    }
    wasConnected = isConnected;
  });

  AppState.addEventListener('change', nextState => {
    if (nextState === 'active') {
      processPendingCallLogsQueue();
    }
  });
};

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
const buildOverlayActivityPayload = async (lead, note) => {
  const activity = {
    leadId: lead._id,
    type: note.type,
    text: note.text,
  };

  if (note.type === 'Task') {
    // Ensure taskDueDate is in YYYY-MM-DD format (string)
    let dueDate = note.taskDueDate || getTodayDateString();

    // If it's a Date object, convert to string
    if (dueDate instanceof Date) {
      dueDate = dueDate.toISOString().split('T')[0];
    }

    activity.taskDueDate = dueDate;

    // Get current user ID and assign task
    const currentUserId = await AsyncStorage.getItem('currentUserId');

    if (currentUserId) {
      activity.taskAssignedTo = currentUserId;
    } else {
      console.warn('⚠️ currentUserId not found in AsyncStorage');
    }

    activity.notifiedUsers = [];
  }

  return activity;
};

const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const applyOverlayNotesToLead = async (lead, notes = []) => {
  if (!lead?._id || !Array.isArray(notes) || notes.length === 0) return [];

  const applied = [];
  for (const note of notes) {
    try {
      const payload = await buildOverlayActivityPayload(lead, note);
      await api.put(`/leads/${lead._id}`, { activities: [payload] });
      applied.push(note);
    } catch (error) {
      console.warn('applyOverlayNotesToLead failed', {
        leadId: lead._id,
        note,
        error: error?.response?.data || error?.message || error,
      });
      throw error;
    }
  }

  return applied;
};

// ══════════════════════════════════════════════
// OFFLINE-SAFE OVERLAY NOTES QUEUE
// Same problem applies to overlay notes/tasks: if network is down when
// the call ends, they used to be silently dropped. Persist them too.
// ══════════════════════════════════════════════
const PENDING_OVERLAY_NOTES_KEY = 'pending_overlay_notes_queue_v1';

const enqueuePendingOverlayNote = async (phoneNumber, note) => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_OVERLAY_NOTES_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ phoneNumber, note, queuedAt: Date.now() });
    await AsyncStorage.setItem(
      PENDING_OVERLAY_NOTES_KEY,
      JSON.stringify(queue),
    );
  } catch (error) {
    console.warn('enqueuePendingOverlayNote failed', error);
  }
};

export const processPendingOverlayNotesQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_OVERLAY_NOTES_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(queue) || queue.length === 0) return;

    const netState = await NetInfo.fetch().catch(() => null);
    if (netState && netState.isConnected === false) return;

    const remaining = [];
    for (const entry of queue) {
      try {
        const lead = await findLeadByPhoneLocal(entry.phoneNumber);
        if (!lead?._id) {
          remaining.push(entry); // keep retrying later
          continue;
        }
        const payload = await buildOverlayActivityPayload(lead, entry.note);
        await api.put(`/leads/${lead._id}`, { activities: [payload] });
      } catch (error) {
        console.warn(
          'processPendingOverlayNotesQueue: item failed, keeping in queue',
          error,
        );
        remaining.push(entry);
      }
    }
    await AsyncStorage.setItem(
      PENDING_OVERLAY_NOTES_KEY,
      JSON.stringify(remaining),
    );
  } catch (error) {
    console.warn('processPendingOverlayNotesQueue crashed', error);
  }
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
      '- queuing',
      notesToFlush.length,
      'items for later retry',
    );
    // Instead of dropping them, persist for later retry (e.g. once lead
    // sync/search works again, or once network is back).
    for (const note of notesToFlush) {
      await enqueuePendingOverlayNote(phoneNumber, note);
    }
    return;
  }

  try {
    await applyOverlayNotesToLead(lead, notesToFlush);
  } catch (error) {
    for (const note of notesToFlush) {
      console.warn(
        'flushPendingOverlayNotes: save failed, queuing for retry',
        note,
        error?.response?.data || error?.message || error,
      );
      await enqueuePendingOverlayNote(phoneNumber, note);
    }
  }
};

const subscribeToOverlayEvents = () => {
  if (!callTrackerEmitter) return;

  if (!overlaySubscription) {
    overlaySubscription = callTrackerEmitter.addListener(
      'OverlayNoteSubmitted',
      event => {
        if (!event?.text) return;

        let finalType = event.type || 'Note';
        let extractedDueDate = null;

        if (finalType.startsWith('Task|')) {
          const parts = finalType.split('|');
          finalType = parts[0];
          extractedDueDate = parts[1];
        }

        pendingOverlayNotes.push({
          type: finalType,
          text: event.text,
          taskDueDate: extractedDueDate,
          timestamp: event.timestamp || Date.now(),
        });
      },
    );
  }

  if (!overlayLeadSubscription) {
    overlayLeadSubscription = callTrackerEmitter.addListener(
      'OverlayLeadSubmitted',
      async event => {
        try {
          const payload = buildOverlayLeadPayload(event);
          if (!payload) {
            showOverlayFeedback(
              'Lead not created',
              'Please enter a name and phone number.',
            );
            return;
          }

          const createdLead = await leadsService.createLead(payload);
          console.log('Overlay lead created successfully', payload.name);

          const notesToAttach = pendingOverlayNotes.slice();
          if (notesToAttach.length > 0) {
            try {
              await applyOverlayNotesToLead(createdLead, notesToAttach);
              pendingOverlayNotes = [];
            } catch (error) {
              console.warn(
                'Overlay lead created, but note/task attachment failed; retrying later',
                error,
              );
              for (const note of notesToAttach) {
                await enqueuePendingOverlayNote(payload.phone, note);
              }
            }
          }

          showOverlayFeedback(
            'Lead created',
            `${payload.name} was added successfully.`,
          );
        } catch (error) {
          const message =
            error?.response?.data?.message ||
            error?.message ||
            'Unable to create lead right now.';

          console.warn('Overlay lead creation failed', message);

          if (String(message).toLowerCase().includes('already exists')) {
            showOverlayFeedback('Lead already exists', message);
          } else {
            showOverlayFeedback('Lead not created', message);
          }
        }
      },
    );
  }

  if (!overlayCloseSubscription) {
    overlayCloseSubscription = callTrackerEmitter.addListener(
      'OverlayCloseRequested',
      event => {
        if (typeof overlayCloseHandler === 'function') {
          overlayCloseHandler(event);
        }
      },
    );
  }
};

const handleRecordingCompleted = async event => {
  if (!event) return;

  await flushPendingOverlayNotes(event.phoneNumber);

  notifyCallRecordingListeners(event);

  const fallbackCallId =
    event.deviceCallId || `unknown_${Date.now()}_${generateRandomId()}`;

  const payload = {
    phoneNumber: event.phoneNumber || '',
    callType: event.callType || 'Incoming',
    duration: Number(event.duration || 0),
    ringDuration: Number(event.ringDuration || 0),
    callTimestamp: Number(event.callTimestamp || Date.now()),
    deviceCallId: fallbackCallId,
    recordingFilePath: event.recordingFilePath,
  };

  // ── Write-ahead: persist BEFORE attempting network, so a crash/kill
  // right after this line still leaves the data recoverable. ──
  await enqueuePendingCallLog(payload);

  const success = await attemptUploadQueueItem(payload);
  if (success) {
    await removeFromQueue(payload.deviceCallId);
    await deleteLocalRecordingFile(payload.recordingFilePath);
  } else {
    console.log(
      'Call log upload failed (likely offline) — queued for automatic retry',
      payload.deviceCallId,
    );
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
    // Kick off offline-sync listeners + retry any leftovers from a
    // previous session as soon as the tracker initializes.
    initCallLogOfflineSync();
    processPendingOverlayNotesQueue();
  } catch (error) {
    console.warn('CallTracker init failed', error);
  }
}

export async function startCallTracker() {
  if (Platform.OS !== 'android' || !CallTrackerModule) return;
  try {
    await CallTrackerModule.startCallTracker();
    subscribeToRecordingEvents();
    initCallLogOfflineSync();
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
  ringDuration,
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
  formData.append('ringDuration', String(ringDuration || 0));
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
      ringDuration,
      response: error?.response?.data || error?.message || error,
    });
    throw error;
  }
}
