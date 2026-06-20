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

/**
 * CallLogCard  —  React Native CLI port.
 * Replaces:
 *   <audio>              → react-native-video (audio-only mode)
 *   lucide-react icons   → react-native-vector-icons/Ionicons
 *   Tailwind classes     → StyleSheet
 *   <a download>         → Linking.openURL
 *   expo-av              → NOT used (RN CLI project)
 *
 * Backend CallLog schema fields (unchanged):
 *   phoneNumber       string   e.g. "+919876543210"
 *   callType          string   "Incoming" | "Outgoing" | "Missed" | "Rejected"
 *   duration          number   seconds
 *   callTimestamp     Date     when the call happened
 *   recordingUrl      string   RELATIVE path "/uploads/call-recordings/xxx.m4a"
 *   recordingUploaded boolean
 */

const TYPE_META = {
  Incoming: {
    iconColor: '#16a34a',
    badgeText: '#15803d',
    badgeBg: '#f0fdf4',
  },
  Outgoing: {
    iconColor: '#2563eb',
    badgeText: '#1d4ed8',
    badgeBg: '#eff6ff',
  },
  Missed: {
    iconColor: '#dc2626',
    badgeText: '#b91c1c',
    badgeBg: '#fef2f2',
  },
  Rejected: {
    iconColor: '#d97706',
    badgeText: '#b45309',
    badgeBg: '#fffbeb',
  },
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
  const videoRef = useRef(null);

  const type = callLog.callType || 'Outgoing';
  const meta = TYPE_META[type] || TYPE_META.Outgoing;

  const bgSurface = theme?.bgSurface || '#ffffff';
  const border = theme?.border || '#e5e7eb';
  const textPrimary = theme?.textPrimary || '#1f2937';
  const textMuted = theme?.textMuted || '#6b7280';
  const accent = theme?.accent || '#7c3aed';
  const inputBg = theme?.inputBg || '#f3f4f6';

  const recordingUrl = getRecordingUrl(callLog.recordingUrl);
  const hasRecording = Boolean(callLog.recordingUploaded && recordingUrl);

  const togglePlay = () => {
    if (!loaded) return; // not ready yet
    setPlaying(prev => !prev);
  };

  const handleDownload = () => {
    if (recordingUrl) Linking.openURL(recordingUrl);
  };

  return (
    <View
      style={[styles.card, { backgroundColor: bgSurface, borderColor: border }]}
    >
      <View style={styles.row}>
        {/* Type icon */}
        <View style={[styles.iconWrap, { backgroundColor: meta.badgeBg }]}>
          <Icon name="call" size={18} color={meta.iconColor} />
        </View>

        <View style={styles.info}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: meta.badgeBg }]}>
              <Text style={[styles.typeBadgeText, { color: meta.badgeText }]}>
                {type}
              </Text>
            </View>
            {hasRecording && (
              <View style={styles.recBadge}>
                <Text style={styles.recBadgeText}>🎙 Recorded</Text>
              </View>
            )}
          </View>

          <Text style={styles.phone}>
            📞 {cleanNumber(callLog.phoneNumber)}
          </Text>

          <Text style={styles.meta}>
            {formatDuration(callLog.duration)} ·{' '}
            {formatDate(callLog.callTimestamp)}
          </Text>
        </View>

        {/* Actions */}
        {hasRecording && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.playBtn, { backgroundColor: inputBg }]}
              onPress={togglePlay}
            >
              <Icon
                name={playing ? 'pause' : 'play'}
                size={16}
                color={accent}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: inputBg }]}
              onPress={handleDownload}
            >
              <Icon name="download-outline" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* react-native-video in audio-only mode (audioOnly + height:0) */}
      {hasRecording && (
        <Video
          ref={videoRef}
          source={{ uri: recordingUrl }}
          audioOnly
          paused={!playing}
          style={styles.hiddenPlayer}
          onLoad={() => setLoaded(true)}
          onEnd={() => setPlaying(false)}
          onError={e => {
            console.warn('CallLogCard video error:', e);
            setPlaying(false);
          }}
          resizeMode="contain"
        />
      )}

      {!hasRecording && (
        <Text style={[styles.noRec, { color: textMuted }]}>
          No recording for this call
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeBadge: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  recBadge: {
    borderRadius: 99,
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
  },
  phone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenPlayer: {
    height: 0,
    width: 0,
  },
  noRec: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
  },
});

export default CallLogCard;
