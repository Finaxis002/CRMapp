import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  TextInput,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { googleCalendarService } from '../../services/googleCalendarService.js';
import AddEventModal from '../../components/common/AddEventModal.jsx';
import api from '../../services/api.js';
import { API_BASE_URL } from '../../config/index.js';
import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../../components/ui/CustomToast';
import PageHeader from '../../components/ui/PageHeader';
import ImprovedButton from '../../components/ui/ImprovedButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const REMINDER_TYPES = ['Call', 'Email', 'Meeting', 'Follow-up', 'Payment'];

const REMINDER_TYPE_CONFIG = {
  Call: {
    color: '#3b82f6',
    light: '#eff6ff',
    textColor: '#1d4ed8',
    icon: 'phone',
    emoji: '📞',
  },
  Email: {
    color: '#a855f7',
    light: '#faf5ff',
    textColor: '#7e22ce',
    icon: 'email',
    emoji: '📧',
  },
  Meeting: {
    color: '#22c55e',
    light: '#f0fdf4',
    textColor: '#15803d',
    icon: 'account-group',
    emoji: '🤝',
  },
  'Follow-up': {
    color: '#f97316',
    light: '#fff7ed',
    textColor: '#c2410c',
    icon: 'bell',
    emoji: '🔔',
  },
  Payment: {
    color: '#10b981',
    light: '#ecfdf5',
    textColor: '#065f46',
    icon: 'lightning-bolt',
    emoji: '💰',
  },
};

const EVENT_META = {
  color: '#6366f1',
  light: '#eef2ff',
  textColor: '#4338ca',
  icon: 'calendar',
};
const TASK_META = {
  color: '#eab308',
  light: '#fefce8',
  textColor: '#854d0e',
  icon: 'checkbox-marked',
};

const PRIMARY = '#6366f1';

const getTypeConfig = type => {
  if (type === 'Task') return TASK_META;
  return (
    REMINDER_TYPE_CONFIG[type] || {
      color: '#6b7280',
      light: '#f9fafb',
      textColor: '#374151',
      icon: 'bell',
    }
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isToday = d => isSameDay(d, new Date());

const getCalendarDays = (year, month) => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  let startDow = first.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const days = [];
  for (let i = startDow - 1; i >= 0; i--)
    days.push({ date: new Date(year, month, -i), currentMonth: false });
  for (let d = 1; d <= last.getDate(); d++)
    days.push({ date: new Date(year, month, d), currentMonth: true });
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++)
    days.push({ date: new Date(year, month + 1, d), currentMonth: false });
  return days;
};

const formatTime12 = time => {
  if (!time) return '';
  const raw = String(time).trim();
  if (/\b(am|pm)$/i.test(raw)) return raw;
  const [hours, minutes] = raw.split(':');
  const hour = Number(hours);
  if (Number.isNaN(hour)) return raw;
  const minute = (minutes || '00').slice(0, 2).padStart(2, '0');
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, '0')}:${minute} ${suffix}`;
};

const formatDate = (date, time) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const dateStr = d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return time ? `${dateStr} · ${formatTime12(time)}` : dateStr;
};

const toDateInputValue = date => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── Date/Time Helpers for Picker ──
const parseDateInputValue = value => {
  if (!value) return new Date();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
};

const parseTimeInputValue = (time, baseDate) => {
  const d = parseDateInputValue(baseDate);
  if (!time) {
    d.setHours(10, 0, 0, 0);
    return d;
  }
  const [hours, minutes] = String(time).split(':').map(Number);
  d.setHours(
    Number.isNaN(hours) ? 10 : hours,
    Number.isNaN(minutes) ? 0 : minutes,
    0,
    0,
  );
  return d;
};

const toTimeInputValue = date => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '10:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
};

const getTaskLeadName = task => {
  if (task.leadId && typeof task.leadId === 'object')
    return task.leadId.name || '—';
  return '—';
};

// ── API Helpers ───────────────────────────────────────────────────────────────
const getToken = async () => {
  try {
    const t =
      (await AsyncStorage.getItem('accessToken')) ||
      (await AsyncStorage.getItem('token'));
    if (t) return t;
    const persist = await AsyncStorage.getItem('persist:auth');
    if (persist)
      return JSON.parse(persist).accessToken?.replace(/"/g, '') || '';
  } catch {
    return '';
  }
  return '';
};

const apiFetch = async (path, opts = {}) => {
  const token = await getToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const base = API_BASE_URL;
  const url = path.startsWith('http')
    ? path
    : `${base}${
        path.startsWith('/api/v1') ? path.replace('/api/v1', '') : path
      }`;
  const res = await fetch(url, { ...opts, headers });
  return res.json();
};

const parseApiList = res => {
  const payload = res?.data?.data || res?.data?.items || res?.data || [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

// ═════════════════════════════════════════════════════════════════════════════
// ── ItemDetailModal ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const ItemDetailModal = ({ item, visible, onClose, onMarkDone, onDelete }) => {
  if (!item) return null;
  const isEv = !!item.isEvent;
  const isTask = !!item.isTask;
  const isDone = isEv ? item.isDone : isTask ? item.taskCompleted : item.isDone;

  const badgeColor = isEv ? '#6366f1' : isTask ? '#eab308' : '#f59e0b';
  const badgeLabel = isEv ? 'Event' : isTask ? 'Task' : item.type || 'Reminder';
  const dotColor = isEv ? '#6366f1' : isTask ? '#eab308' : '#f59e0b';

  const title = isEv
    ? item.title
    : isTask
    ? item.text || 'Task'
    : `${item.type}: ${item.leadId?.name || '—'}`;

  const fullText = isEv
    ? item.note || ''
    : isTask
    ? item.text || ''
    : item.note || item.text || '';

  const dateVal = item.eventDate || item.reminderDate || item.taskDueDate;
  const timeVal = item.eventTime || item.reminderTime || '';
  const leadName = isTask ? getTaskLeadName(item) : item.leadId?.name || null;
  const assignedName = isEv
    ? Array.isArray(item.assignedTo)
      ? item.assignedTo.map(u => u?.name).join(', ')
      : item.assignedTo?.name || '—'
    : isTask
    ? item.taskAssignedTo?.name || '—'
    : item.assignedTo?.name || '—';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={s.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity style={s.detailCard} activeOpacity={1}>
          {/* Header */}
          <View style={s.detailHeader}>
            <View style={s.detailHeaderLeft}>
              <View style={[s.dotBig, { backgroundColor: dotColor }]} />
              <View
                style={[
                  s.badge,
                  {
                    backgroundColor: badgeColor + '20',
                    borderColor: badgeColor + '40',
                  },
                ]}
              >
                <Text style={[s.badgeText, { color: badgeColor }]}>
                  {badgeLabel.toUpperCase()}
                </Text>
              </View>
              {isDone && (
                <View
                  style={[
                    s.badge,
                    { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
                  ]}
                >
                  <Text style={[s.badgeText, { color: '#16a34a' }]}>DONE</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={s.detailBody} showsVerticalScrollIndicator={false}>
            <Text style={[s.detailTitle, isDone && s.strikethrough]}>
              {title}
            </Text>

            {!!fullText && (
              <View style={s.noteBox}>
                <Text style={s.noteLabel}>
                  {isEv ? 'NOTE' : isTask ? 'DESCRIPTION' : 'NOTE'}
                </Text>
                <Text style={s.noteText}>{fullText}</Text>
              </View>
            )}

            {!!leadName && (
              <View style={s.infoRow}>
                <View style={[s.infoIcon, { backgroundColor: '#eff6ff' }]}>
                  <Icon name="account" size={14} color="#3b82f6" />
                </View>
                <View>
                  <Text style={s.infoLabel}>LEAD</Text>
                  <Text style={s.infoValue}>{leadName}</Text>
                </View>
              </View>
            )}

            {!!dateVal && (
              <View style={s.infoRow}>
                <View style={[s.infoIcon, { backgroundColor: '#faf5ff' }]}>
                  <Icon name="calendar" size={14} color="#a855f7" />
                </View>
                <View>
                  <Text style={s.infoLabel}>DATE & TIME</Text>
                  <Text style={s.infoValue}>
                    {formatDate(dateVal, timeVal)}
                  </Text>
                </View>
              </View>
            )}

            {!!assignedName && assignedName !== '—' && (
              <View style={s.infoRow}>
                <View style={[s.infoIcon, { backgroundColor: '#f0fdf4' }]}>
                  <Icon name="account-group" size={14} color="#22c55e" />
                </View>
                <View>
                  <Text style={s.infoLabel}>ASSIGNED TO</Text>
                  <Text style={s.infoValue}>{assignedName}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={s.detailFooter}>
            {onMarkDone && (
              <TouchableOpacity
                onPress={() => {
                  onMarkDone();
                  onClose();
                }}
                style={[
                  s.footerBtn,
                  isDone ? s.footerBtnPending : s.footerBtnDone,
                ]}
              >
                <Icon
                  name={isDone ? 'refresh' : 'checkbox-marked'}
                  size={14}
                  color={isDone ? '#f97316' : '#fff'}
                />
                <Text
                  style={[
                    s.footerBtnText,
                    { color: isDone ? '#f97316' : '#fff' },
                  ]}
                >
                  {isDone ? 'Mark as Pending' : 'Mark as Done'}
                </Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => {
                  onDelete();
                  onClose();
                }}
                style={[s.footerBtn, s.footerBtnDelete]}
              >
                <Icon name="close" size={14} color="#ef4444" />
                <Text style={[s.footerBtnText, { color: '#ef4444' }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ── AddReminderModal ─────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const AddReminderModal = ({
  visible,
  date,
  users,
  currentUser,
  onClose,
  onSaved,
}) => {
  const toast = useKitToast();
  const today = toDateInputValue(new Date());
  const [form, setForm] = useState({
    leadSearch: '',
    leadId: '',
    leadName: '',
    type: 'Call',
    assignedTo: currentUser?._id || '',
    reminderDate: date ? toDateInputValue(date) : today,
    reminderTime: '10:00',
    note: '',
  });
  const [leads, setLeads] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Picker states ──
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);

  const setF = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const searchLeads = useCallback(async q => {
    if (!q.trim()) {
      setLeads([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(
        `/api/v1/leads?search=${encodeURIComponent(q)}&limit=5`,
      );
      const data = res.data?.items || res.data?.data || res.data || [];
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      setLeads([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchLeads(form.leadSearch), 300);
    return () => clearTimeout(t);
  }, [form.leadSearch, searchLeads]);

  const handleSave = async () => {
    if (!form.leadId) {
      toast.error('Select a lead');
      return;
    }
    if (!form.assignedTo) {
      toast.error('Assign to a user');
      return;
    }
    if (!form.reminderDate) {
      toast.error('Pick a date');
      return;
    }
    const payload = {
      leadId: form.leadId,
      type: form.type,
      assignedTo: form.assignedTo,
      reminderDate: form.reminderDate,
      reminderTime: form.reminderTime,
    };
    if (form.note?.trim()) payload.note = form.note.trim();
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/reminders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        toast.success(res.message || 'Reminder created!');
        await onSaved(res.data);
        onClose();
      } else {
        toast.error(res.message || 'Failed to create reminder');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={s.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity style={s.modalCard} activeOpacity={1}>
          {/* Header */}
          <View style={s.modalHeader}>
            <View style={s.modalHeaderLeft}>
              <View style={[s.modalIcon, { backgroundColor: PRIMARY + '15' }]}>
                <Icon name="bell" size={16} color={PRIMARY} />
              </View>
              <Text style={s.modalTitle}>Add Reminder</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Lead */}
            <Text style={s.fieldLabel}>Lead *</Text>
            {form.leadId ? (
              <View style={s.selectedLeadRow}>
                <Text style={s.selectedLeadText}>{form.leadName}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setForm(p => ({
                      ...p,
                      leadId: '',
                      leadName: '',
                      leadSearch: '',
                    }))
                  }
                >
                  <Icon name="close" size={14} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TextInput
                  style={s.input}
                  placeholder="Search lead by name or phone…"
                  placeholderTextColor="#9ca3af"
                  value={form.leadSearch}
                  onChangeText={v => setF('leadSearch', v)}
                />
                {form.leadSearch.length > 0 &&
                  (leads.length > 0 || searching) && (
                    <View style={s.dropdown}>
                      {searching ? (
                        <Text style={s.dropdownSearching}>Searching…</Text>
                      ) : (
                        leads.map(l => (
                          <TouchableOpacity
                            key={l._id}
                            style={s.dropdownItem}
                            onPress={() =>
                              setForm(p => ({
                                ...p,
                                leadId: l._id,
                                leadName: l.name,
                                leadSearch: '',
                              }))
                            }
                          >
                            <Text style={s.dropdownName}>{l.name}</Text>
                            <Text style={s.dropdownPhone}>{l.phone}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
              </View>
            )}

            {/* Type & Assign */}
            <View style={s.rowFields}>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Type</Text>
                <View style={s.pickerWrap}>
                  <Picker
                    itemStyle={s.pickerItem}
                    mode="dropdown"
                    selectedValue={form.type}
                    onValueChange={v => setF('type', v)}
                    style={s.picker}
                    dropdownIconColor="#6b7280"
                  >
                    {REMINDER_TYPES.map(t => (
                      <Picker.Item key={t} label={t} value={t} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Assign To *</Text>
                <View style={s.pickerWrap}>
                  <Picker
                    itemStyle={s.pickerItem}
                    mode="dropdown"
                    selectedValue={form.assignedTo}
                    onValueChange={v => setF('assignedTo', v)}
                    style={s.picker}
                    dropdownIconColor="#6b7280"
                  >
                    <Picker.Item label="Select user" value="" />
                    {users.map(u => (
                      <Picker.Item key={u._id} label={u.name} value={u._id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            {/* Date & Time */}
            <View style={s.rowFields}>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Date *</Text>
                <TouchableOpacity
                  style={[s.input, s.datePickerInput]}
                  activeOpacity={0.8}
                  onPress={() => setShowReminderDatePicker(true)}
                >
                  <Text style={s.datePickerText}>
                    {form.reminderDate || 'Select date'}
                  </Text>
                  <Icon
                    name="calendar"
                    size={18}
                    color="#6b7280"
                    style={s.datePickerIcon}
                  />
                </TouchableOpacity>
              </View>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Time</Text>
                <TouchableOpacity
                  style={[s.input, s.datePickerInput]}
                  activeOpacity={0.8}
                  onPress={() => setShowReminderTimePicker(true)}
                >
                  <Text style={s.datePickerText}>
                    {form.reminderTime
                      ? formatTime12(form.reminderTime)
                      : 'Select time'}
                  </Text>
                  <Icon
                    name="clock-outline"
                    size={18}
                    color="#6b7280"
                    style={s.datePickerIcon}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Note */}
            <Text style={s.fieldLabel}>Note</Text>
            <TextInput
              style={s.input}
              value={form.note}
              onChangeText={v => setF('note', v)}
              placeholder="Optional note…"
              placeholderTextColor="#9ca3af"
            />
          </ScrollView>

          {/* ── Native Date Picker ── */}
          {showReminderDatePicker && (
            <DateTimePicker
              value={parseDateInputValue(form.reminderDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') {
                  setShowReminderDatePicker(false);
                }
                if (event?.type === 'dismissed') return;
                if (selectedDate) {
                  setF('reminderDate', toDateInputValue(selectedDate));
                }
              }}
            />
          )}

          {/* ── Native Time Picker ── */}
          {showReminderTimePicker && (
            <DateTimePicker
              value={parseTimeInputValue(form.reminderTime, form.reminderDate)}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
              onChange={(event, selectedTime) => {
                if (Platform.OS === 'android') {
                  setShowReminderTimePicker(false);
                }
                if (event?.type === 'dismissed') return;
                if (selectedTime) {
                  setF('reminderTime', toTimeInputValue(selectedTime));
                }
              }}
            />
          )}

          {/* Footer */}
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, saving && s.disabledBtn]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save Reminder</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ── AddTaskModal ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const AddTaskModal = ({
  visible,
  date,
  users,
  currentUser,
  onClose,
  onSaved,
}) => {
  const toast = useKitToast();
  const today = toDateInputValue(new Date());
  const [form, setForm] = useState({
    leadSearch: '',
    leadId: '',
    leadName: '',
    text: '',
    dueDate: date ? toDateInputValue(date) : today,
    assignedTo: currentUser?._id || '',
    notify: '',
  });
  const [leads, setLeads] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Picker states ──
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);

  const setF = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const searchLeads = useCallback(async q => {
    if (!q.trim()) {
      setLeads([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(
        `/api/v1/leads?search=${encodeURIComponent(q)}&limit=5`,
      );
      const data = res.data?.items || res.data?.data || res.data || [];
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      setLeads([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchLeads(form.leadSearch), 300);
    return () => clearTimeout(t);
  }, [form.leadSearch, searchLeads]);

  const handleSave = async () => {
    if (!form.leadId) {
      toast.error('Select a lead');
      return;
    }
    if (!form.text.trim()) {
      toast.error('Enter task description');
      return;
    }
    if (!form.dueDate) {
      toast.error('Due date is required');
      return;
    }
    if (!form.assignedTo) {
      toast.error('Assign to a user');
      return;
    }
    const payload = {
      activities: [
        {
          type: 'Task',
          text: form.text.trim(),
          taskDueDate: form.dueDate,
          taskAssignedTo: form.assignedTo,
          notifiedUsers: form.notify ? [form.notify] : [],
        },
      ],
    };
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/leads/${form.leadId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        toast.success('Task created & synced to Google Calendar ✅');
        await onSaved();
        onClose();
      } else {
        toast.error(res.message || 'Failed to create task');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={s.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity style={s.modalCard} activeOpacity={1}>
          <View style={s.modalHeader}>
            <View style={s.modalHeaderLeft}>
              <View style={[s.modalIcon, { backgroundColor: '#eab30820' }]}>
                <Icon name="checkbox-marked" size={16} color="#eab308" />
              </View>
              <Text style={s.modalTitle}>Add Task</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.fieldLabel}>Lead *</Text>
            {form.leadId ? (
              <View style={s.selectedLeadRow}>
                <Text style={s.selectedLeadText}>{form.leadName}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setForm(p => ({
                      ...p,
                      leadId: '',
                      leadName: '',
                      leadSearch: '',
                    }))
                  }
                >
                  <Icon name="close" size={14} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TextInput
                  style={s.input}
                  placeholder="Search lead by name or phone…"
                  placeholderTextColor="#9ca3af"
                  value={form.leadSearch}
                  onChangeText={v => setF('leadSearch', v)}
                />
                {form.leadSearch.length > 0 &&
                  (leads.length > 0 || searching) && (
                    <View style={s.dropdown}>
                      {searching ? (
                        <Text style={s.dropdownSearching}>Searching…</Text>
                      ) : (
                        leads.map(l => (
                          <TouchableOpacity
                            key={l._id}
                            style={s.dropdownItem}
                            onPress={() =>
                              setForm(p => ({
                                ...p,
                                leadId: l._id,
                                leadName: l.name,
                                leadSearch: '',
                              }))
                            }
                          >
                            <Text style={s.dropdownName}>{l.name}</Text>
                            <Text style={s.dropdownPhone}>{l.phone}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
              </View>
            )}

            <Text style={s.fieldLabel}>Task Description</Text>
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              value={form.text}
              onChangeText={v => setF('text', v)}
              placeholder="Task details..."
              placeholderTextColor="#9ca3af"
              multiline
            />

            <View style={s.rowFields}>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Due Date *</Text>
                <TouchableOpacity
                  style={[s.input, s.datePickerInput]}
                  activeOpacity={0.8}
                  onPress={() => setShowTaskDatePicker(true)}
                >
                  <Text style={s.datePickerText}>
                    {form.dueDate || 'Select due date'}
                  </Text>
                  <Icon
                    name="calendar"
                    size={18}
                    color="#6b7280"
                    style={s.datePickerIcon}
                  />
                </TouchableOpacity>
              </View>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Assign To *</Text>
                <View style={s.pickerWrap}>
                  <Picker
                    itemStyle={s.pickerItem}
                    mode="dropdown"
                    selectedValue={form.assignedTo}
                    onValueChange={v => setF('assignedTo', v)}
                    style={s.picker}
                    dropdownIconColor="#6b7280"
                  >
                    <Picker.Item label="Select user" value="" />
                    {users.map(u => (
                      <Picker.Item key={u._id} label={u.name} value={u._id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <Text style={s.fieldLabel}>Notify User</Text>
            <View style={s.pickerWrap}>
              <Picker
                selectedValue={form.notify}
                onValueChange={v => setF('notify', v)}
                style={s.picker}
                itemStyle={s.pickerItem}
                mode="dropdown"
                dropdownIconColor="#6b7280"
              >
                <Picker.Item label="None" value="" />
                {users.map(u => (
                  <Picker.Item key={u._id} label={u.name} value={u._id} />
                ))}
              </Picker>
            </View>
            <Text style={s.hintText}>
              Select a user to notify on task creation.
            </Text>
          </ScrollView>

          {/* ── Native Date Picker ── */}
          {showTaskDatePicker && (
            <DateTimePicker
              value={parseDateInputValue(form.dueDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') {
                  setShowTaskDatePicker(false);
                }
                if (event?.type === 'dismissed') return;
                if (selectedDate) {
                  setF('dueDate', toDateInputValue(selectedDate));
                }
              }}
            />
          )}

          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.saveBtn,
                { backgroundColor: '#eab308' },
                saving && s.disabledBtn,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ── DeleteConfirmModal ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const DeleteConfirmModal = ({
  visible,
  deleteConfirm,
  onCancel,
  onConfirm,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onCancel}
  >
    <TouchableOpacity
      style={s.modalOverlay}
      activeOpacity={1}
      onPress={onCancel}
    >
      <TouchableOpacity
        style={[s.modalCard, { padding: 24, maxHeight: undefined }]}
        activeOpacity={1}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#fee2e2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="close" size={16} color="#dc2626" />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
            {deleteConfirm?.type === 'gcal'
              ? 'Disconnect?'
              : `Delete ${deleteConfirm?.type || ''}?`}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 13,
            color: '#6b7280',
            marginLeft: 48,
            marginBottom: 20,
          }}
        >
          {deleteConfirm?.label}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={[s.cancelBtn, { flex: 1 }]}
            onPress={onCancel}
          >
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.saveBtn, { flex: 1, backgroundColor: '#dc2626' }]}
            onPress={onConfirm}
          >
            <Text style={s.saveBtnText}>
              {deleteConfirm?.type === 'gcal'
                ? 'Yes, Disconnect'
                : 'Yes, Delete'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

// ═════════════════════════════════════════════════════════════════════════════
// ── DayPanel Modal ───────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const DayPanelModal = ({
  visible,
  date,
  reminders,
  events,
  tasks,
  onClose,
  onAddReminder,
  onAddEvent,
  onAddTask,
  onMarkDone,
  onMarkEventDone,
  onMarkTaskDone,
  onDeleteTask,
  onOpenDetail,
}) => {
  if (!date) return null;
  const dayReminders = reminders.filter(r =>
    isSameDay(new Date(r.reminderDate), date),
  );
  const dayEvents = events.filter(e => isSameDay(new Date(e.eventDate), date));
  const dayTasks = tasks.filter(
    t => t.taskDueDate && isSameDay(new Date(t.taskDueDate), date),
  );
  const empty =
    dayReminders.length === 0 &&
    dayEvents.length === 0 &&
    dayTasks.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={s.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity style={s.dayPanelCard} activeOpacity={1}>
          {/* Header */}
          <View style={s.modalHeader}>
            <View>
              <Text
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  letterSpacing: 0.5,
                }}
              >
                {date.toLocaleDateString('en-IN', { weekday: 'long' })}
              </Text>
              <Text
                style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}
              >
                {date.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.dayPanelScroll}
            contentContainerStyle={s.dayPanelContent}
            showsVerticalScrollIndicator={false}
          >
            {empty ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Icon name="bell-outline" size={32} color="#d1d5db" />
                <Text style={{ color: '#9ca3af', marginTop: 8, fontSize: 14 }}>
                  No events for this day
                </Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      onAddReminder(date);
                    }}
                  >
                    <Text
                      style={{
                        color: PRIMARY,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      + Reminder
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      onAddEvent(date);
                    }}
                  >
                    <Text
                      style={{
                        color: '#6366f1',
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      + Event
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      onAddTask(date);
                    }}
                  >
                    <Text
                      style={{
                        color: '#ca8a04',
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      + Task
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {dayReminders.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionLabel}>CRM REMINDERS</Text>
                    {dayReminders.map(r => {
                      const cfg = getTypeConfig(r.type);
                      return (
                        <TouchableOpacity
                          key={r._id}
                          onPress={() =>
                            onOpenDetail({
                              ...r,
                              isEvent: false,
                              isTask: false,
                            })
                          }
                          style={[
                            s.dayItem,
                            {
                              backgroundColor: cfg.light,
                              borderColor: cfg.color + '40',
                              opacity: r.isDone ? 0.5 : 1,
                            },
                          ]}
                        >
                          <View
                            style={[
                              s.dayItemIcon,
                              { backgroundColor: cfg.color },
                            ]}
                          >
                            <Icon name={cfg.icon} size={13} color="#fff" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                s.dayItemTitle,
                                { color: cfg.textColor },
                                r.isDone && s.strikethrough,
                              ]}
                              numberOfLines={1}
                            >
                              {r.type}: {r.leadId?.name || '—'}
                            </Text>
                            <Text style={[s.dayItemSub, { color: cfg.color }]}>
                              {formatTime12(r.reminderTime)} ·{' '}
                              {r.assignedTo?.name || '—'}
                            </Text>
                          </View>
                          {!r.isDone && (
                            <TouchableOpacity
                              onPress={() => onMarkDone(r._id)}
                              style={s.doneChip}
                            >
                              <Text style={s.doneChipText}>Done</Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {dayEvents.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionLabel}>EVENTS</Text>
                    {dayEvents.map(ev => (
                      <TouchableOpacity
                        key={ev._id}
                        onPress={() =>
                          onOpenDetail({ ...ev, isEvent: true, isTask: false })
                        }
                        style={[
                          s.dayItem,
                          {
                            backgroundColor: EVENT_META.light,
                            borderColor: EVENT_META.color + '40',
                            opacity: ev.isDone ? 0.5 : 1,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.dayItemIcon,
                            { backgroundColor: EVENT_META.color },
                          ]}
                        >
                          <Icon name="calendar" size={13} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              s.dayItemTitle,
                              { color: EVENT_META.textColor },
                              ev.isDone && s.strikethrough,
                            ]}
                            numberOfLines={1}
                          >
                            {ev.title}
                          </Text>
                          <Text
                            style={[s.dayItemSub, { color: EVENT_META.color }]}
                          >
                            {formatTime12(ev.eventTime)} ·{' '}
                            {Array.isArray(ev.assignedTo)
                              ? ev.assignedTo.map(u => u?.name).join(', ')
                              : ev.assignedTo?.name || 'Unassigned'}
                          </Text>
                        </View>
                        {!ev.isDone && (
                          <TouchableOpacity
                            onPress={() => onMarkEventDone(ev._id)}
                            style={s.doneChip}
                          >
                            <Text style={s.doneChipText}>Done</Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {dayTasks.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionLabel}>TASKS</Text>
                    {dayTasks.map(task => (
                      <TouchableOpacity
                        key={task._id}
                        onPress={() =>
                          onOpenDetail({
                            ...task,
                            isEvent: false,
                            isTask: true,
                          })
                        }
                        style={[
                          s.dayItem,
                          {
                            backgroundColor: TASK_META.light,
                            borderColor: TASK_META.color + '40',
                            opacity: task.taskCompleted ? 0.5 : 1,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.dayItemIcon,
                            { backgroundColor: TASK_META.color },
                          ]}
                        >
                          <Icon name="checkbox-marked" size={13} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              s.dayItemTitle,
                              { color: TASK_META.textColor },
                              task.taskCompleted && s.strikethrough,
                            ]}
                            numberOfLines={1}
                          >
                            {task.text || 'Task'}
                          </Text>
                          <Text
                            style={[s.dayItemSub, { color: TASK_META.color }]}
                          >
                            Lead: {getTaskLeadName(task)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {!task.taskCompleted && (
                            <TouchableOpacity
                              onPress={() => onMarkTaskDone(task._id, false)}
                              style={s.doneChip}
                            >
                              <Text style={s.doneChipText}>Done</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => onDeleteTask(task._id)}
                            style={[s.doneChip, { backgroundColor: '#fee2e2' }]}
                          >
                            <Icon name="close" size={12} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ── ItemCard (for RemindersView) ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const ItemCard = ({
  item,
  showUndo = false,
  onMarkDone,
  onMarkTaskDone,
  onMarkEventDone,
  onDeleteTask,
  onDeleteEvent,
  onDeleteReminder,
  onOpenDetail,
}) => {
  const isEv = !!item.isEvent;
  const isTask = !!item.isTask;
  const today = new Date();

  const badgeColor = isEv ? '#6366f1' : isTask ? '#eab308' : '#f59e0b';
  const dotColor = badgeColor;
  const badgeLabel = isEv ? 'Event' : isTask ? 'Task' : item.type || 'Reminder';

  return (
    <TouchableOpacity
      onPress={() => onOpenDetail(item)}
      style={[s.itemCard, showUndo && { opacity: 0.75 }]}
      activeOpacity={0.8}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View
          style={[
            s.badge,
            {
              backgroundColor: badgeColor + '15',
              borderColor: badgeColor + '30',
            },
          ]}
        >
          <Text style={[s.badgeText, { color: badgeColor }]}>
            {badgeLabel.toUpperCase()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {showUndo ? (
            <TouchableOpacity
              onPress={() =>
                isTask
                  ? onMarkTaskDone(item._id, true)
                  : isEv
                  ? onMarkEventDone(item._id, true)
                  : onMarkDone(item._id, true)
              }
              style={[s.iconBtn, { backgroundColor: '#dcfce7' }]}
            >
              <Icon
                name="plus"
                size={12}
                color="#16a34a"
                style={{ transform: [{ rotate: '45deg' }] }}
              />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() =>
                  isTask
                    ? onMarkTaskDone(item._id, false)
                    : isEv
                    ? onMarkEventDone(item._id, !!item.isDone)
                    : onMarkDone(item._id, !!item.isDone)
                }
                style={[s.iconBtn, { backgroundColor: '#dcfce7' }]}
              >
                <Icon name="check" size={12} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  isTask
                    ? onDeleteTask(item._id)
                    : isEv
                    ? onDeleteEvent(item._id)
                    : onDeleteReminder(item._id)
                }
                style={[s.iconBtn, { backgroundColor: '#fee2e2' }]}
              >
                <Icon name="close" size={12} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
        }}
      >
        <View style={[s.dotSmall, { backgroundColor: dotColor }]} />
        <Text
          style={[s.itemCardTitle, showUndo && s.strikethrough]}
          numberOfLines={1}
        >
          {isEv
            ? item.title
            : isTask
            ? `Task: ${item.text || 'Task'}`
            : `${item.type}: ${item.leadId?.name || '—'}`}
        </Text>
      </View>

      {isTask && (
        <Text
          style={{
            marginLeft: 16,
            fontSize: 10,
            color: '#ca8a04',
            fontWeight: '600',
            marginTop: 2,
          }}
        >
          Lead: {getTaskLeadName(item)}
        </Text>
      )}

      <View style={{ marginLeft: 16, marginTop: 4, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="calendar" size={11} color="#6b7280" />
          <Text style={s.itemCardMeta}>
            {showUndo ||
            !isSameDay(
              new Date(
                item.eventDate || item.reminderDate || item.taskDueDate || 0,
              ),
              today,
            )
              ? formatDate(
                  item.eventDate || item.reminderDate || item.taskDueDate,
                  item.eventTime || item.reminderTime || '',
                )
              : formatTime12(item.eventTime || item.reminderTime || '10:00')}
          </Text>
        </View>
        {!showUndo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="account-group" size={11} color="#6b7280" />
            <Text style={s.itemCardMeta} numberOfLines={1}>
              {isEv
                ? Array.isArray(item.assignedTo)
                  ? item.assignedTo.map(u => u?.name).join(', ')
                  : item.assignedTo?.name
                : isTask
                ? item.taskAssignedTo?.name || '—'
                : item.assignedTo?.name || '—'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ── RemindersView ─────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const RemindersView = ({
  reminders,
  todayReminders,
  events,
  tasks,
  users,
  user,
  filterUser,
  onRefresh,
  onMarkTaskDone,
  onDeleteTask,
  onOpenDetail,
  setDeleteConfirm,
}) => {
  const toast = useKitToast();
  const isAdmin = user?.role === 'master' || user?.role === 'admin';
  const today = new Date();

  const filterRemindersByRole = list => {
    if (!user) return list;
    if (isAdmin)
      return filterUser === 'all'
        ? list
        : list.filter(
            r => String(r.assignedTo?._id || r.assignedTo || '') === filterUser,
          );
    return list.filter(r => {
      const aid = r.assignedTo?._id || r.assignedTo;
      const notified = r.notifyUsers?.some(
        nu => (typeof nu === 'object' ? nu._id : nu) === user._id,
      );
      return aid === user._id || notified;
    });
  };
  const filterEventsByRole = list => {
    if (!user) return list;
    if (isAdmin)
      return filterUser === 'all'
        ? list
        : list.filter(e =>
            Array.isArray(e.assignedTo)
              ? e.assignedTo.some(u => String(u?._id || u || '') === filterUser)
              : String(e.assignedTo?._id || e.assignedTo || '') === filterUser,
          );
    return list.filter(e =>
      Array.isArray(e.assignedTo)
        ? e.assignedTo.some(
            u => (typeof u === 'object' ? u._id : u) === user._id,
          )
        : (e.assignedTo?._id || e.assignedTo) === user._id,
    );
  };
  const filterTasksByRole = list => {
    if (!user) return list;
    if (isAdmin)
      return filterUser === 'all'
        ? list
        : list.filter(
            t =>
              String(t.taskAssignedTo?._id || t.taskAssignedTo || '') ===
              filterUser,
          );
    return list.filter(
      t => String(t.taskAssignedTo?._id || t.taskAssignedTo || '') === user._id,
    );
  };

  const markDone = async (id, cur) => {
    try {
      await api.patch(`/reminders/${id}/done`, { isDone: !cur });
      toast.info(cur ? 'Marked as pending' : 'Marked as done');
      onRefresh();
    } catch {
      toast.error('Failed to update status.');
    }
  };
  const markEventDone = async (id, cur) => {
    try {
      const res = await apiFetch(`/api/v1/events/${id}/done`, {
        method: 'PATCH',
        body: JSON.stringify({ isDone: !cur }),
      });
      if (res.success) {
        onRefresh();
      }
    } catch {
      toast.error('Failed to update event status.');
    }
  };

  const filteredReminders = filterRemindersByRole(reminders);
  const filteredToday = filterRemindersByRole(todayReminders);
  const todayEvents = filterEventsByRole(
    events.filter(e => isSameDay(new Date(e.eventDate), today) && !e.isDone),
  );
  const pendingEvents = filterEventsByRole(events.filter(e => !e.isDone));
  const completedEvents = filterEventsByRole(events.filter(e => e.isDone)).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  );
  const todayTasks = filterTasksByRole(
    tasks.filter(
      t =>
        t.taskDueDate &&
        isSameDay(new Date(t.taskDueDate), today) &&
        !t.taskCompleted,
    ),
  );
  const pendingTasks = filterTasksByRole(tasks.filter(t => !t.taskCompleted));
  const completedTasks = filterTasksByRole(
    tasks.filter(t => t.taskCompleted),
  ).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const pendingReminders = filteredReminders.filter(r => !r.isDone);
  const completedReminders = filteredReminders
    .filter(r => r.isDone)
    .sort(
      (a, b) =>
        new Date(b.doneAt || b.updatedAt) - new Date(a.doneAt || a.updatedAt),
    );

  const combinedToday = [
    ...todayEvents.map(ev => ({ ...ev, isEvent: true })),
    ...filteredToday.map(r => ({ ...r, isEvent: false })),
    ...todayTasks.map(t => ({ ...t, isTask: true })),
  ].sort((a, b) =>
    (a.eventTime || a.reminderTime || '00:00').localeCompare(
      b.eventTime || b.reminderTime || '00:00',
    ),
  );

  const combinedPending = [
    ...pendingEvents
      .filter(e => !isSameDay(new Date(e.eventDate), today))
      .map(ev => ({ ...ev, isEvent: true })),
    ...pendingReminders
      .filter(r => !isSameDay(new Date(r.reminderDate), today))
      .map(r => ({ ...r, isEvent: false })),
    ...pendingTasks
      .filter(t => !t.taskDueDate || !isSameDay(new Date(t.taskDueDate), today))
      .map(t => ({ ...t, isTask: true })),
  ].sort(
    (a, b) =>
      new Date(a.eventDate || a.reminderDate || a.taskDueDate || 0) -
      new Date(b.eventDate || b.reminderDate || b.taskDueDate || 0),
  );

  const combinedCompleted = [
    ...completedEvents.map(ev => ({ ...ev, isEvent: true })),
    ...completedReminders.map(r => ({ ...r, isEvent: false })),
    ...completedTasks.map(t => ({ ...t, isTask: true })),
  ].sort(
    (a, b) =>
      new Date(b.doneAt || b.updatedAt || 0) -
      new Date(a.doneAt || a.updatedAt || 0),
  );

  const todayTotal =
    filteredToday.length + todayEvents.length + todayTasks.length;
  const completedTotal =
    completedReminders.length + completedEvents.length + completedTasks.length;

  const cardProps = {
    onMarkDone: markDone,
    onMarkTaskDone,
    onMarkEventDone: markEventDone,
    onDeleteTask,
    onOpenDetail,
    onDeleteEvent: id =>
      setDeleteConfirm({
        id,
        type: 'event',
        label: 'This event will be deleted.',
      }),
    onDeleteReminder: id =>
      setDeleteConfirm({
        id,
        type: 'reminder',
        label: 'This reminder will be deleted.',
      }),
  };

  const Section = ({ emoji, title, count, items, showUndo }) => (
    <View style={s.reminderColumn}>
      <Text style={s.reminderColTitle}>
        {emoji} {title} ({count})
      </Text>
      {items.length === 0 ? (
        <Text style={s.emptyText}>No items.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {items.map(
            item =>
              item && (
                <ItemCard
                  key={item._id}
                  item={item}
                  showUndo={showUndo}
                  {...cardProps}
                />
              ),
          )}
        </ScrollView>
      )}
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      <Section
        emoji="📅"
        title="Today's"
        count={todayTotal}
        items={combinedToday}
        showUndo={false}
      />
      <Section
        emoji="⏳"
        title="Pending"
        count={combinedPending.length}
        items={combinedPending}
        showUndo={false}
      />
      <Section
        emoji="✅"
        title="Completed"
        count={completedTotal}
        items={combinedCompleted}
        showUndo={true}
      />
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ── Main CalendarScreen ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const CalendarScreen = () => {
  const { user } = useSelector(state => state.auth);
  const { colors, typography, spacing, borderRadius, isDark } = useUISystem();
  const toast = useKitToast();
  const today = new Date();

  const [activeView, setActiveView] = useState('calendar');
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalStatus, setGcalStatus] = useState({
    connected: false,
    user: null,
  });
  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [reminders, setReminders] = useState([]);
  const [todayReminders, setTodayReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalDate, setEventModalDate] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalDate, setTaskModalDate] = useState(null);
  const [filterUser, setFilterUser] = useState(() =>
    user?._id ? String(user._id) : 'all',
  );
  const [detailItem, setDetailItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  const isCalendarAdmin = user?.role === 'admin' || user?.role === 'master';

  useEffect(() => {
    if (user) setFilterUser(String(user._id));
  }, [user]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const calDays = getCalendarDays(year, month);

  // ── Fetches ──
  const fetchReminders = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'pending' });
      if (filterUser && filterUser !== 'all')
        params.append('assignedTo', filterUser);
      const pendingRes = await api.get(`/reminders?${params.toString()}`);
      const completedParams = new URLSearchParams({ status: 'completed' });
      if (filterUser && filterUser !== 'all')
        completedParams.append('assignedTo', filterUser);
      const completedRes = await api.get(
        `/reminders?${completedParams.toString()}`,
      );
      setReminders([
        ...parseApiList(pendingRes),
        ...parseApiList(completedRes),
      ]);
    } catch {
      toast.error('Failed to load reminders.');
    } finally {
      setLoading(false);
    }
  }, [filterUser]);

  const fetchTasks = useCallback(async () => {
    try {
      let url = '/api/v1/activities?type=Task';
      if (!isCalendarAdmin && user?._id)
        url += `&assignedTo=${encodeURIComponent(user._id)}`;
      else if (filterUser && filterUser !== 'all')
        url += `&assignedTo=${encodeURIComponent(filterUser)}`;
      const res = await apiFetch(url);
      setTasks(parseApiList(res));
    } catch {
      setTasks([]);
    }
  }, [filterUser, isCalendarAdmin, user?._id]);

  const fetchTodayReminders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterUser && filterUser !== 'all')
        params.append('assignedTo', filterUser);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/reminders/today/pending${q}`);
      setTodayReminders(res.data?.data || []);
    } catch {}
  }, [filterUser]);

  const fetchEvents = useCallback(async () => {
    try {
      let url = '/api/v1/events';
      const qp = [];
      if (!isCalendarAdmin && user?._id)
        qp.push(`assignedTo=${encodeURIComponent(user._id)}`);
      else if (filterUser && filterUser !== 'all')
        qp.push(`assignedTo=${encodeURIComponent(filterUser)}`);
      if (qp.length) url += `?${qp.join('&')}`;
      const res = await apiFetch(url);
      const data = res.data?.data || res.data?.items || res.data || [];
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    }
  }, [filterUser, isCalendarAdmin, user?._id]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/users?limit=100');
      const data = res.data?.items || res.data?.data || res.data || [];
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  }, []);

  const fetchGcalStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/gcal/status');
      setGcalStatus({
        connected: res.data?.connected || false,
        user: res.data?.user || null,
      });
    } catch {}
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await fetchReminders();
    await fetchTodayReminders();
    await fetchEvents();
    await fetchTasks();
    setRefreshing(false);
  }, [fetchReminders, fetchTodayReminders, fetchEvents, fetchTasks]);

  useEffect(() => {
    fetchReminders();
    fetchTodayReminders();
    fetchEvents();
    fetchTasks();
    fetchUsers();
    fetchGcalStatus();
  }, [
    fetchReminders,
    fetchTodayReminders,
    fetchEvents,
    fetchTasks,
    fetchUsers,
    fetchGcalStatus,
  ]);

  // ── GCal ──
  const handleGcalConnect = async () => {
    try {
      setGcalConnecting(true);
      await googleCalendarService.connect();
    } catch {
      toast.error('Could not start Google sign-in.');
      setGcalConnecting(false);
    }
  };
  const handleGcalDisconnect = () =>
    setDeleteConfirm({
      id: 'gcal',
      type: 'gcal',
      label: 'Disconnect Google Calendar?',
    });
  const doGcalDisconnect = async () => {
    try {
      setGcalConnecting(true);
      await googleCalendarService.disconnect();
      setGcalStatus({ connected: false, user: null });
    } catch {
      toast.error('Failed to disconnect.');
    } finally {
      setGcalConnecting(false);
    }
  };

  // ── Actions ──
  const handleMarkDone = async reminderId => {
    try {
      const res = await apiFetch(`/api/v1/reminders/${reminderId}/done`, {
        method: 'PATCH',
        body: JSON.stringify({ isDone: true }),
      });
      if (res.success) {
        fetchReminders();
        fetchTodayReminders();
      }
    } catch {
      toast.error('Failed to mark done');
    }
  };
  const handleMarkEventDone = async eventId => {
    try {
      const res = await apiFetch(`/api/v1/events/${eventId}/done`, {
        method: 'PATCH',
        body: JSON.stringify({ isDone: true }),
      });
      if (res.success) fetchEvents();
    } catch {
      toast.error('Failed to mark done');
    }
  };
  const handleMarkTaskDone = async (taskId, currentCompleted) => {
    try {
      const res = await apiFetch(`/api/v1/activities/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ taskCompleted: !currentCompleted }),
      });
      if (res.success) fetchTasks();
      else toast.error(res.message || 'Failed to update task');
    } catch {
      toast.error('Failed to update task');
    }
  };
  const handleDeleteTask = taskId =>
    setDeleteConfirm({
      id: taskId,
      type: 'task',
      label: 'This task will be permanently deleted.',
    });

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    setDeleteConfirm(null);
    if (type === 'gcal') {
      await doGcalDisconnect();
      return;
    }
    if (type === 'task') {
      const res = await apiFetch(`/api/v1/activities/${id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        fetchTasks();
      } else {
        toast.error(res.message || 'Failed to delete task');
      }
      return;
    }
    if (type === 'event') {
      await apiFetch(`/api/v1/events/${id}`, { method: 'DELETE' });
      fetchEvents();
      return;
    }
    if (type === 'reminder') {
      await api.delete(`/reminders/${id}`);
      fetchReminders();
      fetchTodayReminders();
      return;
    }
  };

  // ── Detail popup helpers ──
  const handleOpenDetail = item => setDetailItem(item);
  const handleCloseDetail = () => setDetailItem(null);

  const getDetailDoneHandler = () => {
    if (!detailItem) return null;
    const isEv = !!detailItem.isEvent;
    const isTask = !!detailItem.isTask;
    const isDone = isEv
      ? detailItem.isDone
      : isTask
      ? detailItem.taskCompleted
      : detailItem.isDone;
    if (isTask)
      return () =>
        handleMarkTaskDone(detailItem._id, !!detailItem.taskCompleted);
    if (isEv)
      return () =>
        apiFetch(`/api/v1/events/${detailItem._id}/done`, {
          method: 'PATCH',
          body: JSON.stringify({ isDone: !isDone }),
        }).then(() => fetchEvents());
    return () => {
      if (isDone)
        apiFetch(`/api/v1/reminders/${detailItem._id}/done`, {
          method: 'PATCH',
          body: JSON.stringify({ isDone: false }),
        }).then(() => {
          fetchReminders();
          fetchTodayReminders();
        });
      else handleMarkDone(detailItem._id);
    };
  };
  const getDetailDeleteHandler = () => {
    if (!detailItem) return null;
    if (detailItem.isTask) return () => handleDeleteTask(detailItem._id);
    if (detailItem.isEvent)
      return async () => {
        await apiFetch(`/api/v1/events/${detailItem._id}`, {
          method: 'DELETE',
        });
        fetchEvents();
      };
    return async () => {
      await api.delete(`/reminders/${detailItem._id}`);
      fetchReminders();
      fetchTodayReminders();
    };
  };

  // ── Per-day filters ──
  const getRemindersForDay = date =>
    reminders.filter(r => {
      if (!isSameDay(new Date(r.reminderDate), date)) return false;
      if (filterUser === 'all') return true;
      return String(r.assignedTo?._id || r.assignedTo || '') === filterUser;
    });
  const getEventsForDay = date =>
    events.filter(e => {
      if (!isSameDay(new Date(e.eventDate), date)) return false;
      if (filterUser === 'all') return true;
      if (Array.isArray(e.assignedTo))
        return e.assignedTo.some(u => String(u?._id || u) === filterUser);
      return String(e.assignedTo?._id || e.assignedTo || '') === filterUser;
    });
  const getTasksForDay = date =>
    tasks.filter(t => {
      if (!t.taskDueDate || !isSameDay(new Date(t.taskDueDate), date))
        return false;
      if (filterUser === 'all') return true;
      return (
        String(t.taskAssignedTo?._id || t.taskAssignedTo || '') === filterUser
      );
    });
  const filteredReminders = reminders.filter(r => {
    if (filterUser === 'all') return true;
    return String(r.assignedTo?._id || r.assignedTo || '') === filterUser;
  });

  const DAY_CELL_W = Math.floor((SCREEN_WIDTH - 16) / 7);

  if (loading)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );

  return (
    <View style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefreshAll}
            tintColor={PRIMARY}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <PageHeader title="Calendar & Reminders" subtitle="Reminders, events and follow-ups" />

          {/* View Toggle */}
          <View style={s.toggleRow}>
            <View style={s.toggleGroup}>
              <TouchableOpacity
                onPress={() => setActiveView('calendar')}
                style={[
                  s.toggleBtn,
                  activeView === 'calendar' && s.toggleBtnActive,
                ]}
              >
                <Icon
                  name="calendar"
                  size={14}
                  color={activeView === 'calendar' ? '#111827' : '#9ca3af'}
                />
                <Text
                  style={[
                    s.toggleBtnText,
                    activeView === 'calendar' && s.toggleBtnTextActive,
                  ]}
                >
                  Calendar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveView('reminders')}
                style={[
                  s.toggleBtn,
                  activeView === 'reminders' && s.toggleBtnActive,
                ]}
              >
                <Icon
                  name="bell"
                  size={14}
                  color={activeView === 'reminders' ? '#111827' : '#9ca3af'}
                />
                <Text
                  style={[
                    s.toggleBtnText,
                    activeView === 'reminders' && s.toggleBtnTextActive,
                  ]}
                >
                  Reminders
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filter Picker (admin only) */}
            {isCalendarAdmin && (
              <TouchableOpacity
                style={s.filterPickerBtn}
                onPress={() => setShowFilterPicker(true)}
              >
                <Icon name="account-filter" size={14} color="#6b7280" />
                <Text style={s.filterPickerText} numberOfLines={1}>
                  {filterUser === 'all'
                    ? 'All Users'
                    : users.find(u => String(u._id) === filterUser)?.name ||
                      'User'}
                </Text>
                <Icon name="chevron-down" size={14} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* Action Buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#eab308' }]}
              onPress={() => {
                setTaskModalDate(today);
                setShowTaskModal(true);
              }}
            >
              <Icon name="checkbox-marked" size={14} color="#fff" />
              <Text style={s.actionBtnText}>Task</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#6366f1' }]}
              onPress={() => {
                setEventModalDate(today);
                setShowEventModal(true);
              }}
            >
              <Icon name="calendar-plus" size={14} color="#fff" />
              <Text style={s.actionBtnText}>Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: PRIMARY }]}
              onPress={() => {
                setAddModalDate(today);
                setShowAddModal(true);
              }}
            >
              <Icon name="plus" size={14} color="#fff" />
              <Text style={s.actionBtnText}>Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Calendar View ── */}
        {activeView === 'calendar' && (
          <View>
            {/* Month Nav */}
            <View style={s.calNav}>
              <View style={s.calNavLeft}>
                <TouchableOpacity
                  onPress={() => setCurrentDate(new Date(year, month - 1, 1))}
                  style={s.navArrow}
                >
                  <Icon name="chevron-left" size={20} color="#374151" />
                </TouchableOpacity>
                <Text style={s.calMonthTitle}>
                  {MONTHS[month]} {year}
                </Text>
                <TouchableOpacity
                  onPress={() => setCurrentDate(new Date(year, month + 1, 1))}
                  style={s.navArrow}
                >
                  <Icon name="chevron-right" size={20} color="#374151" />
                </TouchableOpacity>
              </View>
              <View
                style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
              >
                <TouchableOpacity
                  onPress={async () => {
                    await handleRefreshAll();
                  }}
                  style={s.calRefreshBtn}
                  disabled={refreshing}
                >
                  <Icon
                    name={refreshing ? 'loading' : 'refresh'}
                    size={16}
                    color="#374151"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setCurrentDate(
                      new Date(today.getFullYear(), today.getMonth(), 1),
                    )
                  }
                  style={s.todayBtn}
                >
                  <Text style={s.todayBtnText}>Today</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* GCal Connect Bar */}
            <View style={s.gcalBar}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                }}
              >
                <View
                  style={[
                    s.gcalDot,
                    {
                      backgroundColor: gcalStatus.connected
                        ? '#22c55e'
                        : '#d1d5db',
                    },
                  ]}
                />
                <View>
                  <Text style={s.gcalLabel}>
                    {gcalStatus.connected ? 'SYNC ACTIVE' : 'GOOGLE SYNC'}
                  </Text>
                  {gcalStatus.connected && gcalStatus.user && (
                    <Text style={s.gcalUser} numberOfLines={1}>
                      {gcalStatus.user}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={
                  gcalStatus.connected
                    ? handleGcalDisconnect
                    : handleGcalConnect
                }
                disabled={gcalConnecting}
                style={[
                  s.gcalBtn,
                  gcalStatus.connected ? s.gcalBtnDisconnect : s.gcalBtnConnect,
                ]}
              >
                {gcalConnecting ? (
                  <ActivityIndicator
                    size="small"
                    color={gcalStatus.connected ? '#ef4444' : '#fff'}
                  />
                ) : gcalStatus.connected ? (
                  <>
                    <Icon name="close" size={14} color="#ef4444" />
                    <Text style={[s.gcalBtnText, { color: '#ef4444' }]}>
                      Disconnect
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="calendar" size={14} color="#fff" />
                    <Text style={[s.gcalBtnText, { color: '#fff' }]}>
                      Connect Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Calendar Grid */}
            <View style={s.calGrid}>
              {/* Day headers */}
              <View style={s.dayHeaders}>
                {DAYS.map(d => (
                  <View
                    key={d}
                    style={[s.dayHeaderCell, { width: DAY_CELL_W }]}
                  >
                    <Text style={s.dayHeaderText}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Days */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {calDays.map(({ date, currentMonth }, idx) => {
                  const dayRems = getRemindersForDay(date);
                  const dayEvs = getEventsForDay(date);
                  const dayTasks = getTasksForDay(date);
                  const isCurDay = isToday(date);
                  const allItems = [
                    ...dayRems.map(r => ({ kind: 'reminder', data: r })),
                    ...dayEvs.map(e => ({ kind: 'event', data: e })),
                    ...dayTasks.map(t => ({ kind: 'task', data: t })),
                  ];
                  const total = allItems.length;

                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedDate(date)}
                      style={[
                        s.dayCell,
                        { width: DAY_CELL_W, minHeight: 72 },
                        !currentMonth && s.dayCellOtherMonth,
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={s.dayCellTop}>
                        <View style={[s.dayNum, isCurDay && s.dayNumToday]}>
                          <Text
                            style={[
                              s.dayNumText,
                              isCurDay && s.dayNumTextToday,
                              !currentMonth && s.dayNumTextOther,
                            ]}
                          >
                            {date.getDate()}
                          </Text>
                        </View>
                        {total > 2 && (
                          <Text style={s.moreText}>+{total - 2}</Text>
                        )}
                      </View>
                      <View style={{ gap: 1 }}>
                        {allItems.slice(0, 2).map((item, i) => {
                          if (item.kind === 'reminder') {
                            const cfg = getTypeConfig(item.data.type);
                            return (
                              <View
                                key={i}
                                style={[
                                  s.calChip,
                                  {
                                    backgroundColor: cfg.color,
                                    opacity: item.data.isDone ? 0.4 : 1,
                                  },
                                ]}
                              >
                                <Text style={s.calChipText} numberOfLines={1}>
                                  {item.data.leadId?.name || item.data.type}
                                </Text>
                              </View>
                            );
                          }
                          if (item.kind === 'task') {
                            return (
                              <View
                                key={i}
                                style={[
                                  s.calChip,
                                  {
                                    backgroundColor: '#eab308',
                                    opacity: item.data.taskCompleted ? 0.4 : 1,
                                  },
                                ]}
                              >
                                <Text style={s.calChipText} numberOfLines={1}>
                                  {item.data.text || 'Task'}
                                </Text>
                              </View>
                            );
                          }
                          if (item.kind === 'event') {
                            return (
                              <View
                                key={i}
                                style={[
                                  s.calChip,
                                  {
                                    backgroundColor: '#6366f1',
                                    opacity: item.data.isDone ? 0.4 : 1,
                                  },
                                ]}
                              >
                                <Text style={s.calChipText} numberOfLines={1}>
                                  {item.data.title}
                                </Text>
                              </View>
                            );
                          }
                          return null;
                        })}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Legend */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.legendRow}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
            >
              {Object.entries(REMINDER_TYPE_CONFIG).map(([type, cfg]) => (
                <View key={type} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: cfg.color }]} />
                  <Text style={s.legendText}>{type}</Text>
                </View>
              ))}
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#6366f1' }]} />
                <Text style={s.legendText}>Event</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#eab308' }]} />
                <Text style={s.legendText}>Task</Text>
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Reminders View ── */}
        {activeView === 'reminders' && (
          <View style={{ paddingHorizontal: 16 }}>
            <RemindersView
              reminders={reminders}
              todayReminders={todayReminders}
              events={events}
              tasks={tasks}
              users={users}
              user={user}
              filterUser={filterUser}
              onRefresh={handleRefreshAll}
              onMarkTaskDone={handleMarkTaskDone}
              onDeleteTask={handleDeleteTask}
              onOpenDetail={handleOpenDetail}
              setDeleteConfirm={setDeleteConfirm}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Filter User Modal (admin) ── */}
      {showFilterPicker && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setShowFilterPicker(false)}
        >
          <TouchableOpacity
            style={s.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowFilterPicker(false)}
          >
            <TouchableOpacity
              style={[s.modalCard, { maxHeight: '60%' }]}
              activeOpacity={1}
            >
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Filter by User</Text>
                <TouchableOpacity
                  onPress={() => setShowFilterPicker(false)}
                  style={s.closeBtn}
                >
                  <Icon name="close" size={18} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {[{ _id: 'all', name: 'All Users' }, ...users].map(u => (
                  <TouchableOpacity
                    key={u._id}
                    style={[
                      s.filterOption,
                      filterUser === String(u._id) && s.filterOptionActive,
                    ]}
                    onPress={() => {
                      setFilterUser(String(u._id));
                      setShowFilterPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        s.filterOptionText,
                        filterUser === String(u._id) && {
                          color: PRIMARY,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {u.name}
                    </Text>
                    {filterUser === String(u._id) && (
                      <Icon name="check" size={16} color={PRIMARY} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Day Panel ── */}
      <DayPanelModal
        visible={!!selectedDate}
        date={selectedDate}
        reminders={filteredReminders}
        events={selectedDate ? getEventsForDay(selectedDate) : []}
        tasks={tasks}
        onClose={() => setSelectedDate(null)}
        onAddReminder={d => {
          setAddModalDate(d);
          setShowAddModal(true);
        }}
        onAddEvent={d => {
          setEventModalDate(d);
          setShowEventModal(true);
        }}
        onAddTask={d => {
          setTaskModalDate(d);
          setShowTaskModal(true);
        }}
        onMarkDone={handleMarkDone}
        onMarkEventDone={handleMarkEventDone}
        onMarkTaskDone={handleMarkTaskDone}
        onDeleteTask={handleDeleteTask}
        onOpenDetail={handleOpenDetail}
      />

      {/* ── Detail Popup ── */}
      <ItemDetailModal
        visible={!!detailItem}
        item={detailItem}
        onClose={handleCloseDetail}
        onMarkDone={getDetailDoneHandler()}
        onDelete={getDetailDeleteHandler()}
      />

      {/* ── Delete Confirm ── */}
      <DeleteConfirmModal
        visible={!!deleteConfirm}
        deleteConfirm={deleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* ── Add Reminder ── */}
      <AddReminderModal
        visible={showAddModal}
        date={addModalDate}
        users={users}
        currentUser={user}
        onClose={() => setShowAddModal(false)}
        onSaved={async newReminder => {
          if (newReminder) setReminders(prev => [...prev, newReminder]);
          await fetchReminders();
          await fetchTodayReminders();
        }}
      />

      {/* ── Add Event (using existing component) ── */}
      {showEventModal && (
        <AddEventModal
          date={eventModalDate}
          users={users}
          currentUser={user}
          onClose={() => setShowEventModal(false)}
          onSaved={async newEvent => {
            if (newEvent) setEvents(prev => [...prev, newEvent]);
            await fetchEvents();
          }}
        />
      )}

      {/* ── Add Task ── */}
      <AddTaskModal
        visible={showTaskModal}
        date={taskModalDate}
        users={users}
        currentUser={user}
        onClose={() => setShowTaskModal(false)}
        onSaved={async () => {
          await fetchTasks();
        }}
      />
    </View>
  );
};

export default CalendarScreen;

// ═════════════════════════════════════════════════════════════════════════════
// ── Styles ────────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },

  // Header
  header: { padding: 16, gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  toggleBtnTextActive: { color: '#111827' },

  // Filter Picker
  filterPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 130,
  },
  filterPickerText: { fontSize: 12, color: '#374151', flex: 1 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Calendar Nav
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  calNavLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navArrow: { padding: 8, borderRadius: 10, backgroundColor: '#f3f4f6' },
  calMonthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    width: 160,
    textAlign: 'center',
  },
  calRefreshBtn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  todayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  todayBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },

  // GCal Bar
  gcalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    gap: 8,
  },
  gcalDot: { width: 8, height: 8, borderRadius: 4 },
  gcalLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#9ca3af',
  },
  gcalUser: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    maxWidth: 160,
  },
  gcalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  gcalBtnConnect: { backgroundColor: PRIMARY },
  gcalBtnDisconnect: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  gcalBtnText: { fontSize: 12, fontWeight: '700' },

  // Calendar Grid
  calGrid: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  dayHeaders: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dayHeaderCell: { alignItems: 'center', paddingVertical: 8 },
  dayHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayCell: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#f3f4f6',
    padding: 4,
    backgroundColor: '#fff',
  },
  dayCellOtherMonth: { backgroundColor: '#fafafa' },
  dayCellTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  dayNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPanelCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.72,
    maxHeight: SCREEN_HEIGHT * 0.85,
    overflow: 'hidden',
  },

  dayPanelScroll: {
    flex: 1,
  },

  dayPanelContent: {
    padding: 16,
    paddingBottom: 32,
  },
  dayNumToday: { backgroundColor: PRIMARY },
  dayNumText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  dayNumTextToday: { color: '#fff' },
  dayNumTextOther: { color: '#d1d5db' },
  moreText: { fontSize: 9, color: '#9ca3af', fontWeight: '600' },
  calChip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  calChipText: { fontSize: 9, color: '#fff', fontWeight: '600' },

  // Legend
  legendRow: { marginTop: 12, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#6b7280' },

  // Modal base
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalBody: { padding: 20, maxHeight: 440 },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f9fafb' },

  // Form
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  datePickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  datePickerText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  datePickerIcon: {
    marginLeft: 8,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    height: 54,
    justifyContent: 'center',
    overflow: 'visible',
  },
  picker: { height: 54, width: '100%', color: '#111827', fontSize: 13 },
  pickerItem: {
    fontSize: 13,
    color: '#111827',
  },
  rowFields: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  hintText: { fontSize: 11, color: '#9ca3af', marginTop: 4 },

  // Lead search dropdown
  selectedLeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
  },
  selectedLeadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  dropdown: {
    marginTop: 2,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    zIndex: 10,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 8,
  },
  dropdownName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  dropdownPhone: { fontSize: 11, color: '#9ca3af' },
  dropdownSearching: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#9ca3af',
  },

  // Buttons
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  disabledBtn: { opacity: 0.5 },

  // Day Item (in DayPanel)
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  dayItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dayItemTitle: { fontSize: 13, fontWeight: '700' },
  dayItemSub: { fontSize: 11, marginTop: 1 },
  doneChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneChipText: { fontSize: 11, fontWeight: '600', color: '#374151' },

  // Reminders view columns
  reminderColumn: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    marginBottom: 16,
  },
  reminderColTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  emptyText: { fontSize: 13, color: '#9ca3af' },

  // Item Card
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemCardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', flex: 1 },
  itemCardMeta: { fontSize: 10, color: '#6b7280' },
  iconBtn: { padding: 5, borderRadius: 7 },

  // Detail modal
  detailCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailBody: { padding: 20 },
  detailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 24,
    marginBottom: 12,
  },
  detailFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  footerBtnDone: { backgroundColor: '#22c55e' },
  footerBtnPending: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  footerBtnDelete: {
    flex: 0,
    paddingHorizontal: 14,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  footerBtnText: { fontSize: 13, fontWeight: '700' },

  // Note box
  noteBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 12,
    marginBottom: 12,
  },
  noteLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  noteText: { fontSize: 13, color: '#374151', lineHeight: 20 },

  // Info rows in detail
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  // Badge & dot
  badge: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  dotBig: { width: 10, height: 10, borderRadius: 5 },
  dotSmall: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },

  // Filter option
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  filterOptionActive: { backgroundColor: PRIMARY + '08' },
  filterOptionText: { fontSize: 15, color: '#374151' },

  // Common
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.6 },
});