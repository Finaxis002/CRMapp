/**
 * AddScheduleScreen — Reminder / Event / Task add karne ki ek hi uniform screen
 *
 * Route params (CalendarScreen se):
 *   type: 'Reminder' | 'Event' | 'Task'   — kaunsa form pre-selected ho
 *   date: ISO string                       — pre-selected date (optional)
 *   users: array                           — assign/notify dropdown ke liye
 *   currentUserId: string                  — default assignee
 *
 * Navigator mein add karo:
 *   <Stack.Screen name="AddSchedule" component={AddScheduleScreen} />
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

// ── Type config — ek hi screen mein teeno modes ──────────────────────────────

const TYPE_CONFIG = {
  Reminder: {
    key: 'Reminder',
    label: 'Reminder',
    icon: 'bell',
    color: '#f59e0b',
    soft: '#fef3c7',
    saveLabel: 'Save Reminder',
    subtitle: 'Never miss a follow-up',
    endpoint: '/api/v1/reminders',
  },
  Event: {
    key: 'Event',
    label: 'Event',
    icon: 'calendar',
    color: '#6366f1',
    soft: '#eef2ff',
    saveLabel: 'Save Event',
    subtitle: 'Schedule a meeting or milestone',
    endpoint: '/api/v1/events',
  },
  Task: {
    key: 'Task',
    label: 'Task',
    icon: 'checkbox-marked',
    color: '#eab308',
    soft: '#fefce8',
    saveLabel: 'Save Task',
    subtitle: 'Track follow-up work',
    endpoint: null,
  },
};

const REMINDER_TYPES = ['Call', 'Email', 'Meeting', 'Follow-up', 'Payment'];

// ── API helper ────────────────────────────────────────────────────────────────

const getToken = async () => {
  try {
    const t =
      (await AsyncStorage.getItem('accessToken')) ||
      (await AsyncStorage.getItem('token'));
    if (t) return t;
    const persist = await AsyncStorage.getItem('persist:auth');
    if (persist)
      return JSON.parse(persist).accessToken?.replace(/"/g, '') || '';
  } catch {}
  return '';
};

const apiFetch = async (path, opts = {}) => {
  const token = await getToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${
        path.startsWith('/api/v1') ? path.replace('/api/v1', '') : path
      }`;
  const res = await fetch(url, { ...opts, headers });
  return res.json();
};

// ── Date helpers ──────────────────────────────────────────────────────────────

const fmtDate = date => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtTime = date => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '10:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
};

const fmtTime12 = time => {
  const raw = String(time || '10:00');
  const [hours, minutes] = raw.split(':');
  const hour = Number(hours);
  if (Number.isNaN(hour)) return raw;
  const minute = (minutes || '00').slice(0, 2);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, '0')}:${minute} ${suffix}`;
};

// ── Uniform field wrapper ────────────────────────────────────────────────────

const Field = ({ label, children }) => (
  <View style={st.field}>
    <Text style={st.fieldLabel}>{label}</Text>
    {children}
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────

const AddScheduleScreen = ({ navigation, route }) => {
  const toast = useKitToast();
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const users = useMemo(
    () => (Array.isArray(params.users) ? params.users : []),
    [params.users],
  );
  const currentUserId = params.currentUserId || '';

  const [type, setType] = useState(
    TYPE_CONFIG[params.type] ? params.type : 'Reminder',
  );
  const cfg = TYPE_CONFIG[type];

  const initialDate = useMemo(
    () => (params.date ? new Date(params.date) : new Date()),
    [params.date],
  );

  // ── Common form state (teeno types share karte hain) ──
  const [form, setForm] = useState({
    // lead link (Reminder + Task)
    leadSearch: '',
    leadId: '',
    leadName: '',
    // reminder
    reminderType: 'Call',
    assignedTo: currentUserId,
    reminderDate: new Date(initialDate),
    reminderTime: (() => {
      const d = new Date(initialDate);
      // Reminder: purane modal jaisa default 10:00 — Event: current time (purane modal jaisa)
      if (TYPE_CONFIG[params.type]?.key !== 'Event') d.setHours(10, 0, 0, 0);
      return d;
    })(),
    note: '',
    // event
    title: '',
    eventUsers: currentUserId ? [currentUserId] : [],
    // task
    taskText: '',
    taskDueDate: new Date(initialDate),
    taskTime: (() => {
      const d = new Date(initialDate);
      d.setHours(10, 0, 0, 0);
      return d;
    })(),
    notify: '',
  });
  const setF = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const [leads, setLeads] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [notifyPickerOpen, setNotifyPickerOpen] = useState(false);

  const needLead = type === 'Reminder' || type === 'Task';

  // ── Lead search (debounced 300ms) ──
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

  // ── Save ──
  const handleSave = async () => {
    // Validation — teeno types ke liye uniform
    if (needLead && !form.leadId) {
      toast.error('Select a lead');
      return;
    }
    if (type === 'Reminder') {
      if (!form.assignedTo) {
        toast.error('Assign to a user');
        return;
      }
    }
    if (type === 'Event') {
      if (!form.title.trim()) {
        toast.error('Enter event title');
        return;
      }
      if (form.eventUsers.length === 0) {
        toast.error('Assign to at least one user');
        return;
      }
    }
    if (type === 'Task') {
      if (!form.taskText.trim()) {
        toast.error('Enter task description');
        return;
      }
      if (!form.assignedTo) {
        toast.error('Assign to a user');
        return;
      }
    }

    setSaving(true);
    try {
      let res;
      if (type === 'Reminder') {
        const payload = {
          leadId: form.leadId,
          type: form.reminderType,
          assignedTo: form.assignedTo,
          reminderDate: fmtDate(form.reminderDate),
          reminderTime: fmtTime(form.reminderTime),
        };
        if (form.note.trim()) payload.note = form.note.trim();
        res = await apiFetch('/api/v1/reminders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (type === 'Event') {
        res = await apiFetch('/api/v1/events', {
          method: 'POST',
          body: JSON.stringify({
            title: form.title.trim(),
            assignedTo: form.eventUsers,
            eventDate: fmtDate(form.reminderDate),
            eventTime: fmtTime(form.reminderTime),
            ...(form.note.trim() ? { note: form.note.trim() } : {}),
          }),
        });
      } else {
        // Task — lead activities pe PUT
        res = await apiFetch(`/api/v1/leads/${form.leadId}`, {
          method: 'PUT',
          body: JSON.stringify({
            activities: [
              {
                type: 'Task',
                text: form.taskText.trim(),
                taskDueDate: fmtDate(form.taskDueDate),
                taskTime: fmtTime(form.taskTime), // web jaisa — task ka bhi time
                taskAssignedTo: form.assignedTo,
                notifiedUsers: form.notify ? [form.notify] : [],
              },
            ],
          }),
        });
      }

      if (res?.success) {
        toast.success(res.message || `${type} created!`);
        // Calendar ko flag ke saath wapas bhejo — WAHIN tabhi refresh hoga.
        // Bina create ke back (goBack) pe Calendar kuch refresh nahi karega.
        const routeNames = navigation?.getState?.()?.routeNames || [];
        if (routeNames.includes('Calendar')) {
          navigation.navigate('Calendar', { scheduleUpdated: Date.now() });
        } else {
          navigation?.goBack?.();
        }
      } else {
        toast.error(res?.message || `Failed to create ${type.toLowerCase()}`);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  // ── Selected user display name ──
  const userNameById = id =>
    users.find(u => String(u._id) === String(id))?.name || '—';

  // ── User picker row (single & multi dono modes) ──
  const renderUserList = (selectedIds, onToggle, multi = false) => (
    <View style={st.userList}>
      <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
        {users.map(u => {
          const selected = selectedIds.includes(String(u._id));
          return (
            <TouchableOpacity
              key={u._id}
              style={[st.userRow, selected && st.userRowActive]}
              onPress={() => onToggle(String(u._id))}
            >
              <Text
                style={[
                  st.userRowText,
                  selected && { color: '#4338ca', fontWeight: '600' },
                ]}
              >
                {u.name}
              </Text>
              {selected && <Icon name="check" size={15} color="#4338ca" />}
            </TouchableOpacity>
          );
        })}
        {users.length === 0 && (
          <Text style={st.emptyUsers}>No users loaded</Text>
        )}
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Custom form header — shared Topbar is screen pe hide rehta hai ── */}
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={st.backBtn}
          onPress={() => navigation?.goBack?.()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={20} color="#334155" />
        </TouchableOpacity>
        <View style={[st.headerIconWrap, { backgroundColor: cfg.soft }]}>
          <Icon name={cfg.icon} size={15} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle} numberOfLines={1}>
            Add {type}
          </Text>
          <Text style={st.headerSub} numberOfLines={1} ellipsizeMode="tail">
            {cfg.subtitle}
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
        {/* ── Type switch — same row teeno — uniform segmented pills ── */}
        <View style={st.typeRow}>
          {Object.values(TYPE_CONFIG).map(t => {
            const active = type === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  st.typePill,
                  active && { backgroundColor: t.color, borderColor: t.color },
                ]}
                onPress={() => setType(t.key)}
                activeOpacity={0.75}
              >
                <Icon
                  name={t.icon}
                  size={13}
                  color={active ? '#fff' : t.color}
                />
                <Text
                  style={[
                    st.typePillText,
                    active ? { color: '#fff' } : { color: '#374151' },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── EVENT: Title ── */}
        {type === 'Event' && (
          <Field label="EVENT TITLE *">
            <TextInput
              style={st.input}
              placeholder="e.g. Team sync, Product demo…"
              placeholderTextColor="#9ca3af"
              value={form.title}
              onChangeText={v => setF('title', v)}
            />
          </Field>
        )}

        {/* ── REMINDER/TASK: Lead search ── */}
        {needLead && (
          <Field label="LEAD *">
            {form.leadId ? (
              <View style={st.selectedLeadRow}>
                <Text style={st.selectedLeadText} numberOfLines={1}>
                  {form.leadName}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setForm(p => ({
                      ...p,
                      leadId: '',
                      leadName: '',
                      leadSearch: '',
                    }))
                  }
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
                    value={form.leadSearch}
                    onChangeText={v => setF('leadSearch', v)}
                  />
                </View>
                {form.leadSearch.length > 0 &&
                  (leads.length > 0 || searching) && (
                    <View style={st.leadDropdown}>
                      {searching ? (
                        <Text style={st.dropdownHint}>Searching…</Text>
                      ) : (
                        leads.map(l => (
                          <TouchableOpacity
                            key={l._id}
                            style={st.leadOption}
                            onPress={() =>
                              setForm(p => ({
                                ...p,
                                leadId: l._id,
                                leadName: l.name,
                                leadSearch: '',
                              }))
                            }
                          >
                            <Text style={st.leadOptionName} numberOfLines={1}>
                              {l.name}
                            </Text>
                            <Text style={st.leadOptionPhone}>{l.phone}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
              </>
            )}
          </Field>
        )}

        {/* ── REMINDER: Type chips ── */}
        {type === 'Reminder' && (
          <Field label="REMINDER TYPE">
            <View style={st.chipsRow}>
              {REMINDER_TYPES.map(rt => {
                const active = form.reminderType === rt;
                return (
                  <TouchableOpacity
                    key={rt}
                    style={[
                      st.chip,
                      active && {
                        backgroundColor: '#f59e0b',
                        borderColor: '#f59e0b',
                      },
                    ]}
                    onPress={() => setF('reminderType', rt)}
                  >
                    <Text
                      style={[
                        st.chipText,
                        active ? { color: '#fff' } : { color: '#374151' },
                      ]}
                    >
                      {rt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
        )}

        {/* ── TASK: Description ── */}
        {type === 'Task' && (
          <Field label="TASK DESCRIPTION *">
            <TextInput
              style={[st.input, st.textArea]}
              placeholder="Task details…"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={form.taskText}
              onChangeText={v => setF('taskText', v)}
            />
          </Field>
        )}

        {/* ── EVENT: Multi user select ── */}
        {type === 'Event' && (
          <Field label="ASSIGN TO *">
            <TouchableOpacity
              style={st.selectTrigger}
              onPress={() => setUserPickerOpen(p => !p)}
            >
              <Text style={st.selectTriggerText} numberOfLines={1}>
                {form.eventUsers.length
                  ? form.eventUsers.map(userNameById).join(', ')
                  : 'Select team members…'}
              </Text>
              <Icon
                name={userPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#9ca3af"
              />
            </TouchableOpacity>
            {userPickerOpen &&
              renderUserList(
                form.eventUsers,
                id =>
                  setF(
                    'eventUsers',
                    form.eventUsers.includes(id)
                      ? form.eventUsers.filter(x => x !== id)
                      : [...form.eventUsers, id],
                  ),
                true,
              )}
          </Field>
        )}

        {/* ── Date + Time — teeno types ke liye uniform row (web jaisa) ── */}
        <View style={st.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label={type === 'Task' ? 'DUE DATE *' : 'DATE *'}>
              <TouchableOpacity
                style={st.selectTrigger}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={st.selectTriggerText}>
                  {fmtDate(
                    type === 'Task' ? form.taskDueDate : form.reminderDate,
                  ) || 'Select date'}
                </Text>
                <Icon name="calendar" size={14} color="#9ca3af" />
              </TouchableOpacity>
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="TIME">
              <TouchableOpacity
                style={st.selectTrigger}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={st.selectTriggerText}>
                  {fmtTime12(
                    fmtTime(
                      type === 'Task' ? form.taskTime : form.reminderTime,
                    ),
                  )}
                </Text>
                <Icon name="clock-outline" size={14} color="#9ca3af" />
              </TouchableOpacity>
            </Field>
          </View>
        </View>

        {/* ── Assign to (single) — Reminder + Task ── */}
        {type !== 'Event' && (
          <Field label="ASSIGN TO *">
            <TouchableOpacity
              style={st.selectTrigger}
              onPress={() => setUserPickerOpen(p => !p)}
            >
              <Text style={st.selectTriggerText} numberOfLines={1}>
                {form.assignedTo
                  ? userNameById(form.assignedTo)
                  : 'Select user'}
              </Text>
              <Icon
                name={userPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#9ca3af"
              />
            </TouchableOpacity>
            {userPickerOpen &&
              renderUserList(
                form.assignedTo ? [String(form.assignedTo)] : [],
                id => {
                  setF('assignedTo', id);
                  setUserPickerOpen(false);
                },
              )}
          </Field>
        )}

        {/* ── TASK: Notify user ── */}
        {type === 'Task' && (
          <Field label="NOTIFY USER">
            <TouchableOpacity
              style={st.selectTrigger}
              onPress={() => setNotifyPickerOpen(p => !p)}
            >
              <Text style={st.selectTriggerText} numberOfLines={1}>
                {form.notify ? userNameById(form.notify) : 'None'}
              </Text>
              <Icon
                name={notifyPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#9ca3af"
              />
            </TouchableOpacity>
            {notifyPickerOpen &&
              renderUserList(form.notify ? [String(form.notify)] : [], id => {
                setF('notify', form.notify === id ? '' : id);
                setNotifyPickerOpen(false);
              })}
          </Field>
        )}

        {/* ── Note (Reminder + Event) ── */}
        {type !== 'Task' && (
          <Field label="NOTE">
            <TextInput
              style={[st.input, st.textArea]}
              placeholder="Optional note…"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={form.note}
              onChangeText={v => setF('note', v)}
            />
          </Field>
        )}

        {/* ── Save ── */}
        <TouchableOpacity
          style={[
            st.saveBtn,
            { backgroundColor: cfg.color },
            saving && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon name={cfg.icon} size={15} color="#fff" />
              <Text style={st.saveBtnText}>{cfg.saveLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Native pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={type === 'Task' ? form.taskDueDate : form.reminderDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(event, selectedDate) => {
            if (Platform.OS === 'android') setShowDatePicker(false);
            if (event?.type === 'dismissed') return;
            if (selectedDate) {
              if (type === 'Task') setF('taskDueDate', selectedDate);
              else setF('reminderDate', selectedDate);
            }
          }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={type === 'Task' ? form.taskTime : form.reminderTime}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, selectedTime) => {
            if (Platform.OS === 'android') setShowTimePicker(false);
            if (event?.type === 'dismissed') return;
            if (selectedTime)
              setF(type === 'Task' ? 'taskTime' : 'reminderTime', selectedTime);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

export default AddScheduleScreen;

// ── Styles — uniform, compact (Leads/Dashboard density) ──────────────────────

const st = StyleSheet.create({
  container: { padding: 12, gap: 12 },
  // Custom form header (shared Topbar ki jagah)
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
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
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
  headerSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  // Type switch
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  typePillText: { fontSize: 12.5, fontWeight: '700' },
  // Field wrapper
  field: { gap: 4 },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Inputs — uniform 44px height
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 44,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textArea: {
    height: undefined,
    minHeight: 68,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: 'top',
  },
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
  dropdownHint: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#9ca3af',
  },
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
  },
  // Chips (reminder type)
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  // User picker list
  userList: {
    marginTop: 4,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  userRowActive: { backgroundColor: '#eef2ff' },
  userRowText: { fontSize: 13, color: '#374151' },
  emptyUsers: {
    padding: 12,
    fontSize: 12,
    color: '#9ca3af',
  },
  // Save
  saveBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
