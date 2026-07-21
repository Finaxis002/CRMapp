import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Platform,
  Linking,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pick } from '@react-native-documents/picker';
import Video from 'react-native-video';
import axios from 'axios';

// ── UI Kit ──
import { useUISystem } from '../../hooks/useUISystem';
import { FormField, FormRow } from '../ui/FormField';
import FormSection from '../ui/FormSection';
import ImprovedTextInput from '../ui/ImprovedTextInput';
import ImprovedButton from '../ui/ImprovedButton';
import ImprovedDropdown from '../ui/ImprovedDropdown';
import CheckboxRow from '../ui/CheckboxRow';
import DateField from '../ui/DateField';
import EmptyState from '../ui/EmptyState';
import IconButton from '../ui/IconButton';

// ── App components ──
import CustomPhoneInput from '../ui/PhoneInput.jsx';
import MultiSelect from '../ui/MultiSelect';
import PaymentHistoryItem from '../common/LeadFormModel/PaymentHistoryItem.jsx';
import api from '../../services/api.js';
import CallLogCard from '../../services/callLogCard.js';

// ── Toast ──
import { useToast as useKitToast } from '../ui/CustomToast';

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
// DateTimeField
// ════════════════════════════════════════════════════════════════
const DateTimeField = React.memo(
  ({
    value,
    onChange,
    openKey,
    pickerTargets,
    setPickerTargets,
    mode = 'date',
    minimumDate,
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
        <DateField
          value={value}
          mode={mode}
          onPress={() => setPickerTargets(p => ({ ...p, [openKey]: mode }))}
        />
        {open ? (
          <DateTimePicker
            value={parseValue()}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            onChange={(event, selectedDate) => {
              if (event?.type === 'dismissed') {
                setPickerTargets(p => ({ ...p, [openKey]: null }));
                return;
              }
              setPickerTargets(p => ({ ...p, [openKey]: null }));
              if (selectedDate) {
                if (mode === 'time') onChange(toInputTime(selectedDate));
                else onChange(toInputDate(selectedDate));
              }
            }}
          />
        ) : null}
      </View>
    );
  },
);

// ════════════════════════════════════════════════════════════════
// SuccessServiceSelector
// ════════════════════════════════════════════════════════════════
const SuccessServiceSelector = ({ lead, onSaved, toast }) => {
  const { colors, spacing } = useUISystem();
  const [availableServices, setAvailableServices] = useState(
    ALL_CROSS_SELL_SERVICES,
  );
  const [selectedServices, setSelectedServices] = useState(
    lead?.crossSellRecord?.reactivationServices || [],
  );
  const [reactivationDate, setReactivationDate] = useState('');
  const [reactivationTime, setReactivationTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

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
    <View style={{ gap: spacing.sm }}>
      <FormSection title="Select Services">
        <View style={{ gap: 4 }}>
          {availableServices.map(svc => (
            <CheckboxRow
              key={svc}
              label={svc}
              checked={selectedServices.includes(svc)}
              onPress={() => toggleService(svc)}
            />
          ))}
        </View>
      </FormSection>

      <FormSection
        title="Reactivation Date & Time"
        description="On this date and time, the lead will automatically move to 'New'."
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <DateField
              value={reactivationDate}
              placeholder="Select date"
              onPress={() => setPickerTarget('date')}
            />
          </View>
          <View style={{ width: 112 }}>
            <DateField
              value={reactivationTime}
              mode="time"
              placeholder="Select time"
              onPress={() => setPickerTarget('time')}
            />
          </View>
        </View>
        {pickerTarget === 'date' && (
          <DateTimePicker
            value={
              reactivationDate
                ? new Date(`${reactivationDate}T00:00:00`)
                : new Date()
            }
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={(event, selectedDate) => {
              if (event?.type === 'dismissed') {
                setPickerTarget(null);
                return;
              }
              setPickerTarget(null);
              if (selectedDate) setReactivationDate(toInputDate(selectedDate));
            }}
          />
        )}
        {pickerTarget === 'time' && (
          <DateTimePicker
            value={
              reactivationTime
                ? new Date(`2000-01-01T${reactivationTime}:00`)
                : new Date()
            }
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (event?.type === 'dismissed') {
                setPickerTarget(null);
                return;
              }
              setPickerTarget(null);
              if (selectedDate) setReactivationTime(toInputTime(selectedDate));
            }}
          />
        )}
      </FormSection>

      <ImprovedButton
        title={
          selectedServices.length > 0
            ? `Save (${selectedServices.length} service${
                selectedServices.length > 1 ? 's' : ''
              })`
            : 'Please select services first'
        }
        onPress={handleSave}
        loading={saving}
        disabled={saving || selectedServices.length === 0 || !reactivationDate}
        fullWidth
        size="medium"
      />
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// LeadFormModal - MAIN COMPONENT
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
  const { colors, typography, spacing, borderRadius, isDark } = useUISystem();
  const insets = useSafeAreaInsets();
  const toast = useKitToast();

  const [activeTab, setActiveTab] = useState(initialTab || 'Profile');
  const [submitting, setSubmitting] = useState(false);
  const [activeActivityType, setActiveActivityType] = useState('Note');
  const [recordingFile, setRecordingFile] = useState(null);
  const [uploadingRec, setUploadingRec] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState([]);
  const [playingUrl, setPlayingUrl] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState(
    Array.isArray(lead?.payments) ? lead.payments : [],
  );
  const [pickerTargets, setPickerTargets] = useState({});
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

  const statusItems = defaultStatusOptions.map(s => ({ value: s, label: s }));
  const sourceItems = defaultSourceOptions.map(s => ({ value: s, label: s }));
  const priorityItems = PRIORITY_OPTIONS.map(p => ({ value: p, label: p }));
  const userItems = users.map(u => ({ value: u._id, label: u.name }));
  const paymentModeItems = PAYMENT_MODES.map(m => ({ value: m, label: m }));
  const paymentStatusItems = PAYMENT_STATUS.map(s => ({ value: s, label: s }));
  const reminderTypeItems = REMINDER_TYPES.map(r => ({ value: r, label: r }));

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

  const allTabs = useMemo(
    () => [
      ...TABS,
      ...(form.status === 'Success' || lead?.isCrossSell ? ['Cross-Sell'] : []),
    ],
    [form.status, lead?.isCrossSell],
  );

  useEffect(() => {
    if (visible && !allTabs.includes(activeTab)) setActiveTab('Profile');
  }, [allTabs, activeTab, visible]);

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

    const pendingReminders = Array.isArray(lead.reminders)
      ? lead.reminders.filter(r => !r.isDone)
      : [];
    const latestReminder = pendingReminders.length
      ? [...pendingReminders].sort((a, b) => {
          const aDate = new Date(a.reminderDate || a.createdAt || 0);
          const bDate = new Date(b.reminderDate || b.createdAt || 0);
          if (bDate.getTime() !== aDate.getTime()) return bDate - aDate;
          return (b.reminderTime || '00:00').localeCompare(
            a.reminderTime || '00:00',
          );
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

  const handleChange = useCallback((key, value) => {
    setForm(prev => {
      const nextForm = { ...prev, [key]: value };
      if (key === 'assignedTo')
        nextForm.coAssignees = prev.coAssignees.filter(id => id !== value);
      return nextForm;
    });
  }, []);

  const handleCustomFieldChange = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [key]: value },
    }));
  }, []);

  const updateActivity = useCallback((type, key, val) => {
    setActivities(prev => ({ ...prev, [type]: { ...prev[type], [key]: val } }));
  }, []);

  // ── buildPayload ──
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
    if (activities.Note.text.trim() || activities.Note._id)
      activitiesPayload.push({
        _id: activities.Note._id || undefined,
        type: 'Note',
        text: activities.Note.text.trim(),
        notifiedUsers: activities.Note.notify ? [activities.Note.notify] : [],
      });
    if (
      activities.Call.text.trim() ||
      activities.Call.duration.trim() ||
      activities.Call._id
    )
      activitiesPayload.push({
        _id: activities.Call._id || undefined,
        type: 'Call',
        text: activities.Call.text.trim(),
        callDuration: activities.Call.duration.trim() || '',
        callDirection: activities.Call.direction,
        callOutcome: activities.Call.outcome,
        notifiedUsers: activities.Call.notify ? [activities.Call.notify] : [],
      });
    if (activities.Email.text.trim() || activities.Email._id)
      activitiesPayload.push({
        _id: activities.Email._id || undefined,
        type: 'Email',
        text: activities.Email.text.trim(),
        notifiedUsers: activities.Email.notify ? [activities.Email.notify] : [],
      });
    if (activities.Meeting.text.trim() || activities.Meeting._id)
      activitiesPayload.push({
        _id: activities.Meeting._id || undefined,
        type: 'Meeting',
        text: activities.Meeting.text.trim(),
        notifiedUsers: activities.Meeting.notify
          ? [activities.Meeting.notify]
          : [],
      });
    if (
      activities.Task.text.trim() ||
      activities.Task.dueDate ||
      activities.Task._id
    )
      activitiesPayload.push({
        _id: activities.Task._id || undefined,
        type: 'Task',
        text: activities.Task.text.trim(),
        taskDueDate: activities.Task.dueDate || '',
        taskAssignedTo: activities.Task.assignedTo || undefined,
        notifiedUsers: activities.Task.notify ? [activities.Task.notify] : [],
      });
    if (activitiesPayload.length > 0) payload.activities = activitiesPayload;

    const recLabel = form.recordingLabel.trim();
    const recUrl = form.recordingUrl.trim();
    if (recLabel || recUrl)
      payload.recording = { label: recLabel, url: recUrl };

    if (form.paymentAmount.trim())
      payload.payment = {
        amount: Number(form.paymentAmount),
        paymentMode: form.paymentMode,
        status: form.paymentStatus,
        reference: form.paymentReference.trim() || undefined,
        paymentDate: form.paymentDate || undefined,
      };

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
          : existingReminder.notifyUsers[0]?._id || ''
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

  // ── Recording handlers ──
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
      toast.success('Recording deleted successfully.');
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Failed to delete recording.',
      );
    }
  };

  // ── Submit ──
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
    if (altDigits.length > 0 && altDigits.length > 2 && altDigits.length < 10) {
      toast.error('Please enter a valid alternate phone number.');
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

    if (activeTab === 'Cross-Sell') return;

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
            { headers: { Authorization: `Bearer ${token}` } },
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

  const activeAct = activities[activeActivityType];

  // ── RENDER ──
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <View
        style={[
          styles.modalSafeArea,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalBody, { backgroundColor: colors.surface }]}
        >
          {/* ── Compact Header ── */}
          <View
            style={[
              styles.headerBar,
              {
                borderBottomColor: colors.border,
                paddingHorizontal: 12,
                paddingVertical: 10,
              },
            ]}
          >
            <IconButton
              name="arrow-left"
              size={18}
              color={colors.textPrimary}
              backgroundColor={colors.backgroundSecondary}
              onPress={onClose}
              style={{ width: 30, height: 30, borderRadius: 15 }}
            />
            <Text
              style={[
                typography.h3,
                {
                  color: colors.textPrimary,
                  fontSize: 15,
                  fontWeight: '700',
                  flex: 1,
                },
              ]}
              numberOfLines={1}
            >
              {lead ? 'Edit Lead' : 'Add New Lead'}
            </Text>
          </View>

          {/* ── Compact Tabs ── */}
          <View
            style={[styles.tabsContainer, { borderBottomColor: colors.border }]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsInner}
            >
              {allTabs.map(tab => {
                const active = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={styles.tabBtn}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: active ? colors.primary : colors.textSecondary,
                          fontWeight: active ? '700' : '500',
                          fontSize: 12,
                        },
                      ]}
                    >
                      {tab}
                    </Text>
                    {active ? (
                      <View
                        style={[
                          styles.tabIndicator,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
            style={{ flex: 1, backgroundColor: colors.surface }}
          >
            {/* ═══════════════ PROFILE TAB ═══════════════ */}
            {activeTab === 'Profile' && (
              <View style={styles.formContainer}>
                <FormField label="Full Name" required>
                  <ImprovedTextInput
                    value={form.name}
                    onChangeText={v => handleChange('name', v)}
                    placeholder="Contact name"
                    size="medium"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </FormField>
                <FormField label="Primary Phone" required>
                  <CustomPhoneInput
                    value={form.phone}
                    onChange={fullNumber => handleChange('phone', fullNumber)}
                    defaultCountry="IN"
                  />
                </FormField>
                <FormRow columns={2}>
                  <FormField label="Status">
                    <ImprovedDropdown
                      items={statusItems}
                      selectedValue={form.status}
                      onValueChange={v => handleChange('status', v)}
                      placeholder="Select status"
                      searchable={false}
                    />
                  </FormField>
                  <FormField label="Priority">
                    <ImprovedDropdown
                      items={priorityItems}
                      selectedValue={form.priority}
                      onValueChange={v => handleChange('priority', v)}
                      placeholder="Priority"
                      searchable={false}
                    />
                  </FormField>
                </FormRow>
                <FormRow columns={2}>
                  <FormField label="Source">
                    <ImprovedDropdown
                      items={sourceItems}
                      selectedValue={form.source}
                      onValueChange={v => handleChange('source', v)}
                      placeholder="Source"
                      searchable={false}
                    />
                  </FormField>
                  <FormField label="Deal Value (₹)">
                    <ImprovedTextInput
                      keyboardType="numeric"
                      value={form.dealValue}
                      onChangeText={v => handleChange('dealValue', v)}
                      placeholder="Deal value"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </FormField>
                </FormRow>
                <FormRow columns={2}>
                  <FormField label="City">
                    <ImprovedTextInput
                      value={form.city}
                      onChangeText={v => handleChange('city', v)}
                      placeholder="City"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </FormField>
                  <FormField label="Product">
                    <ImprovedTextInput
                      value={form.product}
                      onChangeText={v => handleChange('product', v)}
                      placeholder="Product"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </FormField>
                </FormRow>
                <FormRow columns={2}>
                  <FormField label="Email">
                    <ImprovedTextInput
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={form.email}
                      onChangeText={v => handleChange('email', v)}
                      placeholder="Email address"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </FormField>
                  <FormField label="Close Date">
                    <DateTimeField
                      value={form.closeDate}
                      onChange={v => handleChange('closeDate', v)}
                      openKey="closeDate"
                      pickerTargets={pickerTargets}
                      setPickerTargets={setPickerTargets}
                    />
                  </FormField>
                </FormRow>
                <FormField label="Alternate Phone (Optional)">
                  <CustomPhoneInput
                    value={form.alternatePhone || ''}
                    onChange={fullNumber =>
                      handleChange('alternatePhone', fullNumber)
                    }
                    defaultCountry="IN"
                  />
                </FormField>
                {customColumns
                  .filter(c => c.formVisible !== false)
                  .map(column => (
                    <FormField key={column.key} label={column.label}>
                      <ImprovedTextInput
                        value={form.customFields?.[column.key] || ''}
                        onChangeText={v =>
                          handleCustomFieldChange(column.key, v)
                        }
                        placeholder={`Enter ${column.label}`}
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </FormField>
                  ))}
                <FormField label="Initial Note">
                  <ImprovedTextInput
                    multiline
                    value={form.note}
                    onChangeText={v => handleChange('note', v)}
                    placeholder="Initial note or lead details"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </FormField>
              </View>
            )}

            {/* ═══════════════ ASSIGN TAB ═══════════════ */}
            {activeTab === 'Assign' && (
              <View style={styles.formContainer}>
                <FormField label="Primary Lead Owner" required>
                  <ImprovedDropdown
                    items={userItems}
                    selectedValue={form.assignedTo}
                    onValueChange={v => handleChange('assignedTo', v)}
                    placeholder="Select owner"
                    disabled={!canManageAssignment}
                  />
                  {!canManageAssignment && (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.warning, marginTop: 4, fontSize: 11 },
                      ]}
                    >
                      You do not have permission to change assignment.
                    </Text>
                  )}
                </FormField>
                <FormSection title="Co-Assignees">
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
                    isMulti
                    isClearable
                    maxMenuHeight={280}
                  />
                  {!canManageAssignment && (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.warning, marginTop: 4, fontSize: 11 },
                      ]}
                    >
                      Co-assignee assignment is restricted for your role.
                    </Text>
                  )}
                </FormSection>
              </View>
            )}

            {/* ═══════════════ ACTIVITY TAB ═══════════════ */}
            {activeTab === 'Activity' && (
              <View style={styles.formContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {Object.keys(ACTIVITY_TYPE_META).map(type => {
                      const meta = ACTIVITY_TYPE_META[type];
                      const act = activities[type];
                      const hasData =
                        act.text?.trim() || act.duration?.trim() || act.dueDate;
                      const isActive = activeActivityType === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setActiveActivityType(type)}
                          style={[
                            styles.typePill,
                            {
                              backgroundColor: isActive
                                ? meta.color
                                : colors.backgroundSecondary,
                              borderRadius: borderRadius.full,
                            },
                          ]}
                        >
                          <Icon
                            name={meta.icon}
                            size={12}
                            color={isActive ? '#fff' : colors.textSecondary}
                          />
                          <Text
                            style={[
                              typography.caption,
                              {
                                color: isActive ? '#fff' : colors.textPrimary,
                                fontSize: 11,
                                fontWeight: '600',
                              },
                            ]}
                          >
                            {type}
                          </Text>
                          {hasData ? (
                            <View
                              style={[
                                styles.typePillDot,
                                {
                                  borderColor: isActive
                                    ? meta.color
                                    : colors.surface,
                                },
                              ]}
                            />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <View
                  style={[
                    styles.activityForm,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      borderRadius: borderRadius.lg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.label,
                      {
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {activeActivityType} Activity
                  </Text>
                  <ImprovedTextInput
                    multiline
                    value={activeAct.text}
                    onChangeText={v =>
                      updateActivity(activeActivityType, 'text', v)
                    }
                    placeholder={
                      activeActivityType === 'Call'
                        ? 'Call summary — what was discussed?'
                        : 'Add details...'
                    }
                    containerStyle={{ marginBottom: 0 }}
                  />
                  {activeActivityType === 'Call' && (
                    <FormRow columns={1}>
                      <FormField label="Duration">
                        <ImprovedTextInput
                          value={activeAct.duration}
                          onChangeText={v =>
                            updateActivity('Call', 'duration', v)
                          }
                          placeholder="3m 42s"
                          containerStyle={{ marginBottom: 0 }}
                        />
                      </FormField>
                      <FormField label="Direction">
                        <ImprovedDropdown
                          items={['Outgoing', 'Incoming', 'Missed'].map(d => ({
                            value: d,
                            label: d,
                          }))}
                          selectedValue={activeAct.direction}
                          onValueChange={v =>
                            updateActivity('Call', 'direction', v)
                          }
                          searchable={false}
                        />
                      </FormField>
                      <FormField label="Outcome">
                        <ImprovedDropdown
                          items={['Spoke', 'No Answer', 'Left Voicemail'].map(
                            o => ({ value: o, label: o }),
                          )}
                          selectedValue={activeAct.outcome}
                          onValueChange={v =>
                            updateActivity('Call', 'outcome', v)
                          }
                          searchable={false}
                        />
                      </FormField>
                    </FormRow>
                  )}
                  {activeActivityType === 'Task' && (
                    <FormRow columns={1}>
                      <FormField label="Due Date" required>
                        <DateTimeField
                          value={activeAct.dueDate}
                          onChange={v => updateActivity('Task', 'dueDate', v)}
                          openKey="taskDueDate"
                          pickerTargets={pickerTargets}
                          setPickerTargets={setPickerTargets}
                        />
                      </FormField>
                      <FormField label="Assign To">
                        <ImprovedDropdown
                          items={userItems}
                          selectedValue={activeAct.assignedTo}
                          onValueChange={v =>
                            updateActivity('Task', 'assignedTo', v)
                          }
                        />
                      </FormField>
                    </FormRow>
                  )}
                  <FormField label="Notify">
                    <ImprovedDropdown
                      items={[{ value: '', label: 'No one' }, ...userItems]}
                      selectedValue={activeAct.notify}
                      onValueChange={v =>
                        updateActivity(activeActivityType, 'notify', v)
                      }
                      searchable={false}
                    />
                  </FormField>
                  {(activeAct.text?.trim() ||
                    activeAct.duration?.trim() ||
                    activeAct.dueDate) && (
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
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.danger, fontSize: 11 },
                        ]}
                      >
                        ✕ Clear {activeActivityType} data
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Recent Interactions */}
                {lead &&
                  Array.isArray(lead.activities) &&
                  lead.activities.length > 0 && (
                    <FormSection title="Recent Interactions">
                      {lead.activities.map((item, idx) => {
                        if (item.isAutoTracked)
                          return (
                            <View
                              key={item._id || idx}
                              style={{ marginBottom: 8 }}
                            >
                              <CallLogCard callLog={item} />
                            </View>
                          );

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
                        const st = iconMap[item.type] || iconMap.Status;
                        const userName =
                          typeof item.user === 'string'
                            ? item.user
                            : item.user?.name ||
                              item.createdBy?.name ||
                              item.userName ||
                              '—';

                        return (
                          <View
                            key={item._id || idx}
                            style={[
                              styles.recentItem,
                              {
                                borderColor: colors.border,
                                backgroundColor: colors.surface,
                                borderRadius: borderRadius.md,
                              },
                            ]}
                          >
                            <View style={styles.recentItemTop}>
                              <View
                                style={[
                                  styles.recentIcon,
                                  { backgroundColor: st.bg },
                                ]}
                              >
                                <Icon
                                  name={st.icon}
                                  size={11}
                                  color={st.text}
                                />
                              </View>
                              <Text
                                style={[
                                  typography.caption,
                                  {
                                    color: colors.textPrimary,
                                    fontSize: 11,
                                    fontWeight: '700',
                                  },
                                ]}
                              >
                                {item.type || 'Interaction'}
                              </Text>
                              {idx === 0 && (
                                <View
                                  style={[
                                    styles.recentBadge,
                                    { backgroundColor: colors.successSoft },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      typography.caption,
                                      {
                                        color: colors.success,
                                        fontWeight: '700',
                                        fontSize: 9,
                                      },
                                    ]}
                                  >
                                    Recent
                                  </Text>
                                </View>
                              )}
                            </View>
                            {item.text ? (
                              <Text
                                style={[
                                  typography.body2,
                                  {
                                    color: colors.textSecondary,
                                    fontSize: 11,
                                    lineHeight: 16,
                                  },
                                ]}
                              >
                                {item.text}
                              </Text>
                            ) : null}
                            <Text
                              style={[
                                typography.caption,
                                { color: colors.textTertiary, fontSize: 10 },
                              ]}
                            >
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
                    </FormSection>
                  )}
              </View>
            )}

            {/* ═══════════════ RECORDING TAB ═══════════════ */}
            {activeTab === 'Recording' && (
              <View style={styles.formContainer}>
                <FormSection title="Add New Recording">
                  <FormField label="Label">
                    <ImprovedTextInput
                      value={form.recordingLabel}
                      onChangeText={v => handleChange('recordingLabel', v)}
                      placeholder="First call · 30 Apr"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </FormField>
                  <FormField label="Recording URL">
                    <ImprovedTextInput
                      value={form.recordingUrl}
                      onChangeText={v => {
                        handleChange('recordingUrl', v);
                        if (recordingFile) setRecordingFile(null);
                      }}
                      placeholder="https://drive.google.com/..."
                      autoCapitalize="none"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </FormField>

                  <View style={styles.orDivider}>
                    <View
                      style={[
                        styles.orLine,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textTertiary, fontSize: 10 },
                      ]}
                    >
                      or upload a file
                    </Text>
                    <View
                      style={[
                        styles.orLine,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handlePickRecordingFile}
                    style={[
                      styles.uploadZone,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        borderRadius: borderRadius.lg,
                      },
                    ]}
                  >
                    {recordingFile ? (
                      <View style={styles.fileRow}>
                        <Icon
                          name="microphone"
                          size={20}
                          color={colors.primary}
                        />
                        <View style={styles.fileInfo}>
                          <Text
                            style={[
                              typography.caption,
                              {
                                color: colors.textPrimary,
                                fontWeight: '600',
                                fontSize: 12,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {recordingFile.name}
                          </Text>
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textTertiary, fontSize: 10 },
                            ]}
                          >
                            {(
                              (recordingFile.size || 0) /
                              (1024 * 1024)
                            ).toFixed(2)}{' '}
                            MB
                          </Text>
                        </View>
                        <IconButton
                          name="close"
                          size={14}
                          color={colors.danger}
                          onPress={() => setRecordingFile(null)}
                        />
                      </View>
                    ) : (
                      <>
                        <View
                          style={[
                            styles.uploadIconCircle,
                            { backgroundColor: colors.backgroundSecondary },
                          ]}
                        >
                          <Icon
                            name="upload"
                            size={18}
                            color={colors.textTertiary}
                          />
                        </View>
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: colors.textPrimary,
                              fontWeight: '600',
                              fontSize: 12,
                            },
                          ]}
                        >
                          Tap to select a file
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: colors.textTertiary,
                              textAlign: 'center',
                              fontSize: 10,
                            },
                          ]}
                        >
                          MP3, MP4, WAV, OGG, M4A, WebM · max 100MB
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {(recordingFile || form.recordingUrl.trim()) && lead?._id && (
                    <ImprovedButton
                      title={uploadingRec ? 'Uploading...' : 'Save Recording'}
                      onPress={handleRecordingUpload}
                      loading={uploadingRec}
                      disabled={uploadingRec}
                      size="medium"
                      fullWidth
                    />
                  )}
                  {!lead?._id &&
                    (recordingFile || form.recordingUrl.trim()) && (
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: colors.warning,
                            textAlign: 'center',
                            fontSize: 11,
                          },
                        ]}
                      >
                        ⚠️ Recording will be saved after the lead is created
                      </Text>
                    )}
                </FormSection>

                {savedRecordings.length > 0 && (
                  <FormSection
                    title={`Saved Recordings (${savedRecordings.length})`}
                  >
                    {savedRecordings.map((rec, idx) => {
                      const isVideo = /\.(mp4|webm|mov|avi|mkv)/i.test(
                        rec.url || '',
                      );
                      const isPlaying = playingUrl === rec.url;
                      return (
                        <View
                          key={rec._id || rec.url || idx}
                          style={[
                            styles.savedRecItem,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                              borderRadius: borderRadius.lg,
                            },
                          ]}
                        >
                          <View style={styles.savedRecTopRow}>
                            <View
                              style={[
                                styles.savedRecIcon,
                                { backgroundColor: colors.primarySoft },
                              ]}
                            >
                              <Icon
                                name={isVideo ? 'video-outline' : 'music'}
                                size={14}
                                color={colors.primary}
                              />
                            </View>
                            <View style={styles.savedRecInfo}>
                              <Text
                                style={[
                                  typography.caption,
                                  {
                                    color: colors.textPrimary,
                                    fontWeight: '600',
                                    fontSize: 12,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {rec.label ||
                                  rec.originalName ||
                                  `Recording ${idx + 1}`}
                              </Text>
                              {rec.uploadedAt && (
                                <Text
                                  style={[
                                    typography.caption,
                                    {
                                      color: colors.textTertiary,
                                      fontSize: 10,
                                    },
                                  ]}
                                >
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
                              )}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <IconButton
                                name={
                                  isPlaying
                                    ? 'stop-circle-outline'
                                    : 'play-circle-outline'
                                }
                                size={16}
                                color={colors.primary}
                                onPress={() =>
                                  setPlayingUrl(isPlaying ? null : rec.url)
                                }
                                backgroundColor={colors.primarySoft}
                                style={{
                                  borderRadius: 15,
                                  width: 30,
                                  height: 30,
                                }}
                              />
                              <IconButton
                                name="download"
                                size={14}
                                color={colors.textSecondary}
                                onPress={() => Linking.openURL(rec.url)}
                                backgroundColor={colors.backgroundSecondary}
                                style={{
                                  borderRadius: 15,
                                  width: 30,
                                  height: 30,
                                }}
                              />
                              <IconButton
                                name="trash-can-outline"
                                size={14}
                                color={colors.danger}
                                onPress={() => handleDeleteRecording(rec)}
                                backgroundColor={colors.dangerSoft}
                                style={{
                                  borderRadius: 15,
                                  width: 30,
                                  height: 30,
                                }}
                              />
                            </View>
                          </View>
                          {isPlaying && (
                            <View
                              style={{
                                paddingHorizontal: 10,
                                paddingBottom: 10,
                              }}
                            >
                              <Video
                                source={{ uri: rec.url }}
                                resizeMode="contain"
                                style={{
                                  width: '100%',
                                  height: 160,
                                  backgroundColor: '#000',
                                  borderRadius: borderRadius.md,
                                }}
                                controls
                                paused={!isPlaying}
                                playInBackground={false}
                                playWhenInactive={false}
                                ignoreSilentSwitch="ignore"
                              />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </FormSection>
                )}

                {savedRecordings.length === 0 &&
                  !recordingFile &&
                  !form.recordingUrl && (
                    <EmptyState
                      icon="microphone"
                      title="No recordings saved yet"
                    />
                  )}
              </View>
            )}

            {/* ═══════════════ PAYMENT TAB ═══════════════ */}
            {activeTab === 'Payment' && (
              <View style={styles.formContainer}>
                <FormRow columns={1}>
                  <FormField label="Amount (₹)">
                    <ImprovedTextInput
                      keyboardType="numeric"
                      value={form.paymentAmount}
                      onChangeText={v => handleChange('paymentAmount', v)}
                      placeholder="0"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </FormField>
                  <FormField label="Date">
                    <DateTimeField
                      value={form.paymentDate}
                      onChange={v => handleChange('paymentDate', v)}
                      openKey="paymentDate"
                      pickerTargets={pickerTargets}
                      setPickerTargets={setPickerTargets}
                    />
                  </FormField>
                  <FormField label="Mode">
                    <ImprovedDropdown
                      items={paymentModeItems}
                      selectedValue={form.paymentMode}
                      onValueChange={v => handleChange('paymentMode', v)}
                      searchable={false}
                    />
                  </FormField>
                </FormRow>
                <FormRow columns={1}>
                  <FormField label="Status">
                    <ImprovedDropdown
                      items={paymentStatusItems}
                      selectedValue={form.paymentStatus}
                      onValueChange={v => handleChange('paymentStatus', v)}
                      searchable={false}
                    />
                  </FormField>
                  <FormField label="Reference">
                    <ImprovedTextInput
                      value={form.paymentReference}
                      onChangeText={v => handleChange('paymentReference', v)}
                      placeholder="Transaction ID / UTR"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </FormField>
                </FormRow>
                {paymentHistory.length > 0 && (
                  <FormSection title="Payment History">
                    <ScrollView style={{ maxHeight: 220 }}>
                      <View style={{ gap: 8 }}>
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
                  </FormSection>
                )}
              </View>
            )}

            {/* ═══════════════ REMINDER TAB ═══════════════ */}
            {activeTab === 'Reminder' && (
              <View style={styles.formContainer}>
                <FormRow columns={1}>
                  <FormField label="Type">
                    <ImprovedDropdown
                      items={reminderTypeItems}
                      selectedValue={form.reminderType}
                      onValueChange={v => handleChange('reminderType', v)}
                      searchable={false}
                    />
                  </FormField>
                  <FormField label="Assign To">
                    <ImprovedDropdown
                      items={[
                        { value: '', label: 'Select Assignee' },
                        ...userItems,
                      ]}
                      selectedValue={form.reminderAssignedTo}
                      onValueChange={v => handleChange('reminderAssignedTo', v)}
                    />
                  </FormField>
                </FormRow>
                <FormRow columns={2}>
                  <FormField label="Date">
                    <DateTimeField
                      value={form.reminderDate}
                      onChange={v => handleChange('reminderDate', v)}
                      openKey="reminderDate"
                      pickerTargets={pickerTargets}
                      setPickerTargets={setPickerTargets}
                      minimumDate={new Date()}
                    />
                  </FormField>
                  <FormField label="Time">
                    <DateTimeField
                      value={form.reminderTime}
                      onChange={v => handleChange('reminderTime', v)}
                      openKey="reminderTime"
                      pickerTargets={pickerTargets}
                      setPickerTargets={setPickerTargets}
                      mode="time"
                    />
                  </FormField>
                </FormRow>
                <FormField label="Note">
                  <ImprovedTextInput
                    value={form.reminderNote}
                    onChangeText={v => handleChange('reminderNote', v)}
                    placeholder="Reminder note"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </FormField>
                <FormField label="Also notify">
                  <ImprovedDropdown
                    items={[{ value: '', label: 'None' }, ...userItems]}
                    selectedValue={form.reminderNotify}
                    onValueChange={v => handleChange('reminderNotify', v)}
                    searchable={false}
                  />
                </FormField>
              </View>
            )}

            {/* ═══════════════ CROSS-SELL TAB ═══════════════ */}
            {activeTab === 'Cross-Sell' && (
              <SuccessServiceSelector
                lead={lead}
                onSaved={onClose}
                toast={toast}
              />
            )}
          </ScrollView>

          {/* ── Compact Footer ── */}
          <View
            style={[
              styles.footerBar,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: 14,
                paddingVertical: 10,
              },
            ]}
          >
            <ImprovedButton
              title={
                submitting ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'
              }
              onPress={handleSubmit}
              variant="primary"
              size="medium"
              fullWidth
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ── Styles ──
const styles = StyleSheet.create({
  modalSafeArea: { flex: 1 },
  modalBody: { flex: 1, overflow: 'hidden' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footerBar: { borderTopWidth: StyleSheet.hairlineWidth },
  tabsContainer: {
    maxHeight: 38,
    flexGrow: 0,
    flexShrink: 0,
  },
  tabsInner: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    gap: 2,
    alignItems: 'center',
  },
  tabBtn: {
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 10,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 2,
  },
  formContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'relative',
  },
  typePillDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
  },
  activityForm: { borderWidth: 1, padding: 12, gap: 10 },
  recentItem: { borderWidth: 1, padding: 10, gap: 4, marginBottom: 8 },
  recentItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  recentIcon: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orLine: { flex: 1, height: 1 },
  uploadZone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 84,
  },
  uploadIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  fileInfo: { flex: 1 },
  savedRecItem: { borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  savedRecTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  savedRecIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedRecInfo: { flex: 1 },
});

export default LeadFormModal;
