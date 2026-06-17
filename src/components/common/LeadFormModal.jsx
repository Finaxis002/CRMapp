import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Feather from 'react-native-vector-icons/Feather';
import Video from 'react-native-video';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';

import CustomPhoneInput from '../ui/PhoneInput';
import MultiSelect from '../ui/MultiSelect';
import PaymentHistoryItem from './LeadFormModel/PaymentHistoryItem';
import api from '../../services/api';

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

const getUserId = user =>
  typeof user === 'string' ? user : user?._id || user?.id || '';

const formatDateInput = value => {
  if (!value) return '';
  try {
    return new Date(value).toISOString().split('T')[0];
  } catch {
    return String(value).split('T')[0];
  }
};

const getFileName = file => file?.name || file?.originalName || 'recording';
const isVideoUrl = url => /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url || '');

const showError = message => Alert.alert('Error', message);
const showSuccess = message => Alert.alert('Success', message);

const dateFromInput = dateString => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const timeFromInput = timeString => {
  const [hours = '10', minutes = '00'] = String(timeString || '10:00').split(
    ':',
  );
  const date = new Date();
  date.setHours(Number(hours) || 10, Number(minutes) || 0, 0, 0);
  return date;
};

const SuccessServiceSelector = forwardRef(({ lead, onSaved }, ref) => {
  const [availableServices, setAvailableServices] = useState(
    ALL_CROSS_SELL_SERVICES,
  );
  const [selectedServices, setSelectedServices] = useState(
    lead?.crossSellRecord?.reactivationServices || [],
  );
  const [reactivationDate, setReactivationDate] = useState('');
  const [reactivationTime, setReactivationTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(null); // 'reactivationDate' | 'reactivationTime'

  useEffect(() => {
    setSelectedServices(lead?.crossSellRecord?.reactivationServices || []);
  }, [lead?.crossSellRecord?.reactivationServices]);

  useEffect(() => {
    if (!lead?._id) return;

    api
      .get(`/cross-sell/recommendations/${lead._id}`)
      .then(res => {
        const record = res.data?.data;
        if (record?.reactivationServices?.length) {
          setSelectedServices(record.reactivationServices);
        }
        if (record?.reactivationDate) {
          const utc = new Date(record.reactivationDate);
          const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
          const iso = ist.toISOString();
          setReactivationDate(iso.split('T')[0]);
          setReactivationTime(iso.split('T')[1].slice(0, 5));
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
      prev.includes(svc) ? prev.filter(item => item !== svc) : [...prev, svc],
    );
  };

  const handleSave = useCallback(async () => {
    if (!lead?._id) {
      showError('Please save the lead first.');
      return false;
    }
    if (selectedServices.length === 0) {
      showError('Please select at least one service.');
      return false;
    }
    if (!reactivationDate) {
      showError('Please select a reactivation date.');
      return false;
    }

    setSaving(true);
    try {
      await api.post(`/cross-sell/schedule-reactivation/${lead._id}`, {
        services: selectedServices,
        reactivationDate: new Date(
          `${reactivationDate}T${reactivationTime || '09:00'}:00+05:30`,
        ).toISOString(),
      });
      showSuccess('Services and reactivation date saved successfully.');
      if (onSaved) onSaved();
      return true;
    } catch (err) {
      showError(err?.response?.data?.message || 'Save failed.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    lead?._id,
    onSaved,
    reactivationDate,
    reactivationTime,
    selectedServices,
  ]);

  useImperativeHandle(ref, () => ({ handleSave, saving }), [
    handleSave,
    saving,
  ]);

  const handlePickerChange = (event, selectedDate) => {
    const target = showPicker;
    setShowPicker(null);
    if (Platform.OS === 'android' && event?.type === 'dismissed') return;
    if (!selectedDate || !target) return;

    if (target === 'reactivationDate') {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setReactivationDate(`${y}-${m}-${d}`);
    } else {
      const h = String(selectedDate.getHours()).padStart(2, '0');
      const m = String(selectedDate.getMinutes()).padStart(2, '0');
      setReactivationTime(`${h}:${m}`);
    }
  };

  return (
    <View style={styles.tabContent}>
      <Text style={styles.subHeading}>Select Cross-Sell Services</Text>
      <Text style={styles.helpText}>
        Select services and a reactivation time. On that date, the lead will
        move back to “New”.
      </Text>

      <View style={styles.serviceList}>
        {availableServices.map(service => {
          const checked = selectedServices.includes(service);
          return (
            <TouchableOpacity
              key={service}
              style={[styles.serviceRow, checked && styles.serviceRowSelected]}
              onPress={() => toggleService(service)}
              activeOpacity={0.8}
            >
              <View
                style={[styles.checkbox, checked && styles.checkboxSelected]}
              >
                {checked ? (
                  <Feather name="check" size={13} color="#fff" />
                ) : null}
              </View>
              <Text style={styles.serviceText}>{service}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Reactivation Date & Time</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.dateSelectorButton, styles.flexOne]}
          onPress={() => setShowPicker('reactivationDate')}
        >
          <Text
            style={[
              styles.dateSelectorText,
              reactivationDate ? styles.dateSet : styles.datePlaceholder,
            ]}
          >
            {reactivationDate || 'Select Date'}
          </Text>
          <Feather name="calendar" size={16} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateSelectorButton, styles.flexOne]}
          onPress={() => setShowPicker('reactivationTime')}
        >
          <Text
            style={[
              styles.dateSelectorText,
              reactivationTime ? styles.dateSet : styles.datePlaceholder,
            ]}
          >
            {reactivationTime || '09:00'}
          </Text>
          <Feather name="clock" size={16} color="#64748b" />
        </TouchableOpacity>
      </View>

      {saving ? (
        <ActivityIndicator style={{ marginTop: 16 }} color="#5a7bf6" />
      ) : null}

      {showPicker ? (
        <DateTimePicker
          value={
            showPicker === 'reactivationDate'
              ? dateFromInput(reactivationDate)
              : timeFromInput(reactivationTime)
          }
          mode={showPicker === 'reactivationDate' ? 'date' : 'time'}
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={
            showPicker === 'reactivationDate' ? new Date() : undefined
          }
          onChange={handlePickerChange}
        />
      ) : null}
    </View>
  );
});

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
  const [form, setForm] = useState({});
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [savedRecordings, setSavedRecordings] = useState([]);
  const [recordingFile, setRecordingFile] = useState(null);
  const [uploadingRec, setUploadingRec] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [playingUrl, setPlayingUrl] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateTarget, setDateTarget] = useState(null);
  const crossSellRef = useRef(null);
  const isFirstOpen = useRef(true);

  const canManageAssignment = canAssignLead || canChangeLeadOwner;
  const customColumns = useMemo(
    () =>
      Array.isArray(settings?.customColumns) ? settings.customColumns : [],
    [settings?.customColumns],
  );
  const defaultStatusOptions = useMemo(
    () => (statusOptions.length ? statusOptions : DEFAULT_STATUS_OPTIONS),
    [statusOptions],
  );
  const defaultSourceOptions = useMemo(
    () => (sourceOptions.length ? sourceOptions : DEFAULT_SOURCE_OPTIONS),
    [sourceOptions],
  );

  const initialFormState = useMemo(
    () => ({
      name: '',
      phone: '',
      alternatePhone: '',
      email: '',
      city: '',
      source: defaultSourceOptions[0] || '',
      status: defaultStatusOptions[0] || 'New',
      dealValue: '',
      product: '',
      closeDate: '',
      priority: 'Normal',
      note: '',
      assignedTo: currentUserId || users[0]?._id || '',
      coAssignees: [],
      activeActivityType: 'Note',
      activities: {
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
        Task: {
          _id: '',
          text: '',
          dueDate: '',
          assignedTo: users[0]?._id || '',
          notify: '',
        },
      },
      recordingLabel: '',
      recordingUrl: '',
      paymentAmount: '',
      paymentDate: '',
      paymentMode: 'UPI',
      paymentStatus: 'Paid',
      paymentReference: '',
      customFields: customColumns.reduce((acc, col) => {
        acc[col.key] = '';
        return acc;
      }, {}),
      reminderType: 'Call',
      reminderAssignedTo: '',
      reminderDate: '',
      reminderTime: '10:00',
      reminderNote: '',
      reminderNotify: '',
    }),
    [
      currentUserId,
      users?.[0]?._id,
      customColumns,
      defaultSourceOptions,
      defaultStatusOptions,
    ],
  );

  const getLeadAssignee = leadItem => {
    if (!leadItem || !leadItem.assignedTo) return '';
    if (typeof leadItem.assignedTo === 'string') return leadItem.assignedTo;
    return leadItem.assignedTo._id || leadItem.assignedTo.id || '';
  };

  const buildFormStateFromLead = leadItem => {
    const pendingReminders = Array.isArray(leadItem.reminders)
      ? leadItem.reminders.filter(reminder => !reminder.isDone)
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

    const typeMap = {};
    if (Array.isArray(leadItem.activities)) {
      [...leadItem.activities]
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0) -
            new Date(a.updatedAt || a.createdAt || 0),
        )
        .forEach(act => {
          if (act?.type && !typeMap[act.type]) typeMap[act.type] = act;
        });
    }

    const activities = {
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
        dueDate: formatDateInput(typeMap.Task?.taskDueDate),
        assignedTo:
          getUserId(typeMap.Task?.taskAssignedTo) || users[0]?._id || '',
        notify: getUserId(typeMap.Task?.notifiedUsers?.[0]) || '',
      },
    };

    return {
      ...initialFormState,
      name: leadItem.name || '',
      phone: leadItem.phone || '',
      alternatePhone: leadItem.alternatePhone || '',
      email: leadItem.email || '',
      city: leadItem.city || '',
      source: leadItem.source || defaultSourceOptions[0] || '',
      status: leadItem.status ?? defaultStatusOptions[0] ?? 'New',
      dealValue:
        leadItem.dealValue !== undefined && leadItem.dealValue !== null
          ? String(leadItem.dealValue)
          : leadItem.value !== undefined && leadItem.value !== null
          ? String(leadItem.value)
          : '',
      product: leadItem.product || '',
      closeDate: formatDateInput(leadItem.closeDate),
      priority: leadItem.priority || 'Normal',
      note: leadItem.initialNote || '',
      assignedTo: getLeadAssignee(leadItem) || initialFormState.assignedTo,
      coAssignees: Array.isArray(leadItem.coAssignees)
        ? leadItem.coAssignees.map(getUserId).filter(Boolean)
        : [],
      activeActivityType: 'Note',
      activities,
      customFields: customColumns.reduce((acc, col) => {
        acc[col.key] = String(leadItem.customFields?.[col.key] ?? '');
        return acc;
      }, {}),
      paymentAmount: '',
      paymentDate: '',
      paymentMode: 'UPI',
      paymentStatus: 'Paid',
      paymentReference: '',
      recordingLabel: leadItem.recording?.label || '',
      recordingUrl: leadItem.recording?.url || '',
      reminderType: latestReminder?.type || 'Call',
      reminderAssignedTo: getUserId(latestReminder?.assignedTo) || '',
      reminderDate: formatDateInput(latestReminder?.reminderDate),
      reminderTime: latestReminder?.reminderTime || '10:00',
      reminderNote: latestReminder?.note || '',
      reminderNotify:
        latestReminder?.notifyUsers?.length > 0
          ? getUserId(latestReminder.notifyUsers[0])
          : '',
    };
  };

  useEffect(() => {
    if (!visible) {
      setRecordingFile(null);
      setPlayingUrl(null);
      setUploadProgress(0);
      isFirstOpen.current = true;
      return;
    }

    if (!lead) {
      setForm(initialFormState);
      setPaymentHistory([]);
      setSavedRecordings([]);
      setActiveTab('Profile');
    } else {
      setForm(buildFormStateFromLead(lead));
      setPaymentHistory(Array.isArray(lead.payments) ? lead.payments : []);
      setSavedRecordings(Array.isArray(lead.recordings) ? lead.recordings : []);
      if (isFirstOpen.current) {
        setActiveTab(initialTab || 'Profile');
        isFirstOpen.current = false;
      } else if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [visible, lead, initialFormState]);

  useEffect(() => {
    setPaymentHistory(Array.isArray(lead?.payments) ? lead.payments : []);
  }, [lead?.payments]);

  const allTabs = useMemo(
    () => [
      ...TABS,
      ...(form.status === 'Success' || lead?.isCrossSell ? ['Cross-Sell'] : []),
    ],
    [form.status, lead?.isCrossSell],
  );

  const handleChange = (key, value) => {
    setForm(prev => {
      const nextForm = { ...prev, [key]: value };
      if (key === 'assignedTo') {
        nextForm.coAssignees = (prev.coAssignees || []).filter(
          id => id !== value,
        );
      }
      return nextForm;
    });
  };

  const handleActivityChange = (type, key, value) => {
    setForm(prev => ({
      ...prev,
      activities: {
        ...prev.activities,
        [type]: { ...prev.activities?.[type], [key]: value },
      },
    }));
  };

  const handleCustomFieldChange = (key, value) => {
    setForm(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [key]: value },
    }));
  };

  const handlePickDocument = async () => {
    try {
      const results = await pick({
        type: [types.audio, types.video],
        allowMultiSelection: false,
      });
      const result = Array.isArray(results) ? results[0] : results;
      if (!result) return;

      setRecordingFile(result);
      handleChange('recordingUrl', '');
      if (!form.recordingLabel) {
        handleChange(
          'recordingLabel',
          getFileName(result).replace(/\.[^/.]+$/, ''),
        );
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED)
        return;
      showError('Unable to select audio/video file.');
    }
  };

  const triggerDatePicker = targetKey => {
    setDateTarget(targetKey);
    setShowDatePicker(true);
  };

  const handleDateConfirm = (event, selectedDate) => {
    setShowDatePicker(false);
    if (Platform.OS === 'android' && event?.type === 'dismissed') return;
    if (!selectedDate || !dateTarget) return;

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const isoString = `${year}-${month}-${day}`;

    if (dateTarget === 'taskDueDate') {
      handleActivityChange('Task', 'dueDate', isoString);
    } else {
      handleChange(dateTarget, isoString);
    }
  };

  const handleTimeConfirm = (event, selectedTime) => {
    setShowTimePicker(false);
    if (Platform.OS === 'android' && event?.type === 'dismissed') return;
    if (!selectedTime) return;

    const hours = String(selectedTime.getHours()).padStart(2, '0');
    const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
    handleChange('reminderTime', `${hours}:${minutes}`);
  };

  const buildPayload = () => {
    const altDigits = form.alternatePhone
      ? String(form.alternatePhone).replace(/\D/g, '')
      : '';

    const payload = {
      name: form.name?.trim(),
      phone: form.phone?.trim(),
      alternatePhone:
        altDigits.length >= 10 ? form.alternatePhone.trim() : undefined,
      email: form.email?.trim() || undefined,
      city: form.city?.trim() || undefined,
      source: form.source || 'Other',
      status: form.status || defaultStatusOptions[0] || 'New',
      dealValue: form.dealValue ? Number(form.dealValue) : undefined,
      product: form.product?.trim() || undefined,
      closeDate: form.closeDate || undefined,
      priority: form.priority,
      note: form.note?.trim(),
      coAssignees: lead
        ? form.coAssignees || []
        : form.coAssignees?.length
        ? form.coAssignees
        : undefined,
    };

    if (!lead) {
      payload.assignedTo = form.assignedTo || undefined;
    } else {
      const originalAssignee = getLeadAssignee(lead);
      if (form.assignedTo !== originalAssignee)
        payload.assignedTo = form.assignedTo;
    }

    const activitiesPayload = [];
    const activities = form.activities || {};

    if (activities.Note?.text?.trim() || activities.Note?._id) {
      activitiesPayload.push({
        _id: activities.Note._id || undefined,
        type: 'Note',
        text: activities.Note.text?.trim() || '',
        notifiedUsers: activities.Note.notify ? [activities.Note.notify] : [],
      });
    }

    if (
      activities.Call?.text?.trim() ||
      activities.Call?.duration?.trim() ||
      activities.Call?._id
    ) {
      activitiesPayload.push({
        _id: activities.Call._id || undefined,
        type: 'Call',
        text: activities.Call.text?.trim() || '',
        callDuration: activities.Call.duration?.trim() || '',
        callDirection: activities.Call.direction || 'Outgoing',
        callOutcome: activities.Call.outcome || 'Spoke',
        notifiedUsers: activities.Call.notify ? [activities.Call.notify] : [],
      });
    }

    if (activities.Email?.text?.trim() || activities.Email?._id) {
      activitiesPayload.push({
        _id: activities.Email._id || undefined,
        type: 'Email',
        text: activities.Email.text?.trim() || '',
        notifiedUsers: activities.Email.notify ? [activities.Email.notify] : [],
      });
    }

    if (activities.Meeting?.text?.trim() || activities.Meeting?._id) {
      activitiesPayload.push({
        _id: activities.Meeting._id || undefined,
        type: 'Meeting',
        text: activities.Meeting.text?.trim() || '',
        notifiedUsers: activities.Meeting.notify
          ? [activities.Meeting.notify]
          : [],
      });
    }

    if (
      activities.Task?.text?.trim() ||
      activities.Task?.dueDate ||
      activities.Task?._id
    ) {
      activitiesPayload.push({
        _id: activities.Task._id || undefined,
        type: 'Task',
        text: activities.Task.text?.trim() || '',
        taskDueDate: activities.Task.dueDate || '',
        taskAssignedTo: activities.Task.assignedTo || undefined,
        notifiedUsers: activities.Task.notify ? [activities.Task.notify] : [],
      });
    }

    if (activitiesPayload.length) payload.activities = activitiesPayload;

    payload.recording = {
      label: form.recordingLabel?.trim() || '',
      url: form.recordingUrl?.trim() || '',
    };

    if (form.paymentAmount?.trim()) {
      payload.payment = {
        amount: Number(form.paymentAmount),
        paymentMode: form.paymentMode,
        status: form.paymentStatus,
        reference: form.paymentReference?.trim() || undefined,
        paymentDate: form.paymentDate || undefined,
      };
    }

    if (customColumns.length) payload.customFields = { ...form.customFields };

    const existingReminder =
      lead?.reminders?.find(reminder => !reminder.isDone) || null;
    const existingReminderDate = formatDateInput(
      existingReminder?.reminderDate,
    );
    const existingReminderAssignedTo = getUserId(existingReminder?.assignedTo);
    const existingReminderNotify =
      existingReminder?.notifyUsers?.length > 0
        ? getUserId(existingReminder.notifyUsers[0])
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
        String(form.reminderNote?.trim() || '') !==
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
        note: form.reminderNote?.trim() || undefined,
        notifyUsers: form.reminderNotify ? [form.reminderNotify] : [],
      };
    }

    return payload;
  };

  const uploadRecordingForLead = async leadId => {
    const label = form.recordingLabel || getFileName(recordingFile);

    if (recordingFile) {
      const formData = new FormData();
      formData.append('recording', {
        uri: recordingFile.uri,
        type: recordingFile.type || 'application/octet-stream',
        name: getFileName(recordingFile),
      });
      formData.append('label', label);

      const res = await api.post(
        `/leads/${leadId}/recordings/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: progressEvent => {
            const total = progressEvent.total || 0;
            if (!total) return;
            setUploadProgress(Math.round((progressEvent.loaded * 100) / total));
          },
        },
      );
      return res.data?.data?.recording;
    }

    if (form.recordingUrl?.trim()) {
      const res = await api.post(`/leads/${leadId}/recordings/url`, {
        url: form.recordingUrl.trim(),
        label: form.recordingLabel || 'External Recording Link',
      });
      return res.data?.data?.recording;
    }

    return null;
  };

  const handleRecordingUpload = async () => {
    if (!recordingFile && !form.recordingUrl?.trim()) {
      showError('Please provide a file or recording URL.');
      return;
    }

    if (!lead?._id) {
      Alert.alert(
        'Info',
        'Recording will be uploaded after the lead is saved.',
      );
      return;
    }

    setUploadingRec(true);
    setUploadProgress(0);
    try {
      const recording = await uploadRecordingForLead(lead._id);
      if (recording) setSavedRecordings(prev => [...prev, recording]);
      setRecordingFile(null);
      handleChange('recordingUrl', '');
      handleChange('recordingLabel', '');
      showSuccess('Recording saved successfully.');
    } catch (err) {
      showError(err?.response?.data?.message || 'Upload failed.');
    } finally {
      setUploadingRec(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteRecording = async rec => {
    if (!lead?._id || !rec.filename) {
      setSavedRecordings(prev => prev.filter(item => item !== rec));
      return;
    }

    try {
      await api.delete(`/leads/${lead._id}/recordings/${rec.filename}`);
      setSavedRecordings(prev =>
        prev.filter(item => item.filename !== rec.filename),
      );
      if (playingUrl === rec.url) setPlayingUrl(null);
      showSuccess('Recording deleted successfully.');
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to delete recording.');
    }
  };

  const handleSubmit = async () => {
    if (activeTab === 'Cross-Sell') {
      await crossSellRef.current?.handleSave?.();
      return;
    }

    if (lead && !canEditAnyLead) {
      showError('You do not have permission to edit this lead.');
      return;
    }

    if (!lead && !canCreateLead) {
      showError('You do not have permission to create leads.');
      return;
    }

    const phoneRegex = /^\+?[1-9][0-9]{9,14}$/;
    const rawDigitsOnly = String(form.phone || '').replace(/\D/g, '');
    if (
      !form.phone ||
      !phoneRegex.test(form.phone) ||
      rawDigitsOnly.length < 10
    ) {
      showError('Please enter a valid phone number with country code.');
      setActiveTab('Profile');
      return;
    }

    const altRaw = form.alternatePhone
      ? String(form.alternatePhone).trim()
      : '';
    const altDigits = altRaw.replace(/\D/g, '');
    const isOnlyCountryCode = altDigits.length <= 2;
    if (altDigits.length > 0 && !isOnlyCountryCode && altDigits.length < 10) {
      showError(
        'Please enter a valid alternate phone number with country code.',
      );
      setActiveTab('Profile');
      return;
    }

    if (!form.name?.trim()) {
      showError('Lead name is required.');
      setActiveTab('Profile');
      return;
    }

    if (!form.assignedTo) {
      showError('Please assign the lead to a user.');
      setActiveTab('Assign');
      return;
    }

    if (form.paymentAmount?.trim() && !form.paymentDate) {
      showError('Payment date is required.');
      setActiveTab('Payment');
      return;
    }

    const taskActivity = form.activities?.Task;
    if (taskActivity?.text?.trim() && !taskActivity.dueDate) {
      showError('Task due date is required.');
      setActiveTab('Activity');
      handleChange('activeActivityType', 'Task');
      return;
    }

    if (form.reminderDate && !form.reminderAssignedTo) {
      showError('Reminder must be assigned to a user.');
      setActiveTab('Reminder');
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();
      const savedLead = await onSubmit(payload, lead?._id);

      if (!lead?._id && recordingFile && savedLead?._id) {
        try {
          await uploadRecordingForLead(savedLead._id);
        } catch {
          Alert.alert('Warning', 'Lead created but recording upload failed.');
        }
      }

      if (!lead?._id) onClose();
    } catch (err) {
      showError(err?.response?.data?.message || 'Unable to save lead.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPicker = (
    selectedValue,
    onValueChange,
    items,
    enabled = true,
    placeholder = null,
  ) => (
    <View style={[styles.pickerWrapper, !enabled && styles.disabledControl]}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        enabled={enabled}
      >
        {placeholder ? <Picker.Item label={placeholder} value="" /> : null}
        {items.map(item => {
          const value = typeof item === 'string' ? item : item.value;
          const label = typeof item === 'string' ? item : item.label;
          return <Picker.Item key={value} label={label} value={value} />;
        })}
      </Picker>
    </View>
  );

  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.label}>Full Name *</Text>
      <TextInput
        style={styles.input}
        value={form.name}
        onChangeText={value => handleChange('name', value)}
        placeholder="Contact name"
      />

      <Text style={styles.label}>Primary Phone *</Text>
      <CustomPhoneInput
        value={form.phone}
        onChange={value => handleChange('phone', value)}
        defaultCountry="IN"
      />

      <View style={styles.row}>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Status</Text>
          {renderPicker(
            form.status,
            value => handleChange('status', value),
            defaultStatusOptions,
          )}
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Priority</Text>
          {renderPicker(
            form.priority,
            value => handleChange('priority', value),
            PRIORITY_OPTIONS,
          )}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Deal Value (₹)</Text>
          <TextInput
            style={styles.input}
            value={form.dealValue}
            onChangeText={value => handleChange('dealValue', value)}
            keyboardType="numeric"
            placeholder="Deal value"
          />
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={form.city}
            onChangeText={value => handleChange('city', value)}
            placeholder="City"
          />
        </View>
      </View>

      <Text style={styles.label}>Alternate Phone (Optional)</Text>
      <CustomPhoneInput
        value={form.alternatePhone || ''}
        onChange={value => handleChange('alternatePhone', value)}
        defaultCountry="IN"
      />

      <Text style={styles.label}>Source</Text>
      {renderPicker(
        form.source,
        value => handleChange('source', value),
        defaultSourceOptions,
      )}

      <Text style={styles.label}>Product</Text>
      <TextInput
        style={styles.input}
        value={form.product}
        onChangeText={value => handleChange('product', value)}
        placeholder="Product"
      />

      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        value={form.email}
        onChangeText={value => handleChange('email', value)}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="Email address"
      />

      <Text style={styles.label}>Close Date</Text>
      <TouchableOpacity
        style={styles.dateSelectorButton}
        onPress={() => triggerDatePicker('closeDate')}
      >
        <Text
          style={[
            styles.dateSelectorText,
            form.closeDate ? styles.dateSet : styles.datePlaceholder,
          ]}
        >
          {form.closeDate || 'Select Close Target Date'}
        </Text>
        <Feather name="calendar" size={16} color="#64748b" />
      </TouchableOpacity>

      {customColumns
        .filter(column => column.formVisible !== false)
        .map(column => (
          <View key={column.key}>
            <Text style={styles.label}>{column.label}</Text>
            <TextInput
              style={styles.input}
              value={form.customFields?.[column.key] || ''}
              onChangeText={value => handleCustomFieldChange(column.key, value)}
              placeholder={`Enter ${column.label}`}
            />
          </View>
        ))}

      <Text style={styles.label}>Initial Note</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={form.note}
        onChangeText={value => handleChange('note', value)}
        multiline
        placeholder="Initial note or lead details"
      />
    </View>
  );

  const renderAssignTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.label}>Primary Lead Owner *</Text>
      {renderPicker(
        form.assignedTo,
        value => handleChange('assignedTo', value),
        users.map(user => ({
          value: user._id,
          label: user.name || user.email || 'Unknown user',
        })),
        canManageAssignment,
        'Select owner',
      )}
      {!canManageAssignment ? (
        <Text style={styles.warningText}>
          You do not have permission to change assignment for this lead.
        </Text>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.label}>Co-Assignees</Text>
        <MultiSelect
          options={users
            .filter(user => user._id !== form.assignedTo)
            .map(user => ({
              value: user._id,
              label: user.name || user.email || 'Unknown user',
            }))}
          value={(form.coAssignees || []).map(id => ({
            value: id,
            label:
              users.find(user => user._id === id)?.name ||
              users.find(user => user._id === id)?.email ||
              '',
          }))}
          onChange={selected =>
            handleChange(
              'coAssignees',
              selected ? selected.map(item => item.value) : [],
            )
          }
          placeholder="Select one or more co-assignees"
          disabled={!canManageAssignment}
          isMulti
          isSearchable
          closeMenuOnSelect={false}
          hideSelectedOptions={false}
          isClearable
        />
        {!canManageAssignment ? (
          <Text style={styles.warningText}>
            Co-assignee assignment is restricted for your role.
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderActivityTab = () => {
    const type = form.activeActivityType || 'Note';
    const act = form.activities?.[type] || {};

    const iconMap = {
      Note: { icon: 'file-text', color: '#a855f7' },
      Call: { icon: 'phone', color: '#22c55e' },
      Email: { icon: 'mail', color: '#3b82f6' },
      Meeting: { icon: 'users', color: '#f97316' },
      Task: { icon: 'check-square', color: '#64748b' },
    };

    return (
      <View style={styles.tabContent}>
        <Text style={styles.label}>Activity Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activityPills}
        >
          {ACTIVITY_TYPES.map(activityType => {
            const data = form.activities?.[activityType] || {};
            const hasData =
              data.text?.trim() || data.duration?.trim() || data.dueDate;
            const active = type === activityType;
            return (
              <TouchableOpacity
                key={activityType}
                onPress={() => handleChange('activeActivityType', activityType)}
                style={[
                  styles.activityPill,
                  active && {
                    backgroundColor: iconMap[activityType].color,
                    borderColor: iconMap[activityType].color,
                  },
                ]}
              >
                <Feather
                  name={iconMap[activityType].icon}
                  size={14}
                  color={active ? '#fff' : iconMap[activityType].color}
                />
                <Text
                  style={[
                    styles.activityPillText,
                    active && styles.activityPillTextActive,
                  ]}
                >
                  {activityType}
                </Text>
                {hasData ? <View style={styles.dataDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.panel}>
          <Text style={styles.subHeading}>{type} Activity</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={act.text || ''}
            onChangeText={value => handleActivityChange(type, 'text', value)}
            multiline
            placeholder={
              type === 'Call'
                ? 'Call summary — what was discussed?'
                : 'Add details...'
            }
          />

          {type === 'Call' ? (
            <>
              <Text style={styles.label}>Duration</Text>
              <TextInput
                style={styles.input}
                value={act.duration || ''}
                onChangeText={value =>
                  handleActivityChange(type, 'duration', value)
                }
                placeholder="3m 42s"
              />
              <View style={styles.row}>
                <View style={styles.flexOne}>
                  <Text style={styles.label}>Direction</Text>
                  {renderPicker(
                    act.direction || 'Outgoing',
                    value => handleActivityChange(type, 'direction', value),
                    ['Outgoing', 'Incoming', 'Missed'],
                  )}
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.label}>Outcome</Text>
                  {renderPicker(
                    act.outcome || 'Spoke',
                    value => handleActivityChange(type, 'outcome', value),
                    ['Spoke', 'No Answer', 'Left Voicemail'],
                  )}
                </View>
              </View>
            </>
          ) : null}

          {type === 'Task' ? (
            <View style={styles.row}>
              <View style={styles.flexOne}>
                <Text style={styles.label}>Due Date *</Text>
                <TouchableOpacity
                  style={styles.dateSelectorButton}
                  onPress={() => triggerDatePicker('taskDueDate')}
                >
                  <Text
                    style={[
                      styles.dateSelectorText,
                      act.dueDate ? styles.dateSet : styles.datePlaceholder,
                    ]}
                  >
                    {act.dueDate || 'Select Date'}
                  </Text>
                  <Feather name="calendar" size={16} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.label}>Assign To</Text>
                {renderPicker(
                  act.assignedTo,
                  value => handleActivityChange(type, 'assignedTo', value),
                  users.map(user => ({
                    value: user._id,
                    label: user.name || 'Unknown',
                  })),
                )}
              </View>
            </View>
          ) : null}

          <Text style={styles.label}>Notify</Text>
          {renderPicker(
            act.notify || '',
            value => handleActivityChange(type, 'notify', value),
            users.map(user => ({
              value: user._id,
              label: user.name || 'Unknown',
            })),
            true,
            'No one',
          )}

          {act.text?.trim() || act.duration?.trim() || act.dueDate ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                const base =
                  type === 'Call'
                    ? {
                        _id: act._id || '',
                        text: '',
                        duration: '',
                        direction: 'Outgoing',
                        outcome: 'Spoke',
                        notify: '',
                      }
                    : type === 'Task'
                    ? {
                        _id: act._id || '',
                        text: '',
                        dueDate: '',
                        assignedTo: users[0]?._id || '',
                        notify: '',
                      }
                    : { _id: act._id || '', text: '', notify: '' };
                setForm(prev => ({
                  ...prev,
                  activities: { ...prev.activities, [type]: base },
                }));
              }}
            >
              <Text style={styles.clearButtonText}>✕ Clear {type} data</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {lead &&
        Array.isArray(lead.activities) &&
        lead.activities.length > 0 ? (
          <View style={styles.historyContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.historyHeading}>Recent Interactions</Text>
              <Text style={styles.countBadge}>
                {lead.activities.length} total
              </Text>
            </View>
            {lead.activities.map((item, index) => {
              const userName =
                typeof item.user === 'string'
                  ? item.user
                  : item.user?.name ||
                    item.createdBy?.name ||
                    item.userName ||
                    '—';
              return (
                <View key={item._id || index} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyType}>
                      📌 {item.type || 'Interaction'}
                    </Text>
                    {item.callOutcome ? (
                      <Text style={styles.outcomeBadge}>
                        {item.callOutcome}
                      </Text>
                    ) : null}
                    {index === 0 ? (
                      <Text style={styles.recentBadge}>Recent</Text>
                    ) : null}
                  </View>
                  {item.text ? (
                    <Text style={styles.historyBody}>{item.text}</Text>
                  ) : null}
                  <Text style={styles.historyFooter}>
                    {userName}
                    {item.createdAt
                      ? ` · ${new Date(item.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}`
                      : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  const renderRecordingTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.panel}>
        <Text style={styles.subHeading}>Add New Recording</Text>

        <Text style={styles.label}>Label</Text>
        <TextInput
          style={styles.input}
          value={form.recordingLabel}
          onChangeText={value => handleChange('recordingLabel', value)}
          placeholder="First call · 30 Apr"
        />

        <Text style={styles.label}>Recording URL</Text>
        <TextInput
          style={styles.input}
          value={form.recordingUrl}
          onChangeText={value => {
            handleChange('recordingUrl', value);
            if (recordingFile) setRecordingFile(null);
          }}
          keyboardType="url"
          autoCapitalize="none"
          placeholder="https://drive.google.com/..."
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or upload a file</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={styles.uploadAreaContainer}
          onPress={handlePickDocument}
          activeOpacity={0.85}
        >
          {recordingFile ? (
            <View style={styles.selectedFileRow}>
              <Feather name="mic" size={24} color="#5a7bf6" />
              <View style={styles.flexOne}>
                <Text style={styles.recordingCardTitle} numberOfLines={1}>
                  {getFileName(recordingFile)}
                </Text>
                {recordingFile.size ? (
                  <Text style={styles.uploadAreaSubtext}>
                    {(recordingFile.size / (1024 * 1024)).toFixed(2)} MB
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setRecordingFile(null)}
                style={styles.iconBtnDanger}
              >
                <Feather name="x" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Feather name="upload-cloud" size={28} color="#5a7bf6" />
              <Text style={styles.uploadAreaText}>
                Tap to select audio or video file
              </Text>
              <Text style={styles.uploadAreaSubtext}>
                MP3, MP4, WAV, OGG, M4A, WebM · max depends on server
              </Text>
            </>
          )}
        </TouchableOpacity>

        {uploadingRec ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressMeta}>
              <Text style={styles.helpText}>Uploading...</Text>
              <Text style={styles.helpText}>{uploadProgress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${uploadProgress}%` }]}
              />
            </View>
          </View>
        ) : null}

        {recordingFile || form.recordingUrl?.trim() ? (
          lead?._id ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRecordingUpload}
              disabled={uploadingRec}
            >
              {uploadingRec ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Save Recording</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={[styles.warningText, styles.centerText]}>
              ⚠️ Recording will be saved after the lead is created
            </Text>
          )
        ) : null}
      </View>

      {savedRecordings.length > 0 ? (
        <View style={{ marginTop: 18 }}>
          <Text style={styles.historyHeading}>
            Saved Recordings ({savedRecordings.length})
          </Text>
          {savedRecordings.map((rec, index) => {
            const url = rec.url || rec.uri || '';
            const playing = playingUrl === url;
            const video = isVideoUrl(url);
            return (
              <View
                key={rec._id || rec.url || index}
                style={styles.recordingCard}
              >
                <View style={styles.recordingCardRowTop}>
                  <View style={styles.mediaIconCircle}>
                    <Feather
                      name={video ? 'video' : 'music'}
                      size={17}
                      color="#5a7bf6"
                    />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.recordingCardTitle} numberOfLines={1}>
                      {rec.label ||
                        rec.originalName ||
                        `Recording ${index + 1}`}
                    </Text>
                    {rec.uploadedAt ? (
                      <Text style={styles.recordingCardUrl} numberOfLines={1}>
                        {new Date(rec.uploadedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {rec.size
                          ? ` · ${(rec.size / (1024 * 1024)).toFixed(2)} MB`
                          : ''}
                      </Text>
                    ) : (
                      <Text style={styles.recordingCardUrl} numberOfLines={1}>
                        {url || 'Binary storage block resource'}
                      </Text>
                    )}
                  </View>
                  {url ? (
                    <TouchableOpacity
                      onPress={() => setPlayingUrl(playing ? null : url)}
                      style={styles.iconBtnPrimary}
                    >
                      <Feather
                        name={playing ? 'square' : 'play'}
                        size={15}
                        color="#5a7bf6"
                      />
                    </TouchableOpacity>
                  ) : null}
                  {url ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(url)}
                      style={styles.iconBtnNeutral}
                    >
                      <Feather name="external-link" size={15} color="#64748b" />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => handleDeleteRecording(rec)}
                    style={styles.iconBtnDanger}
                  >
                    <Feather name="trash-2" size={15} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                {playing && url ? (
                  <View style={styles.playerBox}>
                    <Video
                      source={{ uri: url }}
                      style={video ? styles.videoPlayer : styles.audioPlayer}
                      controls
                      paused={false}
                      resizeMode="contain"
                      onError={() =>
                        showError('Unable to play this recording.')
                      }
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : !recordingFile && !form.recordingUrl ? (
        <View style={styles.emptyState}>
          <Feather name="mic" size={36} color="#cbd5e1" />
          <Text style={styles.emptyText}>No recordings saved yet</Text>
        </View>
      ) : null}
    </View>
  );

  const handlePaymentUpdated = updatedPayment => {
    setPaymentHistory(prev =>
      prev.map(item =>
        item._id === updatedPayment._id ? updatedPayment : item,
      ),
    );
  };

  const renderPaymentTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.row}>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            style={styles.input}
            value={form.paymentAmount}
            onChangeText={value => handleChange('paymentAmount', value)}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateSelectorButton}
            onPress={() => triggerDatePicker('paymentDate')}
          >
            <Text
              style={[
                styles.dateSelectorText,
                form.paymentDate ? styles.dateSet : styles.datePlaceholder,
              ]}
            >
              {form.paymentDate || 'Select Date'}
            </Text>
            <Feather name="calendar" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Mode</Text>
          {renderPicker(
            form.paymentMode,
            value => handleChange('paymentMode', value),
            PAYMENT_MODES,
          )}
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Status</Text>
          {renderPicker(
            form.paymentStatus,
            value => handleChange('paymentStatus', value),
            PAYMENT_STATUS,
          )}
        </View>
      </View>

      <Text style={styles.label}>Reference / Transaction ID</Text>
      <TextInput
        style={styles.input}
        value={form.paymentReference}
        onChangeText={value => handleChange('paymentReference', value)}
        placeholder="Transaction ID / UTR"
      />

      {paymentHistory.length > 0 ? (
        <View style={styles.historyContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.historyHeading}>Payment History</Text>
            <Text style={styles.countBadge}>
              {paymentHistory.length} entries
            </Text>
          </View>
          {[...paymentHistory]
            .sort(
              (a, b) =>
                new Date(b.paymentDate || b.createdAt || 0) -
                new Date(a.paymentDate || a.createdAt || 0),
            )
            .map((payment, index) => (
              <PaymentHistoryItem
                key={
                  payment._id ||
                  payment.createdAt ||
                  payment.paymentDate ||
                  index
                }
                payment={payment}
                onUpdated={handlePaymentUpdated}
              />
            ))}
        </View>
      ) : null}
    </View>
  );

  const renderReminderTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.label}>Type</Text>
      {renderPicker(
        form.reminderType,
        value => handleChange('reminderType', value),
        REMINDER_TYPES,
      )}

      <Text style={styles.label}>Assign To</Text>
      {renderPicker(
        form.reminderAssignedTo,
        value => handleChange('reminderAssignedTo', value),
        users.map(user => ({ value: user._id, label: user.name || 'Unknown' })),
        true,
        'Select Assignee',
      )}

      <View style={styles.row}>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateSelectorButton}
            onPress={() => triggerDatePicker('reminderDate')}
          >
            <Text
              style={[
                styles.dateSelectorText,
                form.reminderDate ? styles.dateSet : styles.datePlaceholder,
              ]}
            >
              {form.reminderDate || 'Select Date'}
            </Text>
            <Feather name="calendar" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.label}>Time</Text>
          <TouchableOpacity
            style={styles.dateSelectorButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text
              style={[
                styles.dateSelectorText,
                form.reminderTime ? styles.dateSet : styles.datePlaceholder,
              ]}
            >
              {form.reminderTime || '10:00'}
            </Text>
            <Feather name="clock" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>Note</Text>
      <TextInput
        style={styles.input}
        value={form.reminderNote}
        onChangeText={value => handleChange('reminderNote', value)}
        placeholder="Reminder note"
      />

      <Text style={styles.label}>Also notify</Text>
      {renderPicker(
        form.reminderNotify,
        value => handleChange('reminderNotify', value),
        users.map(user => ({ value: user._id, label: user.name || 'Unknown' })),
        true,
        'None',
      )}
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modal}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>
                {lead ? 'Edit Lead' : 'Add New Lead'}
              </Text>
              <Text style={styles.subtitle}>
                Complete profile, assignment, activity, recording, payment and
                reminder sections.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContainer}
            >
              {allTabs.map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tab, activeTab === tab && styles.activeTab]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab && styles.activeTabText,
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'Profile' && renderProfileTab()}
            {activeTab === 'Assign' && renderAssignTab()}
            {activeTab === 'Activity' && renderActivityTab()}
            {activeTab === 'Recording' && renderRecordingTab()}
            {activeTab === 'Payment' && renderPaymentTab()}
            {activeTab === 'Reminder' && renderReminderTab()}
            {activeTab === 'Cross-Sell' && (
              <SuccessServiceSelector
                ref={crossSellRef}
                lead={lead}
                onSaved={onClose}
              />
            )}
          </ScrollView>

          {showDatePicker ? (
            <DateTimePicker
              value={dateFromInput(
                dateTarget === 'taskDueDate'
                  ? form.activities?.Task?.dueDate
                  : form[dateTarget],
              )}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateConfirm}
            />
          ) : null}

          {showTimePicker ? (
            <DateTimePicker
              value={timeFromInput(form.reminderTime)}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeConfirm}
            />
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>
                  {activeTab === 'Cross-Sell'
                    ? 'Save Services'
                    : lead
                    ? 'Update Lead'
                    : 'Create Lead'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
    minHeight: '72%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  headerTextWrap: { flex: 1, paddingRight: 12 },
  title: { fontSize: 19, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 17 },
  closeBtn: { backgroundColor: '#f8fafc', padding: 9, borderRadius: 22 },
  tabsWrapper: {
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  tabsContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  tab: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    marginRight: 8,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    minHeight: 40,
    justifyContent: 'center',
  },
  activeTab: { backgroundColor: '#5a7bf6' },
  tabText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  activeTabText: { color: '#ffffff', fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 2 },
  tabContent: { paddingBottom: 32 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 14,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  helpText: { fontSize: 12, color: '#64748b', lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    minHeight: 44,
  },
  textArea: { minHeight: 76, textAlignVertical: 'top' },
  dateSelectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    marginTop: 2,
    minHeight: 44,
  },
  dateSelectorText: { fontSize: 14, flex: 1, marginRight: 8 },
  datePlaceholder: { color: '#94a3b8' },
  dateSet: { color: '#0f172a' },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    marginTop: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  disabledControl: { opacity: 0.55, backgroundColor: '#f1f5f9' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flexOne: { flex: 1 },
  panel: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  warningText: { color: '#d97706', fontSize: 12, marginTop: 8, lineHeight: 17 },
  centerText: { textAlign: 'center' },
  activityPills: { paddingVertical: 4, gap: 8 },
  activityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginRight: 8,
    position: 'relative',
  },
  activityPillText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  activityPillTextActive: { color: '#ffffff' },
  dataDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34d399',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  clearButton: { marginTop: 12, alignSelf: 'flex-start' },
  clearButtonText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  uploadAreaContainer: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 112,
  },
  uploadAreaText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  uploadAreaSubtext: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  selectedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  divider: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  actionButton: {
    backgroundColor: '#5a7bf6',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    minHeight: 46,
  },
  actionButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  progressContainer: { marginTop: 14 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: { height: 6, backgroundColor: '#5a7bf6', borderRadius: 999 },
  recordingCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    marginTop: 10,
    overflow: 'hidden',
  },
  recordingCardRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  mediaIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(90,123,246,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingCardTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  recordingCardUrl: { fontSize: 11, color: '#64748b', marginTop: 2 },
  iconBtnPrimary: {
    backgroundColor: 'rgba(90,123,246,0.10)',
    padding: 10,
    borderRadius: 20,
  },
  iconBtnNeutral: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 20 },
  iconBtnDanger: { backgroundColor: '#fef2f2', padding: 10, borderRadius: 20 },
  playerBox: { paddingHorizontal: 12, paddingBottom: 12 },
  videoPlayer: {
    width: '100%',
    height: 210,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  audioPlayer: {
    width: '100%',
    height: 54,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 36,
    alignItems: 'center',
    marginTop: 18,
  },
  emptyText: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  historyContainer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  countBadge: {
    fontSize: 11,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyType: { fontSize: 13, fontWeight: '700', color: '#334155' },
  outcomeBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  recentBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  historyBody: { fontSize: 13, color: '#475569', marginTop: 7, lineHeight: 18 },
  historyFooter: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  serviceList: { marginTop: 12, gap: 8 },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  serviceRowSelected: {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.06)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  serviceText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    minHeight: 46,
  },
  cancelText: { color: '#475569', fontWeight: '700', fontSize: 14 },
  saveBtn: {
    backgroundColor: '#5a7bf6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  saveText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
});

export default LeadFormModal;
