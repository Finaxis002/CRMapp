import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
  RefreshControl,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import Video from 'react-native-video';
import ExcelJS from 'exceljs';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getCallStats,
  getAllCallLogs,
  getRecordingUrl,
} from '../../services/callLogsService';
import { leadsService } from '../../services/leadsService';

const BRAND = '#5a7bf6';
const LOG_PAGE_SIZE = 20;

const pad = n => String(n).padStart(2, '0');
const toDateStr = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getDateRangeForFilter = key => {
  const now = new Date();
  if (key === 'today') return { startDate: toDateStr(now), endDate: toDateStr(now) };
  if (key === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { startDate: toDateStr(start), endDate: toDateStr(now) };
  }
  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: toDateStr(start), endDate: toDateStr(now) };
  }
  return {};
};

const formatTotalDuration = (totalSecs = 0) => {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatMinSec = (secs = 0) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

const formatLastCall = ts => {
  if (!ts) return 'No calls yet';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Today, ${d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })}`;
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
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

const AVATAR_COLORS = [
  { bg: '#F3E8FF', text: '#7C3AED' },
  { bg: '#DCFCE7', text: '#16A34A' },
  { bg: '#FFEDD5', text: '#EA580C' },
  { bg: '#DBEAFE', text: '#2563EB' },
  { bg: '#FCE7F3', text: '#DB2777' },
];
const getInitials = (name = '') =>
  name.split(' ').map(p => p[0]?.toUpperCase()).slice(0, 2).join('');

const TYPE_META = {
  Incoming: { color: '#16a34a', bg: '#dcfce7' },
  Outgoing: { color: '#2563eb', bg: '#dbeafe' },
  Missed: { color: '#dc2626', bg: '#fee2e2' },
  Rejected: { color: '#d97706', bg: '#fef3c7' },
  'No Answer': { color: '#64748b', bg: '#e2e8f0' },
};

const isConnectedType = type => type === 'Outgoing' || type === 'Incoming';

// Web-matching filter categories: All / Outgoing / Incoming / Connected / Not Connected / Recorded
const FILTER_TABS = [
  { key: 'all', label: 'All', icon: 'phone', color: BRAND, bg: '#e8ecfd' },
  { key: 'outgoing', label: 'Outgoing', icon: 'phone-outgoing', color: '#7C3AED', bg: '#ede9fe' },
  { key: 'incoming', label: 'Incoming', icon: 'phone-incoming', color: '#2563EB', bg: '#dbeafe' },
  { key: 'connected', label: 'Connected', icon: 'check-circle', color: '#16A34A', bg: '#dcfce7' },
  { key: 'not-connected', label: 'Not Connected', icon: 'phone-missed', color: '#DC2626', bg: '#fee2e2' },
  { key: 'recorded', label: 'Recorded', icon: 'microphone', color: '#64748B', bg: '#f1f5f9' },
];

// ── Stats helpers (ported from web) ───────────────────────────────
const getPeakHour = (logs = []) => {
  if (logs.length === 0) return null;
  const hourCounts = new Array(24).fill(0);
  logs.forEach(log => {
    const ts = log.createdAt || log.updatedAt || log.callTimestamp;
    if (!ts) return;
    hourCounts[new Date(ts).getHours()]++;
  });
  const maxCount = Math.max(...hourCounts);
  if (maxCount === 0) return null;
  const peakHour = hourCounts.indexOf(maxCount);
  const formatHour = h => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour} ${period}`;
  };
  return { label: `${formatHour(peakHour)} – ${formatHour((peakHour + 1) % 24)}`, count: maxCount };
};

const getAvgTimeBetweenCalls = (logs = []) => {
  if (logs.length < 2) return null;
  const timestamps = logs
    .map(log => log.createdAt || log.updatedAt || log.callTimestamp)
    .filter(Boolean)
    .map(ts => new Date(ts).getTime())
    .sort((a, b) => a - b);
  if (timestamps.length < 2) return null;
  let totalGapSecs = 0;
  for (let i = 1; i < timestamps.length; i++) totalGapSecs += (timestamps[i] - timestamps[i - 1]) / 1000;
  return totalGapSecs / (timestamps.length - 1);
};

const computeLogStats = (logs = []) => {
  const total = logs.length;
  let connected = 0, missed = 0, noAnswer = 0, rejected = 0, recorded = 0;
  let talkTimeSecs = 0, longestRing = 0, shortestRing = null;
  logs.forEach(log => {
    const type = log.callDirection || log.callType;
    if (isConnectedType(type)) {
      connected++;
      talkTimeSecs += Number(log.duration || 0);
    }
    if (type === 'Missed') missed++;
    if (type === 'No Answer') noAnswer++;
    if (type === 'Rejected') rejected++;
    if (log.recordingUploaded && log.recordingUrl) recorded++;
    if (['Missed', 'No Answer'].includes(type)) {
      const ring = Number(log.ringDuration || 0);
      if (ring > longestRing) longestRing = ring;
      if (ring > 0 && (shortestRing === null || ring < shortestRing)) shortestRing = ring;
    }
  });
  const notConnected = missed + noAnswer + rejected;
  return {
    total,
    connected,
    notConnected,
    missed,
    noAnswer,
    rejected,
    recorded,
    talkTimeSecs,
    avgDurationSecs: connected > 0 ? Math.round(talkTimeSecs / connected) : 0,
    longestRing,
    shortestRing: shortestRing === null ? 0 : shortestRing,
    connectedPct: total > 0 ? Math.round((connected / total) * 100) : 0,
    notConnectedPct: total > 0 ? Math.round((notConnected / total) * 100) : 0,
    peakHour: getPeakHour(logs),
    avgGapSecs: getAvgTimeBetweenCalls(logs),
  };
};

const formatSeek = (secs = 0) => {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatShortDate = dateStr => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

// ── Excel export (mirrors web's exportSummaryCSV) ───────────────────
const exportSummaryXLSX = async (userName, logs = []) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Call Summary', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Call ', key: 'callNo', width: 8 },
      { header: 'Lead Name', key: 'name', width: 22 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Duration', key: 'duration', width: 12 },
      { header: 'Ring Time', key: 'ringTime', width: 12 },
      { header: 'Recorded', key: 'recorded', width: 10 },
      { header: 'Call Time', key: 'callTime', width: 20 },
      { header: 'AI Summary', key: 'summary', width: 80 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A7BF6' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const TYPE_COLORS = {
      Outgoing: 'FFDBEAFE',
      Incoming: 'FFDCFCE7',
      Missed: 'FFFEE2E2',
      Rejected: 'FFFEF3C7',
      'No Answer': 'FFE2E8F0',
    };

    logs.forEach((log, idx) => {
      const type = log.callDirection || log.callType || 'N/A';
      const name = log.leadName || log.lead?.name || log.leadId?.name || 'Unknown Lead';
      const phone = cleanNumber(log.phoneNumber || log.phone);
      const durationSecs = Number(log.duration || 0);
      const isConnected = isConnectedType(type);
      const duration = isConnected ? formatMinSec(durationSecs) : 'N/A';
      const ringTime = !isConnected ? `${log.ringDuration || 0}s` : 'N/A';
      const recorded = log.recordingUploaded && log.recordingUrl ? 'Yes' : 'No';
      const ts = log.createdAt || log.updatedAt || log.callTimestamp;
      const rawSummary = log.aiAnalysis?.summary || '';
      const summary = rawSummary.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim() || 'No summary available';

      const row = sheet.addRow({
        callNo: idx + 1, name, phone, type, duration, ringTime, recorded,
        callTime: formatDate(ts), summary,
      });

      row.getCell('phone').numFmt = '@';
const charsPerLine = 55;
const estimatedLines = Math.max(1, Math.ceil(summary.length / charsPerLine));
row.height = Math.max(20, estimatedLines * 14);
      const isEvenRow = idx % 2 === 1;

      row.eachCell((cell, colNumber) => {
        cell.alignment = { wrapText: true, vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left' };
        if (colNumber !== 9) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEvenRow ? 'FFF8FAFC' : 'FFFFFFFF' } };
        }
        cell.font = { size: 10.5, color: { argb: 'FF1E293B' } };
      });

      const typeCell = row.getCell('type');
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TYPE_COLORS[type] || 'FFF1F5F9' } };
      typeCell.alignment = { vertical: 'middle', horizontal: 'center' };
      typeCell.font = { size: 10.5, bold: true, color: { argb: 'FF1E293B' } };

      const recCell = row.getCell('recorded');
      recCell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (recorded === 'Yes') recCell.font = { size: 10.5, bold: true, color: { argb: 'FF16A34A' } };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const fileName = `${userName}_call_summary_${toDateStr(new Date())}.xlsx`;
    const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
    await RNFS.writeFile(filePath, base64, 'base64');

    await Share.open({
      url: Platform.OS === 'android' ? `file://${filePath}` : filePath,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: fileName,
      failOnCancel: false,
    });
  } catch (err) {
    if (err?.message !== 'User did not share') {
      Toast.show({ type: 'error', text1: 'Export failed. Please try again.' });
    }
  }
};

// ── Summary card (top strip) ────────────────────────────────────────
const SummaryCard = ({ icon, label, value, color, isDark }) => (
  <View
    style={[
      styles.summaryCard,
      { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' },
    ]}
  >
    <View style={[styles.summaryIconBox, { backgroundColor: `${color}1A` }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <View style={{ minWidth: 0 }}>
      <Text style={[styles.summaryValue, { color: isDark ? '#F9FAFB' : '#0f172a' }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  </View>
);

// ── Stat row used inside the drawer Summary tab ─────────────────────
const StatLine = ({ icon, label, value, color, isDark, sub }) => (
  <View style={styles.statLine}>
    <Icon name={icon} size={14} color={color || (isDark ? '#94A3B8' : '#64748b')} />
    <View style={{ minWidth: 0 }}>
      <Text style={{ fontSize: 13, color: isDark ? '#E2E8F0' : '#334155' }}>
        {label}: <Text style={{ fontWeight: '700' }}>{value}</Text>
      </Text>
      {sub ? <Text style={{ fontSize: 10, color: isDark ? '#64748B' : '#94a3b8' }}>{sub}</Text> : null}
    </View>
  </View>
);

// ── Per-user drawer Summary panel ───────────────────────────────────
const UserSummaryPanel = ({ userName, stats, isDark, drawerPeriod, onPeriodChange, onExport, exporting }) => {
  const cardBg = isDark ? '#1E293B' : '#fff';
  const border = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#F9FAFB' : '#0f172a';

  const periods = [
    { key: 'page', label: 'Current Filter' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <View style={[styles.summaryPanelCard, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={styles.summaryPanelHeaderRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.summaryPanelTitle, { color: textPrimary }]}>{userName} — Summary</Text>
            <Text style={{ fontSize: 11, color: '#94a3b8' }}>For the selected period</Text>
          </View>
          <TouchableOpacity
            onPress={() => onExport?.()}
            disabled={exporting}
            style={[styles.exportBtn, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={isDark ? '#E2E8F0' : '#475569'} />
            ) : (
              <>
                <Icon name="download" size={13} color={isDark ? '#E2E8F0' : '#475569'} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#E2E8F0' : '#475569' }}>Export</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.periodPillRow}>
          {periods.map(p => {
            const active = drawerPeriod === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => onPeriodChange(p.key)}
                style={[
                  styles.periodPill,
                  {
                    backgroundColor: active ? BRAND : cardBg,
                    borderColor: active ? BRAND : border,
                  },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#fff' : '#64748b' }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.statGrid, { borderTopColor: border }]}>
          <StatLine icon="phone" label="Total" value={stats.total} color={BRAND} isDark={isDark} />
          <StatLine
            icon="check-circle"
            label="Connected"
            value={`${stats.connected} (${stats.connectedPct}%)`}
            color="#16A34A"
            isDark={isDark}
          />
          <StatLine
            icon="close-circle"
            label="Not Connected"
            value={`${stats.notConnected} (${stats.notConnectedPct}%)`}
            color="#DC2626"
            isDark={isDark}
          />
          <StatLine icon="microphone" label="Recorded" value={stats.recorded} color="#7C3AED" isDark={isDark} />
        </View>

        <Text style={[styles.breakdownText, { borderTopColor: border, color: isDark ? '#94A3B8' : '#64748b' }]}>
          No Answer: <Text style={{ fontWeight: '700' }}>{stats.noAnswer}</Text>  ·  Missed:{' '}
          <Text style={{ fontWeight: '700' }}>{stats.missed}</Text>  ·  Rejected:{' '}
          <Text style={{ fontWeight: '700' }}>{stats.rejected}</Text>
        </Text>

        <View style={[styles.statGrid, { borderTopColor: border }]}>
          <StatLine icon="clock-outline" label="Talk Time" value={formatMinSec(stats.talkTimeSecs)} isDark={isDark} />
          <StatLine icon="sort-ascending" label="Avg Duration" value={formatMinSec(stats.avgDurationSecs)} isDark={isDark} />
          <StatLine icon="phone-missed" label="Longest Ring" value={`${stats.longestRing}s`} isDark={isDark} />
          <StatLine icon="phone-missed" label="Shortest Ring" value={`${stats.shortestRing}s`} isDark={isDark} />
        </View>

        {(stats.peakHour || stats.avgGapSecs !== null) && (
          <View style={[styles.statGrid, { borderTopColor: border }]}>
            {stats.peakHour && (
              <StatLine icon="clock-outline" label="Peak Hour" value={stats.peakHour.label} color="#2563EB" isDark={isDark} />
            )}
            {stats.avgGapSecs !== null && (
              <StatLine
                icon="arrow-down-thin"
                label="Avg Gap"
                value={formatMinSec(stats.avgGapSecs)}
                isDark={isDark}
                sub="(between 2 calls)"
              />
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// ── Per-user row ─────────────────────────────────────────────────
const UserStatRow = ({ stat, index, onOpen, isDark }) => {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const connectedRate =
    stat.totalCalls > 0 ? Math.round(((stat.connectedCalls || 0) / stat.totalCalls) * 100) : 0;

  return (
    <TouchableOpacity
      onPress={() => onOpen(stat)}
      style={[
        styles.userRow,
        { borderBottomColor: isDark ? '#334155' : '#f1f5f9' },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: color.bg }]}>
        <Text style={[styles.avatarText, { color: color.text }]}>
          {getInitials(stat.userName)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[styles.userName, { color: isDark ? '#F9FAFB' : '#1e293b' }]}
          numberOfLines={1}
        >
          {stat.userName}
        </Text>
        <Text style={styles.userSub} numberOfLines={1}>
          {formatLastCall(stat.lastCallAt)} · {formatTotalDuration(stat.talkTimeSecs)}
        </Text>
        <View style={styles.statsInline}>
          <Text style={[styles.statChip, { color: BRAND }]}>{stat.totalCalls || 0} total</Text>
          <Text style={[styles.statChip, { color: '#7C3AED' }]}>{stat.outgoingCalls || 0} out</Text>
          <Text style={[styles.statChip, { color: '#2563EB' }]}>{stat.incomingCalls || 0} in</Text>
          <Text style={[styles.statChip, { color: '#16A34A' }]}>{stat.connectedCalls || 0} conn</Text>
          <Text style={[styles.statChip, { color: '#7C3AED' }]}>{stat.recordedCalls || 0} rec</Text>
        </View>
      </View>
      <View style={styles.rateBadge}>
        <Text style={styles.rateText}>{connectedRate}%</Text>
      </View>
    </TouchableOpacity>
  );
};

// Only one recording plays at a time across all rows (mirrors web behaviour)
let currentlyPlayingSound = { stop: null };

// ── Single call log row (tap opens Lead preview; recording plays inline) ────
const CallLogRow = ({ callLog, isDark, onOpenLead }) => {
  const type = callLog.callDirection || callLog.callType || 'Outgoing';
  const meta = TYPE_META[type] || TYPE_META.Outgoing;
  const recordingUrl = getRecordingUrl(callLog.recordingUrl);
  const hasRecording = Boolean(callLog.recordingUploaded && recordingUrl);
  const leadId = callLog.lead?._id || callLog.leadId?._id || callLog.leadId || null;

  const [started, setStarted] = useState(false); // lazily mounts <Video> on first tap
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [positionSecs, setPositionSecs] = useState(0);
  const [totalSecs, setTotalSecs] = useState(0);
  const videoRef = useRef(null);
  const seekingRef = useRef(false);

  const stopThisRow = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    return () => {
      if (currentlyPlayingSound.stop === stopThisRow) currentlyPlayingSound.stop = null;
    };
  }, [stopThisRow]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (currentlyPlayingSound.stop) currentlyPlayingSound.stop();
    if (!started) setStarted(true);
    setPlaying(true);
    currentlyPlayingSound.stop = stopThisRow;
  };

  const onSlidingComplete = value => {
    seekingRef.current = false;
    setPositionSecs(value);
    videoRef.current?.seek(value);
  };

  const openDownload = () => {
    if (recordingUrl) Linking.openURL(recordingUrl).catch(() => {});
  };

const durationSecsCall = Number(callLog.duration || 0);
  let displayDuration = '0s';
  if (type === 'Missed' || type === 'No Answer') {
    const ringTime = callLog.ringDuration || 0;
    displayDuration = ringTime > 0 ? `Rang for ${ringTime}s` : '0s';
  } else {
    displayDuration =
      durationSecsCall > 0
        ? `${Math.floor(durationSecsCall / 60)}m ${durationSecsCall % 60}s`
        : '0s';
  }

  const displayTime = callLog.createdAt || callLog.updatedAt || callLog.callTimestamp;
  const trackColor = isDark ? '#334155' : '#e2e8f0';

  return (
    <View
      style={[
        styles.logCard,
        { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' },
      ]}
    >
      <TouchableOpacity
        activeOpacity={leadId ? 0.6 : 1}
        onPress={() => leadId && onOpenLead(leadId)}
        style={styles.logRowTop}
      >
        <View style={[styles.logIconBox, { backgroundColor: meta.bg }]}>
          <Icon name="phone" size={15} color={meta.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.logBadgeRow}>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.badgeText, { color: meta.color }]}>{type}</Text>
            </View>
            {hasRecording && (
              <View style={[styles.badge, { backgroundColor: '#ede9fe' }]}>
                <Text style={[styles.badgeText, { color: '#7C3AED' }]}>🎙 Recorded</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.logLeadName, { color: isDark ? '#F9FAFB' : '#1e293b' }]}
            numberOfLines={1}
          >
            {callLog.leadName || callLog.lead?.name || callLog.leadId?.name || 'Unknown Lead'}
          </Text>
          <Text style={styles.logSub}>📞 {cleanNumber(callLog.phoneNumber || callLog.phone)}</Text>
          <Text style={styles.logSub}>
            {displayDuration} · {formatDate(displayTime)}
          </Text>
        </View>
        {hasRecording && (
          <View style={styles.logRowActions}>
            <TouchableOpacity onPress={togglePlay} style={styles.playCircleBtn}>
              {started && playing && !loaded ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <Icon name={playing ? 'pause' : 'play'} size={15} color="#7C3AED" />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={openDownload} style={styles.downloadIconBtn}>
              <Icon name="download" size={15} color={isDark ? '#94A3B8' : '#64748b'} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {hasRecording ? (
        <View style={styles.audioControlsRow}>
          <Text style={[styles.seekTimeText, { color: isDark ? '#94A3B8' : '#94a3b8' }]}>
            {formatSeek(positionSecs)}
          </Text>
          <Slider
            style={styles.seekSlider}
            minimumValue={0}
            maximumValue={totalSecs > 0 ? totalSecs : 1}
            value={positionSecs}
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor={trackColor}
            thumbTintColor="#7C3AED"
            onSlidingStart={() => { seekingRef.current = true; }}
            onSlidingComplete={onSlidingComplete}
          />
          <Text style={[styles.seekTimeText, { color: isDark ? '#94A3B8' : '#94a3b8' }]}>
            {formatSeek(totalSecs || durationSecsCall)}
          </Text>
        </View>
      ) : (
        <Text style={styles.noRecText}>No recording for this call</Text>
      )}

      {started && (
        <Video
          ref={videoRef}
          source={{ uri: recordingUrl }}
          paused={!playing}
          audioOnly
          onLoad={data => {
            setLoaded(true);
            setTotalSecs(data.duration || 0);
          }}
          onProgress={data => {
            if (!seekingRef.current) setPositionSecs(data.currentTime || 0);
          }}
          onEnd={() => {
            setPlaying(false);
            setPositionSecs(0);
            videoRef.current?.seek(0);
            if (currentlyPlayingSound.stop === stopThisRow) currentlyPlayingSound.stop = null;
          }}
          onError={() => {
            setPlaying(false);
            Toast.show({ type: 'error', text1: 'Unable to play this recording.' });
          }}
          ignoreSilentSwitch="ignore"
          playInBackground={false}
          style={styles.hiddenVideo}
        />
      )}
    </View>
  );
};

// ── Lead preview drawer (bottom-sheet style modal) ──────────────────
const LeadPreviewDrawer = ({ visible, leadId, onClose, isDark }) => {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !leadId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLead(null);
      try {
        const fullLead = await leadsService.getLead(leadId);
        if (!cancelled) setLead(fullLead);
      } catch {
        if (!cancelled) Toast.show({ type: 'error', text1: 'Unable to load lead details.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, leadId]);

  const cardBg = isDark ? '#1E293B' : '#fff';
  const border = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#F9FAFB' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748b';

  const callLead = () => {
    const phone = lead?.phone || lead?.phoneNumber;
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.leadDrawerOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.leadDrawerSheet, { backgroundColor: cardBg }]}>
          <View style={styles.leadDrawerHandle} />
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={BRAND} />
            </View>
          ) : lead ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.leadDrawerHeaderRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.leadDrawerName, { color: textPrimary }]} numberOfLines={1}>
                    {lead.name || 'Unknown Lead'}
                  </Text>
                  <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                    {cleanNumber(lead.phone || lead.phoneNumber)}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Icon name="close" size={18} color={textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.leadInfoBox, { borderColor: border }]}>
                <View style={styles.leadInfoRow}>
                  <Text style={[styles.leadInfoLabel, { color: textSecondary }]}>Status</Text>
                  <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 13 }}>{lead.status || '—'}</Text>
                </View>
                <View style={styles.leadInfoRow}>
                  <Text style={[styles.leadInfoLabel, { color: textSecondary }]}>Source</Text>
                  <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 13 }}>{lead.source || '—'}</Text>
                </View>
                <View style={styles.leadInfoRow}>
                  <Text style={[styles.leadInfoLabel, { color: textSecondary }]}>Email</Text>
                  <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 13 }}>{lead.email || '—'}</Text>
                </View>
                <View style={styles.leadInfoRow}>
                  <Text style={[styles.leadInfoLabel, { color: textSecondary }]}>Assigned To</Text>
                  <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 13 }}>
                    {lead.assignedTo?.name || lead.assignedUser?.name || '—'}
                  </Text>
                </View>
                {lead.notes ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.leadInfoLabel, { color: textSecondary, marginBottom: 4 }]}>Notes</Text>
                    <Text style={{ color: textPrimary, fontSize: 13 }}>{lead.notes}</Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity style={styles.callLeadBtn} onPress={callLead}>
                <Icon name="phone" size={16} color="#fff" />
                <Text style={styles.callLeadBtnText}>Call Lead</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <Text style={{ textAlign: 'center', color: textSecondary, paddingVertical: 40 }}>
              Lead not found.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ── Main screen ──────────────────────────────────────────────────
const CallTracingScreen = () => {
  const { isDark } = useTheme();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterKey, setFilterKey] = useState('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('totalCalls');
  const [sortDir, setSortDir] = useState('desc');

  const [detailUser, setDetailUser] = useState(null);
  const [userLogs, setUserLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(LOG_PAGE_SIZE);

  // Calls / Summary toggle inside the drawer
  const [drawerView, setDrawerView] = useState('calls'); // 'calls' | 'summary'
  const [drawerPeriod, setDrawerPeriod] = useState('page'); // 'page' | 'today' | 'week' | 'month'

  // Lead preview drawer
  const [previewLeadId, setPreviewLeadId] = useState(null);
  const [leadDrawerVisible, setLeadDrawerVisible] = useState(false);

  // Excel export
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!detailUser) return;
    setExporting(true);
    try {
      await exportSummaryXLSX(detailUser.userName, userLogs);
    } finally {
      setExporting(false);
    }
  };

  const dateRange = useMemo(() => {
    if (filterKey === 'custom') {
      return customRange.start && customRange.end
        ? { startDate: customRange.start, endDate: customRange.end }
        : {};
    }
    return getDateRangeForFilter(filterKey);
  }, [filterKey, customRange]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCallStats(dateRange);
      setStats(data || []);
    } catch (error) {
      Toast.show({ type: 'error', text1: error?.response?.data?.message || 'Unable to load call stats' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const filteredStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q ? stats.filter(s => s.userName?.toLowerCase().includes(q)) : stats;
    result = [...result].sort((a, b) => {
      const diff = (a[sortBy] || 0) - (b[sortBy] || 0);
      return sortDir === 'asc' ? diff : -diff;
    });
    return result;
  }, [stats, search, sortBy, sortDir]);

  const totals = stats.reduce(
    (acc, s) => ({
      totalCalls: acc.totalCalls + (s.totalCalls || 0),
      connectedCalls: acc.connectedCalls + (s.connectedCalls || 0),
      notConnectedCalls: acc.notConnectedCalls + (s.notConnectedCalls || 0),
      recordedCalls: acc.recordedCalls + (s.recordedCalls || 0),
    }),
    { totalCalls: 0, connectedCalls: 0, notConnectedCalls: 0, recordedCalls: 0 },
  );

  const openUserDetail = stat => {
    setDetailUser(stat);
    setVisibleCount(LOG_PAGE_SIZE);
    setLogFilter('all');
    setDrawerView('calls');
    setDrawerPeriod('page');
  };

  const closeDetail = () => {
    setDetailUser(null);
    setUserLogs([]);
    setLogFilter('all');
    setDrawerView('calls');
    setDrawerPeriod('page');
  };

  // Refetch logs whenever the detail user or the drawer's own period changes
  useEffect(() => {
    if (!detailUser) return;
    let cancelled = false;
    const effectiveRange = drawerPeriod === 'page' ? dateRange : getDateRangeForFilter(drawerPeriod);
    (async () => {
      setLoadingLogs(true);
      try {
        const { logs } = await getAllCallLogs({ userId: detailUser.userId, ...effectiveRange });
        if (!cancelled) setUserLogs(logs);
      } catch (error) {
        if (!cancelled) Toast.show({ type: 'error', text1: error?.response?.data?.message || 'Unable to load calls' });
      } finally {
        if (!cancelled) setLoadingLogs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [detailUser, drawerPeriod, dateRange]);

  const getLogType = log => log.callDirection || log.callType;

  const filteredUserLogs = useMemo(() => {
    switch (logFilter) {
      case 'outgoing':
        return userLogs.filter(l => ['Outgoing', 'No Answer'].includes(getLogType(l)));
      case 'incoming':
        return userLogs.filter(l => ['Incoming', 'Missed', 'Rejected'].includes(getLogType(l)));
      case 'connected':
        return userLogs.filter(l => isConnectedType(getLogType(l)));
      case 'not-connected':
        return userLogs.filter(l => ['Missed', 'Rejected', 'No Answer'].includes(getLogType(l)));
      case 'recorded':
        return userLogs.filter(l => l.recordingUploaded && l.recordingUrl);
      default:
        return userLogs;
    }
  }, [userLogs, logFilter]);

  const logCounts = useMemo(() => {
    const counts = { outgoing: 0, incoming: 0, connected: 0, notConnected: 0, recorded: 0 };
    userLogs.forEach(log => {
      const type = getLogType(log);
      if (['Outgoing', 'No Answer'].includes(type)) counts.outgoing++;
      if (['Incoming', 'Missed', 'Rejected'].includes(type)) counts.incoming++;
      if (isConnectedType(type)) counts.connected++;
      if (['Missed', 'Rejected', 'No Answer'].includes(type)) counts.notConnected++;
      if (log.recordingUploaded && log.recordingUrl) counts.recorded++;
    });
    return counts;
  }, [userLogs]);

  const liveStats = useMemo(() => computeLogStats(userLogs), [userLogs]);

  const visibleUserLogs = useMemo(
    () => filteredUserLogs.slice(0, visibleCount),
    [filteredUserLogs, visibleCount],
  );
  const hasMoreLogs = visibleCount < filteredUserLogs.length;

  const handleLoadMore = () => {
    if (hasMoreLogs) {
      setVisibleCount(c => Math.min(c + LOG_PAGE_SIZE, filteredUserLogs.length));
    }
  };

  const handleLogFilterChange = key => {
    setLogFilter(key);
    setVisibleCount(LOG_PAGE_SIZE);
  };

  const openLeadPreview = leadId => {
    setPreviewLeadId(leadId);
    setLeadDrawerVisible(true);
  };
  const closeLeadPreview = () => {
    setLeadDrawerVisible(false);
    setPreviewLeadId(null);
  };

  const applyCustomRange = () => {
    setCustomRange({ start: toDateStr(tempStartDate), end: toDateStr(tempEndDate) });
    setFilterKey('custom');
    setCustomModalOpen(false);
  };

  const clearCustomRange = () => {
    setCustomRange({ start: '', end: '' });
    setTempStartDate(new Date());
    setTempEndDate(new Date());
    setFilterKey('today');
    setCustomModalOpen(false);
  };

  const onChangeStartDate = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setTempStartDate(selectedDate);
  };

  const onChangeEndDate = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setTempEndDate(selectedDate);
  };

  const bg = isDark ? '#0F172A' : '#F8FAFC';
  const cardBg = isDark ? '#1E293B' : '#fff';
  const border = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#F9FAFB' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748b';

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={styles.headerBlock}>
        <Text style={[styles.title, { color: textPrimary }]}>Call Tracing</Text>
        <Text style={[styles.subtitle, { color: textSecondary }]}>
          Track every call — who's calling, who's answering, what's on record.
        </Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryGrid}>
        <SummaryCard icon="phone" label="Total Calls" value={totals.totalCalls} color={BRAND} isDark={isDark} />
        <SummaryCard icon="check-circle" label="Connected" value={totals.connectedCalls} color="#16A34A" isDark={isDark} />
        <SummaryCard icon="close-circle" label="Not Connected" value={totals.notConnectedCalls} color="#DC2626" isDark={isDark} />
        <SummaryCard icon="microphone" label="Recorded" value={totals.recordedCalls} color="#7C3AED" isDark={isDark} />
      </View>

      {/* Quick date filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickFilterRow}
        contentContainerStyle={{ gap: 4, paddingHorizontal: 12 }}
      >
{['all', 'today', 'week', 'month', 'custom'].map(key => {
  const isCustomWithRange = key === 'custom' && customRange.start && customRange.end;
  return (
    <TouchableOpacity
      key={key}
      onPress={() => {
        if (key === 'custom') {
          setTempStartDate(customRange.start ? new Date(customRange.start) : new Date());
          setTempEndDate(customRange.end ? new Date(customRange.end) : new Date());
          setCustomModalOpen(true);
        } else {
          setFilterKey(key);
        }
      }}
      style={[
        styles.quickFilterChip,
        {
          backgroundColor: filterKey === key ? BRAND : cardBg,
          borderColor: filterKey === key ? BRAND : border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
      ]}
    >
      <Text style={{ color: filterKey === key ? '#fff' : textSecondary, fontSize: 12, fontWeight: '600' }}>
        {isCustomWithRange
          ? `${formatShortDate(customRange.start)} – ${formatShortDate(customRange.end)}`
          : key === 'custom' ? 'Custom' : key[0].toUpperCase() + key.slice(1)}
      </Text>
      {isCustomWithRange && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            clearCustomRange();
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Icon name="close" size={13} color={filterKey === key ? '#fff' : textSecondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
})}
      </ScrollView>

      {/* Search + sort */}
<View style={styles.searchRow}>
  <View style={[styles.searchBox, { backgroundColor: cardBg, borderColor: border }]}>
    <Icon name="magnify" size={16} color={textSecondary} />
    <TextInput
      value={search}
      onChangeText={setSearch}
      placeholder="Search by name..."
      placeholderTextColor={textSecondary}
      style={[styles.searchInput, { color: textPrimary }]}
    />
  </View>
  <TouchableOpacity
    onPress={fetchStats}
    disabled={loading}
    style={[styles.sortBtn, { backgroundColor: cardBg, borderColor: border }]}
  >
    <Icon name="refresh" size={16} color={textSecondary} />
  </TouchableOpacity>
  <TouchableOpacity
    onPress={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
    style={[styles.sortBtn, { backgroundColor: cardBg, borderColor: border }]}
  >
    <Icon name={sortDir === 'desc' ? 'sort-descending' : 'sort-ascending'} size={16} color={textSecondary} />
  </TouchableOpacity>
</View>
      <View style={styles.sortByRow}>
        {[
          { key: 'totalCalls', label: 'Total' },
          { key: 'connectedCalls', label: 'Connected' },
          { key: 'notConnectedCalls', label: 'Not Connected' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setSortBy(opt.key)}
            style={[
              styles.sortChip,
              { borderColor: sortBy === opt.key ? BRAND : border, backgroundColor: sortBy === opt.key ? '#e8ecfd' : 'transparent' },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: sortBy === opt.key ? BRAND : textSecondary }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={BRAND} />
        </View>
      ) : filteredStats.length === 0 ? (
        <View style={styles.centerFill}>
          <Icon name="phone-missed" size={28} color={textSecondary} />
          <Text style={{ color: textSecondary, fontSize: 13, marginTop: 8 }}>
            {stats.length === 0 ? 'No calls tracked for this period.' : 'No users match your search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStats}
          keyExtractor={item => item.userId || item.userName}
          renderItem={({ item, index }) => (
            <UserStatRow stat={item} index={index} onOpen={openUserDetail} isDark={isDark} />
          )}
          style={[styles.listCard, { backgroundColor: cardBg, borderColor: border }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND]} />}
        />
      )}

      {/* Custom date range modal */}
      <Modal visible={customModalOpen} transparent animationType="fade" onRequestClose={() => setCustomModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.customModalBox, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textPrimary }]}>Custom Date Range</Text>

            <Text style={[styles.modalLabel, { color: textSecondary }]}>Start Date</Text>
            <TouchableOpacity
              onPress={() => setShowStartPicker(true)}
              style={[styles.dateInput, styles.dateInputRow, { borderColor: border }]}
            >
              <Text style={{ color: textPrimary, fontSize: 13 }}>{toDateStr(tempStartDate)}</Text>
              <Icon name="calendar" size={16} color={textSecondary} />
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={tempStartDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={onChangeStartDate}
              />
            )}

            <Text style={[styles.modalLabel, { color: textSecondary }]}>End Date</Text>
            <TouchableOpacity
              onPress={() => setShowEndPicker(true)}
              style={[styles.dateInput, styles.dateInputRow, { borderColor: border }]}
            >
              <Text style={{ color: textPrimary, fontSize: 13 }}>{toDateStr(tempEndDate)}</Text>
              <Icon name="calendar" size={16} color={textSecondary} />
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={tempEndDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                minimumDate={tempStartDate}
                onChange={onChangeEndDate}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={clearCustomRange} style={styles.modalClearBtn}>
                <Text style={{ color: '#DC2626', fontWeight: '600' }}>Clear</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setCustomModalOpen(false)} style={styles.modalCancelBtn}>
                <Text style={{ color: textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyCustomRange} style={styles.modalApplyBtn}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Drill-down detail modal */}
      <Modal visible={!!detailUser} animationType="slide" onRequestClose={closeDetail}>
        <View style={[styles.detailScreen, { backgroundColor: bg }]}>
          <View style={[styles.detailHeader, { backgroundColor: cardBg, borderBottomColor: border }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.detailUserName, { color: textPrimary }]} numberOfLines={1}>
                {detailUser?.userName}
              </Text>
              <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                {liveStats.total} calls · {liveStats.connected} connected · {liveStats.notConnected} not connected
              </Text>
            </View>

            {/* Calls / Summary toggle */}
            <View style={[styles.viewToggle, { backgroundColor: isDark ? '#0F172A' : '#f1f5f9' }]}>
              <TouchableOpacity
                onPress={() => setDrawerView('calls')}
                style={[styles.viewToggleBtn, drawerView === 'calls' && { backgroundColor: cardBg }]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: drawerView === 'calls' ? textPrimary : textSecondary }}>
                  Calls
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDrawerView('summary')}
                style={[styles.viewToggleBtn, drawerView === 'summary' && { backgroundColor: cardBg }]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: drawerView === 'summary' ? textPrimary : textSecondary }}>
                  Summary
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={closeDetail} style={styles.closeBtn}>
              <Icon name="close" size={18} color={textPrimary} />
            </TouchableOpacity>
          </View>

          {drawerView === 'calls' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsScroll} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
              {FILTER_TABS.map(tab => {
                const active = logFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => handleLogFilterChange(tab.key)}
                    style={[
                      styles.filterTab,
                      { backgroundColor: active ? tab.color : tab.bg },
                    ]}
                  >
                    <Icon name={tab.icon} size={12} color={active ? '#fff' : tab.color} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#fff' : tab.color, marginLeft: 4 }}>
                      {tab.label} ({tab.key === 'all' ? userLogs.length : logCounts[
                        tab.key === 'not-connected' ? 'notConnected' : tab.key
                      ]})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {drawerView === 'summary' ? (
            <UserSummaryPanel
              userName={detailUser?.userName}
              stats={liveStats}
              isDark={isDark}
              drawerPeriod={drawerPeriod}
              onPeriodChange={setDrawerPeriod}
              onExport={handleExport}
              exporting={exporting}
            />
          ) : loadingLogs ? (
            <View style={styles.centerFill}>
              <ActivityIndicator size="large" color={BRAND} />
            </View>
          ) : (
            <FlatList
              data={visibleUserLogs}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <CallLogRow callLog={item} isDark={isDark} onOpenLead={openLeadPreview} />
              )}
              contentContainerStyle={{ padding: 14, gap: 10 }}
              onEndReachedThreshold={0.4}
              onEndReached={handleLoadMore}
              ListEmptyComponent={
                <Text style={{ color: textSecondary, textAlign: 'center', marginTop: 40, fontSize: 13 }}>
                  No calls in this period.
                </Text>
              }
              ListFooterComponent={
                hasMoreLogs ? <ActivityIndicator size="small" color={BRAND} style={{ marginVertical: 12 }} /> : null
              }
            />
          )}
        </View>
      </Modal>

      {/* Lead preview drawer */}
      <LeadPreviewDrawer
        visible={leadDrawerVisible}
        leadId={previewLeadId}
        onClose={closeLeadPreview}
        isDark={isDark}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 12 },
  headerBlock: { paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 10 },
  summaryCard: { flexBasis: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  summaryValue: { fontSize: 17, fontWeight: '700' },
  summaryLabel: { fontSize: 11, color: '#94a3b8' },
  quickFilterRow: { flexGrow: 0, marginBottom: 10 },
  quickFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 9 },
  sortBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  sortByRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginBottom: 10 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  listCard: { flex: 1, marginHorizontal: 12, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700' },
  userName: { fontSize: 14, fontWeight: '600' },
  userSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  statsInline: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  statChip: { fontSize: 10, fontWeight: '700' },
  rateBadge: { backgroundColor: '#16A34A1A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  rateText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  customModalBox: { borderRadius: 18, padding: 18 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalLabel: { fontSize: 11, marginBottom: 4, marginTop: 8 },
  dateInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13 },
  dateInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 18 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  modalClearBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  modalApplyBtn: { backgroundColor: BRAND, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  detailScreen: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  detailUserName: { fontSize: 16, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(148,163,184,0.15)', justifyContent: 'center', alignItems: 'center' },
  viewToggle: { flexDirection: 'row', borderRadius: 20, padding: 3, gap: 2 },
  viewToggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  filterTabsScroll: { flexGrow: 0, marginTop: 10, marginBottom: 4 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  logCard: { borderRadius: 14, borderWidth: 1, padding: 12 },
  logRowTop: { flexDirection: 'row', gap: 10 },
  logIconBox: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  logBadgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  logLeadName: { fontSize: 13, fontWeight: '600', marginTop: 5 },
  logSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  logRowActions: { flexDirection: 'row', alignItems: 'center', gap: 6, shrink: 0 },
  playCircleBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(124,58,237,0.12)', justifyContent: 'center', alignItems: 'center' },
  downloadIconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(148,163,184,0.15)', justifyContent: 'center', alignItems: 'center' },
  audioControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  seekTimeText: { fontSize: 10, fontVariant: ['tabular-nums'], width: 30, textAlign: 'center' },
  seekSlider: { flex: 1, height: 24 },
  hiddenVideo: { width: 0, height: 0 },
  noRecText: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  // Summary panel
  summaryPanelCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
  summaryPanelHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  summaryPanelTitle: { fontSize: 15, fontWeight: '700' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, shrink: 0 },
  periodPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  periodPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
  statLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, minWidth: '45%' },
  breakdownText: { fontSize: 11, borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  // Lead preview drawer
  leadDrawerOverlay: { flex: 1, justifyContent: 'flex-end' },
  leadDrawerSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, maxHeight: '85%' },
  leadDrawerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 14 },
  leadDrawerHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  leadDrawerName: { fontSize: 17, fontWeight: '700' },
  leadInfoBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  leadInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leadInfoLabel: { fontSize: 11, fontWeight: '600' },
  callLeadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 13, marginTop: 16 },
  callLeadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default CallTracingScreen;