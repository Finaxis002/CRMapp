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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getCallStats,
  getAllCallLogs,
  getRecordingUrl,
} from '../../services/callLogsService';

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
};

const FILTER_TABS = [
  { key: 'all', label: 'All', icon: 'phone', color: BRAND, bg: '#e8ecfd' },
  { key: 'missed', label: 'Missed', icon: 'phone-missed', color: '#DC2626', bg: '#fee2e2' },
  { key: 'outgoing', label: 'Outgoing', icon: 'phone-outgoing', color: '#2563EB', bg: '#dbeafe' },
  { key: 'incoming', label: 'Incoming', icon: 'phone-incoming', color: '#16A34A', bg: '#dcfce7' },
  { key: 'recorded', label: 'Recorded', icon: 'microphone', color: '#7C3AED', bg: '#ede9fe' },
  { key: 'not-recorded', label: 'No Recording', icon: 'microphone-off', color: '#64748B', bg: '#f1f5f9' },
];

// ── Summary card ────────────────────────────────────────────────
const SummaryCard = ({ icon, label, value, color, isDark }) => (
  <View
    style={[
      styles.summaryCard,
      { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' },
    ]}
  >
    <View style={[styles.summaryIconBox, { backgroundColor: `${color}1A` }]}>
      <Icon2 name={icon} size={18} color={color} />
    </View>
    <View style={{ minWidth: 0 }}>
      <Text style={[styles.summaryValue, { color: isDark ? '#F9FAFB' : '#0f172a' }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  </View>
);
const Icon2 = Icon;

// ── Per-user row ─────────────────────────────────────────────────
const UserStatRow = ({ stat, index, onOpen, isDark }) => {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const answerRate =
    stat.totalCalls > 0 ? Math.round((stat.answered / stat.totalCalls) * 100) : 0;

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
          {formatLastCall(stat.lastCallAt)} · {formatTotalDuration(stat.totalDurationSecs)}
        </Text>
        <View style={styles.statsInline}>
          <Text style={[styles.statChip, { color: BRAND }]}>{stat.totalCalls} total</Text>
          <Text style={[styles.statChip, { color: '#16A34A' }]}>{stat.answered} ans</Text>
          <Text style={[styles.statChip, { color: '#DC2626' }]}>{stat.notAnswered} miss</Text>
          <Text style={[styles.statChip, { color: '#7C3AED' }]}>{stat.recordedCalls} rec</Text>
        </View>
      </View>
      <View style={styles.rateBadge}>
        <Text style={styles.rateText}>{answerRate}%</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Single call log row ─────────────────────────────────────────
const CallLogRow = ({ callLog, isDark }) => {
  const type = callLog.callDirection || callLog.callType || 'Outgoing';
  const meta = TYPE_META[type] || TYPE_META.Outgoing;
  const recordingUrl = getRecordingUrl(callLog.recordingUrl);
  const hasRecording = Boolean(callLog.recordingUploaded && recordingUrl);

  const durationSecs = Number(callLog.duration || 0);
  const displayDuration =
    durationSecs > 0
      ? `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`
      : '0s';

  const displayTime = callLog.createdAt || callLog.updatedAt || callLog.callTimestamp;

  const openRecording = () => {
    if (recordingUrl) Linking.openURL(recordingUrl).catch(() => {});
  };

  return (
    <View
      style={[
        styles.logCard,
        { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' },
      ]}
    >
      <View style={styles.logRowTop}>
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
      </View>

      {hasRecording ? (
        <TouchableOpacity style={styles.playBtn} onPress={openRecording}>
          <Icon name="play-circle" size={16} color={BRAND} />
          <Text style={styles.playBtnText}>Play Recording</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noRecText}>No recording for this call</Text>
      )}
    </View>
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
      console.log('📞 CALL STATS dateRange:', JSON.stringify(dateRange));
try {
  const data = await getCallStats(dateRange);
  console.log('📞 CALL STATS response:', JSON.stringify(data));
  setStats(data || []);
} catch (err) {
  console.log('📞 CALL STATS ERROR:', err?.response?.status, JSON.stringify(err?.response?.data || err.message));
  throw err;
}
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
      totalCalls: acc.totalCalls + s.totalCalls,
      answered: acc.answered + s.answered,
      notAnswered: acc.notAnswered + s.notAnswered,
      recorded: acc.recorded + s.recordedCalls,
    }),
    { totalCalls: 0, answered: 0, notAnswered: 0, recorded: 0 },
  );

  const openUserDetail = async stat => {
    setDetailUser(stat);
    setVisibleCount(LOG_PAGE_SIZE);
    setLogFilter('all');
    setLoadingLogs(true);
    try {
      const { logs } = await getAllCallLogs({ userId: stat.userId, ...dateRange });
      setUserLogs(logs);
    } catch (error) {
      Toast.show({ type: 'error', text1: error?.response?.data?.message || 'Unable to load calls' });
    } finally {
      setLoadingLogs(false);
    }
  };

  const closeDetail = () => {
    setDetailUser(null);
    setUserLogs([]);
    setLogFilter('all');
  };

  const filteredUserLogs = useMemo(() => {
    switch (logFilter) {
      case 'missed':
        return userLogs.filter(l => (l.callDirection || l.callType) === 'Missed');
      case 'outgoing':
        return userLogs.filter(l => (l.callDirection || l.callType) === 'Outgoing');
      case 'incoming':
        return userLogs.filter(l => (l.callDirection || l.callType) === 'Incoming');
      case 'recorded':
        return userLogs.filter(l => l.recordingUploaded && l.recordingUrl);
      case 'not-recorded':
        return userLogs.filter(l => !(l.recordingUploaded && l.recordingUrl));
      default:
        return userLogs;
    }
  }, [userLogs, logFilter]);

  const logCounts = useMemo(() => {
    const counts = { missed: 0, outgoing: 0, incoming: 0, recorded: 0, notRecorded: 0 };
    userLogs.forEach(log => {
      const type = log.callDirection || log.callType;
      if (type === 'Missed') counts.missed++;
      if (type === 'Outgoing') counts.outgoing++;
      if (type === 'Incoming') counts.incoming++;
      if (log.recordingUploaded && log.recordingUrl) counts.recorded++;
      else counts.notRecorded++;
    });
    return counts;
  }, [userLogs]);

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
        <SummaryCard icon="check-circle" label="Answered" value={totals.answered} color="#16A34A" isDark={isDark} />
        <SummaryCard icon="close-circle" label="Missed" value={totals.notAnswered} color="#DC2626" isDark={isDark} />
        <SummaryCard icon="microphone" label="Recorded" value={totals.recorded} color="#7C3AED" isDark={isDark} />
      </View>

      {/* Quick date filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickFilterRow}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
      >
        {['all', 'today', 'week', 'month', 'custom'].map(key => (
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
              },
            ]}
          >
            <Text style={{ color: filterKey === key ? '#fff' : textSecondary, fontSize: 12, fontWeight: '600' }}>
              {key === 'custom' ? 'Custom' : key[0].toUpperCase() + key.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
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
          onPress={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
          style={[styles.sortBtn, { backgroundColor: cardBg, borderColor: border }]}
        >
          <Icon name={sortDir === 'desc' ? 'sort-descending' : 'sort-ascending'} size={16} color={textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.sortByRow}>
        {[
          { key: 'totalCalls', label: 'Total' },
          { key: 'answered', label: 'Answered' },
          { key: 'notAnswered', label: 'Missed' },
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
                {detailUser?.totalCalls} calls · {detailUser?.answered} answered · {detailUser?.notAnswered} missed
              </Text>
            </View>
            <TouchableOpacity onPress={closeDetail} style={styles.closeBtn}>
              <Icon name="close" size={18} color={textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsScroll} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
            {FILTER_TABS.map(tab => {
              const count =
                tab.key === 'all'
                  ? userLogs.length
                  : logCounts[tab.key === 'not-recorded' ? 'notRecorded' : tab.key];
              const active = logFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => { setLogFilter(tab.key); setVisibleCount(LOG_PAGE_SIZE); }}
                  style={[
                    styles.filterTab,
                    { backgroundColor: active ? tab.color : tab.bg },
                  ]}
                >
                  <Icon name={tab.icon} size={12} color={active ? '#fff' : tab.color} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#fff' : tab.color, marginLeft: 4 }}>
                    {tab.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingLogs ? (
            <View style={styles.centerFill}>
              <ActivityIndicator size="large" color={BRAND} />
            </View>
          ) : (
            <FlatList
              data={visibleUserLogs}
              keyExtractor={item => item._id}
              renderItem={({ item }) => <CallLogRow callLog={item} isDark={isDark} />}
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
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  playBtnText: { fontSize: 12, fontWeight: '600', color: BRAND },
  noRecText: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
});

export default CallTracingScreen;