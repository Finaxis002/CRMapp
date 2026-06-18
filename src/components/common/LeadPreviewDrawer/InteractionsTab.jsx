import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import api from '../../../services/api';

// =============================================
// HELPERS
// =============================================
const parseApiResponseArray = response => {
  const payload = response?.data?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return [payload.data];
  return [];
};

const EDITABLE_TYPES = new Set([
  'call',
  'note',
  'email',
  'meeting',
  'recording',
  'task',
]);

const getActivityIcon = (type, source) => {
  const raw = String(type || '').toLowerCase();

  if (raw.includes('whatsapp') || source === 'whatsapp') {
    return '💬'; // WhatsApp emoji for React Native
  }
  if (raw === 'call') return '📞';
  if (raw === 'task') return '📌';
  if (raw === 'email') return '✉️';
  if (raw === 'meeting') return '🗓️';
  if (raw === 'recording') return '🎙️';
  if (raw === 'payment') return '💰';
  if (raw === 'status change') return '🔄';
  if (raw === 'lead reassignment') return '🔁';
  if (raw === 'reminder') return '🔔';
  return '📝';
};

const getCallOutcomeMeta = outcome => {
  switch (outcome) {
    case 'Spoke':
      return {
        label: 'Spoke',
        color: '#16a34a',
        bg: 'rgba(34, 197, 94, 0.12)',
      };
    case 'No Answer':
      return {
        label: 'No Answer',
        color: '#dc2626',
        bg: 'rgba(239, 68, 68, 0.12)',
      };
    case 'Left Voicemail':
      return {
        label: 'Left Voicemail',
        color: '#d97706',
        bg: 'rgba(245, 158, 11, 0.12)',
      };
    default:
      return null;
  }
};

const formatDate = dateOrItem => {
  const date =
    dateOrItem && typeof dateOrItem === 'object'
      ? dateOrItem.updatedAt || dateOrItem.createdAt
      : dateOrItem;
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// =============================================
// CUSTOM DROPDOWN
// =============================================
const CustomDropdown = ({ value, onChange, options, label, theme }) => {
  const [visible, setVisible] = useState(false);
  const [modalValue, setModalValue] = useState(value);

  const selectedLabel =
    options.find(o => (o.value ?? o) === value)?.label ?? value ?? 'Select...';

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          setModalValue(value);
          setVisible(true);
        }}
        style={[styles.dropdownButton, { borderColor: theme.border }]}
      >
        <Text
          style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}
        >
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
              {label || 'Select Option'}
            </Text>
            <ScrollView style={styles.modalScroll}>
              {options.map((opt, idx) => {
                const val = opt.value ?? opt;
                const lbl = opt.label ?? opt;
                const isSelected = val === modalValue;
                return (
                  <TouchableOpacity
                    key={idx}
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
                  onChange(modalValue);
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

// =============================================
// MAIN COMPONENT
// =============================================
const InteractionsTab = ({
  leadId,
  isDark,
  theme = {},
  users = [],
  activityRefreshTrigger,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({
    text: '',
    duration: '',
    direction: 'Outgoing',
    outcome: 'Spoke',
    dueDate: '',
    assignedTo: '',
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Default theme
  const defaultTheme = {
    bgSurface: theme.bgSurface || '#fff',
    bgContent: theme.bgContent || '#f8f9fb',
    border: theme.border || '#e5e7eb',
    textPrimary: theme.textPrimary || '#111827',
    textSecondary: theme.textSecondary || '#6b7280',
    textMuted: theme.textMuted || '#9ca3af',
    accent: theme.accent || '#6366f1',
    danger: theme.danger || '#ef4444',
  };

  // =============================================
  // FETCH
  // =============================================
  const fetchInteractions = useCallback(async () => {
    if (!leadId) return;

    setLoading(true);
    setError(null);

    try {
      const activityPromise = api.get(`/activities/lead/${leadId}`);
      const whatsappPromise = api.get(`/whatsapp/messages?leadId=${leadId}`);

      const [activityResult, whatsappResult] = await Promise.allSettled([
        activityPromise,
        whatsappPromise,
      ]);

      const activities = parseApiResponseArray(
        activityResult.status === 'fulfilled' ? activityResult.value : null,
      ).map(activity => ({
        ...activity,
        source: 'activity',
        type: activity.type || 'Note',
      }));

      let whatsappMessages = [];
      if (whatsappResult.status === 'fulfilled') {
        whatsappMessages = parseApiResponseArray(whatsappResult.value).map(
          message => ({
            ...message,
            source: 'whatsapp',
            type: 'WhatsApp',
            whatsappType: message.type,
            whatsappDirection: message.direction,
            text: message.body || 'WhatsApp message',
          }),
        );
      }

      const merged = [...activities, ...whatsappMessages].sort((a, b) => {
        const aDate = new Date(a.updatedAt || a.createdAt);
        const bDate = new Date(b.updatedAt || b.createdAt);
        return bDate - aDate;
      });

      setItems(merged);
    } catch (e) {
      setItems([]);
      setError('Failed to load interactions.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions, activityRefreshTrigger]);

  // =============================================
  // FORM HANDLERS
  // =============================================
  const resetEditForm = () => {
    setEditItem(null);
    setEditForm({
      text: '',
      duration: '',
      direction: 'Outgoing',
      outcome: 'Spoke',
      dueDate: '',
      assignedTo: users[0]?._id || '',
    });
    setError(null);
    setShowEditForm(false);
  };

  const prepareEditForm = item => {
    setEditItem(item);
    setEditForm({
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
    setError(null);
    setShowEditForm(true);
  };

  const buildEditPayload = () => {
    if (!editItem) return { text: editForm.text?.trim() || '' };

    const payload = {
      text: editForm.text?.trim() || '',
    };

    if (editItem.type === 'Call') {
      payload.callDuration = editForm.duration?.trim() || undefined;
      payload.callDirection = editForm.direction;
      payload.callOutcome = editForm.outcome;
    }

    if (editItem.type === 'Task') {
      payload.taskDueDate = form.dueDate ? new Date(form.dueDate) : undefined;
      payload.taskAssignedTo = editForm.assignedTo || undefined;
    }

    return payload;
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;

    setError(null);
    if (
      ['Note', 'Email', 'Meeting', 'Recording'].includes(editItem.type) &&
      !editForm.text?.trim()
    ) {
      setError('Please enter details before saving.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildEditPayload();
      await api.put(`/activities/${editItem._id}`, payload);
      await fetchInteractions();
      resetEditForm();
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

  const handleDelete = async activity => {
    if (!activity?._id) return;
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const deleteUrl =
                activity.source === 'whatsapp'
                  ? `/whatsapp/messages/${activity._id}`
                  : `/activities/${activity._id}`;
              await api.delete(deleteUrl);
              await fetchInteractions();
              if (editItem?._id === activity._id) {
                resetEditForm();
              }
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
      ],
    );
  };

  const handleEdit = activity => {
    if (!EDITABLE_TYPES.has(String(activity.type || '').toLowerCase())) return;
    prepareEditForm(activity);
  };

  const firstEditableActivityId = items.find(activity =>
    EDITABLE_TYPES.has(String(activity.type || '').toLowerCase()),
  )?._id;

  const isEditableRecent = activity => {
    return (
      activity._id === firstEditableActivityId &&
      EDITABLE_TYPES.has(String(activity.type || '').toLowerCase())
    );
  };

  // =============================================
  // RENDER ACTIVITY SUMMARY
  // =============================================
  const renderActivitySummary = item => {
    const rawType = String(item.type || 'Note').toLowerCase();
    const text = item.text?.trim();

    switch (rawType) {
      case 'call': {
        const outcomeMeta = getCallOutcomeMeta(item.callOutcome);
        return (
          <>
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {text || 'Call logged.'}
            </Text>
            <View style={styles.metaRow}>
              {item.callDirection && (
                <Text
                  style={[styles.metaText, { color: defaultTheme.textMuted }]}
                >
                  {item.callDirection}
                </Text>
              )}
              {outcomeMeta && (
                <View
                  style={[
                    styles.outcomeBadge,
                    { backgroundColor: outcomeMeta.bg },
                  ]}
                >
                  <View
                    style={[
                      styles.outcomeDot,
                      { backgroundColor: outcomeMeta.color },
                    ]}
                  />
                  <Text
                    style={[styles.outcomeText, { color: outcomeMeta.color }]}
                  >
                    {outcomeMeta.label}
                  </Text>
                </View>
              )}
              {item.callDuration && (
                <Text
                  style={[styles.metaText, { color: defaultTheme.textMuted }]}
                >
                  Duration: {item.callDuration}
                </Text>
              )}
            </View>
          </>
        );
      }

      case 'task':
        return (
          <>
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {text || 'Task recorded.'}
            </Text>
            {item.taskDueDate && (
              <Text
                style={[styles.metaText, { color: defaultTheme.textMuted }]}
              >
                Due by{' '}
                {new Date(item.taskDueDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            )}
            {item.isCompleted && (
              <Text style={styles.completedText}>Completed</Text>
            )}
          </>
        );

      case 'email':
        return (
          <>
            {item.emailSubject && (
              <Text
                style={[
                  styles.subjectText,
                  { color: defaultTheme.textPrimary },
                ]}
              >
                {item.emailSubject}
              </Text>
            )}
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {item.emailBody || text || 'Email activity logged.'}
            </Text>
          </>
        );

      case 'meeting':
        return (
          <Text
            style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
          >
            {text || 'Meeting activity recorded.'}
          </Text>
        );

      case 'recording':
        return (
          <>
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {text || 'Recording added.'}
            </Text>
          </>
        );

      case 'status change':
        return (
          <>
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {item.statusFrom || ''} → {item.statusTo || ''}
            </Text>
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {text || 'Status update recorded.'}
            </Text>
          </>
        );

      case 'payment':
        return (
          <>
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {text || 'Payment activity recorded.'}
            </Text>
            {(item.paymentAmount != null ||
              item.paymentMode ||
              item.paymentStatus ||
              item.paymentReference) && (
              <Text
                style={[styles.metaText, { color: defaultTheme.textMuted }]}
              >
                {item.paymentAmount != null
                  ? `Amount: ₹${item.paymentAmount}`
                  : ''}
                {item.paymentMode ? ` · Mode: ${item.paymentMode}` : ''}
                {item.paymentStatus ? ` · Status: ${item.paymentStatus}` : ''}
                {item.paymentReference
                  ? ` · Ref: ${item.paymentReference}`
                  : ''}
              </Text>
            )}
          </>
        );

      case 'whatsapp':
        return (
          <>
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {item.whatsappType === 'call'
                ? `WhatsApp ${item.whatsappType} ${
                    item.whatsappDirection || ''
                  }`
                : 'WhatsApp message'}
            </Text>
            <Text
              style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
            >
              {item.text || item.body || 'WhatsApp interaction recorded.'}
            </Text>
            {item.mediaName && (
              <Text
                style={[styles.metaText, { color: defaultTheme.textMuted }]}
              >
                Attachment: {item.mediaName}
              </Text>
            )}
          </>
        );

      case 'reminder':
        return (
          <Text
            style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
          >
            {text || 'Reminder recorded.'}
          </Text>
        );

      default:
        return (
          <Text
            style={[styles.summaryText, { color: defaultTheme.textPrimary }]}
          >
            {text || 'Note activity recorded.'}
          </Text>
        );
    }
  };

  // =============================================
  // RENDER
  // =============================================
  const userOptions = users.map(u => ({ value: u._id, label: u.name }));
  const callDirections = ['Outgoing', 'Incoming', 'Missed'];
  const callOutcomes = ['Spoke', 'No Answer', 'Left Voicemail'];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: defaultTheme.textPrimary }]}>
          {items.length} Interaction{items.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          onPress={fetchInteractions}
          disabled={loading}
          style={[
            styles.refreshButton,
            {
              backgroundColor: defaultTheme.accent,
              opacity: loading ? 0.6 : 1,
            },
          ]}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Form */}
      {showEditForm && editItem && (
        <View
          style={[
            styles.editForm,
            {
              backgroundColor: defaultTheme.bgContent,
              borderColor: defaultTheme.border,
            },
          ]}
        >
          <View style={styles.editFormHeader}>
            <Text
              style={[
                styles.editFormTitle,
                { color: defaultTheme.textPrimary },
              ]}
            >
              Edit {editItem.type}
            </Text>
            <TouchableOpacity onPress={resetEditForm}>
              <Text
                style={[
                  styles.cancelEditText,
                  { color: defaultTheme.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editFormGrid}>
            <TextInput
              multiline
              numberOfLines={4}
              value={editForm.text}
              onChangeText={text => setEditForm(prev => ({ ...prev, text }))}
              placeholder={`Edit ${editItem.type} details...`}
              placeholderTextColor={defaultTheme.textMuted}
              style={[
                styles.editTextArea,
                {
                  borderColor: defaultTheme.border,
                  backgroundColor: defaultTheme.bgSurface,
                  color: defaultTheme.textPrimary,
                },
              ]}
            />

            {editItem.type === 'Call' && (
              <View style={styles.callFieldsRow}>
                <TextInput
                  value={editForm.duration}
                  onChangeText={text =>
                    setEditForm(prev => ({ ...prev, duration: text }))
                  }
                  placeholder="Duration"
                  placeholderTextColor={defaultTheme.textMuted}
                  style={[
                    styles.editInput,
                    {
                      borderColor: defaultTheme.border,
                      backgroundColor: defaultTheme.bgSurface,
                      color: defaultTheme.textPrimary,
                    },
                  ]}
                />
                <View style={styles.pickerWrapper}>
                  <CustomDropdown
                    value={editForm.direction}
                    onChange={val =>
                      setEditForm(prev => ({ ...prev, direction: val }))
                    }
                    options={callDirections}
                    label="Direction"
                    theme={defaultTheme}
                  />
                </View>
                <View style={styles.pickerWrapper}>
                  <CustomDropdown
                    value={editForm.outcome}
                    onChange={val =>
                      setEditForm(prev => ({ ...prev, outcome: val }))
                    }
                    options={callOutcomes}
                    label="Outcome"
                    theme={defaultTheme}
                  />
                </View>
              </View>
            )}

            {editItem.type === 'Task' && (
              <View style={styles.taskFieldsRow}>
                <View style={styles.dateFieldWrapper}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: defaultTheme.textSecondary },
                    ]}
                  >
                    Due Date
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={[
                      styles.dateButton,
                      {
                        borderColor: defaultTheme.border,
                        backgroundColor: defaultTheme.bgSurface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        {
                          color: editForm.dueDate
                            ? defaultTheme.textPrimary
                            : defaultTheme.textMuted,
                        },
                      ]}
                    >
                      {editForm.dueDate || 'Select date'}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={
                        editForm.dueDate
                          ? new Date(editForm.dueDate)
                          : new Date()
                      }
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onValueChange={(event, selectedDate) => {
                        if (event?.type === 'dismissed') return;
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          const dateString = selectedDate
                            .toISOString()
                            .split('T')[0];
                          setEditForm(prev => ({
                            ...prev,
                            dueDate: dateString,
                          }));
                        }
                      }}
                      onDismiss={() =>
                        setShowDatePicker(Platform.OS === 'android')
                      }
                    />
                  )}
                </View>
                <View style={styles.pickerWrapper}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: defaultTheme.textSecondary },
                    ]}
                  >
                    Assigned To
                  </Text>
                  <CustomDropdown
                    value={editForm.assignedTo}
                    onChange={val =>
                      setEditForm(prev => ({ ...prev, assignedTo: val }))
                    }
                    options={userOptions}
                    label="Assigned To"
                    theme={defaultTheme}
                  />
                </View>
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.formActions}>
              <TouchableOpacity
                onPress={resetEditForm}
                style={[
                  styles.cancelButton,
                  { borderColor: defaultTheme.border },
                ]}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: defaultTheme.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={saving}
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: defaultTheme.accent,
                    opacity: saving ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Items List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerContent}>
            <Text
              style={[styles.centerText, { color: defaultTheme.textMuted }]}
            >
              Loading interactions...
            </Text>
          </View>
        ) : error && items.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={[styles.centerText, { color: defaultTheme.danger }]}>
              {error}
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerContent}>
            <Text
              style={[styles.centerText, { color: defaultTheme.textMuted }]}
            >
              No interactions yet. Add calls, emails, meetings, recordings, or
              activity to build lead history.
            </Text>
          </View>
        ) : (
          items.map(item => (
            <View
              key={`${item.source}-${item._id}`}
              style={[
                styles.itemCard,
                {
                  backgroundColor: defaultTheme.bgSurface,
                  borderColor: defaultTheme.border,
                },
              ]}
            >
              {/* Header Row */}
              <View style={styles.itemHeader}>
                <View style={styles.itemHeaderLeft}>
                  <Text style={styles.itemIcon}>
                    {getActivityIcon(item.type, item.source)}
                  </Text>
                  <Text
                    style={[
                      styles.itemType,
                      { color: defaultTheme.textPrimary },
                    ]}
                  >
                    {item.type || 'Note'}
                  </Text>
                  {isEditableRecent(item) && (
                    <View
                      style={[
                        styles.recentBadge,
                        { borderColor: defaultTheme.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.recentBadgeText,
                          { color: defaultTheme.accent },
                        ]}
                      >
                        Recent
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemHeaderRight}>
                  {isEditableRecent(item) && (
                    <TouchableOpacity onPress={() => handleEdit(item)}>
                      <Text
                        style={[
                          styles.editText,
                          { color: defaultTheme.accent },
                        ]}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Content */}
              <View style={styles.itemContent}>
                {renderActivitySummary(item)}
              </View>

              {/* Footer */}
              <View
                style={[
                  styles.itemFooter,
                  { borderTopColor: defaultTheme.border },
                ]}
              >
                <Text
                  style={[styles.footerText, { color: defaultTheme.textMuted }]}
                >
                  {item.sentBy?.name || item.createdBy?.name || 'You'}
                </Text>
                <Text
                  style={[styles.footerText, { color: defaultTheme.textMuted }]}
                >
                  {formatDate(item)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// =============================================
// STYLES
// =============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  refreshButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 20,
  },
  centerContent: {
    paddingTop: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  centerText: {
    fontSize: 13,
    textAlign: 'center',
  },
  // Edit Form
  editForm: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  editFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  editFormTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  cancelEditText: {
    fontSize: 12,
  },
  editFormGrid: {
    gap: 14,
  },
  editTextArea: {
    width: '100%',
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  editInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  callFieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  taskFieldsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  pickerWrapper: {
    flex: 1,
  },
  dateFieldWrapper: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateButton: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 13,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 12,
  },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  // Item Card
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemIcon: {
    fontSize: 16,
    width: 16,
    textAlign: 'center',
  },
  itemType: {
    fontSize: 13,
    fontWeight: '700',
  },
  recentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  recentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemHeaderRight: {
    flexDirection: 'row',
    gap: 10,
  },
  editText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  itemContent: {
    gap: 4,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 20,
  },
  subjectText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
  },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  outcomeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  outcomeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  completedText: {
    fontSize: 12,
    color: '#22c55e',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 4,
  },
  footerText: {
    fontSize: 11,
  },
  // Dropdown styles
  dropdownButton: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 13,
    color: '#111',
  },
  dropdownPlaceholder: {
    color: '#9ca3af',
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#6b7280',
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
});

export default InteractionsTab;
