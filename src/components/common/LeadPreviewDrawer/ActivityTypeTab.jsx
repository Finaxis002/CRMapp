import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../services/api.js';
import CallLogCard from '../../../services/callLogCard.js';
import DateField from '../../ui/DateField';

const TYPE_LABEL = {
  Note: 'Note',
  Call: 'Call',
  Email: 'Email',
  Task: 'Task',
};

const TYPE_ICONS = {
  Note: 'note-text-outline',
  Call: 'phone-outline',
  Email: 'email-outline',
  Task: 'clipboard-check-outline',
};

const DEFAULT_FORM = {
  Note: { _id: '', text: '' },
  Call: {
    _id: '',
    text: '',
    duration: '',
    direction: 'Outgoing',
    outcome: 'Spoke',
  },
  Email: { _id: '', text: '' },
  Task: { _id: '', text: '', dueDate: '', dueTime: '10:00', assignedTo: '' },
};

const callDirections = ['Outgoing', 'Incoming', 'Missed'];
const callOutcomes = ['Spoke', 'No Answer', 'Left Voicemail'];

const SelectField = ({ value, onChange, options, theme }) => {
  const [visible, setVisible] = useState(false);
  const [modalValue, setModalValue] = useState(value);

  const selectedLabel =
    options.find(opt => (opt.value ?? opt) === value)?.label ??
    value ??
    'Select...';

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          setModalValue(value);
          setVisible(true);
        }}
        style={[
          styles.pickerWrap,
          { borderColor: theme.border, backgroundColor: theme.bgSurface },
        ]}
      >
        <Text style={[styles.pickerText, { color: theme.textPrimary }]}>
          {selectedLabel}
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: theme.bgSurface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Select option
            </Text>
            <ScrollView style={styles.modalScroll}>
              {options.map((opt, idx) => {
                const val = opt.value ?? opt;
                const lbl = opt.label ?? opt;
                const isSelected = val === modalValue;
                return (
                  <TouchableOpacity
                    key={`${val}-${idx}`}
                    onPress={() => setModalValue(val)}
                    style={[
                      styles.optionItem,
                      isSelected && { backgroundColor: theme.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? '#fff' : theme.textPrimary },
                      ]}
                    >
                      {lbl}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={[styles.modalBtn, { borderColor: theme.border }]}
              >
                <Text
                  style={[styles.modalBtnText, { color: theme.textSecondary }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  onChange({ target: { value: modalValue } });
                  setVisible(false);
                }}
                style={[styles.modalBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={styles.modalBtnPrimary}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const ActivityTypeTab = ({
  leadId,
  type,
  users = [],
  theme,
  activityRefreshTrigger,
  onActivitySaved,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { user } = useSelector(state => state.auth);
  const isAdminUser = user?.role === 'admin';
  const currentUserId = user?._id || user?.id || user?.userId || '';

  const initialForm = useMemo(() => {
    const base = DEFAULT_FORM[type] || DEFAULT_FORM.Note;
    if (type === 'Task' && !base.assignedTo) {
      const fallbackAssignedTo = currentUserId || users[0]?._id || '';
      return { ...base, assignedTo: fallbackAssignedTo };
    }
    return base;
  }, [type, users, currentUserId]);

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(initialForm);
    setEditItem(null);
    setError('');
    setShowForm(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }, [initialForm]);

  const parseResponseItems = response => {
    const payload = response?.data?.data;
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  };

  const toInputDate = date => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toInputTime = date => {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  };

  const normalizeTimeValue = value => {
    const raw = String(value || '10:00').trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);

    if (!match) return '10:00';

    let hours = Number(match[1]);
    const minutes = match[2];
    const meridiem = match[3]?.toUpperCase();

    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (meridiem === 'PM' && hours < 12) hours += 12;

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  const formatDateLabel = value => {
    if (!value) return '';
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const itemDate = new Date(date);
    itemDate.setHours(0, 0, 0, 0);
    const diff = Math.round((today - itemDate) / 86400000);
    const timeString = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (diff === 0) return `Today ${timeString}`;
    if (diff === 1) return `Yesterday ${timeString}`;
    return `${date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })} ${timeString}`;
  };

  const formatDueDate = value => {
    if (!value) return 'Select date';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getItemTypeMeta = item => {
    if (type === 'Call') {
      const direction = item.callDirection || 'Outgoing';
      return `${direction}${
        item.callDuration ? ` · ${item.callDuration}` : ''
      }`;
    }
    if (type === 'Task') {
      let meta = '';

      if (item.taskDueDate) {
        const dueDate = new Date(item.taskDueDate);
        const dateStr = dueDate.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const timeStr = dueDate.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        meta = `Due ${dateStr}, ${timeStr}`;
      }

      if (item.taskAssignedTo) {
        const assigned = item.taskAssignedTo.name || item.taskAssignedTo;
        meta += meta ? ` · Assigned to ${assigned}` : `Assigned to ${assigned}`;
      }

      return meta;
    }
    return '';
  };

  const fetchItems = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/activities', {
        params: { leadId, type, limit: 100 },
      });
      setItems(parseResponseItems(response));
    } catch (err) {
      setError('Unable to load activities.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, type]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, activityRefreshTrigger]);

  const resetForm = () => {
    setForm(initialForm);
    setEditItem(null);
    setError('');
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const buildPayload = () => {
    const payload = {
      leadId,
      type,
      text: form.text?.trim() || '',
    };

    if (type === 'Call') {
      payload.callDuration = form.duration?.trim() || undefined;
      payload.callDirection = form.direction;
      payload.callOutcome = form.outcome;
    }

    if (type === 'Task') {
      let taskDueDate = null;
      if (form.dueDate) {
        const time = normalizeTimeValue(form.dueTime || '10:00');
        taskDueDate = new Date(`${form.dueDate}T${time}:00`);
      }

      payload.taskDueDate = taskDueDate;
      payload.taskAssignedTo = form.assignedTo || undefined;
    }

    return payload;
  };

  const handleSave = async () => {
    setError('');
    const trimmedText = form.text?.trim() || '';
    if ((type === 'Note' || type === 'Email') && !trimmedText) {
      setError(`Please enter ${type.toLowerCase()} details.`);
      return;
    }
    if (type === 'Call' && !trimmedText && !form.duration?.trim()) {
      setError('Please add call details or duration.');
      return;
    }
    if (type === 'Task') {
      if (!trimmedText) {
        setError('Please enter task details.');
        return;
      }
      if (!form.dueDate) {
        setError('Task due date is required.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (editItem?._id) payload._id = editItem._id;
      await api.put(`/leads/${leadId}`, { activities: [payload] });
      await fetchItems();
      resetForm();
      setShowForm(false);
      if (onActivitySaved) onActivitySaved();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Unable to save activity. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async item => {
    if (!item?._id) return;
    Alert.alert('Delete Activity', 'Delete this activity?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await api.delete(`/activities/${item._id}`);
            await fetchItems();
            if (onActivitySaved) onActivitySaved();
          } catch (err) {
            setError(
              err?.response?.data?.message ||
                err?.message ||
                'Unable to delete activity. Please try again.',
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleEdit = item => {
    setEditItem(item);
    setForm({
      _id: item._id || '',
      text: item.text || '',
      duration: item.callDuration || '',
      direction: item.callDirection || 'Outgoing',
      outcome: item.callOutcome || 'Spoke',
      dueDate: item.taskDueDate
        ? new Date(item.taskDueDate).toISOString().split('T')[0]
        : '',
      dueTime: item.taskDueDate ? toInputTime(item.taskDueDate) : '10:00',
      assignedTo:
        item.taskAssignedTo?._id || item.taskAssignedTo || users[0]?._id || '',
    });
    setError('');
    setShowForm(true);
  };

  const renderItemDetails = ({ item, index }) => {
    const isRecent = index === 0;
    const createdAt = new Date(item.updatedAt || item.createdAt || Date.now());
    const typeMeta = getItemTypeMeta(item);
    if (item.isAutoTracked) {
      return (
        <View style={{ marginBottom: 14 }}>
          <CallLogCard
            callLog={item}
            theme={theme}
            showDelete={isAdminUser}
            onDelete={() => handleDelete(item)}
          />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.itemCard,
          { backgroundColor: theme.bgSurface, borderColor: theme.border },
        ]}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <Icon
              name={TYPE_ICONS[type] || 'paperclip'}
              size={16}
              color={theme.accent}
            />
            <Text style={[styles.itemType, { color: theme.textPrimary }]}>
              {TYPE_LABEL[type]}
            </Text>
            {isRecent ? (
              <View style={[styles.recentBadge, { borderColor: theme.border }]}>
                <Text style={[styles.recentText, { color: theme.accent }]}>
                  Recent
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            {isRecent ? (
              <TouchableOpacity onPress={() => handleEdit(item)}>
                <Text style={[styles.actionText, { color: theme.accent }]}>
                  Edit
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => handleDelete(item)}>
              <Text
                style={[
                  styles.actionText,
                  { color: theme.danger || '#dc2626' },
                ]}
              >
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.itemBody, { color: theme.textPrimary }]}>
          {item.text || 'No details provided.'}
        </Text>

        {type === 'Call' ? (
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            {typeMeta}
            {item.callOutcome ? ` · Outcome: ${item.callOutcome}` : ''}
          </Text>
        ) : null}

        {type === 'Task' ? (
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            {typeMeta}
          </Text>
        ) : null}

        <View style={styles.itemFooter}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            {item.createdBy?.name || 'You'}
          </Text>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            {formatDateLabel(createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {TYPE_LABEL[type]}s
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Add, edit, and preview {type.toLowerCase()} activity on this lead.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            if (showForm) resetForm();
            setShowForm(prev => !prev);
          }}
          style={[
            styles.addButton,
            { borderColor: theme.border, backgroundColor: theme.bgSurface },
          ]}
        >
          <Text style={[styles.addButtonText, { color: theme.textPrimary }]}>
            {showForm
              ? 'Hide'
              : editItem?._id
              ? 'Edit item'
              : `Add ${TYPE_LABEL[type]}`}
          </Text>
        </TouchableOpacity>
      </View>

      {showForm ? (
        <View
          style={[
            styles.formCard,
            { borderColor: theme.border, backgroundColor: theme.bgContent },
          ]}
        >
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: theme.textPrimary }]}>
              {editItem?._id
                ? `Edit ${TYPE_LABEL[type]}`
                : `New ${TYPE_LABEL[type]}`}
            </Text>
            {editItem?._id ? (
              <TouchableOpacity onPress={resetForm}>
                <Text
                  style={[styles.clearText, { color: theme.textSecondary }]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.formGrid}>
            <TextInput
              multiline
              numberOfLines={type === 'Call' || type === 'Email' ? 3 : 2}
              value={form.text}
              onChangeText={value =>
                setForm(prev => ({ ...prev, text: value }))
              }
              placeholder={
                type === 'Call'
                  ? 'Call summary - what was discussed?'
                  : type === 'Email'
                  ? 'Email details, subject or note...'
                  : type === 'Task'
                  ? 'Task description...'
                  : 'Note details...'
              }
              placeholderTextColor={theme.textMuted}
              style={[
                styles.textArea,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.bgSurface,
                  color: theme.textPrimary,
                },
              ]}
            />

            {type === 'Call' ? (
              <View style={styles.callGrid}>
                <TextInput
                  value={form.duration}
                  onChangeText={value =>
                    setForm(prev => ({ ...prev, duration: value }))
                  }
                  placeholder="Duration (e.g. 3m 20s)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.bgSurface,
                      color: theme.textPrimary,
                    },
                  ]}
                />
                <SelectField
                  value={form.direction}
                  onChange={e =>
                    setForm(prev => ({ ...prev, direction: e.target.value }))
                  }
                  options={callDirections}
                  theme={theme}
                />
                <SelectField
                  value={form.outcome}
                  onChange={e =>
                    setForm(prev => ({ ...prev, outcome: e.target.value }))
                  }
                  options={callOutcomes}
                  theme={theme}
                />
              </View>
            ) : null}

            {type === 'Task' ? (
              <View style={styles.taskGrid}>
                <View style={styles.taskRow}>
                  <View style={styles.flex1}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Due Date{' '}
                      <Text style={{ color: theme.danger || '#ef4444' }}>
                        *
                      </Text>
                    </Text>
                    <DateField
                      value={form.dueDate}
                      mode="date"
                      placeholder="Select date"
                      onPress={() => setShowDatePicker(true)}
                      style={{
                        borderColor: theme.border,
                        backgroundColor: theme.bgSurface,
                      }}
                    />
                    {showDatePicker ? (
                      <DateTimePicker
                        value={
                          form.dueDate
                            ? new Date(`${form.dueDate}T00:00:00`)
                            : new Date()
                        }
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (event?.type === 'dismissed') return;
                          if (selectedDate) {
                            setForm(prev => ({
                              ...prev,
                              dueDate: toInputDate(selectedDate),
                            }));
                          }
                        }}
                      />
                    ) : null}
                  </View>
                  <View style={styles.flex1}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Due Time
                    </Text>
                    <DateField
                      value={form.dueTime || '10:00'}
                      mode="time"
                      placeholder="10:00"
                      onPress={() => setShowTimePicker(true)}
                      style={{
                        borderColor: theme.border,
                        backgroundColor: theme.bgSurface,
                      }}
                    />
                    {showTimePicker ? (
                      <DateTimePicker
                        value={
                          form.dueTime
                            ? new Date(
                                `2000-01-01T${normalizeTimeValue(
                                  form.dueTime,
                                )}:00`,
                              )
                            : new Date('2000-01-01T10:00:00')
                        }
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowTimePicker(false);
                          if (event?.type === 'dismissed') return;
                          if (selectedDate) {
                            setForm(prev => ({
                              ...prev,
                              dueTime: toInputTime(selectedDate),
                            }));
                          }
                        }}
                      />
                    ) : null}
                  </View>
                </View>
                <View style={styles.taskRow}>
                  <View style={styles.flex1}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Assignee
                    </Text>
                    <SelectField
                      value={form.assignedTo}
                      onChange={e =>
                        setForm(prev => ({
                          ...prev,
                          assignedTo: e.target.value,
                        }))
                      }
                      options={users.map(u => ({
                        value: u._id,
                        label: u.name,
                      }))}
                      theme={theme}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.submitRow}>
              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  setShowForm(false);
                }}
                style={[styles.cancelBtn, { borderColor: theme.border }]}
              >
                <Text
                  style={[styles.cancelText, { color: theme.textSecondary }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={[
                  styles.saveBtn,
                  { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 },
                ]}
              >
                <Text style={styles.saveText}>
                  {saving ? 'Saving...' : editItem?._id ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading...
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item._id}
          renderItem={renderItemDetails}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            items.length ? styles.listContent : styles.emptyListContent
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No {TYPE_LABEL[type].toLowerCase()}s yet. Add one to start.
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 12 },
  addButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  addButtonText: { fontSize: 12, fontWeight: '600' },
  formCard: { marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 18 },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  formTitle: { fontSize: 13, fontWeight: '700' },
  clearText: { fontSize: 12 },
  formGrid: { gap: 14 },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 68,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  callGrid: { gap: 12 },
  taskGrid: { gap: 12 },
  taskRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  flex1: { flex: 1 },
  pickerWrap: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 13,
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalScroll: {
    maxHeight: 180,
  },
  optionItem: {
    padding: 14,
  },
  optionText: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalBtn: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 14,
  },
  modalBtnPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dateButton: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  picker: { height: 42, width: '100%' },
  errorText: { fontSize: 12, lineHeight: 17 },
  submitRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelText: { fontSize: 12 },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  saveText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  loadingText: { marginTop: 8, fontSize: 13 },
  listContent: { paddingBottom: 16 },
  emptyListContent: { flexGrow: 1, justifyContent: 'center', minHeight: 180 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
  itemCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemType: { fontSize: 13, fontWeight: '700' },
  recentBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  recentText: { fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionText: { fontSize: 11, fontWeight: '600' },
  itemBody: { fontSize: 13, lineHeight: 20 },
  metaText: { fontSize: 12 },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  footerText: { fontSize: 12 },
});

export default ActivityTypeTab;
