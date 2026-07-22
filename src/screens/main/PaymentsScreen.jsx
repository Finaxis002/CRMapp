// screens/PaymentsScreen.jsx — REFACTORED with UI Kit (header compacted)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  FlatList,
  RefreshControl,
  Platform,
  Linking,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { canUser } from '../../utils/permissions';
import { API_BASE_URL } from '../../config';
import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../../components/ui/CustomToast';

// ─── UI Kit imports ────────────────────────────────────────────────────────
import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedCard from '../../components/ui/ImprovedCard';
import ImprovedTextInput from '../../components/ui/ImprovedTextInput';
import ImprovedDropdown from '../../components/ui/ImprovedDropdown';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import BottomSheet from '../../components/ui/BottomSheet';
import EmptyState from '../../components/ui/EmptyState';
import IconButton from '../../components/ui/IconButton';

// ─── API helpers ─────────────────────────────────────────────────────────────
const API_BASE_HOST =
  API_BASE_URL?.replace(/\/$/, '') ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api/v1'
    : 'http://localhost:5000/api/v1');
const API_BASE = `${API_BASE_HOST}/payments`;

const buildApiUrl = url => {
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE_HOST}${url}`;
  return `${API_BASE_HOST}/${url}`;
};

const apiFetch = async (url, options = {}) => {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) throw new Error('Not authenticated');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };
    const response = await fetch(buildApiUrl(url), {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data.data;
  } catch (error) {
    throw error;
  }
};

// ─── Status Badge (internal — simple, keep as is with theme tokens) ──────────
const StatusBadge = ({ status }) => {
  const { colors, borderRadius } = useUISystem();

  const getBadgeBg = () => {
    switch (status) {
      case 'Paid':
      case 'Completed':
        return colors.successSoft;
      case 'Pending':
        return colors.warningSoft;
      case 'Partial':
        return colors.infoSoft;
      case 'Overdue':
        return colors.dangerSoft;
      default:
        return colors.backgroundSecondary;
    }
  };

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: getBadgeBg(), borderRadius: borderRadius.full },
      ]}
    >
      <Text style={[styles.statusText, { color: colors.textSecondary }]}>
        {status}
      </Text>
    </View>
  );
};

// ─── Stats Card (internal — specific layout, theme tokens) ───────────────────
const StatsCard = ({
  label,
  value,
  sub,
  iconName,
  iconColor,
  iconBg,
  valueColor,
  wide,
}) => {
  const { colors, borderRadius } = useUISystem();

  return (
    <ImprovedCard
      variant="outline"
      padding="small"
      style={[wide && { width: '100%' }, { flex: wide ? undefined : 1 }]}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 6,
        }}
      >
        <Text
          style={[styles.statsLabel, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {label}
        </Text>
        <View
          style={[
            styles.statsIconWrap,
            { backgroundColor: iconBg, borderRadius: borderRadius.sm },
          ]}
        >
          <Icon name={iconName} size={13} color={iconColor} />
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        <Text
          style={[styles.statsValue, { color: valueColor }]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {sub && (
          <Text
            style={[
              styles.statsSub,
              { color: colors.textSecondary, textAlign: 'right' },
            ]}
            numberOfLines={1}
          >
            {sub}
          </Text>
        )}
      </View>
    </ImprovedCard>
  );
};

// ─── Slim screen header (shared by both connected & not-connected states) ────
// PageHeader ki jagah compact: title 15/700 + subtitle 11 + right actions
const SlimHeader = ({ colors, borderRadius, showActions, onFilter, onAdd }) => (
  <View
    style={[styles.headerContainer, { backgroundColor: colors.background }]}
  >
    <View style={styles.titleRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          Payments
        </Text>
        <Text
          style={[styles.headerSub, { color: colors.textSecondary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Track payments and collect via Razorpay
        </Text>
      </View>
      {showActions && (
        <View style={styles.headerActions}>
          <IconButton
            name="tune-variant"
            onPress={onFilter}
            color={colors.textSecondary}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            }}
          />
          <ImprovedButton
            title="Payment"
            icon="plus"
            size="small"
            onPress={onAdd}
          />
        </View>
      )}
    </View>
  </View>
);

// ─── Razorpay Connect Card ────────────────────────────────────────────────────
const RazorpayConnectCard = ({ onConnect, loading }) => {
  const { colors, borderRadius } = useUISystem();

  return (
    <ImprovedCard
      variant="outline"
      padding="large"
      style={{ marginHorizontal: 16, marginTop: 4 }}
    >
      <View style={styles.connectHeader}>
        <View
          style={[
            styles.connectIconContainer,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Icon name="card-outline" size={32} color="#6B46C1" />
        </View>
        <View style={styles.connectInfo}>
          <Text style={[styles.connectTitle, { color: colors.textPrimary }]}>
            Razorpay
          </Text>
          <Text
            style={[styles.connectDescription, { color: colors.textSecondary }]}
          >
            Integrate Razorpay & Manage Payments
          </Text>
        </View>
      </View>
      <View
        style={[styles.connectDivider, { backgroundColor: colors.border }]}
      />
      <View style={styles.connectButtonContainer}>
        <ImprovedButton
          title="Connect"
          variant="outline"
          size="medium"
          onPress={onConnect}
          loading={loading}
        />
      </View>
    </ImprovedCard>
  );
};

// ─── Status filter options (currency/mode options ab AddPaymentScreen mein) ──
const STATUS_OPTIONS = [
  { label: 'All Status', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Partial', value: 'Partial' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Overdue', value: 'Overdue' },
  { label: 'Cancelled', value: 'Cancelled' },
];

// ─── Generate Link Modal ──────────────────────────────────────────────────────
const GenerateLinkModal = ({ visible, payment, onClose, onSuccess }) => {
  const { colors, typography, borderRadius } = useUISystem();
  const [description, setDescription] = useState(payment?.description || '');
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`${API_BASE}/${payment._id}/generate-link`, {
        method: 'POST',
        body: { description },
      });
      setLink(data.paymentLink);
      onSuccess('Payment link generated!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await Clipboard.setString(link);
      Alert.alert('Success', 'Link copied to clipboard!');
    } catch {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalContent,
            styles.linkModalContent,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius['2xl'],
              borderTopRightRadius: borderRadius['2xl'],
            },
          ]}
        >
          {/* Grab handle — sheet feel */}
          <View style={styles.sheetHandleWrap}>
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.border }]}
            />
          </View>

          <View style={styles.modalHeader}>
            <Text
              style={[typography.h3, { color: colors.textPrimary, flex: 1 }]}
              numberOfLines={1}
            >
              Generate Payment Link
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text
            style={[
              styles.linkModalDescription,
              { color: colors.textSecondary },
            ]}
          >
            Send a Razorpay payment link to{' '}
            <Text
              style={[styles.linkModalLeadName, { color: colors.textPrimary }]}
            >
              {payment?.leadId?.name}
            </Text>{' '}
            for ₹{payment?.amount?.toLocaleString('en-IN')}
          </Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {link ? (
            <View style={styles.linkContainer}>
              <View
                style={[
                  styles.linkDisplay,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text style={styles.linkText} numberOfLines={2}>
                  {link}
                </Text>
              </View>
              <ImprovedButton
                title="Copy Link"
                variant="primary"
                onPress={copyToClipboard}
                fullWidth
              />
            </View>
          ) : (
            <>
              <ImprovedTextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Description (optional)"
                size="medium"
              />
              <View style={[styles.modalActions, { marginTop: 20 }]}>
                <ImprovedButton
                  title="Cancel"
                  variant="outline"
                  onPress={onClose}
                  style={{ flex: 1 }}
                />
                <ImprovedButton
                  title="Generate"
                  variant="primary"
                  onPress={handleGenerate}
                  loading={loading}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── Main PaymentsScreen ──────────────────────────────────────────────────────
const PaymentsScreen = ({ navigation, route }) => {
  const { colors, typography, borderRadius } = useUISystem();
  const toast = useKitToast();

  const currentUser = useSelector(state => state.auth.user);
  const settings = useSelector(state => state.settings.data);

  const canViewAllLeads = useMemo(
    () => canUser(currentUser, settings, 'view_all_leads'),
    [currentUser, settings],
  );
  const canViewTeamLeads = useMemo(
    () => canUser(currentUser, settings, 'view_team_leads_only'),
    [currentUser, settings],
  );
  const isManager = currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';
  const canFilterByUser = canViewAllLeads || (isManager && canViewTeamLeads);

  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [linkModal, setLinkModal] = useState(null);
  const [razorpayConnected, setRazorpayConnected] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [rzpLoading, setRzpLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await apiFetch(`${API_BASE}/${deleteModal._id}`, { method: 'DELETE' });
      toast.success('Payment deleted.');
      fetchPayments();
      fetchStats();
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
    setDeleteModal(null);
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (statusFilter) params.set('status', statusFilter);
      if (selectedUserId && canFilterByUser)
        params.set('userId', selectedUserId);
      const data = await apiFetch(`${API_BASE}?${params}`);
      setPayments(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (e) {
      console.error(e);
      toast.error('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, selectedUserId, canFilterByUser]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUserId && canFilterByUser)
        params.set('userId', selectedUserId);
      const query = params.toString() ? `?${params}` : '';
      const data = await apiFetch(`${API_BASE}/stats/overview${query}`);
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  }, [selectedUserId, canFilterByUser]);

  const fetchUsers = useCallback(async () => {
    if (!canFilterByUser) return;
    try {
      const data = await apiFetch('/users?limit=100');
      let allUsers = data.data || [];
      if (isManager && !isAdmin && !canViewAllLeads) {
        allUsers = allUsers.filter(u => {
          const mid = u.managerId?._id || u.managerId;
          return (
            String(mid) === String(currentUser._id) ||
            String(u._id) === String(currentUser._id)
          );
        });
      }
      setUsers(allUsers);
    } catch (e) {
      console.error(e);
    }
  }, [canFilterByUser, isManager, isAdmin, canViewAllLeads, currentUser]);

  const checkRazorpayConnection = useCallback(async () => {
    try {
      const data = await apiFetch('/integrations/razorpay/status');
      setRazorpayConnected(data?.connected === true);
    } catch {
      setRazorpayConnected(false);
    }
  }, []);

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Razorpay',
      'Are you sure you want to disconnect Razorpay? Online payments will be paused.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setRzpLoading(true);
            try {
              await apiFetch('/integrations/razorpay/disconnect', {
                method: 'POST',
              });
              setRazorpayConnected(false);
              toast.success('Razorpay disconnected.');
            } catch (e) {
              toast.error('Error: ' + e.message);
            } finally {
              setRzpLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleConnect = async () => {
    setRzpLoading(true);
    try {
      await apiFetch('/integrations/razorpay/connect', { method: 'POST' });
      setRazorpayConnected(true);
      toast.success('Razorpay connected successfully.');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setRzpLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPayments(), fetchStats()]);
    setRefreshing(false);
  };

  // AddPayment screen se payment CREATE hoke wapas aaye tabhi refresh —
  // plain back pe kuch nahi (API calls bachao). Manual = pull-to-refresh.
  useEffect(() => {
    if (!route?.params?.paymentsUpdated) return;
    fetchPayments();
    fetchStats();
    navigation?.setParams?.({ paymentsUpdated: undefined });
  }, [route?.params?.paymentsUpdated, fetchPayments, fetchStats, navigation]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        navigation.replace('Login');
        return;
      }
      setAuthReady(true);
    };
    checkAuth();
  }, [navigation]);

  useEffect(() => {
    if (!authReady) return;
    checkRazorpayConnection();
    fetchPayments();
    fetchStats();
    fetchUsers();
  }, [
    authReady,
    checkRazorpayConnection,
    fetchPayments,
    fetchStats,
    fetchUsers,
  ]);

  const statByStatus = s =>
    stats?.byStatus?.find(x => x._id === s) || { count: 0, totalAmount: 0 };

  const showAllPipelinesCard = canFilterByUser && !selectedUserId;
  const ownedRevenueLabel = showAllPipelinesCard
    ? 'Total Received (All Pipelines)'
    : 'Total Received (Pipelines owned)';
  const involvementLabel = 'Total Received (Pipelines involved)';

  const renderPaymentItem = ({ item }) => (
    <ImprovedCard
      variant="outline"
      padding="medium"
      style={{ marginHorizontal: 16, marginVertical: 4 }}
    >
      <View style={styles.paymentHeader}>
        <View style={styles.paymentLeadInfo}>
          <Text
            style={[styles.paymentLeadName, { color: colors.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.leadId?.name || '—'}
          </Text>
          <Text
            style={[styles.paymentLeadPhone, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.leadId?.phone || ''}
          </Text>
        </View>
        <View style={styles.paymentAmountContainer}>
          <Text
            style={[styles.paymentAmount, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {item.currency === 'INR' ? '₹' : item.currency}
            {item.amount.toLocaleString('en-IN')}
          </Text>
          <Text
            style={[styles.paymentMode, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.paymentMode}
          </Text>
        </View>
      </View>

      <View
        style={[styles.paymentDivider, { backgroundColor: colors.border }]}
      />

      <View style={styles.paymentDetails}>
        <View style={styles.paymentDetailItem}>
          <Text
            style={[styles.paymentDetailLabel, { color: colors.textSecondary }]}
          >
            Status
          </Text>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.paymentDetailItem}>
          <Text
            style={[styles.paymentDetailLabel, { color: colors.textSecondary }]}
          >
            Date
          </Text>
          <Text
            style={[styles.paymentDetailValue, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {item.paymentDate
              ? new Date(item.paymentDate).toLocaleDateString('en-IN')
              : '—'}
          </Text>
        </View>
        <View style={styles.paymentDetailItem}>
          <Text
            style={[styles.paymentDetailLabel, { color: colors.textSecondary }]}
          >
            Lead Owner
          </Text>
          <Text
            style={[styles.paymentDetailValue, { color: colors.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.leadId?.assignedTo?.name || '—'}
          </Text>
        </View>
        <View style={styles.paymentDetailItem}>
          <Text
            style={[styles.paymentDetailLabel, { color: colors.textSecondary }]}
          >
            Recorded By
          </Text>
          <Text
            style={[styles.paymentDetailValue, { color: colors.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.recordedBy?.name || '—'}
          </Text>
        </View>
      </View>

      <View style={[styles.paymentActions, { borderTopColor: colors.border }]}>
        {item.paymentMode === 'Razorpay' && item.status === 'Pending' && (
          <TouchableOpacity
            style={styles.paymentActionButton}
            onPress={() => setLinkModal(item)}
          >
            <Icon name="link-variant" size={16} color={colors.primary} />
            <Text
              style={[styles.paymentActionLinkText, { color: colors.primary }]}
            >
              Generate Link
            </Text>
          </TouchableOpacity>
        )}
        {item.paymentLinkUrl && (
          <TouchableOpacity
            style={styles.paymentActionButton}
            onPress={() => Linking.openURL(item.paymentLinkUrl)}
          >
            <Icon name="open-in-new" size={16} color={colors.success} />
            <Text
              style={[styles.paymentActionOpenText, { color: colors.success }]}
            >
              Open Link
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.paymentActionButton, styles.paymentActionDelete]}
          onPress={() => setDeleteModal(item)}
        >
          <Icon name="trash-can-outline" size={16} color={colors.danger} />
          <Text
            style={[styles.paymentActionDeleteText, { color: colors.danger }]}
          >
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </ImprovedCard>
  );

  const renderHeader = () => (
    <>
      {/* ══ Slim header — title + subtitle left, filter + add right ══ */}
      <SlimHeader
        colors={colors}
        borderRadius={borderRadius}
        showActions
        onFilter={() => setShowFilterModal(true)}
        onAdd={() => navigation?.navigate?.('AddPayment')}
      />

      {/* Razorpay Status */}
      <ImprovedCard
        variant="outline"
        padding="small"
        style={{
          marginHorizontal: 16,
          marginVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={styles.razorpayStatus}>
          <View
            style={[
              styles.statusDot,
              razorpayConnected
                ? styles.statusDotConnected
                : styles.statusDotDisconnected,
            ]}
          />
          <Text
            style={[styles.razorpayStatusText, { color: colors.textPrimary }]}
          >
            Razorpay {razorpayConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        {razorpayConnected ? (
          <ImprovedButton
            title={rzpLoading ? '...' : 'Disconnect'}
            variant="danger"
            size="small"
            onPress={handleDisconnect}
            loading={rzpLoading}
          />
        ) : (
          <ImprovedButton
            title={rzpLoading ? '...' : 'Connect'}
            variant="primary"
            size="small"
            onPress={handleConnect}
            loading={rzpLoading}
          />
        )}
      </ImprovedCard>

      {/* Stats */}
      {stats && (
        <View style={styles.statsGrid}>
          <StatsCard
            label={ownedRevenueLabel}
            value={`₹${(stats.totalAmount || 0).toLocaleString('en-IN')}`}
            sub={`${stats.total} transactions`}
            iconName="wallet-outline"
            iconColor={colors.info || '#3B82F6'}
            iconBg={colors.infoSoft || 'rgba(59,130,246,0.12)'}
            valueColor={colors.primary}
            wide
          />
          {!showAllPipelinesCard && (
            <StatsCard
              label={involvementLabel}
              value={`₹${(stats.involvedTotalAmount || 0).toLocaleString(
                'en-IN',
              )}`}
              sub={`${stats.involvedTotal || 0} transactions`}
              iconName="source-merge"
              iconColor={colors.info || '#3B82F6'}
              iconBg={colors.infoSoft || 'rgba(59,130,246,0.12)'}
              valueColor={colors.primary}
              wide
            />
          )}
          <View style={styles.statsRow}>
            <StatsCard
              label="Paid"
              value={String(statByStatus('Paid').count)}
              sub={`₹${(statByStatus('Paid').totalAmount || 0).toLocaleString(
                'en-IN',
              )}`}
              iconName="check-circle-outline"
              iconColor={colors.success}
              iconBg={colors.successSoft}
              valueColor={colors.success}
            />
            <StatsCard
              label="Pending"
              value={String(statByStatus('Pending').count)}
              sub={`₹${(
                statByStatus('Pending').totalAmount || 0
              ).toLocaleString('en-IN')}`}
              iconName="clock-outline"
              iconColor={colors.warning}
              iconBg={colors.warningSoft}
              valueColor={colors.warning}
            />
          </View>
          <View style={styles.statsRow}>
            <StatsCard
              label="Overdue"
              value={String(statByStatus('Overdue').count)}
              sub={`₹${(
                statByStatus('Overdue').totalAmount || 0
              ).toLocaleString('en-IN')}`}
              iconName="alert-circle-outline"
              iconColor={colors.danger}
              iconBg={colors.dangerSoft}
              valueColor={colors.danger}
            />
            <StatsCard
              label="Partial"
              value={String(statByStatus('Partial').count)}
              sub={`₹${(
                statByStatus('Partial').totalAmount || 0
              ).toLocaleString('en-IN')}`}
              iconName="source-pull"
              iconColor={colors.purple}
              iconBg={colors.purpleSoft}
              valueColor={colors.purple}
            />
          </View>
        </View>
      )}
    </>
  );

  // Not connected screen
  if (!razorpayConnected) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SlimHeader colors={colors} borderRadius={borderRadius} />
        <RazorpayConnectCard onConnect={handleConnect} loading={rzpLoading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <FlatList
        data={payments}
        renderItem={renderPaymentItem}
        keyExtractor={item => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="receipt"
              title="No payments found"
              message="Record your first payment to get started"
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textSecondary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationContainer}>
              <ImprovedButton
                title="← Prev"
                variant="outline"
                size="small"
                onPress={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              />
              <Text
                style={[styles.paginationText, { color: colors.textSecondary }]}
              >
                Page {page} of {totalPages}
              </Text>
              <ImprovedButton
                title="Next →"
                variant="outline"
                size="small"
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              />
            </View>
          ) : null
        }
      />

      {linkModal && (
        <GenerateLinkModal
          visible={!!linkModal}
          payment={linkModal}
          onClose={() => setLinkModal(null)}
          onSuccess={msg => {
            toast.success(msg);
            fetchPayments();
          }}
        />
      )}

      <ConfirmDialog
        visible={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
        variant="danger"
      />

      <BottomSheet
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filters"
        footerLabel="Apply"
        onFooterPress={() => setShowFilterModal(false)}
        rightHeader={
          <TouchableOpacity
            onPress={() => {
              setSelectedUserId('');
              setStatusFilter('');
              setPage(1);
              setShowFilterModal(false);
            }}
          >
            <Text
              style={[
                typography.caption,
                { color: colors.danger, fontWeight: '500' },
              ]}
            >
              Clear All
            </Text>
          </TouchableOpacity>
        }
      >
        {users.length > 0 && (
          <ImprovedDropdown
            label="User"
            placeholder="All Users"
            selectedValue={selectedUserId}
            items={[
              { label: 'All Users', value: '' },
              ...users.map(u => ({ label: u.name, value: u._id })),
            ]}
            onValueChange={v => {
              setSelectedUserId(v);
              setPage(1);
            }}
            searchable
          />
        )}

        <View style={{ height: 16 }} />

        <ImprovedDropdown
          label="Status"
          placeholder="All Status"
          selectedValue={statusFilter}
          items={STATUS_OPTIONS}
          onValueChange={v => {
            setStatusFilter(v);
            setPage(1);
          }}
          searchable={false}
        />
      </BottomSheet>
    </SafeAreaView>
  );
};

// ─── Styles (reduced — only custom styling not covered by UI kit) ────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  // Slim header (Calendar/Kanban standard)
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Sheet grab handle (modals)
  sheetHandleWrap: { alignItems: 'center', paddingBottom: 4 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2 },

  // Razorpay status
  razorpayStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotConnected: { backgroundColor: '#10B981' },
  statusDotDisconnected: { backgroundColor: '#9CA3AF' },
  razorpayStatusText: { fontSize: 12, fontWeight: '500' },

  // Stats
  statsGrid: { paddingHorizontal: 16, marginVertical: 6, gap: 6 },
  statsRow: { flexDirection: 'row', gap: 6 },
  statsLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 2,
    flexShrink: 1,
  },
  statsSub: { fontSize: 11 },
  statsIconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Connect card
  connectHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  connectIconContainer: {
    width: 62,
    height: 62,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectInfo: { flex: 1 },
  connectTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  connectDescription: { fontSize: 13 },
  connectDivider: { height: 1, marginVertical: 16 },
  connectButtonContainer: { flexDirection: 'row', justifyContent: 'flex-end' },

  // Payment card
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  paymentLeadInfo: { flex: 1, minWidth: 0 },
  paymentLeadName: { fontSize: 15, fontWeight: '600' },
  paymentLeadPhone: { fontSize: 12, marginTop: 2 },
  paymentAmountContainer: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: 15, fontWeight: '700' },
  paymentMode: { fontSize: 12, marginTop: 2 },
  paymentDivider: { height: 1, marginVertical: 8 },
  paymentDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentDetailItem: { flex: 1, minWidth: 80 },
  paymentDetailLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentDetailValue: { fontSize: 12 },
  paymentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 12,
  },
  paymentActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentActionLinkText: { fontSize: 12, fontWeight: '500' },
  paymentActionOpenText: { fontSize: 12, fontWeight: '500' },
  paymentActionDelete: { marginLeft: 'auto' },
  paymentActionDeleteText: { fontSize: 12, fontWeight: '500' },

  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 10, fontWeight: '600' },

  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  paginationText: { fontSize: 12 },
  listContent: { flexGrow: 1, paddingBottom: 20 },

  // Modal shared
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { padding: 16, paddingTop: 10, maxHeight: '92%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: { flexDirection: 'row', gap: 10 },

  // Form

  // Error
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, color: '#DC2626' },

  // Lead suggestions

  // Link modal
  linkModalContent: { maxHeight: '70%' },
  linkModalDescription: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  linkModalLeadName: { fontWeight: '600' },
  linkContainer: { marginVertical: 8 },
  linkDisplay: { borderWidth: 1, padding: 12, marginBottom: 12 },
  linkText: {
    fontSize: 13,
    color: '#4F46E5',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default PaymentsScreen;
