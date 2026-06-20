import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import {
  addCallRecordingListener,
  removeCallRecordingListener,
} from '../services/callTrackerService.js';

export const useCallRecordingEvents = (onRecording, enabled = true) => {
  const cbRef = useRef(onRecording);
  cbRef.current = onRecording;

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;

    const handler = event => {
      try {
        cbRef.current?.(event);
      } catch (err) {
        console.warn('useCallRecordingEvents handler error', err);
      }
    };

    addCallRecordingListener(handler);
    return () => removeCallRecordingListener(handler);
  }, [enabled]);
};

export const showRecordingToast = event => {
  if (!event) return;
  const dur = Number(event.duration || 0);
  const durLabel =
    dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`;
  Alert.alert(
    'Call recorded',
    `${event.callType || 'Call'} · ${durLabel}\nRecording synced to CRM.`,
    [{ text: 'OK' }],
  );
};
