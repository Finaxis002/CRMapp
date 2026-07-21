import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Linking,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../ui/CustomToast';
import { leadsService } from '../../services/leadsService.js';
import {
  useCallRecordingEvents,
  showRecordingToast,
} from '../../hooks/useCallRecordingEvents.js';

// UI Kit
import ImprovedButton from '../ui/ImprovedButton';
import ImprovedDropdown from '../ui/ImprovedDropdown';
import Avatar from '../ui/Avatar';
import IconButton from '../ui/IconButton';
import FilterChip from '../ui/FilterChip';

// Sub-tabs
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

const LeadPreviewDrawer = ({
  lead,
  visible,
  onClose,
  onOpenFull,
  users,
  activityRefreshTrigger,
  onRefresh,
  canEditAnyLead = false,

  mode = 'details',
}) => {
  const [activeTab, setActiveTab] = useState('Interactions');
  const [isEditing, setIsEditing] = useState(false);
  const [tempLead, setTempLead] = useState({});
  const [saving, setSaving] = useState(false);
  const [mobileView, setMobileView] = useState('info');

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const settings = useSelector(state => state.settings?.data || state.settings);
  const { colors, typography, spacing, borderRadius, isDark } = useUISystem();
  const toast = useKitToast();

  const showDetailsView = mode !== 'activity';
  const showActivityView = mode !== 'details';
  const showSegmentToggle = showDetailsView && showActivityView;
  const forcedView = showDetailsView && !showActivityView ? 'info' : 'tabs';
  const effectiveView = showSegmentToggle ? mobileView : forcedView;

  // Build theme object for sub-tabs (they still expect a theme prop)
  const theme = useMemo(
    () => ({
      bgDrawer: colors.background,
      bgSurface: colors.surface,
      bgContent: colors.backgroundSecondary,
      border: colors.border,
      borderSubtle: colors.borderLight,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textMuted: colors.textTertiary,
      statusBg: colors.purpleSoft,
      statusText: colors.purple,
      phoneBg: colors.successSoft,
      phoneIcon: colors.success,
      accent: colors.primary,
      danger: colors.danger,
      success: colors.success,
      inputBg: colors.backgroundSecondary,
    }),
    [colors],
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
      setMobileView(mode === 'details' ? 'info' : 'tabs');
    }
  }, [visible, lead, mode]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e =>
      setKeyboardHeight(e.endCoordinates?.height || 0),
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useCallRecordingEvents(event => {
    if (!visible) return;
    showRecordingToast(event);
    if (onRefresh) onRefresh();
  }, visible);

  if (!lead) return null;

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

  const updateTempField = (key, value) =>
    setTempLead(prev => ({ ...prev, [key]: value }));
  const updateCustomField = (key, value) =>
    setTempLead(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [key]: value },
    }));

  const validateBeforeSave = () => {
    const phoneRegex = /^\+?[1-9][0-9]{9,14}$/;
    if (!tempLead.name?.trim()) {
      toast.error('Lead name is required.');
      return false;
    }
    if (tempLead.phone) {
      const rawDigits = tempLead.phone.replace(/\D/g, '');
      if (!phoneRegex.test(tempLead.phone) || rawDigits.length < 10) {
        toast.error('Please enter a valid phone number.');
        return false;
      }
    }
    if (tempLead.alternatePhone) {
      const altDigits = String(tempLead.alternatePhone).replace(/\D/g, '');
      if (!phoneRegex.test(tempLead.alternatePhone) || altDigits.length < 10) {
        toast.error('Please enter a valid alternate phone.');
        return false;
      }
    }
    if (tempLead.email && tempLead.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tempLead.email.trim())) {
        toast.error('Please enter a valid email.');
        return false;
      }
    }
    if (
      tempLead.dealValue !== undefined &&
      tempLead.dealValue !== '' &&
      tempLead.dealValue !== null
    ) {
      if (isNaN(Number(tempLead.dealValue)) || Number(tempLead.dealValue) < 0) {
        toast.error('Deal value must be a valid positive number.');
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
            ? tempLead.assignedTo?._id || ''
            : tempLead.assignedTo || '',
        coAssignees: Array.isArray(tempLead.coAssignees)
          ? tempLead.coAssignees
              .map(u => (typeof u === 'object' ? u?._id || '' : u))
              .filter(Boolean)
          : [],
      };
      if (customColumns.length && tempLead.customFields)
        payload.customFields = { ...tempLead.customFields };
      await leadsService.updateLead(lead._id, payload);
      toast.success('Lead updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const assignedName = getAssignedName(lead);
  const coAssigneesNames = getCoAssigneeNames(lead);
  const contactPhones = [lead.phone, lead.alternatePhone || ''].filter(Boolean);
  const primaryPhone = contactPhones[0] || '';

  const openPhone = phoneNumber => {
    const rawPhone = String(phoneNumber || '').trim();
    if (!rawPhone) return;
    const hasCountryCode =
      rawPhone.startsWith('+') || rawPhone.replace(/\D/g, '').length > 10;
    const cleanDigits = rawPhone.replace(/\D/g, '');
    Linking.openURL(
      hasCountryCode
        ? rawPhone.startsWith('+')
          ? `tel:${rawPhone}`
          : `tel:+${rawPhone}`
        : `tel:+91${cleanDigits}`,
    );
  };
  const openWhatsapp = phoneNumber => {
    const rawPhone = String(phoneNumber || '').trim();
    if (!rawPhone) return;
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const hasCountryCode = rawPhone.startsWith('+') || cleanDigits.length > 10;
    Linking.openURL(
      hasCountryCode
        ? `https://wa.me/${cleanDigits}`
        : `https://wa.me/91${cleanDigits}`,
    );
  };

  const renderTabContent = () => {
    const tabProps = {
      leadId: lead._id,
      users,
      theme,
      activityRefreshTrigger,
      onActivitySaved: onRefresh,
    };
    switch (activeTab) {
      case 'Notes':
        return <NotesTab {...tabProps} />;
      case 'Tasks':
        return <TasksTab {...tabProps} />;
      case 'Calls':
        return <CallsTab {...tabProps} />;
      case 'Emails':
        return <EmailsTab {...tabProps} />;
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
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {label}
          </Text>
          <Text
            style={[
              typography.body2,
              {
                color: colors.textPrimary,
                fontWeight: '500',
                fontSize: 12,
                textAlign: 'right',
                flexShrink: 1,
              },
            ]}
          >
            {value}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ marginBottom: spacing.sm }}>
        <Text
          style={[
            typography.overline,
            { color: colors.textTertiary, marginBottom: 3 },
          ]}
        >
          {label}
        </Text>
        {options ? (
          <ImprovedDropdown
            items={options.map(o => ({ value: o, label: o }))}
            selectedValue={tempLead[field] || ''}
            onValueChange={v => updateTempField(field, v)}
            searchable={false}
          />
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
            onChangeText={v => updateTempField(field, v)}
            placeholderTextColor={colors.placeholder}
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary,
                color: colors.textPrimary,
                borderRadius: borderRadius.sm,
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
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {label}
          </Text>
          <Text
            style={[
              typography.body2,
              {
                color: colors.textPrimary,
                fontWeight: '500',
                fontSize: 12,
                textAlign: 'right',
                flexShrink: 1,
              },
            ]}
          >
            {value}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ marginBottom: spacing.sm }}>
        <Text
          style={[
            typography.overline,
            { color: colors.textTertiary, marginBottom: 3 },
          ]}
        >
          {label}
        </Text>
        <TextInput
          value={tempLead.customFields?.[key] || ''}
          onChangeText={v => updateCustomField(key, v)}
          placeholderTextColor={colors.placeholder}
          style={[
            styles.input,
            {
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
              color: colors.textPrimary,
              borderRadius: borderRadius.sm,
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
        style={{ flex: 1 }}
      >
        <SafeAreaView
          style={[
            { flex: 1, backgroundColor: colors.background },
            Platform.OS === 'android' && keyboardHeight > 0
              ? { paddingBottom: keyboardHeight }
              : null,
          ]}
          edges={['top', 'bottom']}
        >
          {/* Top Bar */}
          <View
            style={[
              styles.topBar,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.topLeft}>
              <IconButton
                name="arrow-left"
                size={20}
                color={colors.textSecondary}
                onPress={onClose}
                style={{
                  borderWidth: 0,
                  width: 28,
                  height: 28,
                  backgroundColor: 'transparent',
                }}
              />
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: colors.purpleSoft },
                ]}
              >
                <Text
                  style={[
                    typography.overline,
                    { color: colors.purple, fontSize: 11 },
                  ]}
                >
                  {lead.status || 'New'}
                </Text>
              </View>
              <Text
                style={[typography.caption, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                {lead.source || '-'}
              </Text>
            </View>
            <View style={styles.topActions}>
              {canEditAnyLead && showDetailsView ? (
                isEditing ? (
                  <>
                    <ImprovedButton
                      title={saving ? 'Saving...' : 'Save'}
                      size="small"
                      variant="primary"
                      onPress={handleQuickSave}
                      loading={saving}
                      disabled={saving}
                      style={{ backgroundColor: colors.success }}
                    />
                    <IconButton
                      name="close"
                      size={14}
                      color={colors.danger}
                      onPress={() => {
                        setIsEditing(false);
                        setTempLead(lead);
                      }}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.danger,
                        borderRadius: borderRadius.sm,
                        width: 30,
                        height: 30,
                      }}
                    />
                  </>
                ) : effectiveView === 'info' ? (
                  <ImprovedButton
                    title="Edit"
                    icon="pencil-outline"
                    size="small"
                    variant="secondary"
                    onPress={() => {
                      setTempLead(lead);
                      setIsEditing(true);
                    }}
                  />
                ) : null
              ) : null}
            </View>
          </View>

          {/* Segment Toggle — only when both views enabled */}
          {showSegmentToggle ? (
            <View
              style={[
                styles.segmentBar,
                {
                  backgroundColor: colors.surface,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              {[
                { key: 'tabs', label: 'Activity' },
                { key: 'info', label: 'Details' },
              ].map(seg => (
                <FilterChip
                  key={seg.key}
                  label={seg.label}
                  active={mobileView === seg.key}
                  onPress={() => setMobileView(seg.key)}
                  style={{ flex: 1, justifyContent: 'center' }}
                />
              ))}
            </View>
          ) : null}

          {/* Body */}
          <View style={{ flex: 1 }}>
            {effectiveView === 'info' ? (
              <ScrollView
                style={{ flex: 1, backgroundColor: colors.surface }}
                showsVerticalScrollIndicator={false}
              >
                {/* Avatar Section */}
                <View
                  style={[
                    styles.avatarSection,
                    { borderBottomColor: colors.borderLight },
                  ]}
                >
                  <View style={styles.avatarRow}>
                    <Avatar
                      name={isEditing ? tempLead.name : lead.name}
                      size={44}
                      rounded={borderRadius.md}
                      variant="solid"
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <TextInput
                          value={tempLead.name || ''}
                          onChangeText={v => updateTempField('name', v)}
                          style={[
                            styles.nameInput,
                            {
                              color: colors.textPrimary,
                              backgroundColor: colors.backgroundSecondary,
                              borderColor: colors.border,
                              borderRadius: borderRadius.sm,
                            },
                          ]}
                          placeholder="Lead name *"
                          placeholderTextColor={colors.placeholder}
                        />
                      ) : (
                        <Text
                          style={[
                            typography.h4,
                            { color: colors.textPrimary, fontSize: 15 },
                          ]}
                        >
                          {lead.name || '-'}
                        </Text>
                      )}
                      {assignedName ? (
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textTertiary, marginTop: 2 },
                          ]}
                        >
                          {assignedName}
                        </Text>
                      ) : null}
                      {coAssigneesNames ? (
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textTertiary, marginTop: 2 },
                          ]}
                        >
                          Co-assignees: {coAssigneesNames}
                        </Text>
                      ) : null}
                    </View>
                    {primaryPhone && !isEditing ? (
                      <IconButton
                        name="phone-outline"
                        size={15}
                        color={colors.success}
                        backgroundColor={colors.successSoft}
                        onPress={() => openPhone(primaryPhone)}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                      />
                    ) : null}
                  </View>
                  {lead.isDuplicate ? (
                    <View
                      style={[
                        styles.repeatBadge,
                        { backgroundColor: colors.warningSoft },
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: colors.warning,
                            fontWeight: '600',
                            fontSize: 10,
                          },
                        ]}
                      >
                        Repeat
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Contact Numbers (view mode) */}
                {!isEditing && (
                  <View
                    style={[
                      styles.section,
                      { borderBottomColor: colors.borderLight },
                    ]}
                  >
                    <Text
                      style={[
                        typography.overline,
                        {
                          color: colors.textTertiary,
                          marginBottom: spacing.sm,
                        },
                      ]}
                    >
                      Contact Numbers
                    </Text>
                    {contactPhones.length === 0 ? (
                      <Text
                        style={[
                          typography.body2,
                          { color: colors.textPrimary, fontSize: 13 },
                        ]}
                      >
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
                            color={colors.textSecondary}
                          />
                          <Text
                            style={[
                              typography.body2,
                              {
                                color: colors.textPrimary,
                                fontWeight: '500',
                                fontSize: 13,
                              },
                            ]}
                          >
                            {displayPhone}
                          </Text>
                          <View style={styles.phoneActions}>
                            <IconButton
                              name="phone-outline"
                              size={12}
                              color={colors.textSecondary}
                              backgroundColor={colors.backgroundSecondary}
                              onPress={() => openPhone(rawPhone)}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                              }}
                            />
                            <IconButton
                              name="whatsapp"
                              size={12}
                              color={colors.success}
                              backgroundColor={colors.successSoft}
                              onPress={() => openWhatsapp(rawPhone)}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                              }}
                            />
                          </View>
                        </View>
                      );
                    })}
                    {lead.email ? (
                      <View style={styles.emailRow}>
                        <Icon
                          name="email-outline"
                          size={13}
                          color={colors.textSecondary}
                        />
                        <Text
                          style={[
                            typography.body2,
                            {
                              color: colors.textPrimary,
                              fontSize: 12,
                              flex: 1,
                            },
                          ]}
                        >
                          {lead.email}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Lead Info */}
                <View
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    paddingBottom: spacing['2xl'],
                  }}
                >
                  <Text
                    style={[
                      typography.overline,
                      { color: colors.textTertiary, marginBottom: spacing.sm },
                    ]}
                  >
                    Lead Info
                  </Text>
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
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Deal Value
                      </Text>
                      <Text
                        style={[
                          typography.body2,
                          {
                            color: colors.textPrimary,
                            fontWeight: '500',
                            fontSize: 12,
                          },
                        ]}
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
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Sheet
                      </Text>
                      <View
                        style={[
                          styles.sheetBadge,
                          { backgroundColor: colors.successSoft },
                        ]}
                      >
                        <Icon
                          name="clipboard-text-outline"
                          size={11}
                          color={colors.success}
                        />
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.success, fontWeight: '600' },
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
                            ? colors.border
                            : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Created On
                      </Text>
                      <Text
                        style={[
                          typography.body2,
                          {
                            color: colors.textPrimary,
                            fontWeight: '500',
                            fontSize: 12,
                          },
                        ]}
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
                style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}
              >
                {/* Tabs */}
                <View
                  style={[
                    styles.tabsWrap,
                    {
                      backgroundColor: colors.surface,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ height: 39, alignItems: 'center' }}
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
                                ? colors.primary
                                : 'transparent',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              typography.caption,
                              {
                                color: active
                                  ? colors.primary
                                  : colors.textSecondary,
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
                <View style={{ flex: 1, padding: 14 }}>
                  {renderTabContent()}
                </View>
                {!assignedName ? (
                  <View
                    style={[
                      styles.nextSteps,
                      {
                        borderColor: colors.warningSoft,
                        backgroundColor: isDark ? '#451a03' : '#fff7ed',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          typography.overline,
                          { color: colors.warning, marginBottom: 2 },
                        ]}
                      >
                        Next Steps
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          { color: isDark ? '#fde68a' : '#92400e' },
                        ]}
                      >
                        Unassigned · Assign this lead to a rep
                      </Text>
                    </View>
                    <ImprovedButton
                      title="assign to rep"
                      size="small"
                      variant="outline"
                      onPress={onOpenFull}
                    />
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

const styles = {
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
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  segmentBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  avatarSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  repeatBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  section: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  phoneActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 10,
  },
  input: {
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    fontSize: 12,
  },
  sheetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
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
  tabsWrap: {
    height: 40,
    maxHeight: 40,
    borderBottomWidth: 1,
    paddingHorizontal: 4,
    flexShrink: 0,
    flexGrow: 0,
  },
  tabBtn: {
    height: 39,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 2,
  },
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
};

export default LeadPreviewDrawer;
