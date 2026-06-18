import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';

const PAYMENT_MODES = [
  'UPI',
  'Bank Transfer',
  'Cash',
  'Cheque',
  'Razorpay',
  'Stripe',
  'PayU',
];

const PAYMENT_STATUS = ['Paid', 'Partial', 'Pending', 'Overdue', 'Cancelled'];

const statusStyle = status => {
  if (status === 'Paid') return { bg: '#d1fae5', text: '#065f46' };
  if (status === 'Pending') return { bg: '#fef3c7', text: '#92400e' };
  if (status === 'Overdue') return { bg: '#fee2e2', text: '#991b1b' };
  if (status === 'Partial') return { bg: '#e0f2fe', text: '#075985' };
  return { bg: '#f1f5f9', text: '#334155' };
};

const toInputDate = date => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PaymentHistoryItem = ({ payment, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editForm, setEditForm] = useState({
    amount: String(payment.amount || ''),
    paymentMode: payment.paymentMode || 'UPI',
    status: payment.status || 'Pending',
    paymentDate: payment.paymentDate
      ? new Date(payment.paymentDate).toISOString().split('T')[0]
      : '',
    reference: payment.reference || '',
  });

  useEffect(() => {
    setEditForm({
      amount: String(payment.amount || ''),
      paymentMode: payment.paymentMode || 'UPI',
      status: payment.status || 'Pending',
      paymentDate: payment.paymentDate
        ? new Date(payment.paymentDate).toISOString().split('T')[0]
        : '',
      reference: payment.reference || '',
    });
  }, [payment]);

  const handleSave = async () => {
    if (!editForm.amount || Number(editForm.amount) <= 0) {
      Alert.alert('Validation', 'Valid amount required.');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const { data } = await axios.put(
        `/api/v1/payments/${payment._id}`,
        {
          amount: Number(editForm.amount),
          paymentMode: editForm.paymentMode,
          status: editForm.status,
          paymentDate: editForm.paymentDate || undefined,
          reference: editForm.reference.trim() || undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      Alert.alert('Success', 'Payment updated successfully.');
      setEditing(false);
      if (onUpdated) onUpdated(data.data);
    } catch (err) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || 'Unable to update payment.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    const st = statusStyle(payment.status);
    return (
      <View style={styles.viewCard}>
        <View style={styles.viewTopRow}>
          <View style={styles.flex1}>
            <Text style={styles.upperLabel}>Amount</Text>
            <Text style={styles.amountText}>
              ₹{(Number(payment.amount) || 0).toLocaleString('en-IN')}
            </Text>

            <View style={styles.metaWrap}>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>Mode</Text>
                <Text style={styles.metaValue}>
                  {payment.paymentMode || '—'}
                </Text>
              </View>

              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>
                  {payment.paymentDate
                    ? new Date(payment.paymentDate).toLocaleDateString(
                        'en-IN',
                        {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        },
                      )
                    : '—'}
                </Text>
              </View>
            </View>

            {payment.reference ? (
              <Text style={styles.referenceText}>
                Ref:{' '}
                <Text style={styles.referenceStrong}>{payment.reference}</Text>
              </Text>
            ) : null}
          </View>

          <View style={styles.rightBlock}>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.statusText, { color: st.text }]}>
                {payment.status || '—'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setEditing(true)}
              style={styles.editBtn}
            >
              <Icon name="pencil-outline" size={14} color="#4338ca" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.editCard}>
      <View style={styles.editHeader}>
        <Text style={styles.editTitle}>Edit payment</Text>
        <TouchableOpacity onPress={() => setEditing(false)}>
          <Text style={styles.cancelLink}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridRow}>
        <View style={styles.flex1}>
          <Text style={styles.formLabel}>Amount (₹)</Text>
          <TextInput
            keyboardType="numeric"
            value={editForm.amount}
            onChangeText={value => setEditForm(f => ({ ...f, amount: value }))}
            style={styles.input}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={editForm.status}
              onValueChange={value =>
                setEditForm(f => ({ ...f, status: value }))
              }
              style={styles.picker}
              mode="dropdown"
            >
              {PAYMENT_STATUS.map(status => (
                <Picker.Item key={status} label={status} value={status} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <View style={styles.gridRow}>
        <View style={styles.flex1}>
          <Text style={styles.formLabel}>Mode</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={editForm.paymentMode}
              onValueChange={value =>
                setEditForm(f => ({ ...f, paymentMode: value }))
              }
              style={styles.picker}
              mode="dropdown"
            >
              {PAYMENT_MODES.map(mode => (
                <Picker.Item key={mode} label={mode} value={mode} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.formLabel}>Date</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={styles.dateBtn}
          >
            <Text style={styles.dateBtnText}>
              {editForm.paymentDate || 'Select date'}
            </Text>
            <Icon name="calendar-month-outline" size={16} color="#64748b" />
          </TouchableOpacity>
          {showDatePicker ? (
            <DateTimePicker
              value={
                editForm.paymentDate
                  ? new Date(`${editForm.paymentDate}T00:00:00`)
                  : new Date()
              }
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={(event, selectedDate) => {
                if (event?.type === 'dismissed') return;
                if (selectedDate) {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  setEditForm(f => ({
                    ...f,
                    paymentDate: toInputDate(selectedDate),
                  }));
                }
              }}
              onDismiss={() => {
                if (Platform.OS === 'android') setShowDatePicker(false);
              }}
            />
          ) : null}
        </View>
      </View>

      <View>
        <Text style={styles.formLabel}>Reference</Text>
        <TextInput
          value={editForm.reference}
          onChangeText={value => setEditForm(f => ({ ...f, reference: value }))}
          style={styles.input}
          placeholder="Transaction ID / UTR"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={() => setEditing(false)}
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  viewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 12,
  },
  viewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  upperLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#94a3b8',
  },
  amountText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaLabel: { textTransform: 'uppercase', fontSize: 10, color: '#94a3b8' },
  metaValue: { fontSize: 11, fontWeight: '600', color: '#1e293b' },
  referenceText: { marginTop: 8, fontSize: 11, color: '#64748b' },
  referenceStrong: { fontWeight: '600', color: '#334155' },
  rightBlock: { alignItems: 'flex-end', gap: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#4338ca' },
  editCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff55',
    padding: 12,
    gap: 12,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  editTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#4f46e5',
  },
  cancelLink: { fontSize: 12, color: '#64748b' },
  gridRow: { flexDirection: 'row', gap: 8 },
  formLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  pickerWrap: {
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: { height: 40, width: '100%', color: '#111827' },
  dateBtn: {
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateBtnText: { fontSize: 13, color: '#111827' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelBtnText: { fontSize: 12, color: '#4b5563' },
  saveBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
});

export default PaymentHistoryItem;
