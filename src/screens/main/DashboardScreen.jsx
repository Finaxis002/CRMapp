import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';

import { dashboardService } from '../../services/dashboardService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_SMALL = SCREEN_WIDTH < 640;

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatCurrency = value =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const getInitials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

const statusConfig = {
  Won: { bg: 'successSoft', text: 'success', label: 'Won' },
  Active: { bg: 'warnSoft', text: 'warn', label: 'Active' },
  Lost: { bg: 'redSoft', text: 'red', label: 'Lost' },
  Pipeline: { bg: 'purpleSoft', text: 'purple', label: 'Pipeline' },
  New: { bg: 'accentSoft', text: 'accent', label: 'New' },
};

const reminderIcon = (type = '') => {
  const t = type.toLowerCase();
  if (t.includes('call')) return { icon: 'phone', color: 'accent' };
  if (t.includes('email')) return { icon: 'mail', color: 'success' };
  if (t.includes('meet')) return { icon: 'video', color: 'warn' };
  return { icon: 'clock', color: 'purple' };
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

// ─── Components ───────────────────────────────────────────────────────────

const StatusPill = ({ status, colors }) => {
  const cfg = statusConfig[status] || {
    bg: 'accentSoft',
    text: 'accent',
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

const OwnerAvatar = ({ name, colors }) => (
  <View style={styles.ownerChip}>
    <View style={[styles.avatar, { backgroundColor: colors.gradientStart }]}>
      <Text style={styles.avatarText}>{getInitials(name)}</Text>
    </View>
    <Text style={[styles.ownerName, { color: colors.text1 }]}>
      {name?.split(' ')[0] || '—'}
    </Text>
  </View>
);

const PerfBar = ({ ratio, colors }) => (
  <View style={[styles.perfBarWrap, { backgroundColor: colors.border }]}>
    <View
      style={[
        styles.perfBar,
        {
          width: `${Math.round(Math.min(ratio, 1) * 100)}%`,
          backgroundColor: colors.accent,
        },
      ]}
    />
  </View>
);

const MetricCard = ({ item, colors, onPress }) => (
  <TouchableOpacity
    activeOpacity={onPress ? 0.85 : 1}
    onPress={onPress}
    style={[
      styles.mCard,
      {
        backgroundColor: colors.cardBg,
        borderColor: colors.border,
        borderTopColor:
          item.color === 'yellow'
            ? colors.warn
            : item.color === 'green'
            ? colors.success
            : item.color === 'purple'
            ? colors.purple
            : item.color === 'cyan'
            ? colors.cyan
            : colors.accent,
      },
    ]}
  >
    <View
      style={[
        styles.mIcon,
        {
          backgroundColor:
            item.color === 'yellow'
              ? colors.warnSoft
              : item.color === 'green'
              ? colors.successSoft
              : item.color === 'purple'
              ? colors.purpleSoft
              : item.color === 'cyan'
              ? colors.cyanSoft
              : colors.accentSoft,
        },
      ]}
    >
      <Feather
        name={item.icon}
        size={18}
        color={
          item.color === 'yellow'
            ? colors.warn
            : item.color === 'green'
            ? colors.success
            : item.color === 'purple'
            ? colors.purple
            : item.color === 'cyan'
            ? colors.cyan
            : colors.accent
        }
      />
    </View>
    <Text style={[styles.mLabel, { color: colors.text2 }]}>{item.label}</Text>
    <Text
      style={[
        styles.mValue,
        { color: colors.text1, fontSize: item.label === 'Collected' ? 22 : 26 },
      ]}
    >
      {item.value}
    </Text>
  </TouchableOpacity>
);

const FilterBadge = ({ label, active, colors, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    style={[
      styles.badge,
      active
        ? { backgroundColor: colors.accent }
        : { backgroundColor: colors.cardBg },
      { borderColor: colors.border },
    ]}
  >
    <Text style={[styles.badgeText, { color: active ? '#fff' : colors.text2 }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Skeleton components ───────────────────────────────────────────────────

const SkeletonBox = ({ width, height, colors, style }) => (
  <View
    style={[
      styles.skeleton,
      {
        width,
        height,
        backgroundColor: colors.cardBg,
      },
      style,
      { overflow: 'hidden' },
    ]}
  >
    <View style={[styles.shimmer, { backgroundColor: colors.accentSoft }]} />
  </View>
);

const SkeletonMetricCard = ({ colors }) => (
  <View
    style={[
      styles.skeletonCard,
      { backgroundColor: colors.cardBg, borderColor: colors.border },
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
      style={{ position: 'absolute', top: 16, right: 16, borderRadius: 10 }}
    />
  </View>
);

// ─── Main Component ─────────────────────────────────────────────────────────

const DashboardScreen = ({ navigation }) => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [user, setUser] = useState(null);

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const colors = {
    accent: '#5a7bf6',
    accentDark: '#4a68e0',
    accentSoft: isDark ? 'rgba(90,123,246,0.15)' : 'rgba(90,123,246,0.10)',
    accentBorder: isDark ? 'rgba(90,123,246,0.22)' : 'rgba(90,123,246,0.20)',
    accentShadow: 'rgba(90,123,246,0.25)',
    success: '#12B76A',
    successSoft: isDark ? 'rgba(18,183,106,0.13)' : 'rgba(18,183,106,0.10)',
    warn: '#F79009',
    warnSoft: isDark ? 'rgba(247,144,9,0.13)' : 'rgba(247,144,9,0.10)',
    purple: '#7A5AF8',
    purpleSoft: isDark ? 'rgba(122,90,248,0.13)' : 'rgba(122,90,248,0.10)',
    cyan: '#0BA5EC',
    cyanSoft: isDark ? 'rgba(11,165,236,0.13)' : 'rgba(11,165,236,0.10)',
    red: '#F04438',
    redSoft: isDark ? 'rgba(240,68,56,0.13)' : 'rgba(240,68,56,0.10)',
    text1: isDark ? '#F8FAFC' : '#111827',
    text2: isDark ? '#94A3B8' : '#6B7280',
    text3: isDark ? '#64748B' : '#9CA3AF',
    border: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)',
    cardBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    gradientStart: '#5a7bf6',
    gradientEnd: '#7A5AF8',
  };

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

  const handleNavigate = (path, params = {}) => {
    if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate(path.replace(/^\//, ''), params);
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.cardBg }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text1 }]}>
                Dashboard Overview
              </Text>
              <Text style={[styles.sub, { color: colors.text2 }]}>
                Loading dashboard data…
              </Text>
            </View>
          </View>

          <View style={styles.filtersRow}>
            {['All', 'Today', 'This Week', 'This Month'].map(f => (
              <View
                key={f}
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.text3 }]}>
                  {f}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.metricsGrid}>
            {[1, 2, 3, 4, 5].map(i => (
              <SkeletonMetricCard key={i} colors={colors} />
            ))}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
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
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={styles.skeletonRow}>
                <SkeletonBox width="45%" height={14} colors={colors} />
                <SkeletonBox width="30%" height={14} colors={colors} />
                <SkeletonBox width="25%" height={14} colors={colors} />
              </View>
            ))}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
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
                  style={{ borderRadius: 12 }}
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
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
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
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={styles.skeletonRow}>
                <SkeletonBox
                  width={36}
                  height={36}
                  colors={colors}
                  style={{ borderRadius: 10 }}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <SkeletonBox
                    width="60%"
                    height={14}
                    colors={colors}
                    style={{ marginBottom: 6 }}
                  />
                  <SkeletonBox
                    width="50%"
                    height={12}
                    colors={colors}
                    style={{ marginBottom: 6 }}
                  />
                  <SkeletonBox width="40%" height={12} colors={colors} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.cardBg }]}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.text1 }]}>Dashboard</Text>
          <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

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

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  const combinedItems = [
    ...(overview.todayReminders || []).map(r => ({
      ...r,
      _itemType: 'reminder',
    })),
    ...(overview.todayEvents || []).map(e => ({ ...e, _itemType: 'event' })),
    ...(overview.todayTasks || []).map(t => ({ ...t, _itemType: 'task' })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const renderLeadItem = ({ item: lead }) => (
    <View
      style={[
        styles.leadCard,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
      ]}
    >
      <View style={styles.leadCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.leadCardLabel, { color: colors.text3 }]}>
            LEAD NAME
          </Text>
          <Text style={[styles.leadCardName, { color: colors.text1 }]}>
            {lead.name}
          </Text>
        </View>
        <View style={styles.leadCardRight}>
          <Text
            style={[
              styles.leadCardDate,
              {
                color: colors.text2,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.05)',
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
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.leadCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.leadCardLabel, { color: colors.text3 }]}>
            ASSIGNED TO
          </Text>
          <OwnerAvatar
            name={lead.assignedTo?.name || 'Unassigned'}
            colors={colors}
          />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.leadCardLabel, { color: colors.text3 }]}>
            DEAL VALUE
          </Text>
          <Text style={[styles.leadCardValue, { color: colors.accent }]}>
            {lead.dealValue ? formatCurrency(lead.dealValue) : '—'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderReminderItem = ({ item }) => {
    if (item._itemType === 'event') {
      return (
        <View style={styles.reminderItem}>
          <View style={[styles.rDot, { backgroundColor: colors.purpleSoft }]}>
            <Feather name="calendar" size={18} color={colors.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rType, { color: colors.text1 }]}>
              {item.title || 'Event'}
            </Text>
            <Text style={[styles.rLead, { color: colors.text2 }]}>
              {Array.isArray(item.assignedTo)
                ? item.assignedTo.map(u => u?.name || u).join(', ')
                : item.assignedTo?.name || ''}
            </Text>
            {item.note ? (
              <Text style={[styles.rNote, { color: colors.text2 }]}>
                {item.note}
              </Text>
            ) : null}
            <Text
              style={[
                styles.rTime,
                {
                  color: colors.accent,
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.accentBorder,
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
          <View style={[styles.rDot, { backgroundColor: colors.purpleSoft }]}>
            <Feather name="check-circle" size={18} color={colors.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rType, { color: colors.text1 }]}>Task</Text>
            <Text style={[styles.rLead, { color: colors.text2 }]}>
              {item.leadId?.name || 'Lead Name'}
            </Text>
            {item.text ? (
              <Text style={[styles.rNote, { color: colors.text2 }]}>
                {item.text}
              </Text>
            ) : null}
            <Text
              style={[
                styles.rTime,
                {
                  color: colors.accent,
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.accentBorder,
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
    const { icon, color } = reminderIcon(item.type);
    return (
      <View style={styles.reminderItem}>
        <View
          style={[
            styles.rDot,
            {
              backgroundColor:
                color === 'success'
                  ? colors.successSoft
                  : color === 'warn'
                  ? colors.warnSoft
                  : color === 'purple'
                  ? colors.purpleSoft
                  : colors.accentSoft,
            },
          ]}
        >
          <Feather
            name={icon}
            size={18}
            color={
              color === 'success'
                ? colors.success
                : color === 'warn'
                ? colors.warn
                : color === 'purple'
                ? colors.purple
                : colors.accent
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rType, { color: colors.text1 }]}>
            {item.type || 'Reminder'}
          </Text>
          <Text style={[styles.rLead, { color: colors.text2 }]}>
            {item.leadId?.name || 'Lead Name'}
          </Text>
          {item.note ? (
            <Text style={[styles.rNote, { color: colors.text2 }]}>
              {item.note}
            </Text>
          ) : null}
          <Text
            style={[
              styles.rTime,
              {
                color: colors.accent,
                backgroundColor: colors.accentSoft,
                borderColor: colors.accentBorder,
              },
            ]}
          >
            {item.reminderTime || 'Time not set'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text1 }]}>
              Dashboard Overview
            </Text>
            <Text style={[styles.sub, { color: colors.text2 }]}>
              Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!{' '}
              {isAdmin || isManager
                ? "Here is the summary of your team's sales performance."
                : 'Here is the summary of your personal sales performance.'}
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          {['All', 'Today', 'This Week', 'This Month'].map(f => (
            <FilterBadge
              key={f}
              label={f}
              active={activeFilter === f}
              colors={colors}
              onPress={() => setActiveFilter(f)}
            />
          ))}
        </View>

        {/* Metrics */}
        <View style={styles.metricsGrid}>
          {metrics.map(m => (
            <MetricCard
              key={m.label}
              item={m}
              colors={colors}
              onPress={() => {
                if (m.label === 'Collected') handleNavigate('/payments');
                else if (m.filterValue !== null) {
                  handleNavigate('/leads', buildLeadParams(m.filterValue));
                }
              }}
            />
          ))}
        </View>

        {/* Recent Leads */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHead}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text1 }]}>
                Recent Leads
              </Text>
              <Text style={[styles.cardSub, { color: colors.text2 }]}>
                {isAdmin
                  ? 'Latest lead entries from the entire team'
                  : isManager
                  ? 'Latest lead entries from your team'
                  : 'Your personally assigned latest leads'}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.viewAll,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.accentBorder,
                },
              ]}
              onPress={() => handleNavigate('/leads')}
            >
              <Text style={[styles.viewAllText, { color: colors.accent }]}>
                View all
              </Text>
            </TouchableOpacity>
          </View>

          {!overview.recentLeads?.length ? (
            <Text style={[styles.emptyState, { color: colors.text3 }]}>
              No recent leads found.
            </Text>
          ) : (
            <FlatList
              data={overview.recentLeads}
              keyExtractor={item => item._id}
              renderItem={renderLeadItem}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 10 }}
            />
          )}
        </View>

        {/* Team Performance */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHead}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text1 }]}>
                Team Performance
              </Text>
              <Text style={[styles.cardSub, { color: colors.text2 }]}>
                Top contributors based on lead count
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.viewAll,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.accentBorder,
                },
              ]}
              onPress={() => handleNavigate('/reports')}
            >
              <Text style={[styles.viewAllText, { color: colors.accent }]}>
                See report
              </Text>
            </TouchableOpacity>
          </View>

          {!overview.teamPerformance?.length ? (
            <Text style={[styles.emptyState, { color: colors.text3 }]}>
              No performance data available.
            </Text>
          ) : (
            overview.teamPerformance.map(member => (
              <View key={member.userId || member.name} style={styles.perfItem}>
                <View
                  style={[
                    styles.perfAvatar,
                    {
                      backgroundColor: colors.accentSoft,
                      borderColor: colors.accentBorder,
                    },
                  ]}
                >
                  <Text
                    style={[styles.perfAvatarText, { color: colors.accent }]}
                  >
                    {getInitials(member.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.perfName, { color: colors.text1 }]}>
                    {member.name}
                  </Text>
                  <Text style={[styles.perfMeta, { color: colors.text2 }]}>
                    {member.leadCount} leads assigned
                  </Text>
                </View>
                <View style={styles.perfRight}>
                  <Text style={[styles.perfVal, { color: colors.text1 }]}>
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
        </View>

        {/* Reminders, Events & Tasks */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text1 }]}>
                Today's Reminders, Events & Tasks
              </Text>
              <Text style={[styles.cardSub, { color: colors.text2 }]}>
                Pending follow-ups for today
              </Text>
            </View>
            <View
              style={[
                styles.rCount,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.accentBorder,
                },
              ]}
            >
              <Text style={[styles.rCountText, { color: colors.accent }]}>
                {(overview.todayReminders?.length || 0) +
                  (overview.todayEvents?.length || 0) +
                  (overview.todayTasks?.length || 0)}
              </Text>
            </View>
          </View>

          {!combinedItems.length ? (
            <Text style={[styles.emptyState, { color: colors.text3 }]}>
              No pending reminders, events, or tasks for today.
            </Text>
          ) : (
            <FlatList
              data={combinedItems}
              keyExtractor={(item, index) =>
                item._id ? `${item._id}-${index}` : `${index}`
              }
              renderItem={renderReminderItem}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 4 }}
              ItemSeparatorComponent={() => (
                <View
                  style={[
                    styles.itemSeparator,
                    { backgroundColor: colors.border },
                  ]}
                />
              )}
            />
          )}
        </View>
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  mCard: {
    width: IS_SMALL ? '47%' : '18.5%',
    flex: IS_SMALL ? undefined : 1,
    minWidth: 160,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderTopWidth: 3,
  },
  mIcon: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  mValue: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  viewAll: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  leadCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  leadCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leadCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  leadCardName: {
    fontSize: 14,
    fontWeight: '600',
  },
  leadCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadCardDate: {
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  leadCardValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.4,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ownerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  ownerName: {
    fontSize: 13,
    fontWeight: '500',
  },
  perfItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  perfAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  perfAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  perfName: {
    fontSize: 14,
    fontWeight: '600',
  },
  perfMeta: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  perfRight: {
    alignItems: 'flex-end',
  },
  perfVal: {
    fontSize: 15,
    fontWeight: '600',
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
  rCount: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  rCountText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reminderItem: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 12,
  },
  rDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rType: {
    fontSize: 14,
    fontWeight: '600',
  },
  rLead: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  rNote: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  rTime: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  itemSeparator: {
    height: 1,
    marginVertical: 2,
  },
  emptyState: {
    fontSize: 14,
    paddingVertical: 30,
    textAlign: 'center',
    fontWeight: '500',
  },
  skeleton: {
    borderRadius: 6,
  },
  skeletonCard: {
    width: IS_SMALL ? '47%' : '18.5%',
    flex: IS_SMALL ? undefined : 1,
    minWidth: 160,
    borderRadius: 16,
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
