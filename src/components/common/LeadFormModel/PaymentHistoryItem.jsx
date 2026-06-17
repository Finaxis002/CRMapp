import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Feather from 'react-native-vector-icons/Feather';

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

const PaymentHistoryItem = ({ payment, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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
      alert('Valid amount required.');
      return;
    }

    setSaving(true);
    try {
      // TODO: Replace with actual API call
      // await api.put(`/payments/${payment._id}`, editForm);

      setTimeout(() => {
        setEditing(false);
        if (onUpdated) {
          onUpdated({
            ...payment,
            ...editForm,
            amount: Number(editForm.amount),
          });
        }
        setSaving(false);
      }, 800);
    } catch (err) {
      alert('Failed to update payment');
      setSaving(false);
    }
  };

  const getStatusStyle = status => {
    switch (status) {
      case 'Paid':
        return { backgroundColor: '#d1fae5', color: '#065f46' };
      case 'Partial':
        return { backgroundColor: '#bae6fd', color: '#0369a1' };
      case 'Pending':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'Overdue':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      default:
        return { backgroundColor: '#f1f5f9', color: '#475569' };
    }
  };

  // ==================== VIEW MODE ====================
  if (!editing) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          {/* Left Content */}
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.amount}>
              ₹{Number(payment.amount || 0).toLocaleString('en-IN')}
            </Text>

            <View style={styles.tagsRow}>
              <View style={styles.tag}>
                <Text style={styles.tagLabel}>Mode</Text>
                <Text style={styles.tagValue}>
                  {payment.paymentMode || '—'}
                </Text>
              </View>

              <View style={styles.tag}>
                <Text style={styles.tagLabel}>Date</Text>
                <Text style={styles.tagValue}>
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
              <Text style={styles.reference}>
                Ref:{' '}
                <Text style={{ fontWeight: '600' }}>{payment.reference}</Text>
              </Text>
            ) : null}
          </View>

          {/* Right Side */}
          <View style={styles.rightSection}>
            <View style={[styles.statusBadge, getStatusStyle(payment.status)]}>
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusStyle(payment.status).color },
                ]}
              >
                {payment.status || '—'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(true)}
            >
              <Feather name="edit-2" size={14} color="#6366f1" />
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ==================== EDIT MODE ====================
  return (
    <View style={styles.editCard}>
      <View style={styles.editHeader}>
        <Text style={styles.editTitle}>Edit payment</Text>
        <TouchableOpacity onPress={() => setEditing(false)}>
          <Text style={{ color: '#64748b', fontSize: 13 }}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Amount + Status */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Amount (₹)</Text>
          <TextInput
            value={editForm.amount}
            onChangeText={text =>
              setEditForm(prev => ({ ...prev, amount: text }))
            }
            keyboardType="numeric"
            style={styles.input}
            placeholder="0"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Status</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={editForm.status}
              onValueChange={itemValue =>
                setEditForm(prev => ({ ...prev, status: itemValue }))
              }
              style={styles.picker}
            >
              {PAYMENT_STATUS.map(status => (
                <Picker.Item key={status} label={status} value={status} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      {/* Mode + Date */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Mode</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={editForm.paymentMode}
              onValueChange={itemValue =>
                setEditForm(prev => ({ ...prev, paymentMode: itemValue }))
              }
              style={styles.picker}
            >
              {PAYMENT_MODES.map(mode => (
                <Picker.Item key={mode} label={mode} value={mode} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Date</Text>
          <TextInput
            value={editForm.paymentDate}
            onChangeText={text =>
              setEditForm(prev => ({ ...prev, paymentDate: text }))
            }
            placeholder="YYYY-MM-DD"
            style={styles.input}
          />
        </View>
      </View>

      {/* Reference */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Reference</Text>
        <TextInput
          value={editForm.reference}
          onChangeText={text =>
            setEditForm(prev => ({ ...prev, reference: text }))
          }
          placeholder="Transaction ID / UTR"
          style={styles.input}
        />
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => setEditing(false)}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  tag: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  tagValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1,
  },
  reference: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
  },
  editText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },

  // Edit Mode
  editCard: {
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    padding: 14,
    marginBottom: 10,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366f1',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 48,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelText: {
    color: '#64748b',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default PaymentHistoryItem;
