// screens/PaymentsScreen.jsx — REFACTORED with UI Kit
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Platform,
  Linking,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canUser } from '../../utils/permissions';
import { API_BASE_URL } from '../../config';
import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../../components/ui/CustomToast';

// ─── UI Kit imports ────────────────────────────────────────────────────────
import PageHeader from '../../components/ui/PageHeader';
import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedCard from '../../components/ui/ImprovedCard';
import ImprovedTextInput from '../../components/ui/ImprovedTextInput';
import ImprovedDropdown from '../../components/ui/ImprovedDropdown';
import DateField from '../../components/ui/DateField';
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
  const { colors, borderRadius, elevation } = useUISystem();

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
          marginBottom: 8,
        }}
      >
        <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>
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
        }}
      >
        <Text style={[styles.statsValue, { color: valueColor }]}>{value}</Text>
        {sub && (
          <Text
            style={[
              styles.statsSub,
              { color: colors.textSecondary, textAlign: 'right' },
            ]}
          >
            {sub}
          </Text>
        )}
      </View>
    </ImprovedCard>
  );
};

// ─── Razorpay Connect Card ────────────────────────────────────────────────────
const RazorpayConnectCard = ({ onConnect, loading }) => {
  const { colors, borderRadius } = useUISystem();

  return (
    <ImprovedCard
      variant="outline"
      padding="large"
      style={{ marginHorizontal: 16 }}
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

// ─── Currency & Payment Mode options ─────────────────────────────────────────
const CURRENCY_OPTIONS = [
  { label: 'INR', value: 'INR' },
  { label: 'USD', value: 'USD' },
  { label: 'EUR', value: 'EUR' },
];

const PAYMENT_MODE_OPTIONS = [
  { label: 'Razorpay (Online Checkout)', value: 'Razorpay' },
  { label: 'UPI (Manual)', value: 'UPI' },
  { label: 'Bank Transfer', value: 'Bank Transfer' },
  { label: 'Cash', value: 'Cash' },
  { label: 'Cheque', value: 'Cheque' },
];

const STATUS_OPTIONS = [
  { label: 'All Status', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Partial', value: 'Partial' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Overdue', value: 'Overdue' },
  { label: 'Cancelled', value: 'Cancelled' },
];

// ─── Payment Modal ────────────────────────────────────────────────────────────
const PaymentModal = ({ visible, onClose, onSuccess }) => {
  const { colors, typography, spacing, borderRadius } = useUISystem();
  const toast = useKitToast();

  const [form, setForm] = useState({
    leadId: '',
    amount: '',
    currency: 'INR',
    paymentMode: 'Razorpay',
    description: '',
    dueDate: '',
  });
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadSuggestions, setLeadSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showLeadSuggestions, setShowLeadSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const searchLeads = useCallback(async q => {
    if (!q.trim()) {
      setLeadSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const data = await apiFetch(
        `/leads?search=${encodeURIComponent(q)}&limit=8`,
      );
      const payload = data?.data || data || [];
      setLeadSuggestions(Array.isArray(payload) ? payload : []);
    } catch {
      setLeadSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (leadSearch) searchLeads(leadSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch, searchLeads]);

  const handleManual = async () => {
    setLoading(true);
    setError('');
    try {
      await apiFetch(API_BASE, {
        method: 'POST',
        body: {
          leadId: form.leadId,
          amount: Number(form.amount),
          currency: form.currency,
          paymentMode: form.paymentMode,
          description: form.description,
          dueDate: form.dueDate || undefined,
        },
      });
      onSuccess('Payment recorded!');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const { payment, razorpayOrder } = await apiFetch(
        `${API_BASE}/razorpay/create-order`,
        {
          method: 'POST',
          body: {
            leadId: form.leadId,
            amount: Number(form.amount),
            currency: form.currency,
            description: form.description,
            dueDate: form.dueDate || undefined,
          },
        },
      );

      Alert.alert(
        'Razorpay Checkout',
        `Order created: ${razorpayOrder.id}\nAmount: ₹${razorpayOrder.amount}`,
        [
          {
            text: 'Simulate Payment',
            onPress: async () => {
              try {
                await apiFetch(`${API_BASE}/razorpay/verify`, {
                  method: 'POST',
                  body: {
                    razorpay_order_id: razorpayOrder.id,
                    razorpay_payment_id: 'pay_simulated',
                    razorpay_signature: 'simulated_signature',
                    paymentId: payment._id,
                  },
                });
                onSuccess('Payment successful! ✓');
                onClose();
              } catch (err) {
                setError('Verification failed: ' + err.message);
              }
              setLoading(false);
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
        ],
      );
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.leadId || !form.amount || Number(form.amount) <= 0) {
      setError('Lead and a valid amount are required.');
      return;
    }
    form.paymentMode === 'Razorpay' ? handleRazorpayCheckout() : handleManual();
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) set('dueDate', selectedDate.toISOString().split('T')[0]);
  };

  const renderLeadSuggestion = ({ item }) => (
    <TouchableOpacity
      style={[styles.leadSuggestionItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        set('leadId', item._id);
        setSelectedLead(item);
        setLeadSearch('');
        setShowLeadSuggestions(false);
      }}
    >
      <Text style={[styles.leadSuggestionName, { color: colors.textPrimary }]}>
        {item.name || 'Unnamed'}
      </Text>
      <Text
        style={[styles.leadSuggestionPhone, { color: colors.textSecondary }]}
      >
        {item.phone || 'No phone'}
      </Text>
    </TouchableOpacity>
  );

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
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius['2xl'],
              borderTopRightRadius: borderRadius['2xl'],
            },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border, marginBottom: 16 },
            ]}
          >
            <Text
              style={[typography.h3, { color: colors.textPrimary, flex: 1 }]}
            >
              Record Payment
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Lead */}
            {form.leadId && selectedLead ? (
              <View
                style={[
                  styles.selectedLeadContainer,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.selectedLeadText,
                    { color: colors.textPrimary },
                  ]}
                >
                  {`${selectedLead.name || 'Unnamed'} — ${
                    selectedLead.phone || 'No phone'
                  }`}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    set('leadId', '');
                    setSelectedLead(null);
                    setLeadSearch('');
                  }}
                >
                  <Icon
                    name="close-circle"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginBottom: spacing.md }}>
                <Text
                  style={[
                    typography.label,
                    { color: colors.textPrimary, marginBottom: spacing.xs },
                  ]}
                >
                  Lead *
                </Text>
                <View
                  style={[
                    styles.input,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 14 }}
                    placeholder="Search lead by name or phone…"
                    placeholderTextColor={colors.placeholder}
                    value={leadSearch}
                    onChangeText={text => {
                      setLeadSearch(text);
                      setShowLeadSuggestions(true);
                      if (selectedLead) {
                        setSelectedLead(null);
                        set('leadId', '');
                      }
                    }}
                    onFocus={() => setShowLeadSuggestions(true)}
                  />
                </View>
                {showLeadSuggestions && leadSearch && (
                  <View
                    style={[
                      styles.suggestionsContainer,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    {searching ? (
                      <View
                        style={[
                          styles.suggestionItem,
                          { borderBottomColor: colors.border },
                        ]}
                      >
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                        <Text
                          style={[
                            styles.suggestionText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Searching…
                        </Text>
                      </View>
                    ) : leadSuggestions.length > 0 ? (
                      leadSuggestions
                        .slice(0, 8)
                        .map(item => (
                          <View key={item._id}>
                            {renderLeadSuggestion({ item })}
                          </View>
                        ))
                    ) : (
                      <View
                        style={[
                          styles.suggestionItem,
                          { borderBottomColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.suggestionText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          No leads found.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Amount & Currency */}
            <View style={styles.rowFormGroup}>
              <View style={styles.flex1}>
                <ImprovedTextInput
                  label="Amount *"
                  value={form.amount}
                  onChangeText={text => set('amount', text)}
                  placeholder="0"
                  keyboardType="numeric"
                  size="medium"
                />
              </View>
              <View style={styles.currencyContainer}>
                <ImprovedDropdown
                  label="Currency"
                  placeholder="INR"
                  selectedValue={form.currency}
                  items={CURRENCY_OPTIONS}
                  onValueChange={v => set('currency', v)}
                  searchable={false}
                />
              </View>
            </View>

            {/* Payment Mode */}
            <ImprovedDropdown
              label="Payment Mode *"
              selectedValue={form.paymentMode}
              items={PAYMENT_MODE_OPTIONS}
              onValueChange={v => set('paymentMode', v)}
              searchable={false}
            />

            {/* Description */}
            <ImprovedTextInput
              label="Description"
              value={form.description}
              onChangeText={text => set('description', text)}
              placeholder="Invoice / purpose…"
              size="medium"
            />

            {/* Due Date */}
            <DateField
              value={form.dueDate || ''}
              placeholder="Select Due Date"
              mode="date"
              onPress={() => setShowDatePicker(true)}
            />
            {showDatePicker && (
              <DateTimePicker
                value={form.dueDate ? new Date(form.dueDate) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
            )}

            {/* Actions */}
            <View style={[styles.modalActions, { marginTop: spacing.xl }]}>
              <ImprovedButton
                title="Cancel"
                variant="outline"
                onPress={onClose}
                style={{ flex: 1 }}
              />
              <ImprovedButton
                title={
                  form.paymentMode === 'Razorpay'
                    ? 'Pay via Razorpay →'
                    : 'Record Payment'
                }
                variant="primary"
                onPress={handleSubmit}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

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
          <View style={styles.modalHeader}>
            <Text
              style={[typography.h3, { color: colors.textPrimary, flex: 1 }]}
            >
              Generate Payment Link
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={24} color={colors.textSecondary} />
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
                <Text style={styles.linkText}>{link}</Text>
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
const PaymentsScreen = ({ navigation }) => {
  const { colors, typography, borderRadius, spacing } = useUISystem();
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
  const [showModal, setShowModal] = useState(false);
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
          <Text style={[styles.paymentLeadName, { color: colors.textPrimary }]}>
            {item.leadId?.name || '—'}
          </Text>
          <Text
            style={[styles.paymentLeadPhone, { color: colors.textSecondary }]}
          >
            {item.leadId?.phone || ''}
          </Text>
        </View>
        <View style={styles.paymentAmountContainer}>
          <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>
            {item.currency === 'INR' ? '₹' : item.currency}
            {item.amount.toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.paymentMode, { color: colors.textSecondary }]}>
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
      {/* ══ HEADER with PageHeader + right prop ══ */}
      <View
        style={[styles.headerContainer, { backgroundColor: colors.background }]}
      >
        <PageHeader
          title="Payments"
          subtitle="Track payments and collect via Razorpay"
          right={
            <View style={styles.headerActions}>
              <IconButton
                name="tune-variant"
                onPress={() => setShowFilterModal(true)}
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
                onPress={() => setShowModal(true)}
              />
            </View>
          }
        />
      </View>

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
        <View
          style={[
            styles.headerContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <PageHeader
            title="Payments"
            subtitle="Track payments and collect via Razorpay"
          />
        </View>
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
          <EmptyState
            icon="receipt"
            title="No payments found"
            message="Record your first payment to get started"
          />
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

      <PaymentModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={msg => {
          toast.success(msg);
          fetchPayments();
          fetchStats();
        }}
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
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

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
  },
  statsValue: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 2,
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
  },
  paymentLeadInfo: { flex: 1 },
  paymentLeadName: { fontSize: 16, fontWeight: '600' },
  paymentLeadPhone: { fontSize: 12, marginTop: 2 },
  paymentAmountContainer: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: 16, fontWeight: 'bold' },
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
  modalContent: { padding: 20, maxHeight: '90%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: { flexDirection: 'row', gap: 12 },

  // Form
  rowFormGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  flex1: { flex: 1 },
  currencyContainer: { width: 100 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },

  // Error
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 14, color: '#DC2626' },

  // Lead suggestions
  suggestionsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 1000,
  },
  suggestionsList: { maxHeight: 200 },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  leadSuggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  leadSuggestionName: { fontSize: 14, fontWeight: '500' },
  leadSuggestionPhone: { fontSize: 12 },
  suggestionText: { fontSize: 14 },
  selectedLeadContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  selectedLeadText: { fontSize: 14 },

  // Link modal
  linkModalContent: { maxHeight: '70%' },
  linkModalDescription: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  linkModalLeadName: { fontWeight: '600' },
  linkContainer: { marginVertical: 8 },
  linkDisplay: { borderWidth: 1, padding: 12, marginBottom: 12 },
  linkText: {
    fontSize: 14,
    color: '#4F46E5',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default PaymentsScreen;
