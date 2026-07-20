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
import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../../components/ui/CustomToast';
import {
  getCallStats,
  getAllCallLogs,
  getRecordingUrl,
} from '../../services/callLogsService';
import { leadsService } from '../../services/leadsService';

// ─── UI Kit imports ────────────────────────────────────────────────────────
import PageHeader from '../../components/ui/PageHeader';
import ImprovedCard from '../../components/ui/ImprovedCard';
import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedTextInput from '../../components/ui/ImprovedTextInput';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import FilterChip from '../../components/ui/FilterChip';
import BottomSheet from '../../components/ui/BottomSheet';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import IconButton from '../../components/ui/IconButton';

const BRAND = '#5a7bf6';
const LOG_PAGE_SIZE = 20;

const pad = n => String(n).padStart(2, '0');
const toDateStr = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getDateRangeForFilter = key => {
  const now = new Date();
  if (key === 'today')
    return { startDate: toDateStr(now), endDate: toDateStr(now) };
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

const getInitials = (name = '') =>
  name
    .split(' ')
    .map(p => p[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

const TYPE_META = {
  Incoming: { color: '#16a34a', bg: '#dcfce7' },
  Outgoing: { color: '#2563eb', bg: '#dbeafe' },
  Missed: { color: '#dc2626', bg: '#fee2e2' },
  Rejected: { color: '#d97706', bg: '#fef3c7' },
  'No Answer': { color: '#64748b', bg: '#e2e8f0' },
};

const isConnectedType = type => type === 'Outgoing' || type === 'Incoming';

const FILTER_TABS = [
  { key: 'all', label: 'All', icon: 'phone', color: BRAND, bg: '#e8ecfd' },
  {
    key: 'outgoing',
    label: 'Outgoing',
    icon: 'phone-outgoing',
    color: '#7C3AED',
    bg: '#ede9fe',
  },
  {
    key: 'incoming',
    label: 'Incoming',
    icon: 'phone-incoming',
    color: '#2563EB',
    bg: '#dbeafe',
  },
  {
    key: 'connected',
    label: 'Connected',
    icon: 'check-circle',
    color: '#16A34A',
    bg: '#dcfce7',
  },
  {
    key: 'not-connected',
    label: 'Not Connected',
    icon: 'phone-missed',
    color: '#DC2626',
    bg: '#fee2e2',
  },
  {
    key: 'recorded',
    label: 'Recorded',
    icon: 'microphone',
    color: '#64748B',
    bg: '#f1f5f9',
  },
];

// ── Stats helpers ───────────────────────────────────────────────
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
  return {
    label: `${formatHour(peakHour)} – ${formatHour((peakHour + 1) % 24)}`,
    count: maxCount,
  };
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
  for (let i = 1; i < timestamps.length; i++)
    totalGapSecs += (timestamps[i] - timestamps[i - 1]) / 1000;
  return totalGapSecs / (timestamps.length - 1);
};

const computeLogStats = (logs = []) => {
  const total = logs.length;
  let connected = 0,
    missed = 0,
    noAnswer = 0,
    rejected = 0,
    recorded = 0;
  let talkTimeSecs = 0,
    longestRing = 0,
    shortestRing = null;
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
      if (ring > 0 && (shortestRing === null || ring < shortestRing))
        shortestRing = ring;
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
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
};

// ── Excel export ───────────────────────────────────────────────────
const exportSummaryXLSX = async (userName, logs = [], toast) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Call Summary', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = [
      { header: 'Call #', key: 'callNo', width: 8 },
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
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF5A7BF6' },
      };
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
      const name =
        log.leadName || log.lead?.name || log.leadId?.name || 'Unknown Lead';
      const phone = cleanNumber(log.phoneNumber || log.phone);
      const durationSecs = Number(log.duration || 0);
      const isConnected = isConnectedType(type);
      const duration = isConnected ? formatMinSec(durationSecs) : 'N/A';
      const ringTime = !isConnected ? `${log.ringDuration || 0}s` : 'N/A';
      const recorded = log.recordingUploaded && log.recordingUrl ? 'Yes' : 'No';
      const ts = log.createdAt || log.updatedAt || log.callTimestamp;
      const rawSummary = log.aiAnalysis?.summary || '';
      const summary =
        rawSummary.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim() ||
        'No summary available';
      const row = sheet.addRow({
        callNo: idx + 1,
        name,
        phone,
        type,
        duration,
        ringTime,
        recorded,
        callTime: formatDate(ts),
        summary,
      });
      row.getCell('phone').numFmt = '@';
      const charsPerLine = 55;
      const estimatedLines = Math.max(
        1,
        Math.ceil(summary.length / charsPerLine),
      );
      row.height = Math.max(20, estimatedLines * 14);
      const isEvenRow = idx % 2 === 1;
      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          wrapText: true,
          vertical: 'middle',
          horizontal: colNumber === 1 ? 'center' : 'left',
        };
        if (colNumber !== 9)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEvenRow ? 'FFF8FAFC' : 'FFFFFFFF' },
          };
        cell.font = { size: 10.5, color: { argb: 'FF1E293B' } };
      });
      const typeCell = row.getCell('type');
      typeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: TYPE_COLORS[type] || 'FFF1F5F9' },
      };
      typeCell.alignment = { vertical: 'middle', horizontal: 'center' };
      typeCell.font = { size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
      const recCell = row.getCell('recorded');
      recCell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (recorded === 'Yes')
        recCell.font = { size: 10.5, bold: true, color: { argb: 'FF16A34A' } };
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
    if (err?.message !== 'User did not share' && toast)
      toast.error('Export failed. Please try again.');
  }
};

// ── Summary card (refactored with UI Kit) ────────────────────────
const SummaryCard = ({ icon, label, value, color }) => {
  const { colors, borderRadius } = useUISystem();
  return (
    <ImprovedCard
      variant="outline"
      padding="medium"
      style={{ flexBasis: '47%', flexGrow: 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={[
            styles.summaryIconBox,
            { backgroundColor: color + '1A', borderRadius: borderRadius.lg },
          ]}
        >
          <Icon name={icon} size={18} color={color} />
        </View>
        <View style={{ minWidth: 0 }}>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
            {value}
          </Text>
          <Text style={styles.summaryLabel}>{label}</Text>
        </View>
      </View>
    </ImprovedCard>
  );
};

// ── Stat row (refactored) ─────────────────────────────────────────
const StatLine = ({ icon, label, value, color, sub }) => {
  const { colors } = useUISystem();
  return (
    <View style={styles.statLine}>
      <Icon name={icon} size={14} color={color || colors.textTertiary} />
      <View style={{ minWidth: 0 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          {label}:{' '}
          <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
            {value}
          </Text>
        </Text>
        {sub ? (
          <Text style={{ fontSize: 10, color: colors.textTertiary }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

// ── User Summary Panel (refactored) ───────────────────────────────
const UserSummaryPanel = ({
  userName,
  stats,
  drawerPeriod,
  onPeriodChange,
  onExport,
  exporting,
}) => {
  const { colors, borderRadius } = useUISystem();
  const periods = [
    { key: 'page', label: 'Current Filter' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <ImprovedCard variant="outline" padding="large">
        <View style={styles.summaryPanelHeaderRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.summaryPanelTitle, { color: colors.textPrimary }]}
            >
              {userName} — Summary
            </Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>
              For the selected period
            </Text>
          </View>
          <ImprovedButton
            title="Export"
            icon="download"
            size="small"
            variant="outline"
            onPress={() => onExport?.()}
            loading={exporting}
          />
        </View>

        <View style={styles.periodPillRow}>
          {periods.map(p => {
            const active = drawerPeriod === p.key;
            return (
              <FilterChip
                key={p.key}
                label={p.label}
                active={active}
                onPress={() => onPeriodChange(p.key)}
              />
            );
          })}
        </View>

        <View style={[styles.statGrid, { borderTopColor: colors.border }]}>
          <StatLine
            icon="phone"
            label="Total"
            value={stats.total}
            color={BRAND}
          />
          <StatLine
            icon="check-circle"
            label="Connected"
            value={`${stats.connected} (${stats.connectedPct}%)`}
            color="#16A34A"
          />
          <StatLine
            icon="close-circle"
            label="Not Connected"
            value={`${stats.notConnected} (${stats.notConnectedPct}%)`}
            color="#DC2626"
          />
          <StatLine
            icon="microphone"
            label="Recorded"
            value={stats.recorded}
            color="#7C3AED"
          />
        </View>

        <Text
          style={[
            styles.breakdownText,
            { borderTopColor: colors.border, color: colors.textTertiary },
          ]}
        >
          No Answer:{' '}
          <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
            {stats.noAnswer}
          </Text>{' '}
          · Missed:{' '}
          <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
            {stats.missed}
          </Text>{' '}
          · Rejected:{' '}
          <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
            {stats.rejected}
          </Text>
        </Text>

        <View style={[styles.statGrid, { borderTopColor: colors.border }]}>
          <StatLine
            icon="clock-outline"
            label="Talk Time"
            value={formatMinSec(stats.talkTimeSecs)}
          />
          <StatLine
            icon="sort-ascending"
            label="Avg Duration"
            value={formatMinSec(stats.avgDurationSecs)}
          />
          <StatLine
            icon="phone-missed"
            label="Longest Ring"
            value={`${stats.longestRing}s`}
          />
          <StatLine
            icon="phone-missed"
            label="Shortest Ring"
            value={`${stats.shortestRing}s`}
          />
        </View>

        {(stats.peakHour || stats.avgGapSecs !== null) && (
          <View style={[styles.statGrid, { borderTopColor: colors.border }]}>
            {stats.peakHour && (
              <StatLine
                icon="clock-outline"
                label="Peak Hour"
                value={stats.peakHour.label}
                color="#2563EB"
              />
            )}
            {stats.avgGapSecs !== null && (
              <StatLine
                icon="arrow-down-thin"
                label="Avg Gap"
                value={formatMinSec(stats.avgGapSecs)}
                sub="(between 2 calls)"
              />
            )}
          </View>
        )}
      </ImprovedCard>
    </ScrollView>
  );
};

// ── Per-user row (refactored with Avatar) ─────────────────────────
const UserStatRow = ({ stat, index, onOpen }) => {
  const { colors, borderRadius } = useUISystem();
  const connectedRate =
    stat.totalCalls > 0
      ? Math.round(((stat.connectedCalls || 0) / stat.totalCalls) * 100)
      : 0;

  return (
    <TouchableOpacity
      onPress={() => onOpen(stat)}
      style={[styles.userRow, { borderBottomColor: colors.border }]}
    >
      <Avatar name={stat.userName} size={38} rounded={19} variant="solid" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[styles.userName, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {stat.userName}
        </Text>
        <Text style={styles.userSub} numberOfLines={1}>
          {formatLastCall(stat.lastCallAt)} ·{' '}
          {formatTotalDuration(stat.talkTimeSecs)}
        </Text>
        <View style={styles.statsInline}>
          <Text style={[styles.statChip, { color: BRAND }]}>
            {stat.totalCalls || 0} total
          </Text>
          <Text style={[styles.statChip, { color: '#7C3AED' }]}>
            {stat.outgoingCalls || 0} out
          </Text>
          <Text style={[styles.statChip, { color: '#2563EB' }]}>
            {stat.incomingCalls || 0} in
          </Text>
          <Text style={[styles.statChip, { color: '#16A34A' }]}>
            {stat.connectedCalls || 0} conn
          </Text>
          <Text style={[styles.statChip, { color: '#7C3AED' }]}>
            {stat.recordedCalls || 0} rec
          </Text>
        </View>
      </View>
      <View style={[styles.rateBadge, { borderRadius: borderRadius.full }]}>
        <Text style={styles.rateText}>{connectedRate}%</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Single call log row ───────────────────────────────────────────
let currentlyPlayingSound = { stop: null };

const CallLogRow = ({ callLog, onOpenLead }) => {
  const { colors, borderRadius } = useUISystem();
  const toast = useKitToast();
  const type = callLog.callDirection || callLog.callType || 'Outgoing';
  const meta = TYPE_META[type] || TYPE_META.Outgoing;
  const recordingUrl = getRecordingUrl(callLog.recordingUrl);
  const hasRecording = Boolean(callLog.recordingUploaded && recordingUrl);
  const leadId =
    callLog.lead?._id || callLog.leadId?._id || callLog.leadId || null;

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [positionSecs, setPositionSecs] = useState(0);
  const [totalSecs, setTotalSecs] = useState(0);
  const videoRef = useRef(null);
  const seekingRef = useRef(false);

  const stopThisRow = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    return () => {
      if (currentlyPlayingSound.stop === stopThisRow)
        currentlyPlayingSound.stop = null;
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

  const displayTime =
    callLog.createdAt || callLog.updatedAt || callLog.callTimestamp;
  const trackColor = colors.border;

  return (
    <ImprovedCard variant="outline" padding="medium">
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
              <Text style={[styles.badgeText, { color: meta.color }]}>
                {type}
              </Text>
            </View>
            {hasRecording && (
              <View style={[styles.badge, { backgroundColor: '#ede9fe' }]}>
                <Text style={[styles.badgeText, { color: '#7C3AED' }]}>
                  🎙 Recorded
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.logLeadName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {callLog.leadName ||
              callLog.lead?.name ||
              callLog.leadId?.name ||
              'Unknown Lead'}
          </Text>
          <Text style={styles.logSub}>
            📞 {cleanNumber(callLog.phoneNumber || callLog.phone)}
          </Text>
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
                <Icon
                  name={playing ? 'pause' : 'play'}
                  size={15}
                  color="#7C3AED"
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openDownload}
              style={styles.downloadIconBtn}
            >
              <Icon name="download" size={15} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {hasRecording ? (
        <View style={styles.audioControlsRow}>
          <Text style={[styles.seekTimeText, { color: colors.textTertiary }]}>
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
            onSlidingStart={() => {
              seekingRef.current = true;
            }}
            onSlidingComplete={onSlidingComplete}
          />
          <Text style={[styles.seekTimeText, { color: colors.textTertiary }]}>
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
            if (currentlyPlayingSound.stop === stopThisRow)
              currentlyPlayingSound.stop = null;
          }}
          onError={() => {
            setPlaying(false);
            toast.error('Unable to play this recording.');
          }}
          ignoreSilentSwitch="ignore"
          playInBackground={false}
          style={styles.hiddenVideo}
        />
      )}
    </ImprovedCard>
  );
};

// ── Lead preview drawer (refactored with BottomSheet) ─────────────
const LeadPreviewDrawer = ({ visible, leadId, onClose }) => {
  const { colors, typography, borderRadius } = useUISystem();
  const toast = useKitToast();
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
        if (!cancelled) toast.error('Unable to load lead details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, leadId]);

  const callLead = () => {
    const phone = lead?.phone || lead?.phoneNumber;
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={lead?.name || 'Lead Details'}
      maxHeight="85%"
    >
      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : lead ? (
        <View>
          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: 4,
            }}
          >
            📞 {cleanNumber(lead.phone || lead.phoneNumber)}
          </Text>

          <ImprovedCard
            variant="outline"
            padding="medium"
            style={{ marginBottom: 12 }}
          >
            <View style={styles.leadInfoRow}>
              <Text
                style={[styles.leadInfoLabel, { color: colors.textTertiary }]}
              >
                Status
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                {lead.status || '—'}
              </Text>
            </View>
            <View style={styles.leadInfoRow}>
              <Text
                style={[styles.leadInfoLabel, { color: colors.textTertiary }]}
              >
                Source
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                {lead.source || '—'}
              </Text>
            </View>
            <View style={styles.leadInfoRow}>
              <Text
                style={[styles.leadInfoLabel, { color: colors.textTertiary }]}
              >
                Email
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                {lead.email || '—'}
              </Text>
            </View>
            <View style={styles.leadInfoRow}>
              <Text
                style={[styles.leadInfoLabel, { color: colors.textTertiary }]}
              >
                Assigned To
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                {lead.assignedTo?.name || lead.assignedUser?.name || '—'}
              </Text>
            </View>
            {lead.notes ? (
              <View style={{ marginTop: 8 }}>
                <Text
                  style={[
                    styles.leadInfoLabel,
                    { color: colors.textTertiary, marginBottom: 4 },
                  ]}
                >
                  Notes
                </Text>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                  {lead.notes}
                </Text>
              </View>
            ) : null}
          </ImprovedCard>

          <ImprovedButton
            title="Call Lead"
            icon="phone"
            variant="primary"
            onPress={callLead}
            fullWidth
            style={{ marginTop: 8 }}
          />
        </View>
      ) : (
        <EmptyState icon="account-off" title="Lead not found" />
      )}
    </BottomSheet>
  );
};

// ── Main screen ──────────────────────────────────────────────────
const CallTracingScreen = () => {
  const { colors, typography, borderRadius } = useUISystem();
  const toast = useKitToast();
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

  const [drawerView, setDrawerView] = useState('calls');
  const [drawerPeriod, setDrawerPeriod] = useState('page');

  const [previewLeadId, setPreviewLeadId] = useState(null);
  const [leadDrawerVisible, setLeadDrawerVisible] = useState(false);

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!detailUser) return;
    setExporting(true);
    try {
      await exportSummaryXLSX(detailUser.userName, userLogs, toast);
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
      toast.error(
        error?.response?.data?.message || 'Unable to load call stats',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const filteredStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? stats.filter(s => s.userName?.toLowerCase().includes(q))
      : stats;
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
    {
      totalCalls: 0,
      connectedCalls: 0,
      notConnectedCalls: 0,
      recordedCalls: 0,
    },
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

  useEffect(() => {
    if (!detailUser) return;
    let cancelled = false;
    const effectiveRange =
      drawerPeriod === 'page' ? dateRange : getDateRangeForFilter(drawerPeriod);
    (async () => {
      setLoadingLogs(true);
      try {
        const { logs } = await getAllCallLogs({
          userId: detailUser.userId,
          ...effectiveRange,
        });
        if (!cancelled) setUserLogs(logs);
      } catch (error) {
        if (!cancelled)
          toast.error(error?.response?.data?.message || 'Unable to load calls');
      } finally {
        if (!cancelled) setLoadingLogs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailUser, drawerPeriod, dateRange]);

  const getLogType = log => log.callDirection || log.callType;

  const filteredUserLogs = useMemo(() => {
    switch (logFilter) {
      case 'outgoing':
        return userLogs.filter(l =>
          ['Outgoing', 'No Answer'].includes(getLogType(l)),
        );
      case 'incoming':
        return userLogs.filter(l =>
          ['Incoming', 'Missed', 'Rejected'].includes(getLogType(l)),
        );
      case 'connected':
        return userLogs.filter(l => isConnectedType(getLogType(l)));
      case 'not-connected':
        return userLogs.filter(l =>
          ['Missed', 'Rejected', 'No Answer'].includes(getLogType(l)),
        );
      case 'recorded':
        return userLogs.filter(l => l.recordingUploaded && l.recordingUrl);
      default:
        return userLogs;
    }
  }, [userLogs, logFilter]);

  const logCounts = useMemo(() => {
    const counts = {
      outgoing: 0,
      incoming: 0,
      connected: 0,
      notConnected: 0,
      recorded: 0,
    };
    userLogs.forEach(log => {
      const type = getLogType(log);
      if (['Outgoing', 'No Answer'].includes(type)) counts.outgoing++;
      if (['Incoming', 'Missed', 'Rejected'].includes(type)) counts.incoming++;
      if (isConnectedType(type)) counts.connected++;
      if (['Missed', 'Rejected', 'No Answer'].includes(type))
        counts.notConnected++;
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
    if (hasMoreLogs)
      setVisibleCount(c =>
        Math.min(c + LOG_PAGE_SIZE, filteredUserLogs.length),
      );
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
    setCustomRange({
      start: toDateStr(tempStartDate),
      end: toDateStr(tempEndDate),
    });
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

  const quickFilters = ['all', 'today', 'week', 'month', 'custom'];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.headerBlock}>
        <PageHeader
          title="Call Tracing"
          subtitle="Track every call — who's calling, who's answering, what's on record."
        />
      </View>

      {/* Summary */}
      <View style={styles.summaryGrid}>
        <SummaryCard
          icon="phone"
          label="Total Calls"
          value={totals.totalCalls}
          color={BRAND}
        />
        <SummaryCard
          icon="check-circle"
          label="Connected"
          value={totals.connectedCalls}
          color="#16A34A"
        />
        <SummaryCard
          icon="close-circle"
          label="Not Connected"
          value={totals.notConnectedCalls}
          color="#DC2626"
        />
        <SummaryCard
          icon="microphone"
          label="Recorded"
          value={totals.recordedCalls}
          color="#7C3AED"
        />
      </View>

      {/* Quick date filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickFilterRow}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}
      >
        {quickFilters.map(key => {
          const isCustomWithRange =
            key === 'custom' && customRange.start && customRange.end;
          const active =
            filterKey === key && !(key === 'custom' && !isCustomWithRange);
          const label = isCustomWithRange
            ? `${formatShortDate(customRange.start)} – ${formatShortDate(
                customRange.end,
              )}`
            : key === 'custom'
            ? 'Custom'
            : key[0].toUpperCase() + key.slice(1);
          return (
            <FilterChip
              key={key}
              label={label}
              active={active || isCustomWithRange}
              onPress={() => {
                if (key === 'custom') {
                  setTempStartDate(
                    customRange.start
                      ? new Date(customRange.start)
                      : new Date(),
                  );
                  setTempEndDate(
                    customRange.end ? new Date(customRange.end) : new Date(),
                  );
                  setCustomModalOpen(true);
                } else {
                  setFilterKey(key);
                }
              }}
            />
          );
        })}
      </ScrollView>

      {/* Search + sort */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Icon name="magnify" size={16} color={colors.textTertiary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name..."
            placeholderTextColor={colors.placeholder}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>
        <IconButton
          name="refresh"
          size={16}
          onPress={fetchStats}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.lg,
            width: 38,
            height: 38,
          }}
        />
        <IconButton
          name={sortDir === 'desc' ? 'sort-descending' : 'sort-ascending'}
          size={16}
          onPress={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.lg,
            width: 38,
            height: 38,
          }}
        />
      </View>

      <View style={styles.sortByRow}>
        {[
          { key: 'totalCalls', label: 'Total' },
          { key: 'connectedCalls', label: 'Connected' },
          { key: 'notConnectedCalls', label: 'Not Connected' },
        ].map(opt => (
          <FilterChip
            key={opt.key}
            label={opt.label}
            active={sortBy === opt.key}
            onPress={() => setSortBy(opt.key)}
          />
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredStats.length === 0 ? (
        <EmptyState
          icon="phone-missed"
          title={
            stats.length === 0
              ? 'No calls tracked for this period.'
              : 'No users match your search.'
          }
        />
      ) : (
        <FlatList
          data={filteredStats}
          keyExtractor={item => item.userId || item.userName}
          renderItem={({ item, index }) => (
            <UserStatRow stat={item} index={index} onOpen={openUserDetail} />
          )}
          style={[
            styles.listCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius['2xl'],
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[BRAND]}
            />
          }
        />
      )}

      {/* Custom date range modal */}
      <Modal
        visible={customModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ImprovedCard
            variant="elevated"
            padding="large"
            style={{ width: '100%' }}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Custom Date Range
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textTertiary }]}>
              Start Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowStartPicker(true)}
              style={[styles.dateInput, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                {toDateStr(tempStartDate)}
              </Text>
              <Icon name="calendar" size={16} color={colors.textTertiary} />
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

            <Text style={[styles.modalLabel, { color: colors.textTertiary }]}>
              End Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowEndPicker(true)}
              style={[styles.dateInput, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                {toDateStr(tempEndDate)}
              </Text>
              <Icon name="calendar" size={16} color={colors.textTertiary} />
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
              <ImprovedButton
                title="Clear"
                variant="ghost"
                size="small"
                onPress={clearCustomRange}
                style={{ marginRight: 'auto' }}
              />
              <ImprovedButton
                title="Cancel"
                variant="outline"
                size="small"
                onPress={() => setCustomModalOpen(false)}
              />
              <ImprovedButton
                title="Apply"
                variant="primary"
                size="small"
                onPress={applyCustomRange}
              />
            </View>
          </ImprovedCard>
        </View>
      </Modal>

      {/* Drill-down detail modal */}
      <Modal
        visible={!!detailUser}
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <View
          style={[styles.detailScreen, { backgroundColor: colors.background }]}
        >
          <View
            style={[
              styles.detailHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.detailUserName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {detailUser?.userName}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
              >
                {liveStats.total} calls · {liveStats.connected} connected ·{' '}
                {liveStats.notConnected} not connected
              </Text>
            </View>

            <View
              style={[
                styles.viewToggle,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setDrawerView('calls')}
                style={[
                  styles.viewToggleBtn,
                  drawerView === 'calls' && {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color:
                      drawerView === 'calls'
                        ? colors.textPrimary
                        : colors.textTertiary,
                  }}
                >
                  Calls
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDrawerView('summary')}
                style={[
                  styles.viewToggleBtn,
                  drawerView === 'summary' && {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color:
                      drawerView === 'summary'
                        ? colors.textPrimary
                        : colors.textTertiary,
                  }}
                >
                  Summary
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={closeDetail} style={styles.closeBtn}>
              <Icon name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {drawerView === 'calls' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterTabsScroll}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
            >
              {FILTER_TABS.map(tab => {
                const active = logFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => handleLogFilterChange(tab.key)}
                    style={[
                      styles.filterTab,
                      {
                        backgroundColor: active ? tab.color : tab.bg,
                        borderRadius: borderRadius.full,
                      },
                    ]}
                  >
                    <Icon
                      name={tab.icon}
                      size={12}
                      color={active ? '#fff' : tab.color}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: active ? '#fff' : tab.color,
                        marginLeft: 4,
                      }}
                    >
                      {tab.label} (
                      {tab.key === 'all'
                        ? userLogs.length
                        : logCounts[
                            tab.key === 'not-connected'
                              ? 'notConnected'
                              : tab.key
                          ]}
                      )
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
              drawerPeriod={drawerPeriod}
              onPeriodChange={setDrawerPeriod}
              onExport={handleExport}
              exporting={exporting}
            />
          ) : loadingLogs ? (
            <View style={styles.centerFill}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={visibleUserLogs}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <CallLogRow callLog={item} onOpenLead={openLeadPreview} />
              )}
              contentContainerStyle={{ padding: 14, gap: 10 }}
              onEndReachedThreshold={0.4}
              onEndReached={handleLoadMore}
              ListEmptyComponent={
                <EmptyState icon="phone-off" title="No calls in this period." />
              }
              ListFooterComponent={
                hasMoreLogs ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ marginVertical: 12 }}
                  />
                ) : null
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 12 },
  headerBlock: { paddingHorizontal: 16, marginBottom: 10 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 10,
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryValue: { fontSize: 17, fontWeight: '700' },
  summaryLabel: { fontSize: 11, color: '#94a3b8' },
  quickFilterRow: { flexGrow: 0, marginBottom: 10 },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 9 },
  sortByRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  listCard: { flex: 1, marginHorizontal: 12, borderWidth: 1, marginBottom: 12 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userName: { fontSize: 14, fontWeight: '600' },
  userSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  statsInline: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  statChip: { fontSize: 10, fontWeight: '700' },
  rateBadge: {
    backgroundColor: '#16A34A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rateText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalLabel: { fontSize: 11, marginBottom: 4, marginTop: 8 },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 18,
  },
  detailScreen: { flex: 1 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  detailUserName: { fontSize: 16, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggle: { flexDirection: 'row', padding: 3, gap: 2 },
  viewToggleBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  filterTabsScroll: { flexGrow: 0, marginTop: 10, marginBottom: 4 },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logRowTop: { flexDirection: 'row', gap: 10 },
  logIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logBadgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  logLeadName: { fontSize: 13, fontWeight: '600', marginTop: 5 },
  logSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  logRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shrink: 0,
  },
  playCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(124,58,237,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(148,163,184,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  seekTimeText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    width: 30,
    textAlign: 'center',
  },
  seekSlider: { flex: 1, height: 24 },
  hiddenVideo: { width: 0, height: 0 },
  noRecText: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  summaryPanelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  summaryPanelTitle: { fontSize: 15, fontWeight: '700' },
  periodPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    minWidth: '45%',
  },
  breakdownText: {
    fontSize: 11,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  leadInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadInfoLabel: { fontSize: 11, fontWeight: '600' },
});

export default CallTracingScreen;
