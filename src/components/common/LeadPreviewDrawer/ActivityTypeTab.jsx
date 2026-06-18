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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../services/api.js';

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
  Task: { _id: '', text: '', dueDate: '', assignedTo: '' },
};

const callDirections = ['Outgoing', 'Incoming', 'Missed'];
const callOutcomes = ['Spoke', 'No Answer', 'Left Voicemail'];

const SelectField = ({ value, onChange, options, theme }) => {
  return (
    <View
      style={[
        styles.pickerWrap,
        { borderColor: theme.border, backgroundColor: theme.bgSurface },
      ]}
    >
      <Picker
        selectedValue={value}
        onValueChange={itemValue => onChange({ target: { value: itemValue } })}
        mode="dropdown"
        dropdownIconColor={theme.textSecondary}
        style={[styles.picker, { color: theme.textPrimary }]}
      >
        {options.map(opt => {
          const val = opt.value ?? opt;
          const label = opt.label ?? opt;
          return <Picker.Item key={val} label={String(label)} value={val} />;
        })}
      </Picker>
    </View>
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

  const initialForm = useMemo(() => {
    const base = DEFAULT_FORM[type] || DEFAULT_FORM.Note;
    if (type === 'Task' && users.length && !base.assignedTo) {
      return { ...base, assignedTo: users[0]._id };
    }
    return base;
  }, [type, users]);

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(initialForm);
    setEditItem(null);
    setError('');
    setShowForm(false);
    setShowDatePicker(false);
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
      const due = item.taskDueDate
        ? new Date(item.taskDueDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '';
      return [
        due ? `Due ${due}` : null,
        item.taskAssignedTo
          ? `Assigned to ${item.taskAssignedTo.name || item.taskAssignedTo}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
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
      payload.taskDueDate = form.dueDate ? new Date(form.dueDate) : undefined;
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
              <Text style={[styles.actionText, { color: '#dc2626' }]}>
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
                <View style={styles.flex1}>
                  <Text
                    style={[styles.fieldLabel, { color: theme.textSecondary }]}
                  >
                    Due Date <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={[
                      styles.dateButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.bgSurface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: form.dueDate
                          ? theme.textPrimary
                          : theme.textMuted,
                        fontSize: 13,
                      }}
                    >
                      {formatDueDate(form.dueDate)}
                    </Text>
                    <Icon
                      name="calendar-month-outline"
                      size={16}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                  {showDatePicker ? (
                    <DateTimePicker
                      value={
                        form.dueDate
                          ? new Date(`${form.dueDate}T00:00:00`)
                          : new Date()
                      }
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onValueChange={(event, selectedDate) => {
                        if (event?.type === 'dismissed') return;
                        if (selectedDate) {
                          if (Platform.OS === 'android')
                            setShowDatePicker(false);
                          setForm(prev => ({
                            ...prev,
                            dueDate: toInputDate(selectedDate),
                          }));
                        }
                      }}
                      onDismiss={() => {
                        if (Platform.OS === 'android') setShowDatePicker(false);
                      }}
                    />
                  ) : null}
                </View>
                <View style={styles.flex1}>
                  <Text
                    style={[styles.fieldLabel, { color: theme.textSecondary }]}
                  >
                    Assignee
                  </Text>
                  <SelectField
                    value={form.assignedTo}
                    onChange={e =>
                      setForm(prev => ({ ...prev, assignedTo: e.target.value }))
                    }
                    options={users.map(u => ({ value: u._id, label: u.name }))}
                    theme={theme}
                  />
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
  taskGrid: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  flex1: { flex: 1 },
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
  pickerWrap: {
    borderRadius: 10,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: { height: 42, width: '100%' },
  errorText: { color: '#dc2626', fontSize: 12, lineHeight: 17 },
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
