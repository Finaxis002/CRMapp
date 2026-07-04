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
import Slider from '@react-native-community/slider';
import { getRecordingUrl } from './callLogsService.js';

const TYPE_META = {
  Incoming: { color: '#16a34a', bg: '#dcfce7' },
  Outgoing: { color: '#2563eb', bg: '#dbeafe' },
  Missed: { color: '#dc2626', bg: '#fee2e2' },
  Rejected: { color: '#d97706', bg: '#fef3c7' },
  'No Answer': { color: '#d97706', bg: '#fef3c7' },
};

const formatDuration = secs => {
  const s = Number(secs || 0);
  if (!s) return '0s';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

const formatTimeDisplay = seconds => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

const CallLogCard = ({
  callLog,
  theme = {},
  showDelete = false,
  onDelete,
  showMeta = false,
}) => {
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [wasPlayingBeforeSeek, setWasPlayingBeforeSeek] = useState(false);

  const videoRef = useRef(null);

  const type = callLog.callDirection || callLog.callType || 'Outgoing';
  const meta = TYPE_META[type] || TYPE_META.Outgoing;

  const recordingUrl = getRecordingUrl(callLog.recordingUrl);
  const hasRecording = Boolean(callLog.recordingUploaded && recordingUrl);

  let durationLabel = '0s';
  if (type === 'Missed' || type === 'No Answer') {
    const ringTime = callLog.ringDuration || 0;
    durationLabel =
      ringTime > 0 ? `Rang for: ${formatDuration(ringTime)}` : '0s';
  } else {
    let displayDuration = callLog.callDuration;
    if (!displayDuration && callLog.duration !== undefined) {
      displayDuration = formatDuration(callLog.duration);
    }
    durationLabel = displayDuration || '0s';
  }

  const displayTime =
    callLog.createdAt || callLog.updatedAt || callLog.callTimestamp;
  const senderName = callLog.sentBy?.name || callLog.createdBy?.name || 'You';

  const togglePlay = () => {
    if (!loaded || hasError) return;
    setPlaying(!playing);
  };

  const handleDownload = () => {
    if (recordingUrl) Linking.openURL(recordingUrl);
  };

  const onLoad = data => {
    setLoaded(true);
    setDuration(data.duration);
  };

  const onProgress = data => {
    if (!isSeeking) {
      setCurrentTime(data.currentTime);
    }
  };

  const onEnd = () => {
    setPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) videoRef.current.seek(0);
  };

  const onError = () => {
    setPlaying(false);
    setHasError(true);
  };

  const onSlidingStart = () => {
    setIsSeeking(true);
    setWasPlayingBeforeSeek(playing);
    if (playing) setPlaying(false);
  };

  const onSlidingChange = value => {
    setCurrentTime(value);
  };

  const onSlidingComplete = value => {
    if (videoRef.current) {
      videoRef.current.seek(value);
    }
    setIsSeeking(false);
    if (wasPlayingBeforeSeek) {
      setPlaying(true);
    }
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
            📞 {cleanNumber(callLog.phoneNumber || callLog.phone)}
          </Text>
          <Text style={styles.meta}>
            {durationLabel} · {formatDate(displayTime)}
          </Text>
        </View>

        <View style={styles.actions}>
          {hasRecording && !hasError && (
            <>
              <TouchableOpacity onPress={togglePlay} style={styles.actionBtn}>
                <Icon
                  name={playing ? 'pause' : 'play'}
                  size={16}
                  color="#7c3aed"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDownload}
                style={styles.actionBtn}
              >
                <Icon name="download-outline" size={16} color="#64748b" />
              </TouchableOpacity>
            </>
          )}
          {showDelete && onDelete ? (
            <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {hasRecording && loaded && !hasError && (
        <View style={styles.playerContainer}>
          <Text style={styles.timerText}>{formatTimeDisplay(currentTime)}</Text>
          <Slider
            style={styles.slider}
            value={currentTime}
            minimumValue={0}
            maximumValue={duration}
            minimumTrackTintColor="#7c3aed"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#7c3aed"
            onSlidingStart={onSlidingStart}
            onValueChange={onSlidingChange}
            onSlidingComplete={onSlidingComplete}
          />
          <Text style={styles.timerText}>{formatTimeDisplay(duration)}</Text>
        </View>
      )}

      {hasRecording && !hasError && (
        <Video
          ref={videoRef}
          source={{ uri: recordingUrl }}
          audioOnly
          paused={!playing}
          onLoad={onLoad}
          onProgress={onProgress}
          onEnd={onEnd}
          onError={onError}
          style={styles.hiddenPlayer}
        />
      )}

      {!hasRecording && (
        <Text style={styles.noRec}>No recording for this call</Text>
      )}

      {callLog.aiAnalysis?.summary ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>🤖 AI Summary</Text>
          <Text style={styles.summaryText}>{callLog.aiAnalysis.summary}</Text>
          {callLog.aiAnalysis.intent ? (
            <Text style={styles.intentText}>
              Intent: {callLog.aiAnalysis.intent}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showMeta ? (
        <View style={styles.metaFooter}>
          <Text style={styles.metaFooterText}>{senderName}</Text>
          <Text style={styles.metaFooterText}>{formatDate(displayTime)}</Text>
        </View>
      ) : null}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 11, fontWeight: '700' },
  recBadge: {
    backgroundColor: '#f3e8ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recText: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },
  autoBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  autoText: { fontSize: 10, fontWeight: '700', color: '#6366f1' },
  phone: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    borderRadius: 17,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    backgroundColor: '#fff',
  },
  deleteBtnText: { color: '#dc2626', fontSize: 11, fontWeight: '600' },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 4,
  },
  slider: {
    flex: 1,
    height: 30,
  },
  timerText: {
    fontSize: 11,
    color: '#64748b',
    width: 32,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  hiddenPlayer: { height: 0, width: 0 },
  noRec: { fontSize: 12, color: '#9ca3af', marginTop: 12 },
  summaryBox: {
    marginTop: 12,
    backgroundColor: '#f5f3ff',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },
  intentText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  metaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metaFooterText: { fontSize: 11, color: '#9ca3af' },
});

export default CallLogCard;
