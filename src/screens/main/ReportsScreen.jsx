/**
 * ReportsScreen.jsx  –  React Native
 * FIXED: Proper filter-based chart updates for Today/This Week/This Month/All Time
 */
import { useTheme } from '../../contexts/ThemeContext';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import { BASE_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const { width: SCREEN_W } = Dimensions.get('window');
const CHART_PADDING = 32; // card padding left+right
const Y_AXIS_W = 50;
const CHART_W = SCREEN_W - CHART_PADDING * 2 - Y_AXIS_W - 8;

const FILTERS = ['Today', 'This Week', 'This Month', 'All Time'];
const FILTER_MAP = {
  Today: 'today',
  'This Week': 'week',
  'This Month': 'month',
  'All Time': 'all',
};

const PALETTE = [
  '#5a7bf6',
  '#12B76A',
  '#F79009',
  '#7A5AF8',
  '#0BA5EC',
  '#F04438',
  '#EC4899',
  '#14B8A6',
];

const STATUS_COLORS = {
  New: '#5a7bf6',
  Interested: '#0BA5EC',
  'Details Shared': '#F79009',
  Success: '#12B76A',
  Closed: '#7A5AF8',
  Repeat: '#F04438',
  'Did Not Answered': '#64748B',
};

const SOURCE_COLORS = {
  'Google Ads': '#4285F4',
  Website: '#34A853',
  Referral: '#FBBC05',
  'Walk-in': '#EA4335',
  'Cold Call': '#7A5AF8',
  'Social Media': '#EC4899',
  'Google Sheet': '#14B8A6',
  'Meta Ads': '#1877F2',
  Other: '#94A3B8',
};
const formatDateLabel = d => {
  if (d.__dummy) return '';
  if (d.date && d.date.trim().length > 0) {
    return d.date.trim();
  }
  if (d.ts) {
    const dt = new Date(d.ts);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${dt.getDate()} ${months[dt.getMonth()]}`;
  }
  return '';
};
/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = v => {
  if (!v) return '₹0';
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  return `₹${v}`;
};

const fmtNum = v => {
  if (!v) return '0';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return `${v}`;
};

/** Build dateFrom/dateTo based on active filter */
const getDateParams = activeFilter => {
  // IST = UTC + 5:30 → manually offset karke sahi date nikalo
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  // toISOString() ab IST-as-UTC dega, slice se sahi YYYY-MM-DD milega
  const toDateStr = d =>
    new Date(d.getTime() + istOffset).toISOString().slice(0, 10);
  const dateTo = toDateStr(now);
  let dateFrom = '';

  if (activeFilter === 'Today') {
    dateFrom = dateTo;
  } else if (activeFilter === 'This Week') {
    const d = new Date(now);
    const day = istNow.getUTCDay(); // IST-shifted object pe getUTCDay = IST day
    d.setTime(d.getTime() - (day === 0 ? 6 : day - 1) * 86400000);
    dateFrom = toDateStr(d);
  } else if (activeFilter === 'This Month') {
    dateFrom = `${dateTo.slice(0, 7)}-01`;
  }

  return { dateFrom, dateTo };
};

const BASE = `${BASE_URL}/api/v1`;
const getToken = async () => await AsyncStorage.getItem('token');

const apiFetch = async path => {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
};

/* ─── Theme ──────────────────────────────────────────────────────────────── */
const lightTheme = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#111827',
  subtext: '#6B7280',
  muted: '#9CA3AF',
  headerBg: '#FFFFFF',
  filterBg: '#F1F5F9',
  filterActive: '#FFFFFF',
  tableHead: '#F8FAFC',
  error: '#FEF2F2',
  errorText: '#DC2626',
  accent: '#5a7bf6',
  chartBg: '#FFFFFF',
  rulesColor: '#E2E8F0',
};

const darkTheme = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  text: '#F9FAFB',
  subtext: '#94A3B8',
  muted: '#64748B',
  headerBg: '#1E293B',
  filterBg: '#0F172A',
  filterActive: '#334155',
  tableHead: '#1E293B',
  error: '#450A0A',
  errorText: '#FCA5A5',
  accent: '#5a7bf6',
  chartBg: '#1E293B',
  rulesColor: '#334155',
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */
const StatChip = ({ label, value, color, theme }) => (
  <View
    style={[
      styles.chip,
      { backgroundColor: theme.card, borderColor: theme.border },
    ]}
  >
    <Text style={[styles.chipLabel, { color: theme.muted }]}>{label}</Text>
    <Text style={[styles.chipValue, { color }]}>{value}</Text>
  </View>
);

const SectionTitle = ({ title, sub, theme }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
    {sub ? (
      <Text style={[styles.sectionSub, { color: theme.muted }]}>{sub}</Text>
    ) : null}
  </View>
);

const Card = ({ children, theme, style }) => (
  <View
    style={[
      styles.card,
      { backgroundColor: theme.card, borderColor: theme.border },
      style,
    ]}
  >
    {children}
  </View>
);

const Skeleton = ({ h = 200, theme }) => (
  <View
    style={[styles.skeleton, { height: h, backgroundColor: theme.border }]}
  />
);

const ProgressBar = ({ ratio, color, theme }) => (
  <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
    <View
      style={[
        styles.progressFill,
        {
          width: `${Math.min(Math.round(ratio * 100), 100)}%`,
          backgroundColor: color,
        },
      ]}
    />
  </View>
);

/* ─── Empty Chart Placeholder ────────────────────────────────────────────── */
const EmptyChart = ({ theme, filterLabel }) => (
  <View style={[styles.emptyChart, { borderColor: theme.border }]}>
    <Text style={{ fontSize: 28, marginBottom: 8 }}>📊</Text>
    <Text style={[styles.emptyChartTitle, { color: theme.text }]}>
      No data for "{filterLabel}"
    </Text>
    <Text style={[styles.emptyChartSub, { color: theme.muted }]}>
      Try switching to a different time range
    </Text>
  </View>
);
const TooltipPopup = ({ data, theme }) => {
  if (!data) return null;
  return (
    <View
      style={[
        styles.tooltipBox,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          top: data.y - 70,
          left: Math.min(data.x - 60, SCREEN_W - 160),
        },
      ]}
    >
      <Text style={[styles.tooltipLabel, { color: theme.muted }]}>
        {data.label}
      </Text>
      {data.chartType === 'leads' ? (
        <Text style={[styles.tooltipValue, { color: '#5a7bf6' }]}>
          Leads: {data.leads}
        </Text>
      ) : (
        <Text style={[styles.tooltipValue, { color: '#12B76A' }]}>
          Value: {fmt(data.value)}
        </Text>
      )}
    </View>
  );
};
/* ══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════════════════════ */
const ReportsScreen = ({ navigation, currentUser: propUser }) => {
  const { isDark } = useTheme();
  const theme = isDark ? darkTheme : lightTheme;
  const currentUser = propUser || null;

  const [activeFilter, setActiveFilter] = useState('All Time');
  const [tooltip, setTooltip] = useState(null);
  const [overview, setOverview] = useState(null);
  const [leadsTimeline, setLeadsTimeline] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [sourceBreakdown, setSourceBreakdown] = useState([]);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
  const [pieTooltip, setPieTooltip] = useState(null);

  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';
  const showTeam = isAdmin || isManager;

  /* ── Data fetching ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Overview (uses filter param)
      const ovData = await apiFetch(
        `/dashboard/overview?filter=${FILTER_MAP[activeFilter]}`,
      );

      // 2. Leads analytics (uses date range)
      const { dateFrom, dateTo } = getDateParams(activeFilter);
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (activeFilter !== 'All Time') params.append('dateTo', dateTo);
      const analyticsData = await apiFetch(
        `/leads/analytics?${params.toString()}`,
      );

      setOverview(ovData);
      setTeamPerformance(ovData?.teamPerformance || []);
      setStatusBreakdown(analyticsData?.statusBreakdown || []);
      setSourceBreakdown(analyticsData?.sourceBreakdown || []);

      // Build & sort timeline
      let sorted = [...(analyticsData?.timeline || [])].sort(
        (a, b) => a.ts - b.ts,
      );

    if (sorted.length === 1) {
  sorted.unshift({
    date: '',
    leads: 0,
    value: 0,
    ts: sorted[0].ts - 1,
    __dummy: true,
  });
}

      setLeadsTimeline(sorted);
    } catch (err) {
      setError('Failed to load report data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);
  useEffect(() => {
    setTooltip(null);
    setPieTooltip(null);
  }, [activeFilter]);
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Derived values ── */
  const conversionRate =
    overview && overview.totalLeads > 0
      ? ((overview.wonLeads / overview.totalLeads) * 100).toFixed(1)
      : '0.0';

  /* ── gifted-charts data ── */

  const timelineLeadsData = leadsTimeline.map(d => ({
    value: d.leads || 0,
    label: formatDateLabel(d),
    dataPointColor: '#5a7bf6',
  }));

  const timelineValueData = leadsTimeline.map(d => ({
    value: d.value || 0,
    label: formatDateLabel(d),
    dataPointColor: '#12B76A',
  }));

  const barSourceData = sourceBreakdown.map((s, i) => ({
    value: s.value || 0,
    label: s.name.slice(0, 7),
    frontColor: SOURCE_COLORS[s.name] || PALETTE[i % PALETTE.length],
    topLabelComponent: () => (
      <Text style={{ fontSize: 9, color: theme.muted, marginBottom: 2 }}>
        {s.value}
      </Text>
    ),
  }));

  const teamLeadsData = teamPerformance.map((m, i) => ({
    value: m.leadCount || 0,
    label: (m.name || '?').split(' ')[0].slice(0, 6),
    frontColor: PALETTE[i % PALETTE.length],
    topLabelComponent: () => (
      <Text style={{ fontSize: 9, color: theme.muted, marginBottom: 2 }}>
        {m.leadCount}
      </Text>
    ),
  }));

 const pieData = statusBreakdown.map((s, i) => ({
  value: s.value,
  color: STATUS_COLORS[s.name] || PALETTE[i % PALETTE.length],
  text: `${s.value}`,
  name: s.name,
}));

  const maxLeads = Math.max(...teamPerformance.map(x => x.leadCount || 0), 1);

  /* ── Common chart props ── */
  const commonLineProps = {
    width: CHART_W,
    height: 200,
    thickness: 2.5,
    curved: false,
    curveType: 0,
    areaChart: true,
    startOpacity: 0.25,
    endOpacity: 0,
    hideDataPoints: false,
    dataPointsHeight: 6,
    dataPointsWidth: 6,
    xAxisColor: theme.border,
    yAxisColor: theme.border,
    yAxisTextStyle: { color: theme.muted, fontSize: 10 },
    yAxisWidth: Y_AXIS_W + 10,
    xAxisLabelTextStyle: { color: theme.muted, fontSize: 9, paddingTop: 4 },
    backgroundColor: theme.card,
    rulesColor: theme.rulesColor,
    rulesType: 'dashed',
    noOfSections: 4,
    initialSpacing: activeFilter === 'Today' ? 0 : 12,
    endSpacing: 16,
    spacing:
  activeFilter === 'Today'
    ? CHART_W - 40
    : activeFilter === 'This Week'
        ? Math.floor((CHART_W - 32) / 6)
        : 40,
    isAnimated: true,
  };

  const commonBarProps = {
    width: CHART_W,
    barWidth: 28,
    spacing: 12,
    roundedTop: true,
    xAxisColor: theme.border,
    yAxisColor: theme.border,
    yAxisTextStyle: { color: theme.muted, fontSize: 10 },
    yAxisWidth: Y_AXIS_W,
    xAxisLabelTextStyle: { color: theme.muted, fontSize: 9 },
    noOfSections: 4,
    isAnimated: true,
    backgroundColor: theme.card,
    rulesColor: theme.rulesColor,
    rulesType: 'dashed',
    initialSpacing: 8,
    endSpacing: 8,
  };

  /* ══════════ RENDER ══════════ */
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.headerBg, borderBottomColor: theme.border },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Reports & Analytics
          </Text>
          <Text style={[styles.headerSub, { color: theme.muted }]}>
            {isAdmin
              ? 'Full team performance overview'
              : isManager
              ? "Your team's sales performance"
              : 'Your personal sales analytics'}
          </Text>
        </View>

        {/* ── Filter Tabs ── */}
        <View style={[styles.filterBar, { backgroundColor: theme.filterBg }]}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[
                styles.filterTab,
                activeFilter === f && [
                  styles.filterTabActive,
                  { backgroundColor: theme.filterActive },
                ],
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: activeFilter === f ? theme.text : theme.muted },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setTooltip(null)}
      >
        {/* ── Error ── */}
        {!!error && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: theme.error, borderColor: '#FCA5A5' },
            ]}
          >
            <Text style={{ color: theme.errorText, fontSize: 13 }}>
              {error}
            </Text>
            <TouchableOpacity onPress={fetchAll} style={styles.retryBtn}>
              <Text
                style={{
                  color: theme.errorText,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                Retry ↺
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── KPI Grid ── */}
        <View style={styles.kpiGrid}>
          {[
            {
              label: 'Total Leads',
              value: loading ? '—' : fmtNum(overview?.totalLeads || 0),
              color: '#5a7bf6',
            },
            {
              label: 'Active',
              value: loading ? '—' : fmtNum(overview?.activeLeads || 0),
              color: '#F79009',
            },
            {
              label: 'Won',
              value: loading ? '—' : fmtNum(overview?.wonLeads || 0),
              color: '#12B76A',
            },
            {
              label: 'Closed',
              value: loading ? '—' : fmtNum(overview?.closedLeads || 0),
              color: '#7A5AF8',
            },
            {
              label: 'Collected',
              value: loading ? '—' : fmt(overview?.collectedAmount || 0),
              color: '#0BA5EC',
            },
            {
              label: 'Conversion',
              value: loading ? '—' : `${conversionRate}%`,
              color: '#F04438',
            },
          ].map(s => (
            <StatChip key={s.label} {...s} theme={theme} />
          ))}
        </View>

        {/* ── Leads Over Time ── */}
        <Card
          theme={theme}
          style={{ marginBottom: 16, paddingBottom: 32, position: 'relative' }}
        >
          <View style={styles.cardHeaderRow}>
            <SectionTitle
              title="Leads Over Time"
              sub="Daily lead creation trend"
              theme={theme}
            />
            <View
              style={[styles.filterBadge, { backgroundColor: theme.filterBg }]}
            >
              <Text style={[styles.filterBadgeText, { color: theme.accent }]}>
                {activeFilter}
              </Text>
            </View>
          </View>
          {loading ? (
            <Skeleton h={180} theme={theme} />
          ) : timelineLeadsData.length === 0 ? (
            <EmptyChart theme={theme} filterLabel={activeFilter} />
          ) : (
            <View
              onStartShouldSetResponder={() => {
                setTooltip(null);
                return false;
              }}
            >
              <LineChart
                {...commonLineProps}
                data={timelineLeadsData}
                color="#5a7bf6"
                startFillColor="#5a7bf6"
                dataPointsColor="#5a7bf6"
                onPress={(item, index) => {
                  setTooltip(prev =>
                    prev?.index === index && prev?.chartType === 'leads'
                      ? null
                      : {
                          x: (index + 1) * (CHART_W / timelineLeadsData.length),
                          y: 120,
                          label: item.label,
                          leads: item.value,
                          chartType: 'leads',
                          index,
                        },
                  );
                }}
              />
              {tooltip?.chartType === 'leads' && (
                <TooltipPopup data={tooltip} theme={theme} />
              )}
            </View>
          )}
        </Card>

        {/* ── Deal Value Trend ── */}
        <Card
          theme={theme}
          style={{ marginBottom: 16, paddingBottom: 32, position: 'relative' }}
        >
          <SectionTitle
            title="Deal Value Trend"
            sub="Total deal value added per day"
            theme={theme}
          />
          {loading ? (
            <Skeleton h={180} theme={theme} />
          ) : timelineValueData.length === 0 ? (
            <EmptyChart theme={theme} filterLabel={activeFilter} />
          ) : (
            <View
              onStartShouldSetResponder={() => {
                setTooltip(null);
                return false;
              }}
            >
              <LineChart
                {...commonLineProps}
                data={timelineValueData}
                color="#12B76A"
                startFillColor="#12B76A"
                dataPointsColor="#12B76A"
                formatYLabel={v => {
                  const n = Number(v);
                  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
                  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
                  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
                  return `₹${n}`;
                }}
                onPress={(item, index) => {
                  setTooltip(prev =>
                    prev?.index === index && prev?.chartType === 'value'
                      ? null
                      : {
                          x: (index + 1) * (CHART_W / timelineValueData.length),
                          y: 120,
                          label: item.label,
                          value: item.value,
                          chartType: 'value',
                          index,
                        },
                  );
                }}
              />
              {tooltip?.chartType === 'value' && (
                <TooltipPopup data={tooltip} theme={theme} />
              )}
            </View>
          )}
        </Card>

        {/* ── Status Breakdown (Donut) ── */}
        <Card theme={theme} style={{ marginBottom: 16 }}>
  <TouchableOpacity activeOpacity={1} onPress={() => setPieTooltip(null)}>
  <SectionTitle
    title="Status Breakdown"
    sub="Lead distribution by stage"
    theme={theme}
  />
          {loading ? (
            <Skeleton h={200} theme={theme} />
          ) : pieData.length === 0 ? (
            <EmptyChart theme={theme} filterLabel={activeFilter} />
          ) : (
            <>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
  <View style={{ position: 'relative' }}>
    <PieChart
      data={pieData}
      radius={75}
      innerRadius={40}
      showText={false}
      showTextBackground={false}
      textColor="transparent"
      textSize={0}
      isAnimated
      onPress={(item, index) => {
        setPieTooltip(prev =>
          prev?.index === index ? null : {
            index,
            name: item.name || statusBreakdown[index]?.name,
            value: item.value,
            pct: (() => {
              const total = statusBreakdown.reduce((a, x) => a + x.value, 0);
              return total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
            })(),
            color: item.color,
          }
        );
      }}
      focusOnPress
      selectedSectionStyle={{ scale: 1.05 }}
    />
    {pieTooltip && (
      <View style={[styles.sliceTooltip, {
        backgroundColor: theme.card,
        borderColor: pieTooltip.color,
      }]}>
        <Text style={[styles.sliceTooltipText, { color: theme.muted }]}>
          {pieTooltip.name}
        </Text>
        <Text style={[styles.sliceTooltipVal, { color: pieTooltip.color }]}>
          {pieTooltip.value}
        </Text>
      </View>
    )}
 </View>
</View>
              {(() => {
                const total = statusBreakdown.reduce((a, x) => a + x.value, 0);
                return statusBreakdown.map((s, i) => {
                  const color =
                    STATUS_COLORS[s.name] || PALETTE[i % PALETTE.length];
                  return (
                    <View key={s.name} style={styles.legendRow}>
                      <View
                        style={[styles.legendDot, { backgroundColor: color }]}
                      />
                      <Text
                        style={[styles.legendName, { color: theme.subtext }]}
                      >
                        {s.name}
                      </Text>
                      <Text style={[styles.legendVal, { color: theme.text }]}>
                        {s.value}
                      </Text>
                      <Text style={[styles.legendPct, { color: theme.muted }]}>
                        {total > 0
                          ? ((s.value / total) * 100).toFixed(2)
                          : '0.00'}
                        %
                      </Text>
                    </View>
                  );
                });
              })()}
            </>
          )}
       </TouchableOpacity>
        </Card>

        {/* ── Leads by Source ── */}
        <Card theme={theme} style={{ marginBottom: 16 }}>
          <SectionTitle
            title="Leads by Source"
            sub="Which channels bring the most leads"
            theme={theme}
          />
          {loading ? (
            <Skeleton h={220} theme={theme} />
          ) : barSourceData.length === 0 ? (
            <EmptyChart theme={theme} filterLabel={activeFilter} />
          ) : (
            <BarChart {...commonBarProps} data={barSourceData} height={220} />
          )}
        </Card>

        {/* ── Team Performance ── */}
        {showTeam && (
          <Card theme={theme} style={{ marginBottom: 16 }}>
            <SectionTitle
              title="Team Performance"
              sub="Top performers by lead count & deal value"
              theme={theme}
            />
            {loading ? (
              <Skeleton h={220} theme={theme} />
            ) : teamLeadsData.length === 0 ? (
              <EmptyChart theme={theme} filterLabel={activeFilter} />
            ) : (
              <>
                <Text style={[styles.barGroupLabel, { color: theme.muted }]}>
                  Leads
                </Text>
                <BarChart
                  {...commonBarProps}
                  data={teamLeadsData}
                  height={160}
                />

                <Text
                  style={[
                    styles.barGroupLabel,
                    { color: theme.muted, marginTop: 16 },
                  ]}
                >
                  Deal Value
                </Text>
                <BarChart
                  {...commonBarProps}
                  data={teamPerformance.map((m, i) => ({
                    value: m.totalDealValue || 0,
                    label: (m.name || '?').split(' ')[0].slice(0, 6),
                    frontColor: '#12B76A',
                    topLabelComponent: () => (
                      <Text
                        style={{
                          fontSize: 8,
                          color: theme.muted,
                          marginBottom: 2,
                        }}
                      >
                        {fmt(m.totalDealValue)}
                      </Text>
                    ),
                  }))}
                  height={160}
                  formatYLabel={v => fmt(Number(v))}
                />

                <View style={styles.chartLegend}>
                  <View style={styles.chartLegendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: '#5a7bf6' }]}
                    />
                    <Text style={[styles.legendName, { color: theme.subtext }]}>
                      Leads
                    </Text>
                  </View>
                  <View style={styles.chartLegendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: '#12B76A' }]}
                    />
                    <Text style={[styles.legendName, { color: theme.subtext }]}>
                      Deal Value
                    </Text>
                  </View>
                </View>
              </>
            )}
          </Card>
        )}

        {/* ── Executive Leaderboard ── */}
        {showTeam && teamPerformance.length > 0 && !loading && (
          <Card theme={theme} style={{ marginBottom: 16, padding: 0 }}>
            <View
              style={[styles.tableHeader, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Executive Leaderboard
              </Text>
              <Text style={[styles.sectionSub, { color: theme.muted }]}>
                Detailed breakdown per team member
              </Text>
            </View>

            {/* Table head */}
            <View
              style={[
                styles.tableRow,
                { backgroundColor: theme.tableHead, borderTopWidth: 0 },
              ]}
            >
              <Text
                style={[
                  styles.tableHeadCell,
                  { color: theme.muted, flex: 0.4 },
                ]}
              >
                #
              </Text>
              <Text
                style={[styles.tableHeadCell, { color: theme.muted, flex: 2 }]}
              >
                Executive
              </Text>
              <Text
                style={[
                  styles.tableHeadCell,
                  { color: theme.muted, textAlign: 'right', flex: 1 },
                ]}
              >
                Leads
              </Text>
              <Text
                style={[
                  styles.tableHeadCell,
                  { color: theme.muted, textAlign: 'right', flex: 1.4 },
                ]}
              >
                Value
              </Text>
              <Text
                style={[
                  styles.tableHeadCell,
                  { color: theme.muted, flex: 1.4 },
                ]}
              >
                Progress
              </Text>
            </View>

            {teamPerformance.map((m, i) => (
              <View
                key={m.userId || m.name}
                style={[styles.tableRow, { borderTopColor: theme.border }]}
              >
                <Text
                  style={[styles.tableCell, { flex: 0.4, color: theme.muted }]}
                >
                  {i === 0
                    ? '🥇'
                    : i === 1
                    ? '🥈'
                    : i === 2
                    ? '🥉'
                    : `#${i + 1}`}
                </Text>
                <View style={[styles.nameCell, { flex: 2 }]}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: PALETTE[i % PALETTE.length] },
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {(m.name || '?')
                        .split(' ')
                        .slice(0, 2)
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[styles.tableCell, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {m.name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      flex: 1,
                      textAlign: 'right',
                      color: theme.text,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {fmtNum(m.leadCount)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      flex: 1.4,
                      textAlign: 'right',
                      color: theme.text,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {fmt(m.totalDealValue)}
                </Text>
                <View style={{ flex: 1.4, paddingLeft: 8 }}>
                  <ProgressBar
                    ratio={m.leadCount / maxLeads}
                    color={PALETTE[i % PALETTE.length]}
                    theme={theme}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* ── Personal Stats ── */}
        {!showTeam && (
          <Card theme={theme} style={{ marginBottom: 16 }}>
            <SectionTitle
              title="My Stats"
              sub="Your personal performance"
              theme={theme}
            />
            {loading ? (
              <Skeleton h={180} theme={theme} />
            ) : (
              <>
                <View style={styles.kpiGrid}>
                  <StatChip
                    label="Pipeline Value"
                    value={fmt(overview?.pipelineValue || 0)}
                    color="#5a7bf6"
                    theme={theme}
                  />
                  <StatChip
                    label="Collected"
                    value={fmt(overview?.collectedAmount || 0)}
                    color="#12B76A"
                    theme={theme}
                  />
                  <StatChip
                    label="Won Leads"
                    value={fmtNum(overview?.wonLeads || 0)}
                    color="#F79009"
                    theme={theme}
                  />
                  <StatChip
                    label="Conversion"
                    value={`${conversionRate}%`}
                    color="#7A5AF8"
                    theme={theme}
                  />
                </View>
                <View
                  style={[
                    styles.reminderBox,
                    {
                      borderColor: '#5a7bf633',
                      backgroundColor: 'rgba(90,123,246,0.06)',
                    },
                  ]}
                >
                  <Text style={[styles.reminderLabel, { color: theme.muted }]}>
                    Today's Reminders
                  </Text>
                  <Text style={[styles.reminderCount, { color: '#5a7bf6' }]}>
                    {fmtNum(overview?.todayRemindersCount || 0)}
                  </Text>
                  <Text style={[styles.reminderSub, { color: theme.muted }]}>
                    pending follow-ups
                  </Text>
                </View>
              </>
            )}
          </Card>
        )}

        {/* ── Footer ── */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Text style={[styles.footerNote, { color: theme.muted }]}>
            Data updates on every filter change.
          </Text>
          <TouchableOpacity onPress={() => navigation?.navigate?.('Leads')}>
            <Text style={[styles.footerLink, { color: '#5a7bf6' }]}>
              → View all leads
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Full-screen loader ── */}
      {loading && (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#5a7bf6" />
        </View>
      )}
    </View>
  );
};

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  headerSub: { fontSize: 13, marginTop: 2 },

  /* Filter tabs */
  filterBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    gap: 2,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  filterTabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabText: { fontSize: 11, fontWeight: '600' },

  /* Body */
  body: { padding: 26 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retryBtn: { paddingHorizontal: 8, paddingVertical: 4 },

  /* KPI */
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipValue: { fontSize: 18, fontWeight: '800' },

  /* Section */
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, marginTop: 2 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Card */
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  skeleton: { borderRadius: 12 },

  /* Empty chart */
  emptyChart: {
    height: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  emptyChartTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  emptyChartSub: { fontSize: 11 },

  /* Pie legend */
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 8,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { flex: 1, fontSize: 12 },
  legendVal: { fontSize: 12, fontWeight: '700' },
  legendPct: { fontSize: 10, minWidth: 44, textAlign: 'right' },

  /* Bar labels */
  barGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  /* Chart legend */
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  /* Progress bar */
  progressTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },

  /* Leaderboard */
  tableHeader: { padding: 16, borderBottomWidth: 1 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tableHeadCell: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCell: { fontSize: 12 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },

  /* Personal stats */
  reminderBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  reminderLabel: { fontSize: 12, marginBottom: 4 },
  reminderCount: { fontSize: 28, fontWeight: '800' },
  reminderSub: { fontSize: 11, marginTop: 2 },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    marginBottom: 24,
  },
  footerNote: { fontSize: 11 },
  footerLink: { fontSize: 12, fontWeight: '700' },

  /* Loader */
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },

  // ↓ ye add karo
  tooltipBox: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 130,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  tooltipLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: '800',
  },
donutCenter: {
  position: 'absolute',
  width: 80,
  height: 80,
  top: 75,
  left: 75,
  transform: [{ translateX: -40 }, { translateY: -40 }],
  alignItems: 'center',
  justifyContent: 'center',
},
donutDot: {
  width: 8, height: 8, borderRadius: 4, marginBottom: 3,
},
donutName: {
  fontSize: 10, fontWeight: '600', textAlign: 'center',
  maxWidth: 70, lineHeight: 13,
},
donutVal: {
  fontSize: 18, fontWeight: '800', marginTop: 2,
},
donutPct: {
  fontSize: 11, fontWeight: '600',
},
donutHint: {
  fontSize: 11, lineHeight: 15,
},
sliceTooltip: {
  position: 'absolute',
  bottom: -10,
  alignSelf: 'center',
  borderWidth: 1.5,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 6,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 6,
  elevation: 5,
},
sliceTooltipText: {
  fontSize: 12,
  fontWeight: '600',
},
sliceTooltipVal: {
  fontSize: 13,
  fontWeight: '800',
},
}); // ← ye closing bracket already hai

export default ReportsScreen;
