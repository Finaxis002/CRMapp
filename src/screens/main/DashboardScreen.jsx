import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { useUISystem } from '../../hooks/useUISystem';
import { dashboardService } from '../../services/dashboardService';

// ─── UI Kit imports ────────────────────────────────────────────────────────
import BottomSheet from '../../components/ui/BottomSheet';
import MetricCard from '../../components/ui/MetricCard';
import ImprovedCard from '../../components/ui/ImprovedCard';
import ImprovedButton from '../../components/ui/ImprovedButton';
import Avatar from '../../components/ui/Avatar';
import OwnerChip from '../../components/ui/OwnerChip';
import CountBadge from '../../components/ui/CountBadge';
import ListDivider from '../../components/ui/ListDivider';
import EmptyState from '../../components/ui/EmptyState';

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatCurrency = value =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const statusConfig = {
  Won: { bg: 'successSoft', text: 'success', label: 'Won' },
  Active: { bg: 'warningSoft', text: 'warning', label: 'Active' },
  Lost: { bg: 'dangerSoft', text: 'danger', label: 'Lost' },
  Pipeline: { bg: 'purpleSoft', text: 'purple', label: 'Pipeline' },
  New: { bg: 'primarySoft', text: 'primary', label: 'New' },
};

const reminderIcon = (type = '') => {
  const t = type.toLowerCase();
  if (t.includes('call')) return { icon: 'phone', colorKey: 'primary' };
  if (t.includes('email')) return { icon: 'mail', colorKey: 'success' };
  if (t.includes('meet')) return { icon: 'video', colorKey: 'warning' };
  return { icon: 'clock', colorKey: 'purple' };
};

const getCurrentUser = async () => {
  try {
    const keys = ['user', 'currentUser', 'authUser'];
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch (_) {}
  return null;
};

const toISTDate = date =>
  date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const getDateParams = activeFilter => {
  const now = new Date();
  if (activeFilter === 'Today') {
    const today = toISTDate(now);
    return { dateFrom: today, dateTo: today };
  }
  if (activeFilter === 'This Week') {
    const istDay = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    ).getDay();
    const diffToMonday = istDay === 0 ? 6 : istDay - 1;
    const monday = new Date(now.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
    return { dateFrom: toISTDate(monday), dateTo: toISTDate(now) };
  }
  if (activeFilter === 'This Month') {
    const istNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    );
    const firstDay = `${istNow.getFullYear()}-${String(
      istNow.getMonth() + 1,
    ).padStart(2, '0')}-01`;
    return { dateFrom: firstDay, dateTo: toISTDate(now) };
  }
  return {};
};

// ─── Sub-components ────────────────────────────────────────────────────────

const StatusPill = ({ status, colors }) => {
  const cfg = statusConfig[status] || {
    bg: 'primarySoft',
    text: 'primary',
    label: status || '—',
  };
  return (
    <View style={[styles.pill, { backgroundColor: colors[cfg.bg] }]}>
      <Text style={[styles.pillText, { color: colors[cfg.text] }]}>
        {cfg.label}
      </Text>
    </View>
  );
};

const PerfBar = ({ ratio, colors }) => (
  <View style={[styles.perfBarWrap, { backgroundColor: colors.border }]}>
    <View
      style={[
        styles.perfBar,
        {
          width: `${Math.round(Math.min(ratio, 1) * 100)}%`,
          backgroundColor: colors.primary,
        },
      ]}
    />
  </View>
);

// ─── Skeleton components ───────────────────────────────────────────────────

const useSkeletonPulse = active => {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, active]);
  return pulse;
};

const SkeletonBox = ({ width, height, colors, pulse, style }) => (
  <Animated.View
    style={[
      styles.skeleton,
      {
        width,
        height,
        backgroundColor: colors.skeletonBase || colors.backgroundSecondary,
        opacity: pulse,
      },
      style,
    ]}
  />
);

const SkeletonMetricCard = ({ colors, borderRadius: br, pulse, fullWidth }) => (
  <View
    style={[
      styles.skeletonCard,
      {
        width: fullWidth ? '100%' : '48.5%',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopColor: colors.border,
        borderRadius: br.xl,
      },
      fullWidth && { marginBottom: 8 },
    ]}
  >
    <SkeletonBox
      width={30}
      height={30}
      colors={colors}
      pulse={pulse}
      style={{ position: 'absolute', top: 10, right: 10, borderRadius: br.md }}
    />
    <SkeletonBox
      width="52%"
      height={10}
      colors={colors}
      pulse={pulse}
      style={{ marginTop: 4, marginBottom: 9 }}
    />
    <SkeletonBox width="36%" height={22} colors={colors} pulse={pulse} />
  </View>
);

const SkeletonSectionHeader = ({ colors, pulse }) => (
  <View style={[styles.cardHead, { alignItems: 'center' }]}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <SkeletonBox
        width="42%"
        height={13}
        colors={colors}
        pulse={pulse}
        style={{ marginBottom: 6 }}
      />
      <SkeletonBox width="58%" height={11} colors={colors} pulse={pulse} />
    </View>
    <SkeletonBox
      width={54}
      height={24}
      colors={colors}
      pulse={pulse}
      style={{ borderRadius: 8 }}
    />
  </View>
);

const SkeletonRow = ({ colors, pulse, withPill }) => (
  <View style={styles.skeletonRow}>
    <SkeletonBox
      width={36}
      height={36}
      colors={colors}
      pulse={pulse}
      style={{ borderRadius: 10 }}
    />
    <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
      <SkeletonBox
        width="55%"
        height={12}
        colors={colors}
        pulse={pulse}
        style={{ marginBottom: 6 }}
      />
      <SkeletonBox width="38%" height={10} colors={colors} pulse={pulse} />
    </View>
    {withPill && (
      <SkeletonBox
        width={44}
        height={18}
        colors={colors}
        pulse={pulse}
        style={{ borderRadius: 20 }}
      />
    )}
  </View>
);

// ─── Main Component ─────────────────────────────────────────────────────────

const DashboardScreen = ({ navigation }) => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [periodOpen, setPeriodOpen] = useState(false);

  const { colors, typography, spacing, borderRadius, isDark } = useUISystem();

  const filterMap = {
    All: 'all',
    Today: 'today',
    'This Week': 'week',
    'This Month': 'month',
  };

  const PERIOD_OPTIONS = [
    { key: 'All', icon: 'layers' },
    { key: 'Today', icon: 'sun' },
    { key: 'This Week', icon: 'calendar' },
    { key: 'This Month', icon: 'calendar' },
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await getCurrentUser();
      if (mounted) setUser(u);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setOverview(null);
    (async () => {
      try {
        const data = await dashboardService.getOverview({
          filter: filterMap[activeFilter],
        });
        if (mounted) setOverview(data);
      } catch (err) {
        console.error(err);
        if (mounted)
          setError('Failed to load dashboard data. Please refresh the page.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await dashboardService.getOverview({
        filter: filterMap[activeFilter],
      });
      setOverview(data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data. Please refresh the page.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleNavigate = (path, params = {}) => {
    if (navigation && typeof navigation.navigate === 'function') {
      const screenMap = {
        leads: 'Leads',
        payments: 'Payments',
        reports: 'Reports',
      };
      const key = path.replace(/^\//, '');
      navigation.navigate(screenMap[key] || key, params);
    }
  };

  const buildLeadParams = filterValue => {
    const dateParams = getDateParams(activeFilter);
    const params = {};
    if (filterValue) params.status = filterValue;
    if (dateParams.dateFrom) params.dateFrom = dateParams.dateFrom;
    if (dateParams.dateTo) params.dateTo = dateParams.dateTo;
    return params;
  };

  // ── Compact header: title left + right side period dropdown trigger ──
  const renderHeader = (subtitle, rightNode = null) => (
    <View style={styles.headerRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          Dashboard Overview
        </Text>
        {!!subtitle && (
          <Text
            style={[styles.headerSubtitle, { color: colors.textTertiary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightNode}
    </View>
  );

  const renderPeriodTrigger = (disabled = false) => (
    <TouchableOpacity
      disabled={disabled}
      onPress={() => setPeriodOpen(true)}
      style={[
        styles.periodTrigger,
        {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
          borderRadius: borderRadius.full,
        },
      ]}
      activeOpacity={0.7}
    >
      <Feather name="calendar" size={12} color={colors.primary} />
      <Text
        style={[
          typography.caption,
          { color: colors.textPrimary, fontWeight: '600' },
        ]}
        numberOfLines={1}
      >
        {activeFilter === 'All' ? 'All Time' : activeFilter}
      </Text>
      <Feather name="chevron-down" size={13} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  const overviewSubtitle =
    user?.role === 'admin' || user?.role === 'manager'
      ? "Your team's sales at a glance"
      : 'Your sales at a glance';

  const periodSheet = (
    <BottomSheet
      visible={periodOpen}
      onClose={() => setPeriodOpen(false)}
      title="Time Period"
      maxHeight={360}
    >
      {PERIOD_OPTIONS.map(opt => {
        const active = activeFilter === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => {
              setActiveFilter(opt.key);
              setPeriodOpen(false);
            }}
            style={[
              styles.periodRow,
              { borderBottomColor: colors.borderLight },
              active && { backgroundColor: colors.primarySoft },
            ]}
            activeOpacity={0.7}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <Feather
                name={opt.icon}
                size={16}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  typography.body2,
                  {
                    color: active ? colors.primary : colors.textPrimary,
                    fontWeight: active ? '600' : '400',
                  },
                ]}
              >
                {opt.key === 'All' ? 'All Time' : opt.key}
              </Text>
            </View>
            {active && (
              <Feather name="check" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        );
      })}
    </BottomSheet>
  );

  // ─── Loading State ───────────────────────────────────────────────────────
  const pulse = useSkeletonPulse(loading);

  if (loading) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.container}>
          {renderHeader('Loading dashboard data…', renderPeriodTrigger(false))}

          <View style={styles.metricsGrid}>
            {[1, 2, 3, 4].map(i => (
              <SkeletonMetricCard
                key={i}
                colors={colors}
                borderRadius={borderRadius}
                pulse={pulse}
              />
            ))}
          </View>
          <SkeletonMetricCard
            colors={colors}
            borderRadius={borderRadius}
            pulse={pulse}
            fullWidth
          />

          <ImprovedCard
            variant="outline"
            style={{ marginBottom: spacing.md, marginTop: 12 }}
          >
            <SkeletonSectionHeader colors={colors} pulse={pulse} />
            {[1, 2, 3].map(i => (
              <SkeletonRow key={i} colors={colors} pulse={pulse} withPill />
            ))}
          </ImprovedCard>

          {/* Team Performance skeleton */}
          <ImprovedCard variant="outline" style={{ marginBottom: spacing.md }}>
            <SkeletonSectionHeader colors={colors} pulse={pulse} />
            {[1, 2, 3].map(i => (
              <SkeletonRow key={i} colors={colors} pulse={pulse} />
            ))}
          </ImprovedCard>

          {/* Reminders skeleton */}
          <ImprovedCard variant="outline" style={{ marginBottom: spacing.md }}>
            <SkeletonSectionHeader colors={colors} pulse={pulse} />
            {[1, 2].map(i => (
              <SkeletonRow key={i} colors={colors} pulse={pulse} />
            ))}
          </ImprovedCard>
        </ScrollView>
        {periodSheet}
      </SafeAreaView>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View style={styles.container}>
          {renderHeader(null)}
          <EmptyState
            icon="alert-circle-outline"
            title="Something went wrong"
            message={error}
            actionLabel="Retry"
            onAction={handleRefresh}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Data ready ──────────────────────────────────────────────────────────
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  const metrics = [
    {
      label: 'Total Leads',
      value: overview.totalLeads,
      color: 'blue',
      icon: 'users',
      filterValue: '',
    },
    {
      label: 'Active Leads',
      value: overview.activeLeads,
      color: 'yellow',
      icon: 'layers',
      filterValue: 'active',
    },
    {
      label: 'Success Leads',
      value: overview.wonLeads,
      color: 'green',
      icon: 'award',
      filterValue: 'Success',
    },
    {
      label: 'Closed Leads',
      value: overview.closedLeads,
      color: 'purple',
      icon: 'briefcase',
      filterValue: 'Closed',
    },
    {
      label: 'Collected',
      value: formatCurrency(overview.collectedAmount || 0),
      color: 'cyan',
      icon: 'credit-card',
      filterValue: null,
    },
  ];

  const maxDeal = Math.max(
    ...(overview.teamPerformance || []).map(m => m.totalDealValue || 0),
    1,
  );

  const combinedItems = [
    ...(overview.todayReminders || []).map(r => ({
      ...r,
      _itemType: 'reminder',
    })),
    ...(overview.todayEvents || []).map(e => ({ ...e, _itemType: 'event' })),
    ...(overview.todayTasks || []).map(t => ({ ...t, _itemType: 'task' })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // ─── Render helpers ──────────────────────────────────────────────────────

  const renderLeadItem = ({ item: lead }) => (
    <ImprovedCard variant="outline" padding="small" style={{ marginBottom: 0 }}>
      <View style={styles.leadCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.overline, { color: colors.textTertiary }]}>
            LEAD NAME
          </Text>
          <Text
            style={[
              typography.label,
              { color: colors.textPrimary, fontSize: 13.5 },
            ]}
            numberOfLines={1}
          >
            {lead.name}
          </Text>
        </View>
        <View style={styles.leadCardRight}>
          <Text
            style={[
              typography.caption,
              {
                color: colors.textSecondary,
                backgroundColor: colors.backgroundSecondary,
                fontWeight: '600',
                paddingVertical: 2,
                paddingHorizontal: 7,
                borderRadius: borderRadius.sm,
                overflow: 'hidden',
                fontSize: 11,
              },
            ]}
          >
            {new Date(lead.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
            })}
          </Text>
          <StatusPill status={lead.status} colors={colors} />
        </View>
      </View>

      <ListDivider style={{ marginVertical: 8 }} />

      <View style={styles.leadCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.overline, { color: colors.textTertiary }]}>
            ASSIGNED TO
          </Text>
          <OwnerChip name={lead.assignedTo?.name || 'Unassigned'} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.overline, { color: colors.textTertiary }]}>
            DEAL VALUE
          </Text>
          <Text
            style={[
              typography.label,
              { color: colors.primary, fontSize: 13.5, marginTop: 1 },
            ]}
          >
            {lead.dealValue ? formatCurrency(lead.dealValue) : '—'}
          </Text>
        </View>
      </View>
    </ImprovedCard>
  );

  const renderActivityIcon = (iconName, colorKey) => {
    const softKey = colorKey + 'Soft';
    return (
      <View
        style={[
          styles.rDot,
          {
            backgroundColor: colors[softKey] || colors.primarySoft,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        <Feather
          name={iconName}
          size={16}
          color={colors[colorKey] || colors.primary}
        />
      </View>
    );
  };

  const renderReminderItem = ({ item }) => {
    if (item._itemType === 'event') {
      return (
        <View style={styles.reminderItem}>
          {renderActivityIcon('calendar', 'purple')}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.label,
                { color: colors.textPrimary, fontSize: 13.5 },
              ]}
              numberOfLines={1}
            >
              {item.title || 'Event'}
            </Text>
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  marginTop: 1,
                  fontWeight: '500',
                },
              ]}
              numberOfLines={1}
            >
              {Array.isArray(item.assignedTo)
                ? item.assignedTo.map(u => u?.name || u).join(', ')
                : item.assignedTo?.name || ''}
            </Text>
            {item.note ? (
              <Text
                style={[
                  typography.body2,
                  { color: colors.textSecondary, marginTop: 4, fontSize: 12.5 },
                ]}
                numberOfLines={2}
              >
                {item.note}
              </Text>
            ) : null}
            <Text
              style={[
                styles.timeBadge,
                {
                  color: colors.primary,
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primaryBorder,
                },
              ]}
            >
              {item.eventTime || 'Time not set'}
            </Text>
          </View>
        </View>
      );
    }

    if (item._itemType === 'task') {
      return (
        <View style={styles.reminderItem}>
          {renderActivityIcon('check-circle', 'purple')}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.label,
                { color: colors.textPrimary, fontSize: 13.5 },
              ]}
              numberOfLines={1}
            >
              Task
            </Text>
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  marginTop: 1,
                  fontWeight: '500',
                },
              ]}
              numberOfLines={1}
            >
              {item.leadId?.name || 'Lead Name'}
            </Text>
            {item.text ? (
              <Text
                style={[
                  typography.body2,
                  { color: colors.textSecondary, marginTop: 4, fontSize: 12.5 },
                ]}
                numberOfLines={2}
              >
                {item.text}
              </Text>
            ) : null}
            <Text
              style={[
                styles.timeBadge,
                {
                  color: colors.primary,
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primaryBorder,
                },
              ]}
            >
              {item.taskDueDate
                ? new Date(item.taskDueDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    timeZone: 'Asia/Kolkata',
                  })
                : 'Due date not set'}
            </Text>
          </View>
        </View>
      );
    }

    // Reminder
    const { icon, colorKey } = reminderIcon(item.type);
    return (
      <View style={styles.reminderItem}>
        {renderActivityIcon(icon, colorKey)}
        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.label,
              { color: colors.textPrimary, fontSize: 13.5 },
            ]}
            numberOfLines={1}
          >
            {item.type || 'Reminder'}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: 1, fontWeight: '500' },
            ]}
            numberOfLines={1}
          >
            {item.leadId?.name || 'Lead Name'}
          </Text>
          {item.note ? (
            <Text
              style={[
                typography.body2,
                { color: colors.textSecondary, marginTop: 4, fontSize: 12.5 },
              ]}
              numberOfLines={2}
            >
              {item.note}
            </Text>
          ) : null}
          <Text
            style={[
              styles.timeBadge,
              {
                color: colors.primary,
                backgroundColor: colors.primarySoft,
                borderColor: colors.primaryBorder,
              },
            ]}
          >
            {item.reminderTime || 'Time not set'}
          </Text>
        </View>
      </View>
    );
  };

  // ─── Section Header helper ──────────────────────────────────────────────
  const SectionHeader = ({
    title,
    subtitle,
    actionLabel,
    onAction,
    rightNode,
  }) => (
    <View style={styles.cardHead}>
      <View style={{ flex: 1, marginRight: spacing.sm, minWidth: 0 }}>
        <Text
          style={[typography.h4, { color: colors.textPrimary, fontSize: 15 }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={[
              typography.body2,
              { color: colors.textSecondary, marginTop: 2, fontSize: 11.5 },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightNode ? (
        rightNode
      ) : actionLabel && onAction ? (
        <ImprovedButton
          title={actionLabel}
          variant="ghost"
          size="small"
          onPress={onAction}
        />
      ) : null}
    </View>
  );

  // ─── Main Return ────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {renderHeader(overviewSubtitle, renderPeriodTrigger())}

        {/* Metrics — 2x2 grid + 1 full width */}
        <View style={styles.metricsGrid}>
          {metrics.slice(0, 4).map(m => (
            <MetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              icon={m.icon}
              color={m.color}
              onPress={() => {
                if (m.filterValue !== null) {
                  handleNavigate('/leads', buildLeadParams(m.filterValue));
                }
              }}
            />
          ))}
        </View>
        <MetricCard
          label={metrics[4].label}
          value={metrics[4].value}
          icon={metrics[4].icon}
          color={metrics[4].color}
          fullWidth
          onPress={() => handleNavigate('/payments')}
        />

        {/* Recent Leads */}
        <ImprovedCard
          variant="outline"
          style={{ marginBottom: spacing.md, marginTop: 12 }}
        >
          <SectionHeader
            title="Recent Leads"
            subtitle={
              isAdmin
                ? 'Latest lead entries from the entire team'
                : isManager
                ? 'Latest lead entries from your team'
                : 'Your personally assigned latest leads'
            }
            actionLabel="View all"
            onAction={() => handleNavigate('/leads')}
          />
          {!overview.recentLeads?.length ? (
            <EmptyState
              icon="account-search-outline"
              title="No recent leads"
              message="No recent leads found."
            />
          ) : (
            <FlatList
              data={overview.recentLeads}
              keyExtractor={item => item._id}
              renderItem={renderLeadItem}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 8 }}
            />
          )}
        </ImprovedCard>

        {/* Team Performance */}
        <ImprovedCard variant="outline" style={{ marginBottom: spacing.md }}>
          <SectionHeader
            title="Team Performance"
            subtitle="Top contributors based on lead count"
            actionLabel="See report"
            onAction={() => handleNavigate('/reports')}
          />
          {!overview.teamPerformance?.length ? (
            <EmptyState
              icon="chart-bar"
              title="No data"
              message="No performance data available."
            />
          ) : (
            overview.teamPerformance.map(member => (
              <View key={member.userId || member.name} style={styles.perfItem}>
                <Avatar
                  name={member.name}
                  size={36}
                  rounded={borderRadius.md}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      typography.label,
                      { color: colors.textPrimary, fontSize: 13.5 },
                    ]}
                    numberOfLines={1}
                  >
                    {member.name}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: colors.textSecondary,
                        marginTop: 2,
                        fontWeight: '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {member.leadCount} leads assigned
                  </Text>
                </View>
                <View style={styles.perfRight}>
                  <Text
                    style={[
                      typography.label,
                      { color: colors.textPrimary, fontSize: 14 },
                    ]}
                  >
                    {formatCurrency(member.totalDealValue)}
                  </Text>
                  <PerfBar
                    ratio={member.totalDealValue / maxDeal}
                    colors={colors}
                  />
                </View>
              </View>
            ))
          )}
        </ImprovedCard>

        {/* Reminders, Events & Tasks */}
        <ImprovedCard variant="outline" style={{ marginBottom: spacing.md }}>
          <SectionHeader
            title="Today's Reminders, Events & Tasks"
            subtitle="Pending follow-ups for today"
            rightNode={
              <CountBadge
                count={
                  (overview.todayReminders?.length || 0) +
                  (overview.todayEvents?.length || 0) +
                  (overview.todayTasks?.length || 0)
                }
              />
            }
          />
          {!combinedItems.length ? (
            <EmptyState
              icon="bell-off-outline"
              title="All clear!"
              message="No pending reminders, events, or tasks for today."
            />
          ) : (
            <FlatList
              data={combinedItems}
              keyExtractor={(item, index) =>
                item._id ? `${item._id}-${index}` : `${index}`
              }
              renderItem={renderReminderItem}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 2 }}
              ItemSeparatorComponent={() => <ListDivider />}
            />
          )}
        </ImprovedCard>
      </ScrollView>

      {periodSheet}
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    padding: 12,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  periodTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  // Lead card
  leadCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leadCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Status pill
  pill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Performance
  perfItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  perfRight: {
    alignItems: 'flex-end',
  },
  perfBarWrap: {
    marginTop: 5,
    height: 4,
    width: 90,
    borderRadius: 4,
    overflow: 'hidden',
  },
  perfBar: {
    height: '100%',
    borderRadius: 4,
  },
  // Reminders
  reminderItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  rDot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBadge: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 5,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  // Skeleton
  skeleton: {
    borderRadius: 6,
  },
  skeletonCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderTopWidth: 3,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 12,
  },
});

export default DashboardScreen;
