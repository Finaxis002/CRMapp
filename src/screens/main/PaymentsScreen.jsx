// screens/PaymentsScreen.jsx
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
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canUser } from '../../utils/permissions';
import { API_BASE_URL } from '../../config';
import { useTheme } from '../../contexts/ThemeContext';

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

// ─── Theme ───────────────────────────────────────────────────────────────────
const getT = isDark => ({
  bg: isDark ? '#030712' : '#F9FAFB',
  card: isDark ? '#0f172a' : '#FFFFFF',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#D1D5DB',
  text1: isDark ? '#f1f5f9' : '#111827',
  text2: isDark ? '#94a3b8' : '#6B7280',
  text3: isDark ? '#64748b' : '#9CA3AF',
  inputBg: isDark ? '#1e293b' : '#FFFFFF',
  inputBorder: isDark ? 'rgba(255,255,255,0.12)' : '#D1D5DB',
  divider: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
  badgePaid: isDark ? 'rgba(16,185,129,0.2)' : '#D1FAE5',
  badgePending: isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7',
  badgePartial: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE',
  badgeOverdue: isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2',
  badgeCancelled: isDark ? 'rgba(156,163,175,0.15)' : '#F3F4F6',
  badgeText: isDark ? '#e2e8f0' : '#374151',
  modalBg: isDark ? '#0f172a' : '#FFFFFF',
  selectModalBg: isDark ? '#1e293b' : '#FFFFFF',
  selectItemBg: isDark ? '#1e293b' : '#FFFFFF',
  selectItemHover: isDark ? '#334155' : '#F3F4F6',
  connectCardBorder: isDark ? 'rgba(139,92,246,0.3)' : '#E9D5FF',
  toastBg: isDark ? '#1e293b' : '#1F2937',
  emptyIcon: isDark ? '#374151' : '#D1D5DB',
  filterBtnBg: isDark ? '#1e293b' : '#FFFFFF',
  selectedLeadBg: isDark ? '#1e293b' : '#F9FAFB',
  linkDisplayBg: isDark ? '#1e293b' : '#F9FAFB',
  connectDivider: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F0',
  connectIconBorder: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
  connectIconBg: isDark ? '#1e293b' : '#FFFFFF',
  paginationBorder: isDark ? 'rgba(255,255,255,0.10)' : '#D1D5DB',
});

// ─── Custom Select Field (replaces all Pickers) ───────────────────────────────
const SelectField = ({ label, value, options, onChange, T }) => {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <>
      {label && <Text style={[styles.formLabel, { color: T.text1 }]}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.selectTrigger,
          { borderColor: T.inputBorder, backgroundColor: T.inputBg },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectTriggerText, { color: T.text1 }]} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Icon name="chevron-down" size={16} color={T.text2} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.selectOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View
            style={[
              styles.selectSheet,
              { backgroundColor: T.selectModalBg, borderColor: T.border },
            ]}
          >
            <View style={[styles.selectSheetHeader, { borderBottomColor: T.border }]}>
              {label && (
                <Text style={[styles.selectSheetTitle, { color: T.text1 }]}>{label}</Text>
              )}
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.selectSheetClose}>
                <Icon name="close" size={20} color={T.text2} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={item => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.selectOption,
                      { borderBottomColor: T.divider },
                      isSelected && { backgroundColor: T.selectItemHover },
                    ]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        { color: isSelected ? '#4F46E5' : T.text1 },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Icon name="checkmark" size={18} color="#4F46E5" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status, T }) => {
  const getBadgeBg = () => {
    switch (status) {
      case 'Paid':
      case 'Completed':
        return T.badgePaid;
      case 'Pending':
        return T.badgePending;
      case 'Partial':
        return T.badgePartial;
      case 'Overdue':
        return T.badgeOverdue;
      default:
        return T.badgeCancelled;
    }
  };

  return (
    <View style={[styles.statusBadge, { backgroundColor: getBadgeBg() }]}>
      <Text style={[styles.statusText, { color: T.badgeText }]}>{status}</Text>
    </View>
  );
};

// ─── Stats Card ───────────────────────────────────────────────────────────────
const StatsCard = ({ label, value, sub, iconName, iconColor, iconBg, valueColor, wide, T }) => (
  <View
    style={[
      styles.statsCard,
      { backgroundColor: T.card, borderColor: T.border },
      wide && styles.statsCardWide,
    ]}
  >
    {/* Row 1: Label (Left) aur Icon (Right) */}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <Text style={[styles.statsLabel, { color: T.text2 }]}>{label}</Text>
      <View style={[styles.statsIconWrap, { backgroundColor: iconBg }]}>
        <Icon name={iconName} size={13} color={iconColor} />
      </View>
    </View>

    {/* Row 2: Value (Left) aur Amount/Sub (Right) */}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Text style={[styles.statsValue, { color: valueColor, marginBottom: 0 }]}>{value}</Text>
      {sub && <Text style={[styles.statsSub, { color: T.text2, textAlign: 'right' }]}>{sub}</Text>}
    </View>
  </View>
);

// ─── Razorpay Connect Card ────────────────────────────────────────────────────
const RazorpayConnectCard = ({ onConnect, loading, T }) => (
  <View
    style={[
      styles.connectCard,
      { backgroundColor: T.card, borderColor: T.connectCardBorder },
    ]}
  >
    <View style={styles.connectHeader}>
      <View
        style={[
          styles.connectIconContainer,
          { borderColor: T.connectIconBorder, backgroundColor: T.connectIconBg },
        ]}
      >
        <Icon name="card-outline" size={32} color="#6B46C1" />
      </View>
      <View style={styles.connectInfo}>
        <Text style={[styles.connectTitle, { color: T.text1 }]}>Razorpay</Text>
        <Text style={[styles.connectDescription, { color: T.text2 }]}>
          Integrate Razorpay & Manage Payments
        </Text>
      </View>
    </View>
    <View style={[styles.connectDivider, { backgroundColor: T.connectDivider }]} />
    <View style={styles.connectButtonContainer}>
      <TouchableOpacity
        style={[
          styles.connectButton,
          { backgroundColor: T.card, borderColor: T.border },
        ]}
        onPress={onConnect}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={T.text2} size="small" />
        ) : (
          <Text style={[styles.connectButtonText, { color: T.text1 }]}>
            Connect
          </Text>
        )}
      </TouchableOpacity>
    </View>
  </View>
);

// ─── Delete Modal ─────────────────────────────────────────────────────────────
const DeleteModal = ({ visible, onClose, onConfirm, title, message, T }) => (
  <Modal
    visible={visible}
    animationType="fade"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.deleteModalOverlay}>
      <View
        style={[styles.deleteModalContent, { backgroundColor: T.modalBg }]}
      >
        <Text style={[styles.deleteModalTitle, { color: T.text1 }]}>
          {title}
        </Text>
        <Text style={[styles.deleteModalMessage, { color: T.text2 }]}>
          {message}
        </Text>
        <View style={styles.deleteModalActions}>
          <TouchableOpacity
            style={[styles.deleteCancelButton, { borderColor: T.border }]}
            onPress={onClose}
          >
            <Text style={[styles.deleteCancelText, { color: T.text1 }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteConfirmButton}
            onPress={() => {
              onConfirm();
              onClose();
            }}
          >
            <Text style={styles.deleteConfirmText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

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
const PaymentModal = ({ visible, onClose, onSuccess, T }) => {
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
    } catch { setLeadSuggestions([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (leadSearch) searchLeads(leadSearch); }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch, searchLeads]);

  const handleManual = async () => {
    setLoading(true); setError('');
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
    } catch (err) { setError(err.message); setLoading(false); }
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
      style={[
        styles.leadSuggestionItem,
        { borderBottomColor: T.divider, backgroundColor: T.card },
      ]}
      onPress={() => {
        set('leadId', item._id);
        setSelectedLead(item);
        setLeadSearch('');
        setShowLeadSuggestions(false);
      }}
    >
      <Text style={[styles.leadSuggestionName, { color: T.text1 }]}>
        {item.name || 'Unnamed'}
      </Text>
      <Text style={[styles.leadSuggestionPhone, { color: T.text2 }]}>
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
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: T.modalBg }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: T.text1 }]}>Record Payment</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Icon name="close" size={24} color={T.text2} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Lead */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: T.text1 }]}>Lead *</Text>
              {form.leadId && selectedLead ? (
                <View
                  style={[
                    styles.selectedLeadContainer,
                    { borderColor: T.inputBorder, backgroundColor: T.selectedLeadBg },
                  ]}
                >
                  <Text style={[styles.selectedLeadText, { color: T.text1 }]}>
                    {`${selectedLead.name || 'Unnamed'} — ${selectedLead.phone || 'No phone'}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { set('leadId', ''); setSelectedLead(null); setLeadSearch(''); }}
                  >
                    <Icon name="close-circle" size={20} color={T.text2} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <TextInput
                    style={[
                      styles.input,
                      { borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text1 },
                    ]}
                    placeholder="Search lead by name or phone…"
                    placeholderTextColor={T.text3}
                    value={leadSearch}
                    onChangeText={text => {
                      setLeadSearch(text);
                      setShowLeadSuggestions(true);
                      if (selectedLead) { setSelectedLead(null); set('leadId', ''); }
                    }}
                    onFocus={() => setShowLeadSuggestions(true)}
                  />
                  {showLeadSuggestions && leadSearch && (
                    <View
                      style={[
                        styles.suggestionsContainer,
                        { backgroundColor: T.card, borderColor: T.inputBorder },
                      ]}
                    >
                      {searching ? (
                        <View style={[styles.suggestionItem, { borderBottomColor: T.divider }]}>
                          <ActivityIndicator size="small" color="#6B46C1" />
                          <Text style={[styles.suggestionText, { color: T.text2 }]}>Searching…</Text>
                        </View>
                      ) : leadSuggestions.length > 0 ? (
                        <FlatList
                          data={leadSuggestions}
                          renderItem={renderLeadSuggestion}
                          keyExtractor={item => item._id}
                          style={styles.suggestionsList}
                          keyboardShouldPersistTaps="always"
                        />
                      ) : (
                        <View style={[styles.suggestionItem, { borderBottomColor: T.divider }]}>
                          <Text style={[styles.suggestionText, { color: T.text2 }]}>No leads found.</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Amount & Currency */}
            <View style={styles.rowFormGroup}>
              <View style={[styles.formGroup, styles.flex1]}>
                <Text style={[styles.formLabel, { color: T.text1 }]}>Amount *</Text>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text1 },
                  ]}
                  placeholder="0"
                  placeholderTextColor={T.text3}
                  keyboardType="numeric"
                  value={form.amount}
                  onChangeText={text => set('amount', text)}
                />
              </View>
              <View style={[styles.formGroup, styles.currencyContainer]}>
                <SelectField
                  label="Currency"
                  value={form.currency}
                  options={CURRENCY_OPTIONS}
                  onChange={v => set('currency', v)}
                  T={T}
                />
              </View>
            </View>

            {/* Payment Mode */}
            <View style={styles.formGroup}>
              <SelectField
                label="Payment Mode *"
                value={form.paymentMode}
                options={PAYMENT_MODE_OPTIONS}
                onChange={v => set('paymentMode', v)}
                T={T}
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: T.text1 }]}>Description</Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text1 },
                ]}
                placeholder="Invoice / purpose…"
                placeholderTextColor={T.text3}
                value={form.description}
                onChangeText={text => set('description', text)}
              />
            </View>

            {/* Due Date */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: T.text1 }]}>Due Date</Text>
              <TouchableOpacity
                style={[
                  styles.dateInput,
                  { borderColor: T.inputBorder, backgroundColor: T.inputBg },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={form.dueDate ? [styles.dateText, { color: T.text1 }] : [styles.datePlaceholder, { color: T.text3 }]}>
                  {form.dueDate || 'Select Date'}
                </Text>
                <Icon name="calendar-outline" size={20} color={T.text2} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={form.dueDate ? new Date(form.dueDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                />
              )}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: T.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: T.text1 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {form.paymentMode === 'Razorpay' ? 'Pay via Razorpay →' : 'Record Payment'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Generate Link Modal ──────────────────────────────────────────────────────
const GenerateLinkModal = ({ visible, payment, onClose, onSuccess, T }) => {
  const [description, setDescription] = useState(payment?.description || '');
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiFetch(`${API_BASE}/${payment._id}/generate-link`, {
        method: 'POST',
        body: { description },
      });
      setLink(data.paymentLink);
      onSuccess('Payment link generated!');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const copyToClipboard = async () => {
    try {
      await Clipboard.setString(link);
      Alert.alert('Success', 'Link copied to clipboard!');
    } catch { Alert.alert('Error', 'Failed to copy link'); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.linkModalContent, { backgroundColor: T.modalBg }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: T.text1 }]}>Generate Payment Link</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Icon name="close" size={24} color={T.text2} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.linkModalDescription, { color: T.text2 }]}>
            Send a Razorpay payment link to{' '}
            <Text style={[styles.linkModalLeadName, { color: T.text1 }]}>
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
              <View style={[styles.linkDisplay, { backgroundColor: T.linkDisplayBg, borderColor: T.inputBorder }]}>
                <Text style={styles.linkText}>{link}</Text>
              </View>
              <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                <Text style={styles.copyButtonText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text1 },
                ]}
                placeholder="Description (optional)"
                placeholderTextColor={T.text3}
                value={description}
                onChangeText={setDescription}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.cancelButton, { borderColor: T.border }]} onPress={onClose}>
                  <Text style={[styles.cancelButtonText, { color: T.text1 }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.disabledButton]}
                  onPress={handleGenerate}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Generate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── Filter Modal ─────────────────────────────────────────────────────────────
const FilterModal = ({
  visible, onClose, users, selectedUserId, setSelectedUserId,
  statusFilter, setStatusFilter, setPage, T,
}) => {
  const userOptions = [
    { label: 'All Users', value: '' },
    ...users.map(u => ({ label: u.name, value: u._id })),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.filterModalContent, { backgroundColor: T.modalBg }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: T.text1 }]}>Filters</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Icon name="close" size={24} color={T.text2} />
            </TouchableOpacity>
          </View>

          {users.length > 0 && (
            <View style={styles.formGroup}>
              <SelectField
                label="User"
                value={selectedUserId}
                options={userOptions}
                onChange={v => { setSelectedUserId(v); setPage(1); }}
                T={T}
              />
            </View>
          )}

          <View style={styles.formGroup}>
            <SelectField
              label="Status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={v => { setStatusFilter(v); setPage(1); }}
              T={T}
            />
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterClearButton, { borderColor: T.border }]}
              onPress={() => { setSelectedUserId(''); setStatusFilter(''); setPage(1); onClose(); }}
            >
              <Text style={[styles.filterClearText, { color: T.text1 }]}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyButton} onPress={onClose}>
              <Text style={styles.filterApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main PaymentsScreen ──────────────────────────────────────────────────────
const PaymentsScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const T = getT(isDark);

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
  const [toast, setToast] = useState('');
  const [razorpayConnected, setRazorpayConnected] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [rzpLoading, setRzpLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await apiFetch(`${API_BASE}/${deleteModal._id}`, { method: 'DELETE' });
      showToast('Payment deleted.');
      fetchPayments();
      fetchStats();
    } catch (e) { showToast('Error: ' + e.message); }
    setDeleteModal(null);
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (statusFilter) params.set('status', statusFilter);
      if (selectedUserId && canFilterByUser) params.set('userId', selectedUserId);
      const data = await apiFetch(`${API_BASE}?${params}`);
      setPayments(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch payments');
    } finally { setLoading(false); }
  }, [page, statusFilter, selectedUserId, canFilterByUser]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUserId && canFilterByUser) params.set('userId', selectedUserId);
      const query = params.toString() ? `?${params}` : '';
      const data = await apiFetch(`${API_BASE}/stats/overview${query}`);
      setStats(data);
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
  }, [canFilterByUser, isManager, isAdmin, canViewAllLeads, currentUser]);

  const checkRazorpayConnection = useCallback(async () => {
    try {
      const data = await apiFetch('/integrations/razorpay/status');
      setRazorpayConnected(data?.connected === true);
    } catch { setRazorpayConnected(false); }
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
              await apiFetch('/integrations/razorpay/disconnect', { method: 'POST' });
              setRazorpayConnected(false);
              showToast('Razorpay disconnected.');
            } catch (e) { showToast('Error: ' + e.message); }
            finally { setRzpLoading(false); }
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
      showToast('Razorpay connected successfully.');
    } catch (e) { showToast('Error: ' + e.message); }
    finally { setRzpLoading(false); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPayments(), fetchStats()]);
    setRefreshing(false);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) { navigation.replace('Login'); return; }
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
  }, [authReady, checkRazorpayConnection, fetchPayments, fetchStats, fetchUsers]);

  const statByStatus = s =>
    stats?.byStatus?.find(x => x._id === s) || { count: 0, totalAmount: 0 };

  const showAllPipelinesCard = canFilterByUser && !selectedUserId;
  const ownedRevenueLabel = showAllPipelinesCard
    ? 'Total Received (All Pipelines)'
    : 'Total Received (Pipelines owned)';
  const involvementLabel = 'Total Received (Pipelines involved)';

  const renderPaymentItem = ({ item }) => (
    <View style={[styles.paymentCard, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentLeadInfo}>
          <Text style={[styles.paymentLeadName, { color: T.text1 }]}>
            {item.leadId?.name || '—'}
          </Text>
          <Text style={[styles.paymentLeadPhone, { color: T.text2 }]}>
            {item.leadId?.phone || ''}
          </Text>
        </View>
        <View style={styles.paymentAmountContainer}>
          <Text style={[styles.paymentAmount, { color: T.text1 }]}>
            {item.currency === 'INR' ? '₹' : item.currency}
            {item.amount.toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.paymentMode, { color: T.text2 }]}>{item.paymentMode}</Text>
        </View>
      </View>

      <View style={[styles.paymentDivider, { backgroundColor: T.divider }]} />

      <View style={styles.paymentDetails}>
        <View style={styles.paymentDetailItem}>
          <Text style={[styles.paymentDetailLabel, { color: T.text2 }]}>Status</Text>
          <StatusBadge status={item.status} T={T} />
        </View>
        <View style={styles.paymentDetailItem}>
          <Text style={[styles.paymentDetailLabel, { color: T.text2 }]}>Date</Text>
          <Text style={[styles.paymentDetailValue, { color: T.text1 }]}>
            {item.paymentDate
              ? new Date(item.paymentDate).toLocaleDateString('en-IN')
              : '—'}
          </Text>
        </View>
        <View style={styles.paymentDetailItem}>
          <Text style={[styles.paymentDetailLabel, { color: T.text2 }]}>Lead Owner</Text>
          <Text style={[styles.paymentDetailValue, { color: T.text1 }]}>
            {item.leadId?.assignedTo?.name || '—'}
          </Text>
        </View>
        <View style={styles.paymentDetailItem}>
          <Text style={[styles.paymentDetailLabel, { color: T.text2 }]}>Recorded By</Text>
          <Text style={[styles.paymentDetailValue, { color: T.text1 }]}>
            {item.recordedBy?.name || '—'}
          </Text>
        </View>
      </View>

      <View style={[styles.paymentActions, { borderTopColor: T.divider }]}>
        {item.paymentMode === 'Razorpay' && item.status === 'Pending' && (
          <TouchableOpacity
            style={styles.paymentActionButton}
            onPress={() => setLinkModal(item)}
          >
            <Icon name="link-outline" size={16} color="#6B46C1" />
            <Text style={styles.paymentActionLinkText}>Generate Link</Text>
          </TouchableOpacity>
        )}
        {item.paymentLinkUrl && (
          <TouchableOpacity
            style={styles.paymentActionButton}
            onPress={() => Linking.openURL(item.paymentLinkUrl)}
          >
            <Icon name="open-outline" size={16} color="#059669" />
            <Text style={styles.paymentActionOpenText}>Open Link</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.paymentActionButton, styles.paymentActionDelete]}
          onPress={() => setDeleteModal(item)}
        >
          <Icon name="trash-outline" size={16} color="#EF4444" />
          <Text style={styles.paymentActionDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="receipt-outline" size={64} color={T.emptyIcon} />
      <Text style={[styles.emptyStateText, { color: T.text2 }]}>No payments found.</Text>
    </View>
  );

  const renderHeader = () => (
    <>
      <View style={[styles.headerContainer, { backgroundColor: T.bg }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: T.text1 }]}>Payments</Text>
          <Text style={[styles.headerSubtitle, { color: T.text2 }]}>
            Track payments and collect via Razorpay
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: T.filterBtnBg, borderColor: T.border }]}
            onPress={() => setShowFilterModal(true)}
          >
            <Icon name="options-outline" size={20} color={T.text2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowModal(true)}
          >
            <Icon name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Payment</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Razorpay Status */}
      <View
        style={[
          styles.razorpayStatusContainer,
          { backgroundColor: T.card, borderColor: T.border },
        ]}
      >
        <View style={styles.razorpayStatus}>
          <View
            style={[
              styles.statusDot,
              razorpayConnected ? styles.statusDotConnected : styles.statusDotDisconnected,
            ]}
          />
          <Text style={[styles.razorpayStatusText, { color: T.text1 }]}>
            Razorpay {razorpayConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        {razorpayConnected ? (
          <TouchableOpacity
            style={styles.razorpayActionButton}
            onPress={handleDisconnect}
            disabled={rzpLoading}
          >
            <Text style={styles.razorpayDisconnectText}>
              {rzpLoading ? '...' : 'Disconnect'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.razorpayActionButton, styles.razorpayConnectButton]}
            onPress={handleConnect}
            disabled={rzpLoading}
          >
            <Text style={styles.razorpayConnectText}>
              {rzpLoading ? '...' : 'Connect'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsGrid}>
          <StatsCard
            label={ownedRevenueLabel}
            value={`₹${(stats.totalAmount || 0).toLocaleString('en-IN')}`}
            sub={`${stats.total} transactions`}
            iconName="wallet-outline"
            iconColor={isDark ? '#60a5fa' : '#3B82F6'}
            iconBg={isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.12)'}
            valueColor={isDark ? '#60a5fa' : '#1D4ED8'}
            wide
            T={T}
          />
          {!showAllPipelinesCard && (
            <StatsCard
              label={involvementLabel}
              value={`₹${(stats.involvedTotalAmount || 0).toLocaleString('en-IN')}`}
              sub={`${stats.involvedTotal || 0} transactions`}
              iconName="git-merge-outline"
              iconColor={isDark ? '#60a5fa' : '#3B82F6'}
              iconBg={isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.12)'}
              valueColor={isDark ? '#60a5fa' : '#1D4ED8'}
              wide
              T={T}
            />
          )}
          <View style={styles.statsRow}>
            <StatsCard
              label="Paid"
              value={String(statByStatus('Paid').count)}
              sub={`₹${(statByStatus('Paid').totalAmount || 0).toLocaleString('en-IN')}`}
              iconName="checkmark-circle-outline"
              iconColor={isDark ? '#4ade80' : '#16A34A'}
              iconBg={isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)'}
              valueColor={isDark ? '#4ade80' : '#15803D'}
              T={T}
            />
            <StatsCard
              label="Pending"
              value={String(statByStatus('Pending').count)}
              sub={`₹${(statByStatus('Pending').totalAmount || 0).toLocaleString('en-IN')}`}
              iconName="time-outline"
              iconColor={isDark ? '#facc15' : '#D97706'}
              iconBg={isDark ? 'rgba(234,179,8,0.15)' : 'rgba(217,119,6,0.12)'}
              valueColor={isDark ? '#facc15' : '#B45309'}
              T={T}
            />
          </View>
          <View style={styles.statsRow}>
            <StatsCard
              label="Overdue"
              value={String(statByStatus('Overdue').count)}
              sub={`₹${(statByStatus('Overdue').totalAmount || 0).toLocaleString('en-IN')}`}
              iconName="alert-circle-outline"
              iconColor={isDark ? '#f87171' : '#DC2626'}
              iconBg={isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)'}
              valueColor={isDark ? '#f87171' : '#B91C1C'}
              T={T}
            />
            <StatsCard
              label="Partial"
              value={String(statByStatus('Partial').count)}
              sub={`₹${(statByStatus('Partial').totalAmount || 0).toLocaleString('en-IN')}`}
              iconName="git-pull-request-outline"
              iconColor={isDark ? '#c084fc' : '#9333EA'}
              iconBg={isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.12)'}
              valueColor={isDark ? '#c084fc' : '#7E22CE'}
              T={T}
            />
          </View>
        </View>
      )}
    </>
  );

  // Not connected screen
  if (!razorpayConnected) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: T.bg }]} edges={['bottom']}>
        <View style={[styles.headerContainer, { backgroundColor: T.bg }]}>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: T.text1 }]}>Payments</Text>
            <Text style={[styles.headerSubtitle, { color: T.text2 }]}>
              Track payments and collect via Razorpay
            </Text>
          </View>
        </View>
        <RazorpayConnectCard onConnect={handleConnect} loading={rzpLoading} T={T} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: T.bg }]} edges={['bottom']}>
      {toast ? (
        <View style={[styles.toastContainer, { backgroundColor: T.toastBg }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <FlatList
        data={payments}
        renderItem={renderPaymentItem}
        keyExtractor={item => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  { borderColor: T.paginationBorder },
                  page === 1 && styles.paginationDisabled,
                ]}
                onPress={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <Text style={[styles.paginationButtonText, { color: T.text1 }]}>← Prev</Text>
              </TouchableOpacity>
              <Text style={[styles.paginationText, { color: T.text2 }]}>
                Page {page} of {totalPages}
              </Text>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  { borderColor: T.paginationBorder },
                  page === totalPages && styles.paginationDisabled,
                ]}
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <Text style={[styles.paginationButtonText, { color: T.text1 }]}>Next →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <PaymentModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={msg => { showToast(msg); fetchPayments(); fetchStats(); }}
        T={T}
      />

      {linkModal && (
        <GenerateLinkModal
          visible={!!linkModal}
          payment={linkModal}
          onClose={() => setLinkModal(null)}
          onSuccess={msg => { showToast(msg); fetchPayments(); }}
          T={T}
        />
      )}

      <DeleteModal
        visible={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
        T={T}
      />

      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        users={users}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        setPage={setPage}
        T={T}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  toastContainer: {
    position: 'absolute', top: 50, left: 20, right: 20, zIndex: 1000,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  toastText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
  headerContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterButton: { padding: 8, borderRadius: 8, borderWidth: 1 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#4F46E5',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  razorpayStatusContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    marginHorizontal: 16, marginVertical: 8,
    borderRadius: 8, borderWidth: 1,
  },
  razorpayStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotConnected: { backgroundColor: '#10B981' },
  statusDotDisconnected: { backgroundColor: '#9CA3AF' },
  razorpayStatusText: { fontSize: 12, fontWeight: '500' },
  razorpayActionButton: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#EF4444',
  },
  razorpayDisconnectText: { fontSize: 12, color: '#EF4444', fontWeight: '500' },
  razorpayConnectButton: { borderColor: '#4F46E5', backgroundColor: '#4F46E5' },
  razorpayConnectText: { fontSize: 12, color: '#FFFFFF', fontWeight: '500' },
  statsGrid: { paddingHorizontal: 16, marginVertical: 6, gap: 6 },
  statsRow: { flexDirection: 'row', gap: 6 },
  statsCard: {
    borderRadius: 12, borderWidth: 1, padding: 10, flex: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  statsCardWide: { flex: undefined },
  statsCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  statsIconWrap: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  statsLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  statsValue: { fontSize: 22, fontWeight: '600', lineHeight: 26, marginBottom: 2 },
  statsSub: { fontSize: 11 },
  paymentCard: {
    borderRadius: 12, borderWidth: 1,
    marginHorizontal: 16, marginVertical: 4, padding: 12,
  },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
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
    fontSize: 10, textTransform: 'uppercase', fontWeight: '600', marginBottom: 2,
  },
  paymentDetailValue: { fontSize: 12 },
  paymentActions: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, gap: 12,
  },
  paymentActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentActionLinkText: { fontSize: 12, color: '#6B46C1', fontWeight: '500' },
  paymentActionOpenText: { fontSize: 12, color: '#059669', fontWeight: '500' },
  paymentActionDelete: { marginLeft: 'auto' },
  paymentActionDeleteText: { fontSize: 12, color: '#EF4444', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { fontSize: 14, marginTop: 8 },
  paginationContainer: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 16, gap: 12,
  },
  paginationButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  paginationDisabled: { opacity: 0.4 },
  paginationButtonText: { fontSize: 12 },
  paginationText: { fontSize: 12 },
  listContent: { flexGrow: 1, paddingBottom: 20 },
  connectCard: {
    borderRadius: 16, borderWidth: 1.5,
    marginHorizontal: 16, padding: 20,
  },
  connectHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  connectIconContainer: {
    width: 62, height: 62, borderWidth: 1,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  connectInfo: { flex: 1 },
  connectTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  connectDescription: { fontSize: 13 },
  connectDivider: { height: 1, marginVertical: 16 },
  connectButtonContainer: { flexDirection: 'row', justifyContent: 'flex-end' },
  connectButton: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 22, paddingVertical: 7,
  },
  connectButtonText: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalCloseButton: { padding: 4 },
  formGroup: { marginBottom: 12 },
  rowFormGroup: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-end' },
  flex1: { flex: 1 },
  currencyContainer: { width: 100 },
  formLabel: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  input: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  // ── Custom SelectField styles ──
  selectTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11, height: 46,
  },
  selectTriggerText: { fontSize: 14, flex: 1, marginRight: 8 },
  selectOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  selectSheet: {
    width: '100%', maxWidth: 360, borderRadius: 16,
    borderWidth: 1, maxHeight: 400, overflow: 'hidden',
  },
  selectSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  selectSheetTitle: { fontSize: 15, fontWeight: '600' },
  selectSheetClose: { padding: 4 },
  selectOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  selectOptionText: { fontSize: 14 },
  // ── end SelectField ──
  dateInput: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  dateText: { fontSize: 14 },
  datePlaceholder: { fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 8 },
  cancelButton: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  cancelButtonText: { fontSize: 14, fontWeight: '500' },
  submitButton: { flex: 1, backgroundColor: '#4F46E5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  submitButtonText: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },
  errorContainer: {
    backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, padding: 12, marginBottom: 12,
  },
  errorText: { fontSize: 14, color: '#DC2626' },
  suggestionsContainer: {
    position: 'absolute', top: 48, left: 0, right: 0,
    borderWidth: 1, borderRadius: 8, maxHeight: 200, zIndex: 1000,
  },
  suggestionsList: { maxHeight: 200 },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  leadSuggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  leadSuggestionName: { fontSize: 14, fontWeight: '500' },
  leadSuggestionPhone: { fontSize: 12 },
  suggestionText: { fontSize: 14 },
  selectedLeadContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  selectedLeadText: { fontSize: 14 },
  linkModalContent: { maxHeight: '70%' },
  linkModalDescription: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  linkModalLeadName: { fontWeight: '600' },
  linkContainer: { marginVertical: 8 },
  linkDisplay: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  linkText: {
    fontSize: 14, color: '#4F46E5',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: { backgroundColor: '#4F46E5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  copyButtonText: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },
  deleteModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  deleteModalContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  deleteModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  deleteModalMessage: { fontSize: 14, marginBottom: 20 },
  deleteModalActions: { flexDirection: 'row', gap: 12 },
  deleteCancelButton: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  deleteCancelText: { fontSize: 14, fontWeight: '500' },
  deleteConfirmButton: { flex: 1, backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  deleteConfirmText: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },
  filterModalContent: { maxHeight: '70%' },
  filterActions: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 8 },
  filterClearButton: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  filterClearText: { fontSize: 14, fontWeight: '500' },
  filterApplyButton: { flex: 1, backgroundColor: '#4F46E5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  filterApplyText: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },
});

export default PaymentsScreen;