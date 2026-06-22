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
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canUser } from '../../utils/permissions';
import { API_BASE_URL } from '../../config';
// ─── API helpers ─────────────────────────────────────────────────────────────
const API_BASE_HOST = API_BASE_URL?.replace(/\/$/, '') ||
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

// ─── Status Badge Component ──────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'Paid':
      case 'Completed':
        return styles.statusPaid;
      case 'Pending':
        return styles.statusPending;
      case 'Partial':
        return styles.statusPartial;
      case 'Overdue':
        return styles.statusOverdue;
      case 'Cancelled':
        return styles.statusCancelled;
      default:
        return styles.statusDefault;
    }
  };

  return (
    <View style={[styles.statusBadge, getStatusStyle()]}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
};

// ─── Stats Card Component ────────────────────────────────────────────────────
const StatsCard = ({ label, value, sub, color }) => (
  <View style={styles.statsCard}>
    <Text style={styles.statsLabel}>{label}</Text>
    <Text style={[styles.statsValue, color && { color }]}>{value}</Text>
    {sub && <Text style={styles.statsSub}>{sub}</Text>}
  </View>
);

// ─── Razorpay Connect Card ──────────────────────────────────────────────────
const RazorpayConnectCard = ({ onConnect, loading }) => {
  return (
    <View style={styles.connectCard}>
      <View style={styles.connectHeader}>
        <View style={styles.connectIconContainer}>
          <Icon name="card-outline" size={32} color="#6B46C1" />
        </View>
        <View style={styles.connectInfo}>
          <Text style={styles.connectTitle}>Razorpay</Text>
          <Text style={styles.connectDescription}>
            Integrate Razorpay & Manage Payments
          </Text>
        </View>
      </View>
      <View style={styles.connectDivider} />
      <View style={styles.connectButtonContainer}>
        <TouchableOpacity
          style={styles.connectButton}
          onPress={onConnect}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#374151" size="small" />
          ) : (
            <Text style={styles.connectButtonText}>Connect</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Delete Modal ────────────────────────────────────────────────────────────
const DeleteModal = ({ visible, onClose, onConfirm, title, message }) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.deleteModalOverlay}>
        <View style={styles.deleteModalContent}>
          <Text style={styles.deleteModalTitle}>{title}</Text>
          <Text style={styles.deleteModalMessage}>{message}</Text>
          <View style={styles.deleteModalActions}>
            <TouchableOpacity
              style={styles.deleteCancelButton}
              onPress={onClose}
            >
              <Text style={styles.deleteCancelText}>Cancel</Text>
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
};

// ─── Payment Modal ──────────────────────────────────────────────────────────
const PaymentModal = ({ visible, onClose, onSuccess }) => {
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
    } catch (err) {
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
      // For React Native, you'd integrate Razorpay SDK or use WebView
      // This is a placeholder that shows the order creation
      const { payment, razorpayOrder, razorpayKeyId } = await apiFetch(
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
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setLoading(false),
          },
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
    if (form.paymentMode === 'Razorpay') {
      handleRazorpayCheckout();
    } else {
      handleManual();
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      set('dueDate', selectedDate.toISOString().split('T')[0]);
    }
  };

  const renderLeadSuggestion = ({ item }) => (
    <TouchableOpacity
      style={styles.leadSuggestionItem}
      onPress={() => {
        set('leadId', item._id);
        setSelectedLead(item);
        setLeadSearch('');
        setShowLeadSuggestions(false);
      }}
    >
      <Text style={styles.leadSuggestionName}>{item.name || 'Unnamed'}</Text>
      <Text style={styles.leadSuggestionPhone}>{item.phone || 'No phone'}</Text>
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
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Lead Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Lead *</Text>
              {form.leadId && selectedLead ? (
                <View style={styles.selectedLeadContainer}>
                  <Text style={styles.selectedLeadText}>
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
                    <Icon name="close-circle" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <TextInput
                    style={styles.input}
                    placeholder="Search lead by name or phone…"
                    placeholderTextColor="#9CA3AF"
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
                  {showLeadSuggestions && leadSearch && (
                    <View style={styles.suggestionsContainer}>
                      {searching ? (
                        <View style={styles.suggestionItem}>
                          <ActivityIndicator size="small" color="#6B46C1" />
                          <Text style={styles.suggestionText}>Searching…</Text>
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
                        <View style={styles.suggestionItem}>
                          <Text style={styles.suggestionText}>
                            No leads found.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Amount and Currency */}
            <View style={styles.rowFormGroup}>
              <View style={[styles.formGroup, styles.flex1]}>
                <Text style={styles.formLabel}>Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={form.amount}
                  onChangeText={text => set('amount', text)}
                />
              </View>
              <View style={[styles.formGroup, styles.currencyContainer]}>
                <Text style={styles.formLabel}>Currency</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.currency}
                    onValueChange={itemValue => set('currency', itemValue)}
                    style={styles.picker}
                  >
                    <Picker.Item label="INR" value="INR" />
                    <Picker.Item label="USD" value="USD" />
                    <Picker.Item label="EUR" value="EUR" />
                  </Picker>
                </View>
              </View>
            </View>

            {/* Payment Mode */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Mode *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.paymentMode}
                  onValueChange={itemValue => set('paymentMode', itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item
                    label="Razorpay (Online Checkout)"
                    value="Razorpay"
                  />
                  <Picker.Item label="UPI (Manual)" value="UPI" />
                  <Picker.Item label="Bank Transfer" value="Bank Transfer" />
                  <Picker.Item label="Cash" value="Cash" />
                  <Picker.Item label="Cheque" value="Cheque" />
                </Picker>
              </View>
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="Invoice / purpose…"
                placeholderTextColor="#9CA3AF"
                value={form.description}
                onChangeText={text => set('description', text)}
              />
            </View>

            {/* Due Date */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Due Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text
                  style={
                    form.dueDate ? styles.dateText : styles.datePlaceholder
                  }
                >
                  {form.dueDate || 'Select Date'}
                </Text>
                <Icon name="calendar-outline" size={20} color="#6B7280" />
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

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
                    {form.paymentMode === 'Razorpay'
                      ? 'Pay via Razorpay →'
                      : 'Record Payment'}
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

// ─── Generate Link Modal ──────────────────────────────────────────────────
const GenerateLinkModal = ({ visible, payment, onClose, onSuccess }) => {
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
    } catch (err) {
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
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.linkModalContent]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Generate Payment Link</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.linkModalDescription}>
            Send a Razorpay payment link to{' '}
            <Text style={styles.linkModalLeadName}>
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
              <View style={styles.linkDisplay}>
                <Text style={styles.linkText}>{link}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyToClipboard}
              >
                <Text style={styles.copyButtonText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Description (optional)"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.disabledButton,
                  ]}
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

// ─── Filter Modal ────────────────────────────────────────────────────────────
const FilterModal = ({
  visible,
  onClose,
  users,
  selectedUserId,
  setSelectedUserId,
  statusFilter,
  setStatusFilter,
  setPage,
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, styles.filterModalContent]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Icon name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {users.length > 0 && (
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>User</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedUserId}
                onValueChange={itemValue => {
                  setSelectedUserId(itemValue);
                  setPage(1);
                }}
                style={styles.picker}
              >
                <Picker.Item label="All Users" value="" />
                {users.map(u => (
                  <Picker.Item key={u._id} label={u.name} value={u._id} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={statusFilter}
              onValueChange={itemValue => {
                setStatusFilter(itemValue);
                setPage(1);
              }}
              style={styles.picker}
            >
              <Picker.Item label="All Status" value="" />
              <Picker.Item label="Pending" value="Pending" />
              <Picker.Item label="Partial" value="Partial" />
              <Picker.Item label="Paid" value="Paid" />
              <Picker.Item label="Overdue" value="Overdue" />
              <Picker.Item label="Cancelled" value="Cancelled" />
            </Picker>
          </View>
        </View>

        <View style={styles.filterActions}>
          <TouchableOpacity
            style={styles.filterClearButton}
            onPress={() => {
              setSelectedUserId('');
              setStatusFilter('');
              setPage(1);
              onClose();
            }}
          >
            <Text style={styles.filterClearText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterApplyButton} onPress={onClose}>
            <Text style={styles.filterApplyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ─── Main PaymentsScreen ──────────────────────────────────────────────────────
const PaymentsScreen = ({ navigation }) => {
  // ── Redux state ──────────────────────────────────────────────────────────
  const currentUser = useSelector(state => state.auth.user);
  const settings = useSelector(state => state.settings.data);

  // ── Permission-based access flags ──────────────────────────────────────
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

  // ── Local State ──────────────────────────────────────────────────────────
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

  const handleDeleteClick = payment => {
    setDeleteModal(payment);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await apiFetch(`${API_BASE}/${deleteModal._id}`, { method: 'DELETE' });
      showToast('Payment deleted.');
      fetchPayments();
      fetchStats();
    } catch (e) {
      showToast('Error: ' + e.message);
    }
    setDeleteModal(null);
  };

  // ── fetchPayments ────────────────────────────────────────────────────────
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
      Alert.alert('Error', 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, selectedUserId, canFilterByUser]);

  // ── fetchStats ───────────────────────────────────────────────────────────
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

  // ── fetchUsers ───────────────────────────────────────────────────────────
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

  // ── checkRazorpayConnection ─────────────────────────────────────────────
  const checkRazorpayConnection = useCallback(async () => {
    try {
      const data = await apiFetch('/integrations/razorpay/status');
      setRazorpayConnected(data?.connected === true);
    } catch (e) {
      setRazorpayConnected(false);
    }
  }, []);

  // ── handleDisconnect ─────────────────────────────────────────────────────
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
              showToast('Razorpay disconnected.');
            } catch (e) {
              showToast('Error: ' + e.message);
            } finally {
              setRzpLoading(false);
            }
          },
        },
      ],
    );
  };

  // ── handleConnect ────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setRzpLoading(true);
    try {
      await apiFetch('/integrations/razorpay/connect', {
        method: 'POST',
      });
      setRazorpayConnected(true);
      showToast('Razorpay connected successfully.');
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      setRzpLoading(false);
    }
  };

  // ── handleRefresh ────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPayments(), fetchStats()]);
    setRefreshing(false);
  };

  // ── Effects ──────────────────────────────────────────────────────────────
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

  // ── Stat Helpers ──────────────────────────────────────────────────────────
  const statByStatus = s =>
    stats?.byStatus?.find(x => x._id === s) || { count: 0, totalAmount: 0 };

  const showAllPipelinesCard = canFilterByUser && !selectedUserId;
  const ownedRevenueLabel = showAllPipelinesCard
    ? 'Total Received (All Pipelines)'
    : 'Total Received (Pipelines owned)';
  const involvementLabel = 'Total Received (Pipelines involved)';

  // ── Render Payment Item ──────────────────────────────────────────────────
  const renderPaymentItem = ({ item }) => (
    <View style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentLeadInfo}>
          <Text style={styles.paymentLeadName}>{item.leadId?.name || '—'}</Text>
          <Text style={styles.paymentLeadPhone}>
            {item.leadId?.phone || ''}
          </Text>
        </View>
        <View style={styles.paymentAmountContainer}>
          <Text style={styles.paymentAmount}>
            {item.currency === 'INR' ? '₹' : item.currency}
            {item.amount.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.paymentMode}>{item.paymentMode}</Text>
        </View>
      </View>

      <View style={styles.paymentDivider} />

      <View style={styles.paymentDetails}>
        <View style={styles.paymentDetailItem}>
          <Text style={styles.paymentDetailLabel}>Status</Text>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.paymentDetailItem}>
          <Text style={styles.paymentDetailLabel}>Date</Text>
          <Text style={styles.paymentDetailValue}>
            {item.paymentDate
              ? new Date(item.paymentDate).toLocaleDateString('en-IN')
              : '—'}
          </Text>
        </View>
        <View style={styles.paymentDetailItem}>
          <Text style={styles.paymentDetailLabel}>Lead Owner</Text>
          <Text style={styles.paymentDetailValue}>
            {item.leadId?.assignedTo?.name || '—'}
          </Text>
        </View>
        <View style={styles.paymentDetailItem}>
          <Text style={styles.paymentDetailLabel}>Recorded By</Text>
          <Text style={styles.paymentDetailValue}>
            {item.recordedBy?.name || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.paymentActions}>
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
          onPress={() => handleDeleteClick(item)}
        >
          <Icon name="trash-outline" size={16} color="#EF4444" />
          <Text style={styles.paymentActionDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Render Empty State ──────────────────────────────────────────────────
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="receipt-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateText}>No payments found.</Text>
    </View>
  );

  // ─── Render Header ───────────────────────────────────────────────────────
  const renderHeader = () => (
    <>
      {/* Header Row */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Payments</Text>
          <Text style={styles.headerSubtitle}>
            Track payments and collect via Razorpay
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Icon name="options-outline" size={20} color="#6B7280" />
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
      <View style={styles.razorpayStatusContainer}>
        <View style={styles.razorpayStatus}>
          <View
            style={[
              styles.statusDot,
              razorpayConnected
                ? styles.statusDotConnected
                : styles.statusDotDisconnected,
            ]}
          />
          <Text style={styles.razorpayStatusText}>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
        >
          <View style={styles.statsContainer}>
            <StatsCard
              label={ownedRevenueLabel}
              value={`₹${(stats.totalAmount || 0).toLocaleString('en-IN')}`}
              sub={`${stats.total} transactions`}
              color="#4F46E5"
            />
            {!showAllPipelinesCard && (
              <StatsCard
                label={involvementLabel}
                value={`₹${(stats.involvedTotalAmount || 0).toLocaleString(
                  'en-IN',
                )}`}
                sub={`${stats.involvedTotal || 0} transactions`}
                color="#0EA5E9"
              />
            )}
            <StatsCard
              label="Paid"
              value={statByStatus('Paid').count}
              sub={`₹${(statByStatus('Paid').totalAmount || 0).toLocaleString(
                'en-IN',
              )}`}
              color="#10B981"
            />
            <StatsCard
              label="Pending"
              value={statByStatus('Pending').count}
              sub={`₹${(
                statByStatus('Pending').totalAmount || 0
              ).toLocaleString('en-IN')}`}
              color="#F59E0B"
            />
            <StatsCard
              label="Overdue"
              value={statByStatus('Overdue').count}
              sub={`₹${(
                statByStatus('Overdue').totalAmount || 0
              ).toLocaleString('en-IN')}`}
              color="#EF4444"
            />
            {showAllPipelinesCard && (
              <StatsCard
                label="Partial"
                value={statByStatus('Partial').count}
                sub={`₹${(
                  statByStatus('Partial').totalAmount || 0
                ).toLocaleString('en-IN')}`}
                color="#3B82F6"
              />
            )}
          </View>
        </ScrollView>
      )}
    </>
  );

  // ─── Main Render ──────────────────────────────────────────────────────────
  // Not connected screen
  if (!razorpayConnected) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Payments</Text>
            <Text style={styles.headerSubtitle}>
              Track payments and collect via Razorpay
            </Text>
          </View>
        </View>
        <RazorpayConnectCard onConnect={handleConnect} loading={rzpLoading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Toast */}
      {toast ? (
        <View style={styles.toastContainer}>
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
                  page === 1 && styles.paginationDisabled,
                ]}
                onPress={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <Text style={styles.paginationButtonText}>← Prev</Text>
              </TouchableOpacity>
              <Text style={styles.paginationText}>
                Page {page} of {totalPages}
              </Text>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  page === totalPages && styles.paginationDisabled,
                ]}
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <Text style={styles.paginationButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* Modals */}
      <PaymentModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={msg => {
          showToast(msg);
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
            showToast(msg);
            fetchPayments();
          }}
        />
      )}

      <DeleteModal
        visible={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
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
      />
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  // Toast
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1000,
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  // Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Razorpay Status
  razorpayStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  razorpayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotConnected: {
    backgroundColor: '#10B981',
  },
  statusDotDisconnected: {
    backgroundColor: '#9CA3AF',
  },
  razorpayStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  razorpayActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  razorpayDisconnectText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  razorpayConnectButton: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
  },
  razorpayConnectText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // Stats
  statsScroll: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    minWidth: 100,
  },
  statsLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  statsSub: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  // Payment Card
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentLeadInfo: {
    flex: 1,
  },
  paymentLeadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  paymentLeadPhone: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  paymentAmountContainer: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  paymentMode: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  paymentDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentDetailItem: {
    flex: 1,
    minWidth: 80,
  },
  paymentDetailLabel: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentDetailValue: {
    fontSize: 12,
    color: '#374151',
  },
  paymentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  paymentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentActionLinkText: {
    fontSize: 12,
    color: '#6B46C1',
    fontWeight: '500',
  },
  paymentActionOpenText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  paymentActionDelete: {
    marginLeft: 'auto',
  },
  paymentActionDeleteText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  // Status Badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPartial: {
    backgroundColor: '#DBEAFE',
  },
  statusOverdue: {
    backgroundColor: '#FEE2E2',
  },
  statusCancelled: {
    backgroundColor: '#F3F4F6',
  },
  statusDefault: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  paginationDisabled: {
    opacity: 0.4,
  },
  paginationButtonText: {
    fontSize: 12,
    color: '#374151',
  },
  paginationText: {
    fontSize: 12,
    color: '#6B7280',
  },
  // List
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  // Connect Card
  connectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    marginHorizontal: 16,
    padding: 20,
  },
  connectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  connectIconContainer: {
    width: 62,
    height: 62,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectInfo: {
    flex: 1,
  },
  connectTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  connectDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  connectDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },
  connectButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  connectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 22,
    paddingVertical: 7,
  },
  connectButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  formGroup: {
    marginBottom: 12,
  },
  rowFormGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  flex1: {
    flex: 1,
  },
  currencyContainer: {
    width: 100,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  picker: {
    height: 44,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  dateText: {
    fontSize: 14,
    color: '#111827',
  },
  datePlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  // Lead Suggestions
  suggestionsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  leadSuggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  leadSuggestionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  leadSuggestionPhone: {
    fontSize: 12,
    color: '#6B7280',
  },
  suggestionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectedLeadContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  selectedLeadText: {
    fontSize: 14,
    color: '#111827',
  },
  // Link Modal
  linkModalContent: {
    maxHeight: '70%',
  },
  linkModalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  linkModalLeadName: {
    fontWeight: '600',
    color: '#111827',
  },
  linkContainer: {
    marginVertical: 8,
  },
  linkDisplay: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#4F46E5',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  // Delete Modal
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  deleteModalMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  // Filter Modal
  filterModalContent: {
    maxHeight: '70%',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  filterClearButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterClearText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterApplyButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterApplyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

export default PaymentsScreen;
