import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { getRecordingUrl } from './callLogsService.js';

const TYPE_META = {
  Incoming: { color: '#16a34a', bg: '#dcfce7' },
  Outgoing: { color: '#2563eb', bg: '#dbeafe' },
  Missed: { color: '#dc2626', bg: '#fee2e2' },
  Rejected: { color: '#d97706', bg: '#fef3c7' },
};

const formatDuration = secs => {
  const s = Number(secs || 0);
  if (!s) return '0s';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

const formatDate = ts =>
  ts
    ? new Date(ts).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '—';

const cleanNumber = n => (n ? String(n).replace(/\D/g, '').slice(-10) : '—');

const CallLogCard = ({ callLog, theme = {} }) => {
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef(null);

  // Flexible keys (web + old backend support)
  const type = callLog.callDirection || callLog.callType || 'Outgoing';
  const meta = TYPE_META[type] || TYPE_META.Outgoing;

  const recordingUrl = getRecordingUrl(callLog.recordingUrl);
  const hasRecording = Boolean(callLog.recordingUploaded && recordingUrl);

  // Duration handling (flexible)
  let displayDuration = callLog.callDuration;
  if (!displayDuration && callLog.duration !== undefined) {
    displayDuration = formatDuration(callLog.duration);
  } else if (!displayDuration) {
    displayDuration = '0s';
  }

  const displayTime =
    callLog.createdAt || callLog.updatedAt || callLog.callTimestamp;

  const togglePlay = () => {
    if (!loaded || hasError) return;
    setPlaying(!playing);
  };

  const handleDownload = () => {
    if (recordingUrl) Linking.openURL(recordingUrl);
  };

  const onEnd = () => {
    setPlaying(false);
    if (videoRef.current) videoRef.current.seek(0);
  };

  const onError = () => {
    setPlaying(false);
    setHasError(true);
  };

  return (
    <View
      style={[styles.card, { backgroundColor: '#fff', borderColor: '#e5e7eb' }]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Icon name="call" size={18} color={meta.color} />
        </View>

        <View style={styles.info}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.typeText, { color: meta.color }]}>
                {type}
              </Text>
            </View>
            {hasRecording && !hasError && (
              <View style={styles.recBadge}>
                <Text style={styles.recText}>🎙 Recorded</Text>
              </View>
            )}
            {hasError && (
              <View style={[styles.recBadge, { backgroundColor: '#fef2f2' }]}>
                <Text style={[styles.recText, { color: '#b91c1c' }]}>
                  ⚠ Unavailable
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.phone}>
            📞 {cleanNumber(callLog.phoneNumber)}
          </Text>
          <Text style={styles.meta}>
            {displayDuration} · {formatDate(displayTime)}
          </Text>
        </View>

        {hasRecording && !hasError && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={togglePlay} style={styles.actionBtn}>
              <Icon
                name={playing ? 'pause' : 'play'}
                size={16}
                color="#7c3aed"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDownload} style={styles.actionBtn}>
              <Icon name="download-outline" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {hasRecording && !hasError && (
        <Video
          ref={videoRef}
          source={{ uri: recordingUrl }}
          audioOnly
          paused={!playing}
          onLoad={() => setLoaded(true)}
          onEnd={onEnd}
          onError={onError}
          style={styles.hiddenPlayer}
        />
      )}

      {!hasRecording && (
        <Text style={styles.noRec}>No recording for this call</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 11, fontWeight: '700' },
  recBadge: {
    backgroundColor: '#f3e8ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recText: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },
  phone: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenPlayer: { height: 0, width: 0 },
  noRec: { fontSize: 12, color: '#9ca3af', marginTop: 12 },
});

export default CallLogCard;
