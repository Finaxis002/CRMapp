import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';

// ── Auth Headers using AsyncStorage ──────────────────────────────────
const authHeaders = async () => {
  let token = '';
  try {
    // 1. Direct token check
    token =
      (await AsyncStorage.getItem('accessToken')) ||
      (await AsyncStorage.getItem('token'));

    // 2. Fallback to Redux Persist 'persist:auth'
    if (!token) {
      const persistAuth = await AsyncStorage.getItem('persist:auth');
      if (persistAuth) {
        const parsedAuth = JSON.parse(persistAuth);
        if (parsedAuth.accessToken) {
          token = parsedAuth.accessToken.replace(/"/g, '');
        }
      }
    }
  } catch (error) {
    console.error('Error reading token from AsyncStorage:', error);
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

// ── API Fetch Wrapper ────────────────────────────────────────────────
const apiFetch = async (url, opts = {}) => {
  const headers = await authHeaders();
  const fullUrl = url.startsWith('http')
    ? url
    : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

  const res = await fetch(fullUrl, { headers, ...opts });
  return res.json();
};

// ── Helper to format date for display ──────────────────────────────
const formatDate = date => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AddEventModal = ({
  visible,
  date,
  users = [],
  currentUser,
  onClose,
  onSaved,
}) => {
  // ── Form State ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    title: '',
    assignedTo: currentUser ? [currentUser._id] : [],
    eventDate: date ? new Date(date) : new Date(),
    eventTime: '10:00',
    note: '',
  });

  // ── UI States ──────────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────

  // Handle date change from picker
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setForm(p => ({ ...p, eventDate: selectedDate }));
    }
  };

  // Handle time change from picker
  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const updatedDateTime = new Date(form.eventDate);
      updatedDateTime.setHours(selectedTime.getHours());
      updatedDateTime.setMinutes(selectedTime.getMinutes());
      setForm(p => ({ ...p, eventDate: updatedDateTime }));
    }
  };

  // Toggle user selection
  const toggleUserSelection = userId => {
    setForm(p => ({
      ...p,
      assignedTo: p.assignedTo.includes(userId)
        ? p.assignedTo.filter(id => id !== userId)
        : [...p.assignedTo, userId],
    }));
  };

  // ── Save Event ────────────────────────────────────────────────────
  const handleSave = async () => {
    // Validation
    if (!form.title.trim()) {
      Alert.alert('Error', 'Enter event title');
      return;
    }
    if (form.assignedTo.length === 0) {
      Alert.alert('Error', 'Assign to at least one user');
      return;
    }

    setSaving(true);
    try {
      const formattedDate = formatDate(form.eventDate);
      const hours = String(form.eventDate.getHours()).padStart(2, '0');
      const minutes = String(form.eventDate.getMinutes()).padStart(2, '0');
      const formattedTime = `${hours}:${minutes}`;

      const res = await apiFetch('/events', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          assignedTo: form.assignedTo,
          eventDate: formattedDate,
          eventTime: formattedTime,
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        }),
      });

      if (res.success) {
        Alert.alert('Success', res.message || 'Event created!');
        if (onSaved) await onSaved(res.data);
        onClose();
      } else {
        Alert.alert('Error', res.message || 'Failed to create event');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  // ── Get selected users labels ────────────────────────────────────
  const selectedUsersLabels = users
    .filter(u => form.assignedTo.includes(u._id))
    .map(u => u.name)
    .join(', ');

  // ── Render DateTimePicker for iOS/Android ────────────────────────
  const renderDateTimePicker = () => {
    if (Platform.OS === 'ios') {
      return (
        <>
          {showDatePicker && (
            <DateTimePicker
              value={form.eventDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={form.eventDate}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
            />
          )}
        </>
      );
    }
    return (
      <>
        {showDatePicker && (
          <DateTimePicker
            value={form.eventDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={form.eventDate}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.iconContainer}>
                <Icon name="calendar-month" size={18} color="#4f46e5" />
              </View>
              <Text style={styles.headerTitle}>Add Event</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.formContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Title ── */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Team sync, Product demo..."
                placeholderTextColor="#94a3b8"
                value={form.title}
                onChangeText={text => setForm(p => ({ ...p, title: text }))}
              />
            </View>

            {/* ── Assign To (Custom Dropdown) ── */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Assign To *</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowUserPicker(!showUserPicker)}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                  {selectedUsersLabels || 'Select team members...'}
                </Text>
                <Icon
                  name={showUserPicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>

              {showUserPicker && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={{ maxHeight: 180 }}>
                    {users.map(user => {
                      const isSelected = form.assignedTo.includes(user._id);
                      return (
                        <TouchableOpacity
                          key={user._id}
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                          ]}
                          onPress={() => toggleUserSelection(user._id)}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              isSelected && styles.dropdownItemTextSelected,
                            ]}
                          >
                            {user.name}
                          </Text>
                          {isSelected && (
                            <Icon name="check" size={16} color="#4f46e5" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* ── Date & Time Row ── */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                <Text style={styles.label}>Date *</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerText}>
                    {form.eventDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                <Text style={styles.label}>Time</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerText}>
                    {form.eventDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Date/Time Pickers ── */}
            {renderDateTimePicker()}

            {/* ── Description ── */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Optional agenda or description…"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={form.note}
                onChangeText={text => setForm(p => ({ ...p, note: text }))}
              />
            </View>
          </ScrollView>

          {/* ── Footer Buttons ── */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Event</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  closeButton: {
    padding: 6,
  },
  formContainer: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
    justifyContent: 'center',
    minHeight: 44,
  },
  pickerText: {
    fontSize: 14,
    color: '#0f172a',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemSelected: {
    backgroundColor: '#eef2ff',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#334155',
  },
  dropdownItemTextSelected: {
    color: '#4338ca',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AddEventModal;
