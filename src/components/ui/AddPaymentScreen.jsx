/**
 * AddPaymentScreen — Record Payment ka full form-screen (AddScheduleScreen pattern)
 *
 * Kyun screen, modal nahi: RN Modal ke andar KeyboardAvoidingView Android pe
 * kaam nahi karta — keyboard form ke upar aa jata. Screen pe KAV sahi chalti hai.
 *
 * Route params: (koi zaroori nahi — sab optional)
 *
 * Navigator mein add karo:
 *   <Stack.Screen name="AddPayment" component={AddPaymentScreen} />
 *
 * Success pe PaymentsScreen ko flag bhejta hai (paymentsUpdated) — wahan
 * tabhi refresh hota hai; plain back pe refresh NAHI.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL } from '../../config';
import { useToast as useKitToast } from './CustomToast';

const PRIMARY = '#6366f1';
const PRIMARY_SOFT = '#eef2ff';

// ─── API helpers (PaymentsScreen jaisa hi) ───────────────────────────────────
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
  const token = await AsyncStorage.getItem('accessToken');
  if (!token) throw new Error('Not authenticated');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  const response = await fetch(buildApiUrl(url), {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data.data;
};

// ─── Options ──────────────────────────────────────────────────────────────────
const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR'];

const PAYMENT_MODE_OPTIONS = [
  { label: 'Razorpay (Online Checkout)', value: 'Razorpay' },
  { label: 'UPI (Manual)', value: 'UPI' },
  { label: 'Bank Transfer', value: 'Bank Transfer' },
  { label: 'Cash', value: 'Cash' },
  { label: 'Cheque', value: 'Cheque' },
];

// ─── Uniform field wrapper (AddScheduleScreen density) ───────────────────────
const Field = ({ label, children }) => (
  <View style={st.field}>
    <Text style={st.fieldLabel}>{label}</Text>
    {children}
  </View>
);

// ─── Main Screen ───────────────────────────────────────────────────────────────
const AddPaymentScreen = ({ navigation }) => {
  const toast = useKitToast();
  const insets = useSafeAreaInsets();

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Lead search (debounced 300ms — modal jaisa hi) ──
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

  // ── Success → PaymentsScreen ko flag ke saath wapas (wahi tabhi refresh karega) ──
  const goBackWithRefresh = useCallback(() => {
    const routeNames = navigation?.getState?.()?.routeNames || [];
    if (routeNames.includes('Payments')) {
      navigation.navigate('Payments', { paymentsUpdated: Date.now() });
    } else {
      navigation?.goBack?.();
    }
  }, [navigation]);

  // ── Save handlers (PaymentModal jaisa 1:1) ──
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
      toast.success('Payment recorded!');
      goBackWithRefresh();
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
                toast.success('Payment successful! ✓');
                goBackWithRefresh();
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

  const fmtDate = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Custom form header (shared Topbar is route pe hide hai) ── */}
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={st.backBtn}
          onPress={() => navigation?.goBack?.()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={20} color="#334155" />
        </TouchableOpacity>
        <View style={[st.headerIconWrap, { backgroundColor: PRIMARY_SOFT }]}>
          <Icon name="cash-plus" size={15} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle} numberOfLines={1}>
            Record Payment
          </Text>
          <Text style={st.headerSub} numberOfLines={1} ellipsizeMode="tail">
            Collect via Razorpay or manual mode
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          st.container,
          { paddingBottom: 24 + insets.bottom },
        ]}
      >
        {/* Error box */}
        {error ? (
          <View style={st.errorBox}>
            <Icon name="alert-circle-outline" size={14} color="#dc2626" />
            <Text style={st.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── LEAD ── */}
        <Field label="LEAD *">
          {form.leadId && selectedLead ? (
            <View style={st.selectedLeadRow}>
              <Text style={st.selectedLeadText} numberOfLines={1}>
                {selectedLead.name || 'Unnamed'}
                {selectedLead.phone ? ` — ${selectedLead.phone}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  set('leadId', '');
                  setSelectedLead(null);
                  setLeadSearch('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close" size={14} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={st.searchWrap}>
                <Icon
                  name="magnify"
                  size={14}
                  color="#9ca3af"
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={st.searchInput}
                  placeholder="Search lead by name or phone…"
                  placeholderTextColor="#9ca3af"
                  value={leadSearch}
                  onChangeText={setLeadSearch}
                />
              </View>
              {leadSearch.length > 0 && (
                <View style={st.leadDropdown}>
                  {searching ? (
                    <View style={st.dropdownRowHint}>
                      <ActivityIndicator size="small" color={PRIMARY} />
                      <Text style={st.dropdownHint}>Searching…</Text>
                    </View>
                  ) : leadSuggestions.length > 0 ? (
                    leadSuggestions.slice(0, 8).map(l => (
                      <TouchableOpacity
                        key={l._id}
                        style={st.leadOption}
                        onPress={() => {
                          set('leadId', l._id);
                          setSelectedLead(l);
                          setLeadSearch('');
                          setLeadSuggestions([]);
                        }}
                      >
                        <Text style={st.leadOptionName} numberOfLines={1}>
                          {l.name || 'Unnamed'}
                        </Text>
                        <Text style={st.leadOptionPhone}>
                          {l.phone || 'No phone'}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={st.dropdownRowHint}>
                      <Text style={st.dropdownHint}>No leads found.</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </Field>

        {/* ── AMOUNT + CURRENCY ── */}
        <View style={st.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="AMOUNT *">
              <View style={st.amountWrap}>
                <Text style={st.amountPrefix}>
                  {form.currency === 'INR'
                    ? '₹'
                    : form.currency === 'USD'
                    ? '$'
                    : '€'}
                </Text>
                <TextInput
                  style={st.amountInput}
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={form.amount}
                  onChangeText={v => set('amount', v)}
                />
              </View>
            </Field>
          </View>
          <View style={{ width: 108 }}>
            <Field label="CURRENCY">
              <TouchableOpacity
                style={st.selectTrigger}
                onPress={() => setCurrencyOpen(p => !p)}
              >
                <Text style={st.selectTriggerText} numberOfLines={1}>
                  {form.currency}
                </Text>
                <Icon
                  name={currencyOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#9ca3af"
                />
              </TouchableOpacity>
              {currencyOpen && (
                <View style={st.miniList}>
                  {CURRENCY_OPTIONS.map(c => {
                    const active = form.currency === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[st.miniRow, active && st.miniRowActive]}
                        onPress={() => {
                          set('currency', c);
                          setCurrencyOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            st.miniRowText,
                            active && { color: '#4338ca', fontWeight: '700' },
                          ]}
                        >
                          {c}
                        </Text>
                        {active && (
                          <Icon name="check" size={14} color="#4338ca" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Field>
          </View>
        </View>

        {/* ── PAYMENT MODE — dropdown select (Currency jaisi UI) ── */}
        <Field label="PAYMENT MODE *">
          <TouchableOpacity
            style={st.selectTrigger}
            onPress={() => setModeOpen(p => !p)}
            activeOpacity={0.75}
          >
            <Text style={st.selectTriggerText} numberOfLines={1}>
              {
                PAYMENT_MODE_OPTIONS.find(pm => pm.value === form.paymentMode)
                  ?.label
              }
            </Text>
            <Icon
              name={modeOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#9ca3af"
            />
          </TouchableOpacity>
          {modeOpen && (
            <View style={st.miniList}>
              {PAYMENT_MODE_OPTIONS.map(pm => {
                const active = form.paymentMode === pm.value;
                return (
                  <TouchableOpacity
                    key={pm.value}
                    style={[st.miniRow, active && st.miniRowActive]}
                    onPress={() => {
                      set('paymentMode', pm.value);
                      setModeOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        st.miniRowText,
                        active && { color: '#4338ca', fontWeight: '700' },
                      ]}
                    >
                      {pm.label}
                    </Text>
                    {active && <Icon name="check" size={14} color="#4338ca" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Field>

        {/* ── DESCRIPTION ── */}
        <Field label="DESCRIPTION">
          <TextInput
            style={st.input}
            placeholder="Invoice / purpose…"
            placeholderTextColor="#9ca3af"
            value={form.description}
            onChangeText={v => set('description', v)}
          />
        </Field>

        {/* ── DUE DATE ── */}
        <Field label="DUE DATE">
          <TouchableOpacity
            style={st.selectTrigger}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                st.selectTriggerText,
                !form.dueDate && { color: '#9ca3af', fontWeight: '400' },
              ]}
              numberOfLines={1}
            >
              {form.dueDate ? fmtDate(form.dueDate) : 'Select due date'}
            </Text>
            {!!form.dueDate && (
              <TouchableOpacity
                onPress={() => set('dueDate', '')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginRight: 6 }}
              >
                <Icon name="close-circle" size={15} color="#9ca3af" />
              </TouchableOpacity>
            )}
            <Icon name="calendar" size={14} color="#9ca3af" />
          </TouchableOpacity>
        </Field>

        {/* ── Save ── */}
        <TouchableOpacity
          style={[st.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon
                name={
                  form.paymentMode === 'Razorpay'
                    ? 'credit-card-outline'
                    : 'cash-plus'
                }
                size={15}
                color="#fff"
              />
              <Text style={st.saveBtnText}>
                {form.paymentMode === 'Razorpay'
                  ? 'Pay via Razorpay'
                  : 'Record Payment'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={form.dueDate ? new Date(form.dueDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (event?.type === 'dismissed') return;
            if (selectedDate)
              set('dueDate', selectedDate.toISOString().split('T')[0]);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

export default AddPaymentScreen;

// ─── Styles — uniform, compact (AddScheduleScreen density) ────────────────────
const st = StyleSheet.create({
  container: { padding: 12, gap: 12 },
  // Custom form header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { fontSize: 12.5, color: '#dc2626', flex: 1 },

  // Field wrapper
  field: { gap: 4 },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Inputs — uniform 44px
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 11,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#fff',
  },
  // Amount with prefix
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  amountPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginRight: 6,
  },
  amountInput: { flex: 1, fontSize: 13, color: '#111827', padding: 0 },
  // Select trigger — uniform 44px
  selectTrigger: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  selectTriggerText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  // Two-col row
  twoCol: { flexDirection: 'row', gap: 10 },
  // Lead search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#111827', padding: 0 },
  leadDropdown: {
    marginTop: 4,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  leadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 8,
  },
  leadOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  leadOptionPhone: { fontSize: 11, color: '#9ca3af' },
  dropdownRowHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownHint: { fontSize: 12, color: '#9ca3af' },
  selectedLeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 11,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#f9fafb',
  },
  selectedLeadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  // Mini dropdown (currency)
  miniList: {
    marginTop: 4,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  miniRowActive: { backgroundColor: '#eef2ff' },
  miniRowText: { fontSize: 13, color: '#374151' },
  // Chips (payment mode)
  // Save
  saveBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
