import React, { useEffect, useState } from 'react';
import {
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
import PageHeader from '../../components/ui/PageHeader';
import FilterChip from '../../components/ui/FilterChip';
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

const SkeletonBox = ({ width, height, colors, style }) => (
  <View
    style={[
      styles.skeleton,
      {
        width,
        height,
        backgroundColor: colors.skeletonBase,
      },
      style,
      { overflow: 'hidden' },
    ]}
  >
    <View
      style={[styles.shimmer, { backgroundColor: colors.skeletonHighlight }]}
    />
  </View>
);

const SkeletonMetricCard = ({ colors, borderRadius: br }) => (
  <View
    style={[
      styles.skeletonCard,
      {
        backgroundColor: colors.cardBg,
        borderColor: colors.border,
        borderRadius: br.xl,
      },
    ]}
  >
    <SkeletonBox
      width="60%"
      height={12}
      colors={colors}
      style={{ marginBottom: 16 }}
    />
    <SkeletonBox
      width="45%"
      height={28}
      colors={colors}
      style={{ marginBottom: 20 }}
    />
    <SkeletonBox
      width={36}
      height={36}
      colors={colors}
      style={{ position: 'absolute', top: 16, right: 16, borderRadius: br.md }}
    />
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

  const { colors, typography, spacing, borderRadius, elevation, isDark } =
    useUISystem();

  const filterMap = {
    All: 'all',
    Today: 'today',
    'This Week': 'week',
    'This Month': 'month',
  };

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

  // ─── Loading State ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <PageHeader
            title="Dashboard Overview"
            subtitle="Loading dashboard data…"
            style={{ marginBottom: spacing.md }}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.md }}
          >
            <View style={styles.filtersRow}>
              {['All', 'Today', 'This Week', 'This Month'].map(f => (
                <FilterChip key={f} label={f} active={false} disabled />
              ))}
            </View>
          </ScrollView>

          <View style={styles.metricsGrid}>
            {[1, 2, 3, 4, 5].map(i => (
              <SkeletonMetricCard
                key={i}
                colors={colors}
                borderRadius={borderRadius}
              />
            ))}
          </View>

          {/* Skeleton cards for sections */}
          {[1, 2, 3].map(section => (
            <ImprovedCard
              key={section}
              variant="outline"
              style={{ marginBottom: spacing.xl }}
            >
              <SkeletonBox
                width="35%"
                height={18}
                colors={colors}
                style={{ marginBottom: 6 }}
              />
              <SkeletonBox
                width="50%"
                height={12}
                colors={colors}
                style={{ marginBottom: 20 }}
              />
              {[1, 2, 3].map(i => (
                <View key={i} style={styles.skeletonRow}>
                  <SkeletonBox
                    width={40}
                    height={40}
                    colors={colors}
                    style={{ borderRadius: borderRadius.md }}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <SkeletonBox
                      width="55%"
                      height={14}
                      colors={colors}
                      style={{ marginBottom: 6 }}
                    />
                    <SkeletonBox width="40%" height={12} colors={colors} />
                  </View>
                </View>
              ))}
            </ImprovedCard>
          ))}
        </ScrollView>
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
          <PageHeader title="Dashboard" />
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
              { color: colors.textPrimary, fontSize: 14 },
            ]}
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
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: borderRadius.sm,
                overflow: 'hidden',
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

      <ListDivider style={{ marginVertical: spacing.md }} />

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
              { color: colors.primary, fontSize: 14, marginTop: 2 },
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
          size={18}
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
                { color: colors.textPrimary, fontSize: 14 },
              ]}
            >
              {item.title || 'Event'}
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
            >
              {Array.isArray(item.assignedTo)
                ? item.assignedTo.map(u => u?.name || u).join(', ')
                : item.assignedTo?.name || ''}
            </Text>
            {item.note ? (
              <Text
                style={[
                  typography.body2,
                  { color: colors.textSecondary, marginTop: 6, fontSize: 13 },
                ]}
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
                { color: colors.textPrimary, fontSize: 14 },
              ]}
            >
              Task
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
            >
              {item.leadId?.name || 'Lead Name'}
            </Text>
            {item.text ? (
              <Text
                style={[
                  typography.body2,
                  { color: colors.textSecondary, marginTop: 6, fontSize: 13 },
                ]}
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
              { color: colors.textPrimary, fontSize: 14 },
            ]}
          >
            {item.type || 'Reminder'}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
            ]}
          >
            {item.leadId?.name || 'Lead Name'}
          </Text>
          {item.note ? (
            <Text
              style={[
                typography.body2,
                { color: colors.textSecondary, marginTop: 6, fontSize: 13 },
              ]}
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
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={[typography.h4, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={[
              typography.body2,
              { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
            ]}
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
        {/* Header */}
        <PageHeader
          title="Dashboard Overview"
          subtitle={
            `Welcome back${
              user?.name ? `, ${user.name.split(' ')[0]}` : ''
            }! ` +
            (isAdmin || isManager
              ? "Here is the summary of your team's sales performance."
              : 'Here is the summary of your personal sales performance.')
          }
          style={{ marginBottom: spacing.md }}
        />

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.md }}
          contentContainerStyle={styles.filtersRow}
        >
          {['All', 'Today', 'This Week', 'This Month'].map(f => (
            <FilterChip
              key={f}
              label={f}
              active={activeFilter === f}
              onPress={() => setActiveFilter(f)}
            />
          ))}
        </ScrollView>

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
          style={{ marginBottom: spacing.xl, marginTop: spacing.md }}
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
              contentContainerStyle={{ gap: 10 }}
            />
          )}
        </ImprovedCard>

        {/* Team Performance */}
        <ImprovedCard variant="outline" style={{ marginBottom: spacing.xl }}>
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
                  size={40}
                  rounded={borderRadius.md}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.label,
                      { color: colors.textPrimary, fontSize: 14 },
                    ]}
                  >
                    {member.name}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: colors.textSecondary,
                        marginTop: 4,
                        fontWeight: '500',
                      },
                    ]}
                  >
                    {member.leadCount} leads assigned
                  </Text>
                </View>
                <View style={styles.perfRight}>
                  <Text
                    style={[
                      typography.label,
                      { color: colors.textPrimary, fontSize: 15 },
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
        <ImprovedCard variant="outline" style={{ marginBottom: spacing.xl }}>
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
              contentContainerStyle={{ gap: 4 }}
              ItemSeparatorComponent={() => <ListDivider />}
            />
          )}
        </ImprovedCard>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
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
    marginBottom: 18,
  },
  // Lead card
  leadCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leadCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Status pill
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Performance
  perfItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  perfRight: {
    alignItems: 'flex-end',
  },
  perfBarWrap: {
    marginTop: 6,
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
    gap: 14,
    paddingVertical: 12,
  },
  rDot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
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
    width: '48%',
    minWidth: 160,
    padding: 18,
    borderWidth: 1,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
});

export default DashboardScreen;
