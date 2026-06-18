import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Dimensions,
  Linking,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Picker } from '@react-native-picker/picker';

import { leadsService } from '../../services/leadsService.js';

import InteractionsTab from './LeadPreviewDrawer/InteractionsTab.jsx';
import TasksTab from './LeadPreviewDrawer/TasksTab.jsx';
import NotesTab from './LeadPreviewDrawer/NotesTab.jsx';
import CallsTab from './LeadPreviewDrawer/CallsTab.jsx';
import EmailsTab from './LeadPreviewDrawer/EmailsTab.jsx';
import DocumentsTab from './LeadPreviewDrawer/DocumentsTab.jsx';
import ActivitiesTab from './LeadPreviewDrawer/ActivitiesTab.jsx';
import WhatsAppTab from './LeadPreviewDrawer/WhatsappTab.jsx';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// =============================================
// CUSTOM HOOK: useIsMobile
// =============================================
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(SCREEN_WIDTH <= breakpoint);

  useEffect(() => {
    const handleChange = () => {
      setIsMobile(Dimensions.get('window').width <= breakpoint);
    };
    const subscription = Dimensions.addEventListener('change', handleChange);
    return () => subscription?.remove();
  }, [breakpoint]);

  return isMobile;
};

// =============================================
// CUSTOM DROPDOWN COMPONENT
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
        style={[
          styles.dropdownButton,
          {
            borderColor: theme?.border || '#e5e7eb',
            backgroundColor: theme?.inputBg || '#fff',
          },
        ]}
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
            style={[
              styles.modalContent,
              { backgroundColor: theme?.bgSurface || '#fff' },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: theme?.textPrimary || '#111' },
              ]}
            >
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
                      isSelected && {
                        backgroundColor: theme?.accent || '#6366f1',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: isSelected
                            ? '#fff'
                            : theme?.textPrimary || '#111',
                        },
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
                style={[
                  styles.modalBtn,
                  { borderColor: theme?.border || '#e5e7eb' },
                ]}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    { color: theme?.textSecondary || '#6b7280' },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  onChange(modalValue);
                  setVisible(false);
                }}
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme?.accent || '#6366f1' },
                ]}
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

  // Mobile detection
  const isMobile = useIsMobile(768);
  const [mobileView, setMobileView] = useState('info');

  // Redux settings
  const settings = useSelector(state => state.settings?.data || state.settings);

  // Theme (no document access - use prop or default)
  const theme = useMemo(
    () => ({
      bgDrawer: '#f5f6fa',
      bgSurface: '#fff',
      bgContent: '#f8f9fb',
      border: '#e5e7eb',
      borderSubtle: '#f0f0f5',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      textMuted: '#9ca3af',
      statusBg: '#ede9fe',
      statusText: '#6366f1',
      phoneBg: '#dcfce7',
      phoneIcon: '#16a34a',
      accent: '#6366f1',
      danger: '#ef4444',
      success: '#22c55e',
      inputBg: '#f9fafb',
    }),
    [],
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

  // Reset on open
  useEffect(() => {
    if (visible) {
      setActiveTab('Interactions');
      setIsEditing(false);
      setTempLead(lead || {});
      setMobileView('info');
    }
  }, [visible, lead]);

  // Early return AFTER hooks
  if (!lead) return null;

  // ── Helper functions ──
  const getInitials = (name = '') =>
    name
      .split(' ')
      .slice(0, 2)
      .map(w => w?.[0]?.toUpperCase())
      .join('');

  const getAssignedName = item => {
    if (!item?.assignedTo) return null;
    return typeof item.assignedTo === 'string'
      ? item.assignedTo
      : item.assignedTo?.name || item.assignedTo?.email || null;
  };

  const getCoAssigneeNames = item => {
    if (!Array.isArray(item?.coAssignees) || item.coAssignees.length === 0)
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

  // ── Validations ──
  const validateBeforeSave = () => {
    const phoneRegex = /^\+?[1-9][0-9]{9,14}$/;

    if (!tempLead.name?.trim()) {
      Alert.alert('Validation Error', 'Lead name is required.');
      return false;
    }

    if (tempLead.phone) {
      const rawDigits = String(tempLead.phone).replace(/\D/g, '');
      if (!phoneRegex.test(tempLead.phone) || rawDigits.length < 10) {
        Alert.alert(
          'Validation Error',
          'Please enter a valid phone number with country code.',
        );
        return false;
      }
    }

    if (tempLead.alternatePhone) {
      const altDigits = String(tempLead.alternatePhone).replace(/\D/g, '');
      if (!phoneRegex.test(tempLead.alternatePhone) || altDigits.length < 10) {
        Alert.alert(
          'Validation Error',
          'Please enter a valid alternate phone number with country code.',
        );
        return false;
      }
    }

    if (tempLead.email && tempLead.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(tempLead.email.trim())) {
        Alert.alert('Validation Error', 'Please enter a valid email address.');
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
        Alert.alert(
          'Validation Error',
          'Deal value must be a valid positive number.',
        );
        return false;
      }
    }

    return true;
  };

  // ── Quick Save with clean payload ──
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

      Alert.alert('Success', 'Lead updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived values ──
  const assignedName = getAssignedName(lead);
  const coAssigneesNames = getCoAssigneeNames(lead);
  const initials = getInitials(isEditing ? tempLead.name : lead.name);

  const alternatePhoneValue = lead.alternatePhone || '';
  const contactPhones = [lead.phone, alternatePhoneValue].filter(Boolean);
  const primaryPhone = contactPhones[0] || '';
  const primaryDigits = primaryPhone.startsWith('+')
    ? primaryPhone.replace(/\D/g, '')
    : primaryPhone.replace(/\D/g, '');

  const normalizePhone = phone => String(phone || '').replace(/\D/g, '');

  // ── Info row renderer ──
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
      <View style={styles.editField}>
        <Text style={[styles.editLabel, { color: theme.textMuted }]}>
          {label}
        </Text>
        {options ? (
          <CustomDropdown
            value={tempLead[field] || ''}
            onChange={val => updateTempField(field, val)}
            options={options}
            theme={theme}
          />
        ) : (
          <TextInput
            value={tempLead[field] || ''}
            onChangeText={text => updateTempField(field, text)}
            keyboardType={
              field === 'dealValue'
                ? 'numeric'
                : field === 'email'
                ? 'email-address'
                : 'default'
            }
            style={[
              styles.editInput,
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

  // ── Custom field row renderer ──
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
      <View style={styles.editField}>
        <Text style={[styles.editLabel, { color: theme.textMuted }]}>
          {label}
        </Text>
        <TextInput
          value={tempLead.customFields?.[key] || ''}
          onChangeText={text => updateCustomField(key, text)}
          style={[
            styles.editInput,
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

  // ── Tab renderer ──
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
          <WhatsAppTab
            leadId={lead._id}
            leadPhone={primaryPhone}
            leadName={lead.name}
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
            theme={theme}
            users={users}
            activityRefreshTrigger={activityRefreshTrigger}
            onActivitySaved={onRefresh}
          />
        );
    }
  };

  // ── Render ──
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Drawer */}
        <SafeAreaView
          style={[
            styles.drawer,
            {
              backgroundColor: theme.bgDrawer,
              width: isMobile ? SCREEN_WIDTH : 860,
              maxWidth: isMobile ? SCREEN_WIDTH : '95vw',
            },
          ]}
        >
          {/* ── TOP BAR ── */}
          <View
            style={[
              styles.topBar,
              {
                backgroundColor: theme.bgSurface,
                borderBottomColor: theme.border,
              },
            ]}
          >
            {/* Left — Status + Source */}
            <View style={styles.topBarLeft}>
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
              {!isMobile && (
                <Text style={[styles.sourceText, { color: theme.textMuted }]}>
                  {lead.source || '—'}
                </Text>
              )}
            </View>

            {/* Right — Edit / Save / Cancel + Open Full + Close */}
            <View style={styles.topBarRight}>
              {canEditAnyLead && (
                <>
                  {isEditing ? (
                    <>
                      {/* Save Button */}
                      <TouchableOpacity
                        onPress={handleQuickSave}
                        disabled={saving}
                        style={[
                          styles.saveButton,
                          { backgroundColor: theme.success },
                        ]}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.buttonText}>Save</Text>
                        )}
                      </TouchableOpacity>

                      {/* Cancel Button */}
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditing(false);
                          setTempLead(lead);
                        }}
                        style={[
                          styles.cancelButton,
                          { borderColor: theme.danger },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cancelButtonText,
                            { color: theme.danger },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    /* Edit Button */
                    <TouchableOpacity
                      onPress={() => {
                        setTempLead(lead);
                        setIsEditing(true);
                      }}
                      style={[
                        styles.editButton,
                        { backgroundColor: '#f3f4f6' },
                      ]}
                    >
                      <Text style={styles.editIcon}>✏️</Text>
                      {!isMobile && (
                        <Text
                          style={[
                            styles.editButtonText,
                            { color: theme.accent },
                          ]}
                        >
                          Edit
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Open Full View */}
              <TouchableOpacity
                onPress={onOpenFull}
                style={[styles.fullButton, { backgroundColor: theme.danger }]}
              >
                <Text style={styles.fullButtonText}>
                  {isMobile ? 'Full' : 'Full View'}
                </Text>
              </TouchableOpacity>

              {/* Close */}
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, { borderColor: theme.border }]}
              >
                <Text
                  style={[styles.closeIcon, { color: theme.textSecondary }]}
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── MOBILE: segmented toggle ── */}
          {isMobile && (
            <View
              style={[
                styles.mobileToggle,
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
                      styles.toggleButton,
                      {
                        borderColor: active ? theme.accent : theme.border,
                        backgroundColor: active ? theme.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        { color: active ? '#fff' : theme.textSecondary },
                      ]}
                    >
                      {seg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── BODY ── */}
          <View style={styles.body}>
            {/* ── LEFT PANEL ── */}
            {(!isMobile || mobileView === 'info') && (
              <ScrollView
                style={[
                  styles.leftPanel,
                  {
                    backgroundColor: theme.bgSurface,
                    borderRightColor: isMobile ? 'transparent' : theme.border,
                    width: isMobile ? '100%' : 240,
                  },
                ]}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {/* Avatar + Name */}
                <View
                  style={[
                    styles.avatarSection,
                    { borderBottomColor: theme.borderSubtle },
                  ]}
                >
                  <View style={styles.avatarHeader}>
                    <View style={styles.avatarRow}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: theme.accent },
                        ]}
                      >
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>
                      <View style={styles.nameContainer}>
                        {isEditing ? (
                          <TextInput
                            value={tempLead.name || ''}
                            onChangeText={text => updateTempField('name', text)}
                            style={[
                              styles.nameInput,
                              {
                                borderColor: theme.accent,
                                backgroundColor: theme.inputBg,
                                color: theme.textPrimary,
                              },
                            ]}
                            placeholder="Lead name *"
                          />
                        ) : (
                          <Text
                            style={[
                              styles.leadName,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {lead.name || '—'}
                          </Text>
                        )}
                        {assignedName && (
                          <Text
                            style={[
                              styles.assignedName,
                              { color: theme.textMuted },
                            ]}
                          >
                            {assignedName}
                          </Text>
                        )}
                        {coAssigneesNames && (
                          <Text
                            style={[
                              styles.assignedName,
                              { color: theme.textMuted },
                            ]}
                          >
                            Co-assignees: {coAssigneesNames}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Phone call button */}
                    {primaryPhone && !isEditing && (
                      <TouchableOpacity
                        onPress={() => {
                          const digits = normalizePhone(primaryPhone);
                          const href = primaryPhone.startsWith('+')
                            ? `tel:${primaryPhone}`
                            : `tel:+91${digits}`;
                          Linking.openURL(href);
                        }}
                        style={[
                          styles.phoneButton,
                          { backgroundColor: theme.phoneBg },
                        ]}
                      >
                        <Text style={{ fontSize: 14 }}>📞</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Duplicate badge */}
                  {lead.isDuplicate && (
                    <View
                      style={[
                        styles.duplicateBadge,
                        { backgroundColor: '#fef3c7' },
                      ]}
                    >
                      <Text
                        style={[styles.duplicateText, { color: '#b45309' }]}
                      >
                        Repeat
                      </Text>
                    </View>
                  )}
                </View>

                {/* ── Contact Numbers ── */}
                {!isEditing && (
                  <View
                    style={[
                      styles.contactsSection,
                      { borderBottomColor: theme.borderSubtle },
                    ]}
                  >
                    <Text
                      style={[styles.sectionLabel, { color: theme.textMuted }]}
                    >
                      Contact Numbers
                    </Text>

                    {contactPhones.length === 0 && (
                      <Text
                        style={[
                          styles.noContacts,
                          { color: theme.textPrimary },
                        ]}
                      >
                        —
                      </Text>
                    )}

                    {contactPhones.map((phoneNumber, index) => {
                      const rawPhone = String(phoneNumber).trim();
                      const digits = normalizePhone(rawPhone);
                      const hasCountryCode =
                        rawPhone.startsWith('+') || digits.length > 10;
                      const telHref = hasCountryCode
                        ? rawPhone.startsWith('+')
                          ? `tel:${rawPhone}`
                          : `tel:+${rawPhone}`
                        : `tel:+91${digits}`;
                      const displayPhone = hasCountryCode
                        ? rawPhone.startsWith('+')
                          ? rawPhone
                          : `+${rawPhone}`
                        : `+91${digits}`;
                      const whatsappHref = `https://wa.me/${digits}`;

                      return (
                        <View
                          key={`${phoneNumber}-${index}`}
                          style={styles.phoneRow}
                        >
                          <Text
                            style={[
                              styles.phoneNumber,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {displayPhone}
                          </Text>
                          <View style={styles.phoneActions}>
                            <TouchableOpacity
                              onPress={() => Linking.openURL(telHref)}
                              style={[
                                styles.phoneActionButton,
                                { backgroundColor: '#f3f4f6' },
                              ]}
                            >
                              <Text style={{ fontSize: 12 }}>📞</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => Linking.openURL(whatsappHref)}
                              style={[
                                styles.phoneActionButton,
                                { backgroundColor: theme.phoneBg },
                              ]}
                            >
                              <Text style={{ fontSize: 12 }}>💬</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}

                    {lead.email && (
                      <View style={styles.emailRow}>
                        <Text style={{ fontSize: 13 }}>✉️</Text>
                        <Text
                          style={[
                            styles.emailText,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {lead.email}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* ── Lead Info / Edit Section ── */}
                <View style={styles.infoSection}>
                  <Text
                    style={[styles.sectionLabel, { color: theme.textMuted }]}
                  >
                    Lead Info
                  </Text>

                  {/* Edit mode — phone, alt phone, email */}
                  {isEditing && (
                    <>
                      {renderInfoRow('Phone', tempLead.phone, 'phone')}
                      {renderInfoRow(
                        'Alternate Phone',
                        tempLead.alternatePhone,
                        'alternatePhone',
                      )}
                      {renderInfoRow('Email', tempLead.email, 'email')}
                    </>
                  )}

                  {/* Source dropdown */}
                  {renderInfoRow(
                    'Source',
                    isEditing ? tempLead.source : lead.source,
                    'source',
                    SOURCE_OPTIONS,
                  )}

                  {/* Deal Value */}
                  {isEditing ? (
                    renderInfoRow('Deal Value', tempLead.dealValue, 'dealValue')
                  ) : lead.dealValue ? (
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

                  {renderInfoRow(
                    'Product',
                    isEditing ? tempLead.product : lead.product,
                    'product',
                  )}
                  {renderInfoRow(
                    'Priority',
                    isEditing ? tempLead.priority : lead.priority,
                    'priority',
                    PRIORITY_OPTIONS,
                  )}
                  {renderInfoRow(
                    'Status',
                    isEditing ? tempLead.status : lead.status,
                    'status',
                    pipelineStages,
                  )}
                  {renderInfoRow(
                    'City',
                    isEditing ? tempLead.city : lead.city,
                    'city',
                  )}

                  {/* Google Sheet badge */}
                  {!isEditing &&
                    lead.source === 'Google Sheet' &&
                    lead.sheetName && (
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
                            { backgroundColor: '#dcfce7' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.sheetBadgeText,
                              { color: '#15803d' },
                            ]}
                          >
                            📋 {lead.sheetName}
                          </Text>
                        </View>
                      </View>
                    )}

                  {/* Custom Fields */}
                  {customColumns.length > 0 &&
                    customColumns
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
                          <React.Fragment key={col.key}>
                            {renderCustomRow(col.label, col.key, displayVal)}
                          </React.Fragment>
                        );
                      })}

                  {/* Created On — always visible, never editable */}
                  {lead.createdAt && (
                    <View
                      style={[
                        styles.createdOn,
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
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* ── RIGHT PANEL ── */}
            {(!isMobile || mobileView === 'tabs') && (
              <View
                style={[
                  styles.rightPanel,
                  { backgroundColor: theme.bgContent },
                ]}
              >
                {/* Tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={[
                    styles.tabsContainer,
                    {
                      backgroundColor: theme.bgSurface,
                      borderBottomColor: theme.border,
                    },
                  ]}
                  contentContainerStyle={styles.tabsContent}
                >
                  {TABS.map(tab => (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => setActiveTab(tab)}
                      style={[
                        styles.tabButton,
                        {
                          borderBottomColor:
                            activeTab === tab ? theme.accent : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          {
                            color:
                              activeTab === tab
                                ? theme.accent
                                : theme.textSecondary,
                          },
                        ]}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Tab Content */}
                <View
                  style={[
                    styles.tabContent,
                    styles.tabContentInner,
                    {
                      marginTop: -1,
                      paddingTop: 0,
                      paddingHorizontal: isMobile ? 14 : 20,
                      paddingBottom: isMobile ? 14 : 20,
                    },
                  ]}
                >
                  {renderTabContent()}
                </View>

                {/* Next Steps footer */}
                {!assignedName && (
                  <View
                    style={[
                      styles.nextSteps,
                      { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
                    ]}
                  >
                    <View>
                      <Text
                        style={[styles.nextStepsLabel, { color: '#ea580c' }]}
                      >
                        Next Steps
                      </Text>
                      <Text
                        style={[styles.nextStepsText, { color: '#92400e' }]}
                      >
                        Unassigned · Assign this lead to a rep
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={onOpenFull}
                      style={[
                        styles.assignButton,
                        { borderColor: theme.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.assignButtonText,
                          { color: theme.accent },
                        ]}
                      >
                        assign to rep
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// =============================================
// STYLES
// =============================================
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sourceText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 70,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editIcon: {
    fontSize: 13,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fullButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
  },
  fullButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
  },
  mobileToggle: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 0,
  },
  leftPanel: {
    borderRightWidth: 1,
  },
  avatarSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  avatarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  nameContainer: {
    flex: 1,
    minWidth: 0,
  },
  leadName: {
    fontSize: 15,
    fontWeight: '700',
  },
  assignedName: {
    fontSize: 11,
    marginTop: 2,
  },
  nameInput: {
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  phoneButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  duplicateText: {
    fontSize: 10,
    fontWeight: '600',
  },
  contactsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.08,
    marginBottom: 8,
  },
  noContacts: {
    fontSize: 13,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  phoneNumber: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  phoneActions: {
    flexDirection: 'row',
    gap: 6,
  },
  phoneActionButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailText: {
    fontSize: 12,
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  editField: {
    marginBottom: 10,
  },
  editLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  editInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  sheetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  sheetBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  createdOn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    paddingVertical: 0,
  },
  tabsContent: {
    paddingHorizontal: 4,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 12,
  },
  tabContent: {
    flex: 1,
    minHeight: 0,
  },
  tabContentInner: {
    paddingBottom: 20,
  },
  nextSteps: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextStepsLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  nextStepsText: {
    fontSize: 12,
  },
  assignButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
  assignButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Dropdown styles
  dropdownButton: {
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 12,
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

export default LeadPreviewDrawer;
