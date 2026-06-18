import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { leadsService } from '../../services/leadsService.js';
import InteractionsTab from './LeadPreviewDrawer/InteractionsTab.jsx';
import TasksTab from './LeadPreviewDrawer/TasksTab.jsx';
import NotesTab from './LeadPreviewDrawer/NotesTab.jsx';
import CallsTab from './LeadPreviewDrawer/CallsTab.jsx';
import EmailsTab from './LeadPreviewDrawer/EmailsTab.jsx';
import WhatsappTab from './LeadPreviewDrawer/WhatsappTab.jsx';
import DocumentsTab from './LeadPreviewDrawer/DocumentsTab.jsx';
import ActivitiesTab from './LeadPreviewDrawer/ActivitiesTab.jsx';

const TABS = [
  'Interactions',
  'Tasks',
  'Notes',
  'Calls',
  'Emails',
  'Whatsapp',
  'Documents',
  'Activities',
];

const SOURCE_OPTIONS = [
  'Google Ads',
  'Website',
  'Referral',
  'Walk-in',
  'Cold Call',
  'Social Media',
  'Google Sheet',
  'Meta Ads',
  'Other',
];

const PRIORITY_OPTIONS = ['Normal', 'High', 'Urgent'];

const showError = message => Alert.alert('Error', message);
const showSuccess = message => Alert.alert('Success', message);

const LeadPreviewDrawer = ({
  lead,
  visible,
  onClose,
  onOpenFull,
  users,
  activityRefreshTrigger,
  onRefresh,
  canEditAnyLead = false,
}) => {
  const [activeTab, setActiveTab] = useState('Interactions');
  const [isEditing, setIsEditing] = useState(false);
  const [tempLead, setTempLead] = useState({});
  const [saving, setSaving] = useState(false);
  const [mobileView, setMobileView] = useState('info');

  const settings = useSelector(state => state.settings?.data || state.settings);

  const isDark = Boolean(settings?.theme === 'dark' || settings?.isDarkMode);

  const theme = useMemo(
    () => ({
      bgDrawer: isDark ? '#1e293b' : '#f5f6fa',
      bgSurface: isDark ? '#334155' : '#fff',
      bgContent: isDark ? '#0f172a' : '#f8f9fb',
      border: isDark ? '#475569' : '#e5e7eb',
      borderSubtle: isDark ? '#1e293b' : '#f0f0f5',
      textPrimary: isDark ? '#f1f5f9' : '#111827',
      textSecondary: isDark ? '#94a3b8' : '#6b7280',
      textMuted: isDark ? '#64748b' : '#9ca3af',
      statusBg: '#ede9fe',
      statusText: '#6366f1',
      phoneBg: isDark ? '#064e3b' : '#dcfce7',
      phoneIcon: isDark ? '#4ade80' : '#16a34a',
      accent: '#6366f1',
      danger: '#ef4444',
      success: '#22c55e',
      inputBg: isDark ? '#1e293b' : '#f9fafb',
    }),
    [isDark],
  );

  const customColumns = useMemo(
    () =>
      Array.isArray(settings?.customColumns) ? settings.customColumns : [],
    [settings],
  );

  const pipelineStages = useMemo(
    () =>
      settings?.pipelineStages?.map(s => s.name) || [
        'New',
        'Interested',
        'Details Shared',
        'Success',
        'Closed',
      ],
    [settings],
  );

  useEffect(() => {
    if (visible) {
      setActiveTab('Interactions');
      setIsEditing(false);
      setTempLead(lead || {});
      setMobileView('info');
    }
  }, [visible, lead]);

  if (!lead) return null;

  const getInitials = (name = '') =>
    name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase())
      .join('');

  const getAssignedName = item => {
    if (!item.assignedTo) return null;
    return typeof item.assignedTo === 'string'
      ? item.assignedTo
      : item.assignedTo.name || item.assignedTo.email || null;
  };

  const getCoAssigneeNames = item => {
    if (!Array.isArray(item.coAssignees) || item.coAssignees.length === 0)
      return null;
    return item.coAssignees
      .map(user =>
        typeof user === 'string' ? user : user?.name || user?.email,
      )
      .filter(Boolean)
      .join(', ');
  };

  const updateTempField = (key, value) => {
    setTempLead(prev => ({ ...prev, [key]: value }));
  };

  const updateCustomField = (key, value) => {
    setTempLead(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [key]: value },
    }));
  };

  const validateBeforeSave = () => {
    const phoneRegex = /^\+?[1-9][0-9]{9,14}$/;

    if (!tempLead.name?.trim()) {
      showError('Lead name is required.');
      return false;
    }

    if (tempLead.phone) {
      const rawDigits = tempLead.phone.replace(/\D/g, '');
      if (!phoneRegex.test(tempLead.phone) || rawDigits.length < 10) {
        showError('Please enter a valid phone number with country code.');
        return false;
      }
    }

    if (tempLead.alternatePhone) {
      const altDigits = String(tempLead.alternatePhone).replace(/\D/g, '');
      if (!phoneRegex.test(tempLead.alternatePhone) || altDigits.length < 10) {
        showError(
          'Please enter a valid alternate phone number with country code.',
        );
        return false;
      }
    }

    if (tempLead.email && tempLead.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(tempLead.email.trim())) {
        showError('Please enter a valid email address.');
        return false;
      }
    }

    if (
      tempLead.dealValue !== undefined &&
      tempLead.dealValue !== '' &&
      tempLead.dealValue !== null
    ) {
      const numVal = Number(tempLead.dealValue);
      if (isNaN(numVal) || numVal < 0) {
        showError('Deal value must be a valid positive number.');
        return false;
      }
    }

    return true;
  };

  const handleQuickSave = async () => {
    if (!validateBeforeSave()) return;

    setSaving(true);
    try {
      const payload = {
        name: tempLead.name?.trim() || '',
        phone: tempLead.phone?.trim() || '',
        alternatePhone: tempLead.alternatePhone?.trim() || undefined,
        email: tempLead.email?.trim() || undefined,
        city: tempLead.city?.trim() || undefined,
        source: tempLead.source || 'Other',
        status: tempLead.status || 'New',
        dealValue: tempLead.dealValue ? Number(tempLead.dealValue) : undefined,
        product: tempLead.product?.trim() || undefined,
        priority: tempLead.priority || 'Normal',
        assignedTo:
          typeof tempLead.assignedTo === 'object'
            ? tempLead.assignedTo?._id || tempLead.assignedTo?.id || ''
            : tempLead.assignedTo || '',
        coAssignees: Array.isArray(tempLead.coAssignees)
          ? tempLead.coAssignees
              .map(u => (typeof u === 'object' ? u?._id || u?.id || '' : u))
              .filter(Boolean)
          : [],
      };

      if (customColumns.length && tempLead.customFields) {
        payload.customFields = { ...tempLead.customFields };
      }

      await leadsService.updateLead(lead._id, payload);
      showSuccess('Lead updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      showError(error.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const assignedName = getAssignedName(lead);
  const coAssigneesNames = getCoAssigneeNames(lead);
  const initials = getInitials(isEditing ? tempLead.name : lead.name);
  const alternatePhoneValue = lead.alternatePhone || '';
  const contactPhones = [lead.phone, alternatePhoneValue].filter(Boolean);
  const primaryPhone = contactPhones[0] || '';

  const openPhone = phoneNumber => {
    const rawPhone = String(phoneNumber || '').trim();
    if (!rawPhone) return;
    const hasCountryCode =
      rawPhone.startsWith('+') || rawPhone.replace(/\D/g, '').length > 10;
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const telHref = hasCountryCode
      ? rawPhone.startsWith('+')
        ? `tel:${rawPhone}`
        : `tel:+${rawPhone}`
      : `tel:+91${cleanDigits}`;
    Linking.openURL(telHref);
  };

  const openWhatsapp = phoneNumber => {
    const rawPhone = String(phoneNumber || '').trim();
    if (!rawPhone) return;
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const hasCountryCode = rawPhone.startsWith('+') || cleanDigits.length > 10;
    const whatsappHref = hasCountryCode
      ? `https://wa.me/${cleanDigits}`
      : `https://wa.me/91${cleanDigits}`;
    Linking.openURL(whatsappHref);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Notes':
        return (
          <NotesTab
            leadId={lead._id}
            users={users}
            theme={theme}
            activityRefreshTrigger={activityRefreshTrigger}
            onActivitySaved={onRefresh}
          />
        );
      case 'Tasks':
        return (
          <TasksTab
            leadId={lead._id}
            users={users}
            theme={theme}
            activityRefreshTrigger={activityRefreshTrigger}
            onActivitySaved={onRefresh}
          />
        );
      case 'Calls':
        return (
          <CallsTab
            leadId={lead._id}
            users={users}
            theme={theme}
            activityRefreshTrigger={activityRefreshTrigger}
            onActivitySaved={onRefresh}
          />
        );
      case 'Emails':
        return (
          <EmailsTab
            leadId={lead._id}
            users={users}
            theme={theme}
            activityRefreshTrigger={activityRefreshTrigger}
          />
        );
      case 'Whatsapp':
        return (
          <WhatsappTab
            leadId={lead._id}
            leadPhone={primaryPhone}
            leadName={lead.name}
            isDark={isDark}
            theme={theme}
          />
        );
      case 'Documents':
        return <DocumentsTab theme={theme} />;
      case 'Activities':
        return (
          <ActivitiesTab
            leadId={lead._id}
            theme={theme}
            activityRefreshTrigger={activityRefreshTrigger}
          />
        );
      case 'Interactions':
      default:
        return (
          <InteractionsTab
            leadId={lead._id}
            isDark={isDark}
            theme={theme}
            users={users}
            activityRefreshTrigger={activityRefreshTrigger}
            onActivitySaved={onRefresh}
          />
        );
    }
  };

  const renderInfoRow = (label, value, field, options = null) => {
    if (!isEditing) {
      if (value === null || value === undefined || value === '') return null;
      return (
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
            {label}
          </Text>
          <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
            {value}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.editFieldWrap}>
        <Text style={[styles.editLabel, { color: theme.textMuted }]}>
          {label}
        </Text>
        {options ? (
          <View
            style={[
              styles.pickerWrap,
              { borderColor: theme.accent, backgroundColor: theme.inputBg },
            ]}
          >
            <Picker
              selectedValue={tempLead[field] || ''}
              onValueChange={value => updateTempField(field, value)}
              mode="dropdown"
              dropdownIconColor={theme.textSecondary}
              style={[styles.picker, { color: theme.textPrimary }]}
            >
              <Picker.Item label="Select..." value="" />
              {options.map(opt => (
                <Picker.Item key={opt} label={opt} value={opt} />
              ))}
            </Picker>
          </View>
        ) : (
          <TextInput
            keyboardType={
              field === 'dealValue'
                ? 'numeric'
                : field === 'email'
                ? 'email-address'
                : 'default'
            }
            value={tempLead[field] ? String(tempLead[field]) : ''}
            onChangeText={value => updateTempField(field, value)}
            style={[
              styles.input,
              {
                borderColor: theme.accent,
                backgroundColor: theme.inputBg,
                color: theme.textPrimary,
              },
            ]}
          />
        )}
      </View>
    );
  };

  const renderCustomRow = (label, key, value) => {
    if (!isEditing) {
      if (!value) return null;
      return (
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
            {label}
          </Text>
          <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
            {value}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.editFieldWrap}>
        <Text style={[styles.editLabel, { color: theme.textMuted }]}>
          {label}
        </Text>
        <TextInput
          value={tempLead.customFields?.[key] || ''}
          onChangeText={value => updateCustomField(key, value)}
          style={[
            styles.input,
            {
              borderColor: theme.accent,
              backgroundColor: theme.inputBg,
              color: theme.textPrimary,
            },
          ]}
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.drawer}
      >
        <SafeAreaView
          style={[styles.drawer, { backgroundColor: theme.bgDrawer }]}
          edges={['top', 'bottom']}
        >
          <View
            style={[
              styles.topBar,
              {
                backgroundColor: theme.bgSurface,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <View style={styles.topLeft}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.statusBg },
                ]}
              >
                <Text style={[styles.statusText, { color: theme.statusText }]}>
                  {lead.status || 'New'}
                </Text>
              </View>
              <Text
                style={[styles.sourceText, { color: theme.textMuted }]}
                numberOfLines={1}
              >
                {lead.source || '-'}
              </Text>
            </View>

            <View style={styles.topActions}>
              {canEditAnyLead ? (
                isEditing ? (
                  <>
                    <TouchableOpacity
                      onPress={handleQuickSave}
                      disabled={saving}
                      style={[styles.saveTopBtn, { opacity: saving ? 0.6 : 1 }]}
                    >
                      {saving ? (
                        <ActivityIndicator size={14} color="#fff" />
                      ) : (
                        <Icon name="check" size={14} color="#fff" />
                      )}
                      <Text style={styles.topBtnWhiteText}>
                        {saving ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setIsEditing(false);
                        setTempLead(lead);
                      }}
                      style={[
                        styles.cancelTopBtn,
                        { borderColor: theme.danger },
                      ]}
                    >
                      <Icon name="close" size={14} color={theme.danger} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setTempLead(lead);
                      setIsEditing(true);
                    }}
                    style={[
                      styles.editTopBtn,
                      { backgroundColor: isDark ? '#475569' : '#f3f4f6' },
                    ]}
                  >
                    <Icon
                      name="pencil-outline"
                      size={13}
                      color={theme.accent}
                    />
                    <Text style={[styles.editTopText, { color: theme.accent }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                )
              ) : null}

              <TouchableOpacity
                onPress={onOpenFull}
                style={[styles.fullBtn, { backgroundColor: theme.danger }]}
              >
                <Text style={styles.topBtnWhiteText}>Full</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { borderColor: theme.border }]}
              >
                <Icon name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.segmentBar,
              {
                backgroundColor: theme.bgSurface,
                borderBottomColor: theme.border,
              },
            ]}
          >
            {[
              { key: 'info', label: 'Details' },
              { key: 'tabs', label: 'Activity' },
            ].map(seg => {
              const active = mobileView === seg.key;
              return (
                <TouchableOpacity
                  key={seg.key}
                  onPress={() => setMobileView(seg.key)}
                  style={[
                    styles.segmentBtn,
                    {
                      borderColor: active ? theme.accent : theme.border,
                      backgroundColor: active ? theme.accent : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active ? '#fff' : theme.textSecondary,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {seg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.body}>
            {mobileView === 'info' ? (
              <ScrollView
                style={[styles.infoPanel, { backgroundColor: theme.bgSurface }]}
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={[
                    styles.avatarSection,
                    { borderBottomColor: theme.borderSubtle },
                  ]}
                >
                  <View style={styles.avatarRow}>
                    <View
                      style={[styles.avatar, { backgroundColor: theme.accent }]}
                    >
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.nameWrap}>
                      {isEditing ? (
                        <TextInput
                          value={tempLead.name || ''}
                          onChangeText={value => updateTempField('name', value)}
                          style={[
                            styles.nameInput,
                            {
                              color: theme.textPrimary,
                              backgroundColor: theme.inputBg,
                              borderColor: theme.accent,
                            },
                          ]}
                          placeholder="Lead name *"
                          placeholderTextColor={theme.textMuted}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.nameText,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {lead.name || '-'}
                        </Text>
                      )}
                      {assignedName ? (
                        <Text
                          style={[
                            styles.mutedSmall,
                            { color: theme.textMuted },
                          ]}
                        >
                          {assignedName}
                        </Text>
                      ) : null}
                      {coAssigneesNames ? (
                        <Text
                          style={[
                            styles.mutedSmall,
                            { color: theme.textMuted },
                          ]}
                        >
                          Co-assignees: {coAssigneesNames}
                        </Text>
                      ) : null}
                    </View>
                    {primaryPhone && !isEditing ? (
                      <TouchableOpacity
                        onPress={() => openPhone(primaryPhone)}
                        style={[
                          styles.phoneCircle,
                          { backgroundColor: theme.phoneBg },
                        ]}
                      >
                        <Icon
                          name="phone-outline"
                          size={15}
                          color={theme.phoneIcon}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {lead.isDuplicate ? (
                    <View style={styles.repeatBadge}>
                      <Text style={styles.repeatText}>Repeat</Text>
                    </View>
                  ) : null}
                </View>

                {!isEditing ? (
                  <View
                    style={[
                      styles.section,
                      { borderBottomColor: theme.borderSubtle },
                    ]}
                  >
                    <Text
                      style={[styles.sectionTitle, { color: theme.textMuted }]}
                    >
                      Contact Numbers
                    </Text>
                    {contactPhones.length === 0 ? (
                      <Text style={{ color: theme.textPrimary, fontSize: 13 }}>
                        -
                      </Text>
                    ) : null}
                    {contactPhones.map((phoneNumber, index) => {
                      const rawPhone = String(phoneNumber).trim();
                      const hasCountryCode =
                        rawPhone.startsWith('+') ||
                        rawPhone.replace(/\D/g, '').length > 10;
                      const cleanDigits = rawPhone.replace(/\D/g, '');
                      const displayPhone = hasCountryCode
                        ? rawPhone.startsWith('+')
                          ? rawPhone
                          : `+${rawPhone}`
                        : `+91${cleanDigits}`;
                      return (
                        <View
                          key={`${phoneNumber}-${index}`}
                          style={styles.phoneRow}
                        >
                          <Icon
                            name="phone-outline"
                            size={13}
                            color={theme.textSecondary}
                          />
                          <Text
                            style={[
                              styles.phoneText,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {displayPhone}
                          </Text>
                          <View style={styles.phoneActions}>
                            <TouchableOpacity
                              onPress={() => openPhone(rawPhone)}
                              style={[
                                styles.actionCircle,
                                {
                                  backgroundColor: isDark
                                    ? '#334155'
                                    : '#f3f4f6',
                                },
                              ]}
                            >
                              <Icon
                                name="phone-outline"
                                size={12}
                                color={theme.textSecondary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => openWhatsapp(rawPhone)}
                              style={[
                                styles.actionCircle,
                                { backgroundColor: theme.phoneBg },
                              ]}
                            >
                              <Icon
                                name="whatsapp"
                                size={12}
                                color={theme.phoneIcon}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                    {lead.email ? (
                      <View style={styles.emailRow}>
                        <Icon
                          name="email-outline"
                          size={13}
                          color={theme.textSecondary}
                        />
                        <Text
                          style={[
                            styles.emailText,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {lead.email}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.infoSection}>
                  <Text
                    style={[styles.sectionTitle, { color: theme.textMuted }]}
                  >
                    Lead Info
                  </Text>

                  {isEditing ? (
                    <>
                      {renderInfoRow('Phone', tempLead.phone, 'phone')}
                      {renderInfoRow(
                        'Alternate Phone',
                        tempLead.alternatePhone,
                        'alternatePhone',
                      )}
                      {renderInfoRow('Email', tempLead.email, 'email')}
                    </>
                  ) : null}

                  {renderInfoRow(
                    'Source',
                    tempLead.source,
                    'source',
                    SOURCE_OPTIONS,
                  )}

                  {isEditing ? (
                    renderInfoRow('Deal Value', tempLead.dealValue, 'dealValue')
                  ) : lead.dealValue || lead.dealValue === 0 ? (
                    <View style={styles.infoRow}>
                      <Text
                        style={[
                          styles.infoLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Deal Value
                      </Text>
                      <Text
                        style={[styles.infoValue, { color: theme.textPrimary }]}
                      >
                        ₹{Number(lead.dealValue).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ) : null}

                  {renderInfoRow('Product', tempLead.product, 'product')}
                  {renderInfoRow(
                    'Priority',
                    tempLead.priority,
                    'priority',
                    PRIORITY_OPTIONS,
                  )}
                  {renderInfoRow(
                    'Status',
                    tempLead.status,
                    'status',
                    pipelineStages,
                  )}
                  {renderInfoRow('City', tempLead.city, 'city')}

                  {!isEditing &&
                  lead.source === 'Google Sheet' &&
                  lead.sheetName ? (
                    <View style={styles.infoRow}>
                      <Text
                        style={[
                          styles.infoLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Sheet
                      </Text>
                      <View
                        style={[
                          styles.sheetBadge,
                          { backgroundColor: isDark ? '#14532d' : '#dcfce7' },
                        ]}
                      >
                        <Icon
                          name="clipboard-text-outline"
                          size={11}
                          color={isDark ? '#4ade80' : '#15803d'}
                        />
                        <Text
                          style={[
                            styles.sheetText,
                            { color: isDark ? '#4ade80' : '#15803d' },
                          ]}
                        >
                          {lead.sheetName}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {customColumns.length > 0
                    ? customColumns
                        .filter(
                          col =>
                            ![
                              'createdOn',
                              'created_on',
                              'createdAt',
                              'updatedAt',
                              'updated_at',
                            ].includes(col.key),
                        )
                        .map(col => {
                          const rawVal = isEditing
                            ? tempLead.customFields?.[col.key]
                            : lead.customFields?.[col.key];
                          const displayVal =
                            rawVal !== undefined && rawVal !== null
                              ? Array.isArray(rawVal)
                                ? rawVal.join(', ')
                                : typeof rawVal === 'object'
                                ? JSON.stringify(rawVal)
                                : String(rawVal)
                              : '';
                          return (
                            <View key={col.key}>
                              {renderCustomRow(col.label, col.key, displayVal)}
                            </View>
                          );
                        })
                    : null}

                  {lead.createdAt ? (
                    <View
                      style={[
                        styles.createdRow,
                        {
                          borderTopColor: isEditing
                            ? theme.border
                            : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.infoLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Created On
                      </Text>
                      <Text
                        style={[styles.infoValue, { color: theme.textPrimary }]}
                      >
                        {new Date(lead.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            ) : (
              <View
                style={[styles.tabsPanel, { backgroundColor: theme.bgContent }]}
              >
                <View
                  style={[
                    styles.tabsWrap,
                    {
                      backgroundColor: theme.bgSurface,
                      borderBottomColor: theme.border,
                    },
                  ]}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tabsScroller}
                    contentContainerStyle={styles.tabsScrollContent}
                  >
                    {TABS.map(tab => {
                      const active = activeTab === tab;
                      return (
                        <TouchableOpacity
                          key={tab}
                          onPress={() => setActiveTab(tab)}
                          style={[
                            styles.tabBtn,
                            {
                              borderBottomColor: active
                                ? theme.accent
                                : 'transparent',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tabText,
                              {
                                color: active
                                  ? theme.accent
                                  : theme.textSecondary,
                                fontWeight: active ? '600' : '400',
                              },
                            ]}
                          >
                            {tab}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.tabContent}>{renderTabContent()}</View>

                {!assignedName ? (
                  <View
                    style={[
                      styles.nextSteps,
                      {
                        borderColor: isDark ? '#854d0e' : '#fed7aa',
                        backgroundColor: isDark ? '#451a03' : '#fff7ed',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.nextStepsTitle,
                          { color: isDark ? '#fed7aa' : '#ea580c' },
                        ]}
                      >
                        Next Steps
                      </Text>
                      <Text
                        style={[
                          styles.nextStepsText,
                          { color: isDark ? '#fde68a' : '#92400e' },
                        ]}
                      >
                        Unassigned · Assign this lead to a rep
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={onOpenFull}
                      style={[styles.assignBtn, { borderColor: theme.accent }]}
                    >
                      <Text
                        style={[styles.assignBtnText, { color: theme.accent }]}
                      >
                        assign to rep
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  drawer: { flex: 1 },
  topBar: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 8,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  statusBadge: { borderRadius: 4, paddingVertical: 2, paddingHorizontal: 8 },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceText: { fontSize: 12, flexShrink: 1 },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  saveTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#22c55e',
    borderRadius: 6,
  },
  cancelTopBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  editTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  editTopText: { fontSize: 12, fontWeight: '600' },
  fullBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  topBtnWhiteText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13 },
  body: { flex: 1, overflow: 'hidden' },
  infoPanel: { flex: 1 },
  avatarSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  nameWrap: { flex: 1, minWidth: 0 },
  nameText: { fontWeight: '700', fontSize: 15, lineHeight: 18 },
  nameInput: {
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  mutedSmall: { fontSize: 11, marginTop: 2 },
  phoneCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  repeatText: { fontSize: 10, color: '#b45309', fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  phoneText: { fontSize: 13, fontWeight: '500' },
  phoneActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  actionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emailText: { fontSize: 12, flex: 1 },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 10,
  },
  infoLabel: { fontSize: 12 },
  infoValue: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  editFieldWrap: { marginBottom: 10 },
  editLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  input: {
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 12,
  },
  pickerWrap: {
    width: '100%',
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: { width: '100%', height: 40 },
  sheetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  sheetText: { fontSize: 11, fontWeight: '600' },
  createdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  tabsPanel: { flex: 1 },
  tabsWrap: {
    height: 40,
    maxHeight: 40,
    borderBottomWidth: 1,
    paddingHorizontal: 4,
    flexShrink: 0,
    flexGrow: 0,
  },
  tabsScroller: { height: 39, maxHeight: 39, flexGrow: 0, flexShrink: 0 },
  tabsScrollContent: { height: 39, alignItems: 'center' },
  tabBtn: {
    height: 39,
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 12 },
  tabContent: { flex: 1, padding: 14 },
  nextSteps: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nextStepsTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nextStepsText: { fontSize: 12 },
  assignBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  assignBtnText: { fontSize: 12, fontWeight: '600' },
});

export default LeadPreviewDrawer;
