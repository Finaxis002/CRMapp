import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pick } from '@react-native-documents/picker';
import Video from 'react-native-video';
import axios from 'axios';

import CustomPhoneInput from '../ui/PhoneInput.jsx';
import MultiSelect from '../ui/MultiSelect';
import CrossSellTab from './Crossselltab';
import PaymentHistoryItem from '../common/LeadFormModel/PaymentHistoryItem.jsx';
import api from '../../services/api.js';

// ── Shims: web's react-hot-toast → native Alert ──
const toast = {
  success: msg => Alert.alert('Success', String(msg)),
  error: msg => Alert.alert('Error', String(msg)),
};

// ── Constants ──
const DEFAULT_STATUS_OPTIONS = [
  'New',
  'Interested',
  'Details Shared',
  'Success',
  'Closed',
  'Repeat',
];
const DEFAULT_SOURCE_OPTIONS = [
  'Google Ads',
  'Website',
  'Referral',
  'Walk-in',
  'Cold Call',
  'Social Media',
  'Google Sheet',
  'Other',
];
const PRIORITY_OPTIONS = ['Normal', 'High', 'Urgent'];
const ACTIVITY_TYPES = ['Note', 'Call', 'Email', 'Meeting', 'Task'];
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
const REMINDER_TYPES = ['Call', 'Email', 'Meeting', 'Follow-up', 'Payment'];
const ALL_CROSS_SELL_SERVICES = [
  'MSME',
  'GST Registration',
  'GST Return',
  'Income Tax Return',
  'Income Tax Audit',
  'Project Report',
  'Subsidy Services',
  'Trade Mark',
  'IEC Code',
];

const TABS = [
  'Profile',
  'Assign',
  'Activity',
  'Recording',
  'Payment',
  'Reminder',
];

const ACTIVITY_TYPE_META = {
  Note: { color: '#a855f7', icon: 'note-text-outline' },
  Call: { color: '#22c55e', icon: 'phone-outline' },
  Email: { color: '#3b82f6', icon: 'email-outline' },
  Meeting: { color: '#f97316', icon: 'account-group-outline' },
  Task: { color: '#64748b', icon: 'checkbox-marked-outline' },
};

const toInputDate = d => {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const toInputTime = d => {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
};

// ════════════════════════════════════════════════════════════════
// SuccessServiceSelector
// ════════════════════════════════════════════════════════════════
const SuccessServiceSelector = ({ lead, onSaved, isSuccess }) => {
  const [availableServices, setAvailableServices] = useState(
    ALL_CROSS_SELL_SERVICES,
  );
  const [selectedServices, setSelectedServices] = useState(
    lead?.crossSellRecord?.reactivationServices || [],
  );
  const [reactivationDate, setReactivationDate] = useState('');
  const [reactivationTime, setReactivationTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // 'date' | 'time'

  useEffect(() => {
    if (!lead?._id) return;
    api
      .get(`/cross-sell/recommendations/${lead._id}`)
      .then(res => {
        const record = res.data?.data;
        if (record?.reactivationServices?.length)
          setSelectedServices(record.reactivationServices);
        if (record?.reactivationDate) {
          const utc = new Date(record.reactivationDate);
          const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
          setReactivationDate(ist.toISOString().split('T')[0]);
          setReactivationTime(ist.toISOString().split('T')[1].slice(0, 5));
        }
      })
      .catch(() => {});
  }, [lead?._id]);

  useEffect(() => {
    api
      .get('/cross-sell/rules')
      .then(res => {
        const rules = res.data?.data || [];
        const active = rules.filter(r => r.isActive).map(r => r.triggerService);
        if (active.length > 0) setAvailableServices([...new Set(active)]);
      })
      .catch(() => {});
  }, []);

  const toggleService = svc => {
    setSelectedServices(prev =>
      prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc],
    );
  };

  const handleSave = async () => {
    if (!lead?._id) {
      toast.error('Please save the lead first');
      return;
    }
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }
    if (!reactivationDate) {
      toast.error('Please select a reactivation date');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/cross-sell/schedule-reactivation/${lead._id}`, {
        services: selectedServices,
        reactivationDate: new Date(
          `${reactivationDate}T${reactivationTime}:00+05:30`,
        ).toISOString(),
      });
      toast.success('Services and reactivation date saved successfully!');
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={ss.container}>
      <View>
        <Text style={ss.sectionTitle}>Select Services</Text>
        <View style={ss.servicesList}>
          {availableServices.map(svc => {
            const checked = selectedServices.includes(svc);
            return (
              <TouchableOpacity
                key={svc}
                onPress={() => toggleService(svc)}
                style={[ss.serviceRow, checked && ss.serviceRowChecked]}
                activeOpacity={0.8}
              >
                <View style={[ss.checkbox, checked && ss.checkboxChecked]}>
                  {checked ? (
                    <Icon name="check" size={11} color="#fff" />
                  ) : null}
                </View>
                <Text style={ss.serviceLabel}>{svc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={ss.sectionTitle}>Reactivation Date & Time</Text>
        <Text style={ss.sectionHint}>
          On this date and time, the lead will automatically move to "New".
        </Text>
        <View style={ss.dateTimeRow}>
          <TouchableOpacity
            onPress={() => setPickerTarget('date')}
            style={ss.dateTimeBtn}
          >
            <Icon name="calendar" size={16} color="#64748b" />
            <Text style={ss.dateTimeText}>
              {reactivationDate || 'Select date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPickerTarget('time')}
            style={[ss.dateTimeBtn, { width: 128 }]}
          >
            <Icon name="clock-outline" size={16} color="#64748b" />
            <Text style={ss.dateTimeText}>
              {reactivationTime || 'Select time'}
            </Text>
          </TouchableOpacity>
        </View>

        {pickerTarget === 'date' ? (
          <DateTimePicker
            value={
              reactivationDate
                ? new Date(`${reactivationDate}T00:00:00`)
                : new Date()
            }
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onValueChange={(event, selectedDate) => {
              if (event?.type === 'dismissed') return;
              setPickerTarget(null);
              if (selectedDate) setReactivationDate(toInputDate(selectedDate));
            }}
            onDismiss={() => setPickerTarget(null)}
          />
        ) : null}
        {pickerTarget === 'time' ? (
          <DateTimePicker
            value={
              reactivationTime
                ? new Date(`2000-01-01T${reactivationTime}:00`)
                : new Date()
            }
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onValueChange={(event, selectedDate) => {
              if (event?.type === 'dismissed') return;
              setPickerTarget(null);
              if (selectedDate) setReactivationTime(toInputTime(selectedDate));
            }}
            onDismiss={() => setPickerTarget(null)}
          />
        ) : null}
      </View>

      <TouchableOpacity
        disabled={saving || selectedServices.length === 0 || !reactivationDate}
        onPress={handleSave}
        style={[
          ss.saveBtn,
          (saving || selectedServices.length === 0 || !reactivationDate) &&
            ss.disabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={ss.saveBtnText}>
            {selectedServices.length > 0
              ? `Save (${selectedServices.length} service${
                  selectedServices.length > 1 ? 's' : ''
                })`
              : 'Please select services first'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const ss = StyleSheet.create({
  container: { gap: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  sectionHint: { fontSize: 11, color: '#6b7280', marginBottom: 8 },
  servicesList: { gap: 8 },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  serviceRowChecked: {
    borderColor: '#2563eb',
    borderWidth: 1.5,
    backgroundColor: 'rgba(37,99,235,0.06)',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  serviceLabel: { fontSize: 13, fontWeight: '500', color: '#0f172a' },
  dateTimeRow: { flexDirection: 'row', gap: 8 },
  dateTimeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: { fontSize: 13, color: '#111827' },
  saveBtn: {
    borderRadius: 12,
    backgroundColor: '#5a7bf6',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});

// ════════════════════════════════════════════════════════════════
// LeadFormModal
// ════════════════════════════════════════════════════════════════
const LeadFormModal = ({
  visible,
  lead = null,
  onClose,
  onSubmit,
  users = [],
  statusOptions = [],
  sourceOptions = [],
  currentUserId = '',
  canCreateLead = true,
  canEditAnyLead = true,
  canAssignLead = true,
  canChangeLeadOwner = true,
  settings = {},
  initialTab = 'Profile',
}) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'Profile');
  const [submitting, setSubmitting] = useState(false);
  const [activeActivityType, setActiveActivityType] = useState('Note');
  const [recordingFile, setRecordingFile] = useState(null);
  const [uploadingRec, setUploadingRec] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savedRecordings, setSavedRecordings] = useState([]);
  const [playingUrl, setPlayingUrl] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState(
    Array.isArray(lead?.payments) ? lead.payments : [],
  );
  const [pickerTargets, setPickerTargets] = useState({}); // { key: 'date'|'time'|'datetime' }
  const [activities, setActivities] = useState({
    Note: { _id: '', text: '', notify: '' },
    Call: {
      _id: '',
      text: '',
      duration: '',
      direction: 'Outgoing',
      outcome: 'Spoke',
      notify: '',
    },
    Email: { _id: '', text: '', notify: '' },
    Meeting: { _id: '', text: '', notify: '' },
    Task: { _id: '', text: '', dueDate: '', assignedTo: '', notify: '' },
  });

  const customColumns = Array.isArray(settings?.customColumns)
    ? settings.customColumns
    : [];
  const defaultStatusOptions = statusOptions.length
    ? statusOptions
    : DEFAULT_STATUS_OPTIONS;
  const defaultSourceOptions = sourceOptions.length
    ? sourceOptions
    : DEFAULT_SOURCE_OPTIONS;
  const canManageAssignment = canAssignLead || canChangeLeadOwner;

  // ── Build form fields ──
  const [form, setForm] = useState({
    name: '',
    phone: '',
    alternatePhone: '',
    email: '',
    city: '',
    source: defaultSourceOptions[0] || '',
    status: 'New',
    dealValue: '',
    product: '',
    closeDate: '',
    priority: 'Normal',
    note: '',
    assignedTo: currentUserId || users[0]?._id || '',
    coAssignees: [],
    recordingLabel: '',
    recordingUrl: '',
    paymentAmount: '',
    paymentDate: '',
    paymentMode: 'UPI',
    paymentStatus: 'Paid',
    paymentReference: '',
    customFields: {},
    reminderType: 'Call',
    reminderAssignedTo: '',
    reminderDate: '',
    reminderTime: '10:00',
    reminderNote: '',
    reminderNotify: '',
  });

  const getLeadAssignee = leadItem => {
    if (!leadItem || !leadItem.assignedTo) return '';
    if (typeof leadItem.assignedTo === 'string') return leadItem.assignedTo;
    return leadItem.assignedTo._id || leadItem.assignedTo.id || '';
  };

  // ── Sync lead -> form ──
  useEffect(() => {
    if (!visible) {
      setRecordingFile(null);
      return;
    }
    if (!lead) {
      setActiveTab(initialTab || 'Profile');
      setForm({
        name: '',
        phone: '',
        alternatePhone: '',
        email: '',
        city: '',
        source: defaultSourceOptions[0] || '',
        status: 'New',
        dealValue: '',
        product: '',
        closeDate: '',
        priority: 'Normal',
        note: '',
        assignedTo: currentUserId || users[0]?._id || '',
        coAssignees: [],
        recordingLabel: '',
        recordingUrl: '',
        paymentAmount: '',
        paymentDate: '',
        paymentMode: 'UPI',
        paymentStatus: 'Paid',
        paymentReference: '',
        customFields: {},
        reminderType: 'Call',
        reminderAssignedTo: '',
        reminderDate: '',
        reminderTime: '10:00',
        reminderNote: '',
        reminderNotify: '',
      });
      setActivities({
        Note: { _id: '', text: '', notify: '' },
        Call: {
          _id: '',
          text: '',
          duration: '',
          direction: 'Outgoing',
          outcome: 'Spoke',
          notify: '',
        },
        Email: { _id: '', text: '', notify: '' },
        Meeting: { _id: '', text: '', notify: '' },
        Task: { _id: '', text: '', dueDate: '', assignedTo: '', notify: '' },
      });
      setSavedRecordings([]);
      return;
    }

    // Build form from lead
    const latestActivity =
      Array.isArray(lead.activities) && lead.activities.length
        ? lead.activities[0]
        : null;
    const pendingReminders = Array.isArray(lead.reminders)
      ? lead.reminders.filter(r => !r.isDone)
      : [];
    const latestReminder = pendingReminders.length
      ? [...pendingReminders].sort((a, b) => {
          const aDate = new Date(a.reminderDate || a.createdAt || 0);
          const bDate = new Date(b.reminderDate || b.createdAt || 0);
          if (bDate.getTime() !== aDate.getTime()) return bDate - aDate;
          const aTime = a.reminderTime || '00:00';
          const bTime = b.reminderTime || '00:00';
          return bTime.localeCompare(aTime);
        })[0]
      : null;

    const getUserId = user =>
      typeof user === 'string' ? user : user?._id || user?.id || '';
    const typeMap = {};
    if (Array.isArray(lead.activities)) {
      [...lead.activities]
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt) -
            new Date(a.updatedAt || a.createdAt),
        )
        .forEach(act => {
          if (act?.type && !typeMap[act.type]) typeMap[act.type] = act;
        });
    }

    setActivities({
      Note: {
        _id: typeMap.Note?._id || '',
        text: typeMap.Note?.text || '',
        notify: getUserId(typeMap.Note?.notifiedUsers?.[0]) || '',
      },
      Call: {
        _id: typeMap.Call?._id || '',
        text: typeMap.Call?.text || '',
        duration: typeMap.Call?.callDuration || '',
        direction: typeMap.Call?.callDirection || 'Outgoing',
        outcome: typeMap.Call?.callOutcome || 'Spoke',
        notify: getUserId(typeMap.Call?.notifiedUsers?.[0]) || '',
      },
      Email: {
        _id: typeMap.Email?._id || '',
        text: typeMap.Email?.text || '',
        notify: getUserId(typeMap.Email?.notifiedUsers?.[0]) || '',
      },
      Meeting: {
        _id: typeMap.Meeting?._id || '',
        text: typeMap.Meeting?.text || '',
        notify: getUserId(typeMap.Meeting?.notifiedUsers?.[0]) || '',
      },
      Task: {
        _id: typeMap.Task?._id || '',
        text: typeMap.Task?.text || '',
        dueDate: typeMap.Task?.taskDueDate
          ? new Date(typeMap.Task.taskDueDate).toISOString().split('T')[0]
          : '',
        assignedTo:
          getUserId(typeMap.Task?.taskAssignedTo) || users[0]?._id || '',
        notify: getUserId(typeMap.Task?.notifiedUsers?.[0]) || '',
      },
    });

    setForm({
      name: lead.name || '',
      phone: lead.phone || '',
      alternatePhone: lead.alternatePhone || '',
      email: lead.email || '',
      city: lead.city || '',
      source: lead.source || defaultSourceOptions[0] || '',
      status: lead.status ?? defaultStatusOptions[0] ?? 'New',
      dealValue: lead.dealValue ?? lead.value ?? '',
      product: lead.product || '',
      closeDate: lead.closeDate
        ? new Date(lead.closeDate).toISOString().split('T')[0]
        : '',
      priority: lead.priority || 'Normal',
      note: lead.initialNote || '',
      assignedTo: getLeadAssignee(lead) || currentUserId || users[0]?._id || '',
      coAssignees: Array.isArray(lead.coAssignees)
        ? lead.coAssignees
            .map(item =>
              typeof item === 'string' ? item : item?._id || item?.id || '',
            )
            .filter(Boolean)
        : [],
      recordingLabel: lead.recording?.label || '',
      recordingUrl: lead.recording?.url || '',
      paymentAmount: '',
      paymentDate: '',
      paymentMode: 'UPI',
      paymentStatus: 'Paid',
      paymentReference: '',
      customFields: customColumns.reduce((acc, col) => {
        acc[col.key] = String(lead.customFields?.[col.key] ?? '');
        return acc;
      }, {}),
      reminderType: latestReminder?.type || 'Call',
      reminderAssignedTo: getUserId(latestReminder?.assignedTo) || '',
      reminderDate: latestReminder?.reminderDate
        ? new Date(latestReminder.reminderDate).toISOString().split('T')[0]
        : '',
      reminderTime: latestReminder?.reminderTime || '10:00',
      reminderNote: latestReminder?.note || '',
      reminderNotify:
        latestReminder?.notifyUsers?.length > 0
          ? getUserId(latestReminder.notifyUsers[0])
          : '',
    });
    setSavedRecordings(lead.recordings?.length ? lead.recordings : []);
    setActiveTab(initialTab || 'Profile');
  }, [visible, lead]);

  // ── Payment sync ──
  useEffect(() => {
    setPaymentHistory(Array.isArray(lead?.payments) ? lead.payments : []);
  }, [lead?.payments]);

  const handlePaymentUpdated = updatedPayment => {
    setPaymentHistory(prev =>
      prev.map(item =>
        item._id === updatedPayment._id ? updatedPayment : item,
      ),
    );
  };

  const handleChange = (key, value) => {
    setForm(prev => {
      const nextForm = { ...prev, [key]: value };
      if (key === 'assignedTo') {
        nextForm.coAssignees = prev.coAssignees.filter(id => id !== value);
      }
      return nextForm;
    });
  };

  const handleCustomFieldChange = (key, value) => {
    setForm(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [key]: value },
    }));
  };

  const updateActivity = (type, key, val) => {
    setActivities(prev => ({ ...prev, [type]: { ...prev[type], [key]: val } }));
  };

  // ── Build payload ──
  const buildPayload = () => {
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      alternatePhone: (() => {
        const digits = form.alternatePhone
          ? String(form.alternatePhone).replace(/\D/g, '')
          : '';
        return digits.length >= 10 ? form.alternatePhone.trim() : undefined;
      })(),
      email: form.email.trim() || undefined,
      city: form.city.trim() || undefined,
      source: form.source || 'Other',
      status: form.status || defaultStatusOptions[0] || 'New',
      dealValue: form.dealValue ? Number(form.dealValue) : undefined,
      product: form.product.trim() || undefined,
      closeDate: form.closeDate || undefined,
      priority: form.priority,
      note: form.note.trim(),
      coAssignees: lead
        ? form.coAssignees
        : form.coAssignees.length
        ? form.coAssignees
        : undefined,
    };

    if (!lead) payload.assignedTo = form.assignedTo || undefined;
    else {
      const originalAssignee = getLeadAssignee(lead);
      if (form.assignedTo !== originalAssignee)
        payload.assignedTo = form.assignedTo;
    }

    const activitiesPayload = [];
    if (activities.Note.text.trim() || activities.Note._id) {
      activitiesPayload.push({
        _id: activities.Note._id || undefined,
        type: 'Note',
        text: activities.Note.text.trim(),
        notifiedUsers: activities.Note.notify ? [activities.Note.notify] : [],
      });
    }
    if (
      activities.Call.text.trim() ||
      activities.Call.duration.trim() ||
      activities.Call._id
    ) {
      activitiesPayload.push({
        _id: activities.Call._id || undefined,
        type: 'Call',
        text: activities.Call.text.trim(),
        callDuration: activities.Call.duration.trim() || '',
        callDirection: activities.Call.direction,
        callOutcome: activities.Call.outcome,
        notifiedUsers: activities.Call.notify ? [activities.Call.notify] : [],
      });
    }
    if (activities.Email.text.trim() || activities.Email._id) {
      activitiesPayload.push({
        _id: activities.Email._id || undefined,
        type: 'Email',
        text: activities.Email.text.trim(),
        notifiedUsers: activities.Email.notify ? [activities.Email.notify] : [],
      });
    }
    if (activities.Meeting.text.trim() || activities.Meeting._id) {
      activitiesPayload.push({
        _id: activities.Meeting._id || undefined,
        type: 'Meeting',
        text: activities.Meeting.text.trim(),
        notifiedUsers: activities.Meeting.notify
          ? [activities.Meeting.notify]
          : [],
      });
    }
    if (
      activities.Task.text.trim() ||
      activities.Task.dueDate ||
      activities.Task._id
    ) {
      activitiesPayload.push({
        _id: activities.Task._id || undefined,
        type: 'Task',
        text: activities.Task.text.trim(),
        taskDueDate: activities.Task.dueDate || '',
        taskAssignedTo: activities.Task.assignedTo || undefined,
        notifiedUsers: activities.Task.notify ? [activities.Task.notify] : [],
      });
    }
    if (activitiesPayload.length > 0) payload.activities = activitiesPayload;

    payload.recording = {
      label: form.recordingLabel.trim() || '',
      url: form.recordingUrl.trim() || '',
    };

    if (form.paymentAmount.trim()) {
      payload.payment = {
        amount: Number(form.paymentAmount),
        paymentMode: form.paymentMode,
        status: form.paymentStatus,
        reference: form.paymentReference.trim() || undefined,
        paymentDate: form.paymentDate || undefined,
      };
    }

    if (customColumns.length) payload.customFields = { ...form.customFields };

    const existingReminder = lead?.reminders?.find(r => !r.isDone) || null;
    const existingReminderDate = existingReminder?.reminderDate
      ? new Date(existingReminder.reminderDate).toISOString().split('T')[0]
      : '';
    const existingReminderAssignedTo =
      typeof existingReminder?.assignedTo === 'string'
        ? existingReminder.assignedTo
        : existingReminder?.assignedTo?._id ||
          existingReminder?.assignedTo?.id ||
          '';
    const existingReminderNotify =
      existingReminder?.notifyUsers?.length > 0
        ? typeof existingReminder.notifyUsers[0] === 'string'
          ? existingReminder.notifyUsers[0]
          : existingReminder.notifyUsers[0]?._id ||
            existingReminder.notifyUsers[0]?.id ||
            ''
        : '';

    const reminderChanged = !lead
      ? Boolean(form.reminderDate)
      : String(form.reminderType || 'Call') !==
          String(existingReminder?.type || 'Call') ||
        String(form.reminderAssignedTo || '') !==
          String(existingReminderAssignedTo || '') ||
        String(form.reminderDate || '') !==
          String(existingReminderDate || '') ||
        String(form.reminderTime || '10:00') !==
          String(existingReminder?.reminderTime || '10:00') ||
        String(form.reminderNote.trim() || '') !==
          String(existingReminder?.note || '') ||
        String(form.reminderNotify || '') !==
          String(existingReminderNotify || '');

    if (form.reminderDate && reminderChanged) {
      payload.reminder = {
        _id: existingReminder?._id || undefined,
        type: form.reminderType || 'Call',
        assignedTo: form.reminderAssignedTo || undefined,
        reminderDate: form.reminderDate,
        reminderTime: form.reminderTime || '10:00',
        note: form.reminderNote.trim() || undefined,
        notifyUsers:
          form.reminderNotify && form.reminderNotify !== ''
            ? [form.reminderNotify]
            : [],
      };
    }
    return payload;
  };

  // ── Recording file pick via @react-native-documents/picker ──
  const handlePickRecordingFile = async () => {
    try {
      const result = await pick({
        type: ['audio', 'video'],
        mode: 'open',
        copyTo: 'cachesDirectory',
      });
      if (!result || (Array.isArray(result) && result.length === 0)) return;
      const file = Array.isArray(result) ? result[0] : result;
      if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
        toast.error('Only audio or video files are allowed.');
        return;
      }
      setRecordingFile({
        name: file.name || 'recording',
        size: file.size || 0,
        uri: file.uri,
        type: file.type,
      });
      setForm(prev => ({
        ...prev,
        recordingUrl: '',
        recordingLabel:
          prev.recordingLabel || (file.name || '').replace(/\.[^/.]+$/, ''),
      }));
    } catch (err) {
      if (err?.message !== 'User canceled')
        toast.error(err?.message || 'File pick failed');
    }
  };

  const handleRecordingUpload = async () => {
    if (!recordingFile && !form.recordingUrl.trim()) {
      toast.error('Please provide a file or a recording URL.');
      return;
    }
    if (!lead?._id) {
      toast.success('Recording will be uploaded after the lead is saved.');
      return;
    }
    setUploadingRec(true);
    setUploadProgress(0);
    try {
      if (recordingFile) {
        const fd = new FormData();
        fd.append('recording', {
          uri: recordingFile.uri,
          name: recordingFile.name,
          type: recordingFile.type,
        });
        fd.append('label', form.recordingLabel || recordingFile.name);
        const token = await AsyncStorage.getItem('accessToken');
        const { data } = await axios.post(
          `/api/v1/leads/${lead._id}/recordings/upload`,
          fd,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSavedRecordings(prev => [...prev, data.data.recording]);
        setRecordingFile(null);
        handleChange('recordingLabel', '');
        toast.success('Recording saved successfully!');
      } else {
        toast.success('Save the lead — URL recording will be saved.');
      }
    } catch (err) {
      toast.error(err?.message || 'Upload failed.');
    } finally {
      setUploadingRec(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteRecording = async rec => {
    if (!lead?._id || !rec.filename) {
      setSavedRecordings(prev => prev.filter(r => r !== rec));
      return;
    }
    try {
      const token = await AsyncStorage.getItem('accessToken');
      await axios.delete(
        `/api/v1/leads/${lead._id}/recordings/${rec.filename}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setSavedRecordings(prev => prev.filter(r => r.filename !== rec.filename));
      if (lead.recordings)
        lead.recordings = lead.recordings.filter(
          r => r.filename !== rec.filename,
        );
      if (lead.recording?.url && rec.url && lead.recording.url === rec.url) {
        lead.recording = { label: '', url: '' };
      }
      toast.success('Recording deleted successfully.');
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Failed to delete recording.',
      );
    }
  };

  // ── Submit handler ──
  const handleSubmit = async () => {
    if (lead && !canEditAnyLead) {
      toast.error('You do not have permission to edit this lead.');
      return;
    }
    if (!lead && !canCreateLead) {
      toast.error('You do not have permission to create leads.');
      return;
    }

    const phoneRegex = /^\+?[1-9][0-9]{9,14}$/;
    const rawDigitsOnly = form.phone.replace(/\D/g, '');
    if (
      !form.phone ||
      !phoneRegex.test(form.phone) ||
      rawDigitsOnly.length < 10
    ) {
      toast.error('Please enter a valid phone number with country code.');
      setActiveTab('Profile');
      return;
    }

    const altRaw = form.alternatePhone
      ? String(form.alternatePhone).trim()
      : '';
    const altDigits = altRaw.replace(/\D/g, '');
    const isOnlyCountryCode = altDigits.length <= 2;
    if (altDigits.length > 0 && !isOnlyCountryCode && altDigits.length < 10) {
      toast.error(
        'Please enter a valid alternate phone number with country code.',
      );
      setActiveTab('Profile');
      return;
    }

    if (!form.name.trim()) {
      toast.error('Lead name is required.');
      setActiveTab('Profile');
      return;
    }
    if (!form.assignedTo) {
      toast.error('Please assign the lead to a user.');
      setActiveTab('Assign');
      return;
    }
    if (form.paymentAmount.trim() && !form.paymentDate) {
      toast.error('Payment date is required.');
      setActiveTab('Payment');
      return;
    }

    if (activities.Task.text?.trim() && !activities.Task.dueDate) {
      toast.error('Task due date is required.');
      setActiveTab('Activity');
      setActiveActivityType('Task');
      return;
    }
    if (form.reminderDate && !form.reminderAssignedTo) {
      toast.error('Reminder must be assigned to a user.');
      setActiveTab('Reminder');
      return;
    }

    if (activeTab === 'Cross-Sell') {
      // Cross-Sell save handled inside SuccessServiceSelector via ref/parent — not applicable here
      return;
    }

    const payload = buildPayload();
    setSubmitting(true);
    try {
      const savedLead = await onSubmit(payload, lead?._id);
      if (!lead?._id && recordingFile && savedLead?._id) {
        try {
          const fd = new FormData();
          fd.append('recording', {
            uri: recordingFile.uri,
            name: recordingFile.name,
            type: recordingFile.type,
          });
          fd.append('label', form.recordingLabel || recordingFile.name);
          const token = await AsyncStorage.getItem('accessToken');
          await axios.post(
            `/api/v1/leads/${savedLead._id}/recordings/upload`,
            fd,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
        } catch {
          toast.error('Lead created but recording upload failed.');
        }
      }
      if (!lead?._id) onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to save lead.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const allTabs = [
    ...TABS,
    ...(form.status === 'Success' || lead?.isCrossSell ? ['Cross-Sell'] : []),
  ];
  const activeMeta =
    ACTIVITY_TYPE_META[activeActivityType] || ACTIVITY_TYPE_META.Note;
  const activeAct = activities[activeActivityType];

  // ── Render helper: FormRow ──
  const FormRow = ({ children, columns = 1 }) => (
    <View style={[styles.formRow, columns === 2 && styles.formRow2]}>
      {children}
    </View>
  );
  const FieldBlock = ({ label, required = false, children }) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>
        {label} {required ? <Text style={styles.reqStar}>*</Text> : null}
      </Text>
      {children}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalBody}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>
                {lead ? 'Edit Lead' : 'Add New Lead'}
              </Text>
              <Text style={styles.headerSubtitle}>
                Complete profile, assignment, activity, recording, payment and
                reminder sections.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
          >
            <View style={styles.tabsInner}>
              {allTabs.map(tab => {
                const active = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={styles.tabBtn}
                  >
                    <Text
                      style={[styles.tabText, active && styles.tabTextActive]}
                    >
                      {tab}
                    </Text>
                    {active ? <View style={styles.tabIndicator} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Form Body */}
          <ScrollView
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* ═══ PROFILE TAB ═══ */}
            {activeTab === 'Profile' ? (
              <View style={styles.formContainer}>
                <FieldBlock label="Full Name" required>
                  <TextInput
                    value={form.name}
                    onChangeText={v => handleChange('name', v)}
                    placeholder="Contact name"
                    style={styles.input}
                  />
                </FieldBlock>

                <FormRow columns={2}>
                  <FieldBlock label="Primary Phone" required>
                    <CustomPhoneInput
                      value={form.phone}
                      onChange={fullNumber => handleChange('phone', fullNumber)}
                      defaultCountry="IN"
                    />
                  </FieldBlock>
                  <FieldBlock label="Status">
                    <FieldPicker
                      value={form.status}
                      options={defaultStatusOptions}
                      onChange={v => handleChange('status', v)}
                    />
                  </FieldBlock>
                </FormRow>

                <FormRow columns={2}>
                  <FieldBlock label="Priority">
                    <FieldPicker
                      value={form.priority}
                      options={PRIORITY_OPTIONS}
                      onChange={v => handleChange('priority', v)}
                    />
                  </FieldBlock>
                  <FieldBlock label="Deal Value (₹)">
                    <TextInput
                      keyboardType="numeric"
                      value={form.dealValue}
                      onChangeText={v => handleChange('dealValue', v)}
                      placeholder="Deal value"
                      style={styles.input}
                    />
                  </FieldBlock>
                </FormRow>

                <FormRow columns={2}>
                  <FieldBlock label="City">
                    <TextInput
                      value={form.city}
                      onChangeText={v => handleChange('city', v)}
                      placeholder="City"
                      style={styles.input}
                    />
                  </FieldBlock>
                  <FieldBlock label="Alternate Phone (Optional)">
                    <CustomPhoneInput
                      value={form.alternatePhone || ''}
                      onChange={fullNumber =>
                        handleChange('alternatePhone', fullNumber)
                      }
                      defaultCountry="IN"
                    />
                  </FieldBlock>
                </FormRow>

                <FormRow columns={2}>
                  <FieldBlock label="Source">
                    <FieldPicker
                      value={form.source}
                      options={defaultSourceOptions}
                      onChange={v => handleChange('source', v)}
                    />
                  </FieldBlock>
                  <FieldBlock label="Product">
                    <TextInput
                      value={form.product}
                      onChangeText={v => handleChange('product', v)}
                      placeholder="Product"
                      style={styles.input}
                    />
                  </FieldBlock>
                </FormRow>

                <FormRow columns={2}>
                  <FieldBlock label="Email">
                    <TextInput
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={form.email}
                      onChangeText={v => handleChange('email', v)}
                      placeholder="Email address"
                      style={styles.input}
                    />
                  </FieldBlock>
                  <FieldBlock label="Close Date">
                    <DateTimeField
                      value={form.closeDate}
                      onChange={v => handleChange('closeDate', v)}
                      openKey="closeDate"
                      pickerTargets={pickerTargets}
                      setPickerTargets={setPickerTargets}
                    />
                  </FieldBlock>
                </FormRow>

                {customColumns.length > 0
                  ? customColumns
                      .filter(column => column.formVisible !== false)
                      .map(column => (
                        <FieldBlock key={column.key} label={column.label}>
                          <TextInput
                            value={form.customFields?.[column.key] || ''}
                            onChangeText={v =>
                              handleCustomFieldChange(column.key, v)
                            }
                            placeholder={`Enter ${column.label}`}
                            style={styles.input}
                          />
                        </FieldBlock>
                      ))
                  : null}

                <FieldBlock label="Initial Note">
                  <TextInput
                    multiline
                    numberOfLines={3}
                    value={form.note}
                    onChangeText={v => handleChange('note', v)}
                    placeholder="Initial note or lead details"
                    style={[styles.input, styles.textarea]}
                  />
                </FieldBlock>
              </View>
            ) : null}

            {/* ═══ ASSIGN TAB ═══ */}
            {activeTab === 'Assign' ? (
              <View style={styles.formContainer}>
                <FieldBlock label="Primary Lead Owner" required>
                  <FieldPicker
                    value={form.assignedTo}
                    options={users.map(u => ({ value: u._id, label: u.name }))}
                    onChange={v => handleChange('assignedTo', v)}
                    emptyLabel="Select owner"
                    disabled={!canManageAssignment}
                  />
                  {!canManageAssignment ? (
                    <Text style={styles.warningText}>
                      You do not have permission to change assignment for this
                      lead.
                    </Text>
                  ) : null}
                </FieldBlock>

                <View style={styles.coAssignBox}>
                  <Text style={styles.fieldLabel}>Co-Assignees</Text>
                  <View style={{ marginTop: 12 }}>
                    <MultiSelect
                      options={users
                        .filter(u => u._id !== form.assignedTo)
                        .map(u => ({
                          value: u._id,
                          label: u.name || u.email || 'Unknown user',
                        }))}
                      value={users
                        .filter(u => u._id !== form.assignedTo)
                        .map(u => ({
                          value: u._id,
                          label: u.name || u.email || 'Unknown user',
                        }))
                        .filter(opt => form.coAssignees.includes(opt.value))}
                      onChange={selected => {
                        const ids = Array.isArray(selected)
                          ? selected.map(item => item.value)
                          : [];
                        handleChange('coAssignees', ids);
                      }}
                      placeholder="Select one or more co-assignees"
                      disabled={!canManageAssignment}
                      isSearchable
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      noOptionsMessage={() => 'No users available'}
                      isMulti
                      isClearable
                      maxMenuHeight={280}
                    />
                  </View>
                  {!canManageAssignment ? (
                    <Text style={styles.warningText}>
                      Co-assignee assignment is restricted for your role.
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* ═══ ACTIVITY TAB ═══ */}
            {activeTab === 'Activity' ? (
              <View style={styles.formContainer}>
                <View style={styles.activityTypeHeader}>
                  <Text style={styles.fieldLabel}>Activity Type</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.typeScroll}
                  >
                    <View style={styles.typeRow}>
                      {Object.keys(ACTIVITY_TYPE_META).map(type => {
                        const meta = ACTIVITY_TYPE_META[type];
                        const act = activities[type];
                        const hasData =
                          act.text?.trim() ||
                          act.duration?.trim() ||
                          act.dueDate;
                        const isActive = activeActivityType === type;
                        return (
                          <TouchableOpacity
                            key={type}
                            onPress={() => setActiveActivityType(type)}
                            style={[
                              styles.typePill,
                              isActive
                                ? { backgroundColor: meta.color }
                                : styles.typePillInactive,
                            ]}
                          >
                            <Icon
                              name={meta.icon}
                              size={14}
                              color={isActive ? '#fff' : '#4b5563'}
                            />
                            <Text
                              style={[
                                styles.typePillText,
                                isActive && styles.typePillTextActive,
                              ]}
                            >
                              {type}
                            </Text>
                            {hasData ? (
                              <View style={styles.typePillDot} />
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.activityForm}>
                  <Text style={styles.activityFormTitle}>
                    {activeActivityType} Activity
                  </Text>
                  <TextInput
                    multiline
                    numberOfLines={2}
                    value={activeAct.text}
                    onChangeText={v =>
                      updateActivity(activeActivityType, 'text', v)
                    }
                    placeholder={
                      activeActivityType === 'Call'
                        ? 'Call summary — what was discussed?'
                        : 'Add details...'
                    }
                    style={[styles.input, styles.textarea]}
                    placeholderTextColor="#9ca3af"
                  />

                  {activeActivityType === 'Call' ? (
                    <View style={styles.callGrid}>
                      <FieldBlock label="DURATION">
                        <TextInput
                          value={activeAct.duration}
                          onChangeText={v =>
                            updateActivity('Call', 'duration', v)
                          }
                          placeholder="3m 42s"
                          style={styles.input}
                        />
                      </FieldBlock>
                      <FieldBlock label="DIRECTION">
                        <FieldPicker
                          value={activeAct.direction}
                          options={['Outgoing', 'Incoming', 'Missed']}
                          onChange={v => updateActivity('Call', 'direction', v)}
                        />
                      </FieldBlock>
                      <FieldBlock label="OUTCOME">
                        <FieldPicker
                          value={activeAct.outcome}
                          options={['Spoke', 'No Answer', 'Left Voicemail']}
                          onChange={v => updateActivity('Call', 'outcome', v)}
                        />
                      </FieldBlock>
                    </View>
                  ) : null}

                  {activeActivityType === 'Task' ? (
                    <View style={styles.taskGrid}>
                      <FieldBlock label="DUE DATE" required>
                        <DateTimeField
                          value={activeAct.dueDate}
                          onChange={v => updateActivity('Task', 'dueDate', v)}
                          openKey="taskDueDate"
                          pickerTargets={pickerTargets}
                          setPickerTargets={setPickerTargets}
                        />
                      </FieldBlock>
                      <FieldBlock label="ASSIGN TO">
                        <FieldPicker
                          value={activeAct.assignedTo}
                          options={users.map(u => ({
                            value: u._id,
                            label: u.name,
                          }))}
                          onChange={v =>
                            updateActivity('Task', 'assignedTo', v)
                          }
                        />
                      </FieldBlock>
                    </View>
                  ) : null}

                  <FieldBlock label="NOTIFY">
                    <FieldPicker
                      value={activeAct.notify}
                      options={[
                        { value: '', label: 'No one' },
                        ...users.map(u => ({ value: u._id, label: u.name })),
                      ]}
                      onChange={v =>
                        updateActivity(activeActivityType, 'notify', v)
                      }
                    />
                  </FieldBlock>

                  {activeAct.text?.trim() ||
                  activeAct.duration?.trim() ||
                  activeAct.dueDate ? (
                    <TouchableOpacity
                      onPress={() => {
                        const base =
                          activeActivityType === 'Call'
                            ? {
                                _id: activeAct._id || '',
                                text: '',
                                duration: '',
                                direction: 'Outgoing',
                                outcome: 'Spoke',
                                notify: '',
                              }
                            : activeActivityType === 'Task'
                            ? {
                                _id: activeAct._id || '',
                                text: '',
                                dueDate: '',
                                assignedTo: users[0]?._id || '',
                                notify: '',
                              }
                            : {
                                _id: activeAct._id || '',
                                text: '',
                                notify: '',
                              };
                        setActivities(prev => ({
                          ...prev,
                          [activeActivityType]: base,
                        }));
                      }}
                    >
                      <Text style={styles.clearLink}>
                        ✕ Clear {activeActivityType} data
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {lead &&
                Array.isArray(lead.activities) &&
                lead.activities.length > 0 ? (
                  <View style={styles.recentBlock}>
                    <View style={styles.recentHeader}>
                      <Text style={styles.recentTitle}>
                        Recent Interactions
                      </Text>
                      <View style={styles.recentDivider} />
                      <View style={styles.recentCount}>
                        <Text style={styles.recentCountText}>
                          {lead.activities.length} total
                        </Text>
                      </View>
                    </View>
                    {lead.activities.map((item, idx) => {
                      const iconMap = {
                        Note: {
                          bg: '#f3e8ff',
                          text: '#9333ea',
                          icon: 'note-text-outline',
                        },
                        Call: {
                          bg: '#dcfce7',
                          text: '#16a34a',
                          icon: 'phone-outline',
                        },
                        Email: {
                          bg: '#dbeafe',
                          text: '#2563eb',
                          icon: 'email-outline',
                        },
                        Meeting: {
                          bg: '#ffedd5',
                          text: '#ea580c',
                          icon: 'account-group-outline',
                        },
                        Task: {
                          bg: '#f1f5f9',
                          text: '#475569',
                          icon: 'checkbox-marked-outline',
                        },
                        Status: {
                          bg: '#e0e7ff',
                          text: '#4f46e5',
                          icon: 'sync',
                        },
                        Reminder: {
                          bg: '#fef9c3',
                          text: '#ca8a04',
                          icon: 'bell-outline',
                        },
                      };
                      const style = iconMap[item.type] || iconMap.Status;
                      const getCallOutcomeBadge = outcome => {
                        if (outcome === 'Spoke')
                          return {
                            label: 'Spoke',
                            dot: '#22c55e',
                            bg: '#dcfce7',
                            text: '#15803d',
                          };
                        if (outcome === 'No Answer')
                          return {
                            label: 'No Answer',
                            dot: '#ef4444',
                            bg: '#fee2e2',
                            text: '#b91c1c',
                          };
                        if (outcome === 'Left Voicemail')
                          return {
                            label: 'Left Voicemail',
                            dot: '#eab308',
                            bg: '#fef9c3',
                            text: '#a16207',
                          };
                        return null;
                      };
                      const callOutcomeBadge =
                        item.type === 'Call'
                          ? getCallOutcomeBadge(item.callOutcome)
                          : null;
                      const userName =
                        typeof item.user === 'string'
                          ? item.user
                          : item.user?.name ||
                            item.createdBy?.name ||
                            item.userName ||
                            '—';
                      return (
                        <View key={item._id || idx} style={styles.recentItem}>
                          <View style={styles.recentItemTop}>
                            <View
                              style={[
                                styles.recentIcon,
                                { backgroundColor: style.bg },
                              ]}
                            >
                              <Icon
                                name={style.icon}
                                size={13}
                                color={style.text}
                              />
                            </View>
                            <Text style={styles.recentType}>
                              {item.type || 'Interaction'}
                            </Text>
                            {callOutcomeBadge ? (
                              <View
                                style={[
                                  styles.outcomeBadge,
                                  {
                                    backgroundColor: callOutcomeBadge.bg,
                                    borderColor: callOutcomeBadge.dot,
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.outcomeDot,
                                    { backgroundColor: callOutcomeBadge.dot },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.outcomeText,
                                    { color: callOutcomeBadge.text },
                                  ]}
                                >
                                  {callOutcomeBadge.label}
                                </Text>
                              </View>
                            ) : null}
                            {idx === 0 ? (
                              <View style={styles.recentBadge}>
                                <Text style={styles.recentBadgeText}>
                                  Recent
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {item.text ? (
                            <Text style={styles.recentText}>{item.text}</Text>
                          ) : null}
                          <Text style={styles.recentMeta}>
                            {userName}
                            {item.createdAt
                              ? ` · ${new Date(item.createdAt).toLocaleString(
                                  'en-IN',
                                  {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  },
                                )}`
                              : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ═══ RECORDING TAB ═══ */}
            {activeTab === 'Recording' ? (
              <View style={styles.formContainer}>
                <View style={styles.recordingBlock}>
                  <Text style={styles.sectionTitle}>Add New Recording</Text>
                  <FieldBlock label="Label">
                    <TextInput
                      value={form.recordingLabel}
                      onChangeText={v => handleChange('recordingLabel', v)}
                      placeholder="First call · 30 Apr"
                      style={styles.input}
                    />
                  </FieldBlock>
                  <FieldBlock label="Recording URL">
                    <TextInput
                      value={form.recordingUrl}
                      onChangeText={v => {
                        handleChange('recordingUrl', v);
                        if (recordingFile) setRecordingFile(null);
                      }}
                      placeholder="https://drive.google.com/..."
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  </FieldBlock>

                  <View style={styles.orDivider}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>or upload a file</Text>
                    <View style={styles.orLine} />
                  </View>

                  <TouchableOpacity
                    onPress={handlePickRecordingFile}
                    style={styles.uploadZone}
                  >
                    {recordingFile ? (
                      <View style={styles.fileRow}>
                        <Icon name="microphone" size={24} color="#5a7bf6" />
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {recordingFile.name}
                          </Text>
                          <Text style={styles.fileSize}>
                            {(
                              (recordingFile.size || 0) /
                              (1024 * 1024)
                            ).toFixed(2)}{' '}
                            MB
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setRecordingFile(null);
                          }}
                          style={styles.fileRemove}
                        >
                          <Icon name="close" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View style={styles.uploadIconCircle}>
                          <Icon name="upload" size={24} color="#9ca3af" />
                        </View>
                        <Text style={styles.uploadTitle}>
                          Tap to select a file
                        </Text>
                        <Text style={styles.uploadHint}>
                          MP3, MP4, WAV, OGG, M4A, WebM · max 100MB
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {uploadingRec ? (
                    <View style={styles.progressWrap}>
                      <View style={styles.progressTopRow}>
                        <Text style={styles.progressLabel}>Uploading...</Text>
                        <Text style={styles.progressLabel}>
                          {uploadProgress}%
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${uploadProgress}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ) : null}

                  {(recordingFile || form.recordingUrl.trim()) && lead?._id ? (
                    <TouchableOpacity
                      disabled={uploadingRec}
                      onPress={handleRecordingUpload}
                      style={[
                        styles.uploadBtn,
                        uploadingRec && styles.disabled,
                      ]}
                    >
                      <Text style={styles.uploadBtnText}>
                        {uploadingRec ? 'Uploading...' : 'Save Recording'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {!lead?._id && (recordingFile || form.recordingUrl.trim()) ? (
                    <Text style={styles.warningTextCenter}>
                      ⚠️ Recording will be saved after the lead is created
                    </Text>
                  ) : null}
                </View>

                {savedRecordings.length > 0 ? (
                  <View style={styles.savedRecsBlock}>
                    <View style={styles.savedRecsHeader}>
                      <Icon name="microphone" size={16} color="#5a7bf6" />
                      <Text style={styles.savedRecsTitle}>
                        {' '}
                        Saved Recordings ({savedRecordings.length})
                      </Text>
                    </View>
                    {savedRecordings.map((rec, idx) => {
                      const isVideo = /\.(mp4|webm|mov|avi|mkv)/i.test(
                        rec.url || '',
                      );
                      const isPlaying = playingUrl === rec.url;
                      return (
                        <View
                          key={rec._id || rec.url || idx}
                          style={styles.savedRecItem}
                        >
                          <View style={styles.savedRecTopRow}>
                            <View style={styles.savedRecIcon}>
                              <Icon
                                name={isVideo ? 'video-outline' : 'music'}
                                size={16}
                                color="#5a7bf6"
                              />
                            </View>
                            <View style={styles.savedRecInfo}>
                              <Text
                                style={styles.savedRecLabel}
                                numberOfLines={1}
                              >
                                {rec.label ||
                                  rec.originalName ||
                                  `Recording ${idx + 1}`}
                              </Text>
                              {rec.uploadedAt ? (
                                <Text style={styles.savedRecMeta}>
                                  {new Date(rec.uploadedAt).toLocaleDateString(
                                    'en-IN',
                                    {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    },
                                  )}
                                  {rec.size
                                    ? ` · ${(rec.size / (1024 * 1024)).toFixed(
                                        2,
                                      )} MB`
                                    : ''}
                                </Text>
                              ) : null}
                            </View>
                            <View style={styles.savedRecActions}>
                              <TouchableOpacity
                                onPress={() =>
                                  setPlayingUrl(isPlaying ? null : rec.url)
                                }
                                style={styles.recActionBtn}
                              >
                                <Icon
                                  name={
                                    isPlaying
                                      ? 'stop-circle-outline'
                                      : 'play-circle-outline'
                                  }
                                  size={20}
                                  color="#5a7bf6"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => Linking.openURL(rec.url)}
                                style={styles.recActionBtnGray}
                              >
                                <Icon
                                  name="download"
                                  size={16}
                                  color="#6b7280"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleDeleteRecording(rec)}
                                style={styles.recActionBtnRed}
                              >
                                <Icon
                                  name="trash-can-outline"
                                  size={16}
                                  color="#ef4444"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                          {isPlaying ? (
                            <View style={styles.mediaContainer}>
                              <Video
                                source={{ uri: rec.url }}
                                resizeMode="contain"
                                style={styles.mediaPlayer}
                                controls
                                paused={!isPlaying}
                                playInBackground={false}
                                playWhenInactive={false}
                                ignoreSilentSwitch="ignore"
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {savedRecordings.length === 0 &&
                !recordingFile &&
                !form.recordingUrl ? (
                  <View style={styles.emptyRecording}>
                    <Icon name="microphone" size={40} color="#d1d5db" />
                    <Text style={styles.emptyRecordingText}>
                      No recordings saved yet
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ═══ PAYMENT TAB ═══ */}
            {activeTab === 'Payment' ? (
              <View style={styles.formContainer}>
                <FormRow columns={3}>
                  <FieldBlock label="Amount (₹)">
                    <TextInput
                      keyboardType="numeric"
                      value={form.paymentAmount}
                      onChangeText={v => handleChange('paymentAmount', v)}
                      placeholder="0"
                      style={styles.input}
                    />
                  </FieldBlock>
                  <FieldBlock label="Date">
                    <DateTimeField
                      value={form.paymentDate}
                      onChange={v => handleChange('paymentDate', v)}
                      openKey="paymentDate"
                      pickerTargets={pickerTargets}
                      setPickerTargets={setPickerTargets}
                    />
                  </FieldBlock>
                  <FieldBlock label="Mode">
                    <FieldPicker
                      value={form.paymentMode}
                      options={PAYMENT_MODES}
                      onChange={v => handleChange('paymentMode', v)}
                    />
                  </FieldBlock>
                </FormRow>
                <FormRow columns={2}>
                  <FieldBlock label="Status">
                    <FieldPicker
                      value={form.paymentStatus}
                      options={PAYMENT_STATUS}
                      onChange={v => handleChange('paymentStatus', v)}
                    />
                  </FieldBlock>
                  <FieldBlock label="Reference">
                    <TextInput
                      value={form.paymentReference}
                      onChangeText={v => handleChange('paymentReference', v)}
                      placeholder="Transaction ID / UTR"
                      style={styles.input}
                    />
                  </FieldBlock>
                </FormRow>

                {paymentHistory.length > 0 ? (
                  <View style={styles.paymentHistoryBlock}>
                    <View style={styles.paymentHistoryHeader}>
                      <Text style={styles.paymentHistoryTitle}>
                        Payment history
                      </Text>
                      <View style={styles.recentDivider} />
                      <View style={styles.recentCount}>
                        <Text style={styles.recentCountText}>
                          {paymentHistory.length} entries
                        </Text>
                      </View>
                    </View>
                    <ScrollView style={{ maxHeight: 256 }}>
                      <View style={{ gap: 12 }}>
                        {[...paymentHistory]
                          .sort(
                            (a, b) =>
                              new Date(b.paymentDate || b.createdAt) -
                              new Date(a.paymentDate || a.createdAt),
                          )
                          .map(payment => (
                            <PaymentHistoryItem
                              key={
                                payment._id ||
                                payment.createdAt ||
                                payment.paymentDate
                              }
                              payment={payment}
                              onUpdated={handlePaymentUpdated}
                            />
                          ))}
                      </View>
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ═══ REMINDER TAB ═══ */}
            {activeTab === 'Reminder' ? (
              <View style={styles.formContainer}>
                <FormRow columns={2}>
                  <FieldBlock label="Type">
                    <FieldPicker
                      value={form.reminderType}
                      options={REMINDER_TYPES}
                      onChange={v => handleChange('reminderType', v)}
                    />
                  </FieldBlock>
                  <FieldBlock label="Assign To">
                    <FieldPicker
                      value={form.reminderAssignedTo}
                      options={[
                        { value: '', label: 'Select Assignee' },
                        ...users.map(u => ({ value: u._id, label: u.name })),
                      ]}
                      onChange={v => handleChange('reminderAssignedTo', v)}
                    />
                  </FieldBlock>
                </FormRow>
                <FormRow columns={2}>
                  <FieldBlock label="Date">
                    <DateTimeField
                      value={form.reminderDate}
                      onChange={v => handleChange('reminderDate', v)}
                      openKey="reminderDate"
                      pickerTargets={pickerTargets}
                      setPickerTargets={setPickerTargets}
                    />
                  </FieldBlock>
                  <FieldBlock label="Time">
                    <DateTimeField
                      value={form.reminderTime}
                      onChange={v => handleChange('reminderTime', v)}
                      openKey="reminderTime"
                      pickerTargets={pickerTargets}
                      setPickerTargets={setPickerTargets}
                      mode="time"
                    />
                  </FieldBlock>
                </FormRow>
                <FieldBlock label="Note">
                  <TextInput
                    value={form.reminderNote}
                    onChangeText={v => handleChange('reminderNote', v)}
                    placeholder="Reminder note"
                    style={styles.input}
                  />
                </FieldBlock>
                <FieldBlock label="Also notify">
                  <FieldPicker
                    value={form.reminderNotify}
                    options={[
                      { value: '', label: 'None' },
                      ...users.map(u => ({ value: u._id, label: u.name })),
                    ]}
                    onChange={v => handleChange('reminderNotify', v)}
                  />
                </FieldBlock>
              </View>
            ) : null}

            {/* ═══ CROSS-SELL TAB ═══ */}
            {activeTab === 'Cross-Sell' ? (
              <SuccessServiceSelector lead={lead} onSaved={onClose} isSuccess />
            ) : null}

            {/* Footer buttons */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={submitting}
                onPress={handleSubmit}
                style={[styles.submitBtn, submitting && styles.disabled]}
              >
                <Text style={styles.submitBtnText}>
                  {submitting
                    ? 'Saving...'
                    : lead
                    ? 'Update Lead'
                    : 'Create Lead'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ── Small inline sub-components ──
const FieldPicker = ({ value, options, onChange, emptyLabel, disabled }) => {
  const items = Array.isArray(options)
    ? options.map(opt => {
        const val = typeof opt === 'object' ? opt.value ?? opt : opt;
        const label =
          typeof opt === 'object' ? opt.label ?? opt.value ?? opt : opt;
        return { value: val, label };
      })
    : [];

  return (
    <View style={[fpStyles.wrap, disabled && fpStyles.disabled]}>
      <Picker
        enabled={!disabled}
        selectedValue={value ?? ''}
        onValueChange={v => onChange(v)}
        style={fpStyles.picker}
        mode="dropdown"
      >
        {emptyLabel ? <Picker.Item label={emptyLabel} value="" /> : null}
        {items.map(opt => (
          <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
        ))}
      </Picker>
    </View>
  );
};

const fpStyles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    minHeight: 44,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: { minHeight: 44, color: '#111827' },
  disabled: { opacity: 0.6 },
});

const DateTimeField = ({
  value,
  onChange,
  openKey,
  pickerTargets,
  setPickerTargets,
  mode = 'date',
}) => {
  const open = pickerTargets?.[openKey] === mode;
  const parseValue = () => {
    if (!value) return new Date();
    if (mode === 'time') {
      const [h, m] = String(value).split(':');
      const d = new Date();
      d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
      return d;
    }
    return new Date(`${value}T00:00:00`);
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setPickerTargets(p => ({ ...p, [openKey]: mode }))}
        style={dtfStyles.btn}
      >
        <Text style={dtfStyles.text}>
          {value || (mode === 'time' ? 'Select time' : 'Select date')}
        </Text>
        <Icon
          name={mode === 'time' ? 'clock-outline' : 'calendar'}
          size={16}
          color="#64748b"
        />
      </TouchableOpacity>
      {open ? (
        <DateTimePicker
          value={parseValue()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={mode === 'date' ? new Date() : undefined}
          onValueChange={(event, selectedDate) => {
            if (event?.type === 'dismissed') return;
            setPickerTargets(p => ({ ...p, [openKey]: null }));
            if (selectedDate) {
              if (mode === 'time') onChange(toInputTime(selectedDate));
              else onChange(toInputDate(selectedDate));
            }
          }}
          onDismiss={() => {
            setPickerTargets(p => ({ ...p, [openKey]: null }));
          }}
        />
      ) : null}
    </View>
  );
};

const dtfStyles = StyleSheet.create({
  btn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { fontSize: 13, color: '#111827' },
});

// ── Styles ──
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalBody: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  headerTextWrap: { flex: 1, paddingRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsScroll: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabsInner: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#4b5563' },
  tabTextActive: { color: '#5a7bf6' },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#5a7bf6',
    borderRadius: 2,
  },
  formScroll: { paddingBottom: 24 },
  formContainer: { padding: 20, gap: 14 },
  formRow: { gap: 14 },
  formRow2: { flexDirection: 'row', gap: 14 },
  fieldBlock: { flex: 1 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  reqStar: { color: '#ef4444' },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  warningText: { marginTop: 8, fontSize: 13, color: '#d97706' },
  warningTextCenter: {
    marginTop: 10,
    fontSize: 12,
    color: '#d97706',
    textAlign: 'center',
  },
  coAssignBox: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 16,
    marginTop: 6,
  },
  activityTypeHeader: { marginBottom: 14, gap: 8 },
  typeScroll: { marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'relative',
  },
  typePillInactive: { backgroundColor: '#f3f4f6' },
  typePillText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  typePillTextActive: { color: '#fff' },
  typePillDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  activityForm: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 16,
    gap: 14,
  },
  activityFormTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  callGrid: { flexDirection: 'row', gap: 10 },
  taskGrid: { flexDirection: 'row', gap: 14 },
  clearLink: { color: '#f87171', fontSize: 12 },
  recentBlock: { marginTop: 16, gap: 12, maxHeight: 256 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recentTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentDivider: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  recentCount: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recentCountText: { fontSize: 11, color: '#6b7280' },
  recentItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 12,
    gap: 6,
  },
  recentItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  recentIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentType: { fontSize: 13, fontWeight: '500', color: '#1f2937' },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  outcomeDot: { width: 6, height: 6, borderRadius: 999 },
  outcomeText: { fontSize: 10, fontWeight: '600' },
  recentBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recentBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  recentText: { fontSize: 12, color: '#4b5563', lineHeight: 17 },
  recentMeta: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  recordingBlock: { gap: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  orText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  uploadZone: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 100,
    backgroundColor: '#fff',
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  uploadHint: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  fileSize: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  fileRemove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: { gap: 6 },
  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 11, color: '#6b7280' },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: '#5a7bf6' },
  uploadBtn: {
    borderRadius: 12,
    backgroundColor: '#5a7bf6',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  savedRecsBlock: { marginTop: 20, gap: 12 },
  savedRecsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedRecsTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  savedRecItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  savedRecTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  savedRecIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(90,123,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedRecInfo: { flex: 1 },
  savedRecLabel: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  savedRecMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  savedRecActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(90,123,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recActionBtnGray: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recActionBtnRed: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaContainer: { paddingHorizontal: 12, paddingBottom: 12 },
  mediaPlayer: {
    width: '100%',
    height: 180,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  emptyRecording: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyRecordingText: { fontSize: 13, color: '#9ca3af' },
  paymentHistoryBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 16,
    marginTop: 6,
  },
  paymentHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  paymentHistoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  cancelBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  submitBtn: {
    borderRadius: 12,
    backgroundColor: '#5a7bf6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#818cf8',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default LeadFormModal;
