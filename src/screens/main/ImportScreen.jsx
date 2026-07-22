import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useSelector } from 'react-redux';

import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../../components/ui/CustomToast';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { googleSheetsService } from '../../services/googleSheetsService';

// ─── UI Kit imports ────────────────────────────────────────────────────────
import ImprovedCard from '../../components/ui/ImprovedCard';
import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedTextInput from '../../components/ui/ImprovedTextInput';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import BottomSheet from '../../components/ui/BottomSheet';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FilterChip from '../../components/ui/FilterChip';
import IconButton from '../../components/ui/IconButton';

/* ══════════════════════════════════════════════
   GOOGLE SIGNIN CONFIG
══════════════════════════════════════════════ */
GoogleSignin.configure({
  webClientId:
    '66533216580-4s8r76d7cnb8tl4scit5h2glnmfqmn2i.apps.googleusercontent.com',
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],
  offlineAccess: true,
});

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const BASE_CRM_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'dealValue', label: 'Deal Value', required: false },
  { key: 'product', label: 'Product', required: false },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'closeDate', label: 'Close Date', required: false },
  { key: 'skip', label: '— Skip —', required: false },
];

const PALETTE = [
  '#185FA5',
  '#0F6E56',
  '#993C1D',
  '#993556',
  '#534AB7',
  '#3B6D11',
  '#854F0B',
  '#A32D2D',
];

/* ══════════════════════════════════════════════
   SOURCE REPORT BOTTOM SHEET
══════════════════════════════════════════════ */
const SourceReportModal = ({ visible, connections, onClose }) => {
  const { colors, borderRadius } = useUISystem();
  const total = connections.reduce((s, c) => s + (c.totalImported || 0), 0);
  const active = connections.filter(c => c.isActive).length;
  const errored = connections.filter(c => c.lastError).length;
  const maxVal = Math.max(...connections.map(c => c.totalImported || 0), 1);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Source Report"
      maxHeight="90%"
    >
      <View style={styles.metricRow}>
        {[
          { label: 'Total imported', val: total.toLocaleString('en-IN') },
          { label: 'Active sheets', val: active },
          { label: 'Errors', val: errored },
        ].map(card => (
          <ImprovedCard
            key={card.label}
            variant="outline"
            padding="medium"
            style={{ flex: 1 }}
          >
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
              {card.label}
            </Text>
            <Text style={[styles.metricVal, { color: colors.textPrimary }]}>
              {card.val}
            </Text>
          </ImprovedCard>
        ))}
      </View>

      <Text
        style={[
          styles.sectionLabel,
          { marginTop: 16, color: colors.textPrimary },
        ]}
      >
        Leads per sheet
      </Text>
      {connections.map((conn, i) => (
        <View key={conn._id} style={styles.barRow}>
          <Text
            style={[styles.barName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {conn.sheetName}
          </Text>
          <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${((conn.totalImported || 0) / maxVal) * 100}%`,
                  backgroundColor: PALETTE[i % PALETTE.length],
                },
              ]}
            />
          </View>
          <Text style={[styles.barVal, { color: colors.textPrimary }]}>
            {conn.totalImported || 0}
          </Text>
        </View>
      ))}

      <Text
        style={[
          styles.sectionLabel,
          { marginTop: 16, color: colors.textPrimary },
        ]}
      >
        Sheet Details
      </Text>
      <ImprovedCard
        variant="outline"
        padding="none"
        style={{ overflow: 'hidden' }}
      >
        {connections.map((conn, i) => (
          <View
            key={conn._id}
            style={[
              styles.tableRow,
              i > 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: PALETTE[i % PALETTE.length] },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.tableSheetName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {conn.sheetName}
              </Text>
              <Text
                style={[styles.tableSubtext, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                {conn.tabName} · {conn.googleEmail}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={[styles.tableImported, { color: colors.textPrimary }]}
              >
                {(conn.totalImported || 0).toLocaleString('en-IN')}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  conn.lastError
                    ? styles.badgeError
                    : conn.isActive
                    ? styles.badgeActive
                    : styles.badgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    conn.lastError
                      ? styles.badgeErrorText
                      : conn.isActive
                      ? styles.badgeActiveText
                      : styles.badgeInactiveText,
                  ]}
                >
                  {conn.lastError
                    ? 'Error'
                    : conn.isActive
                    ? 'Active'
                    : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>
        ))}
        {connections.length === 0 && (
          <Text style={styles.emptyText}>No connections to report on.</Text>
        )}
      </ImprovedCard>
    </BottomSheet>
  );
};

/* ══════════════════════════════════════════════
   ADD SHEET MODAL
══════════════════════════════════════════════ */
const AddSheetModal = ({ visible, onClose, onRegistered }) => {
  const { colors, typography, borderRadius } = useUISystem();
  const toast = useKitToast();

  const [googleUser, setGoogleUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [sheetTabs, setSheetTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [fetchingTabs, setFetchingTabs] = useState(false);
  const [registering, setRegistering] = useState(false);

  const showTabSelection = sheetTabs.length > 0;

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      setGoogleUser({
        email: userInfo.data?.user?.email || userInfo.user?.email,
        avatar: userInfo.data?.user?.photo || userInfo.user?.photo,
        accessToken: tokens.accessToken,
      });
    } catch (error) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        toast.error('Google sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await GoogleSignin.signOut();
    } catch {}
    setGoogleUser(null);
    setSheetUrl('');
    setSheetId('');
    setSheetName('');
    setSheetTabs([]);
    setSelectedTab('');
  };

  const extractSheetId = url => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleUrlSubmit = async () => {
    const id = extractSheetId(sheetUrl);
    if (!id) {
      toast.error('Please enter a valid Google Sheets URL');
      return;
    }
    setSheetId(id);
    setFetchingTabs(true);
    setSheetTabs([]);
    setSelectedTab('');
    try {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets.properties`,
        { headers: { Authorization: `Bearer ${googleUser.accessToken}` } },
      );
      const meta = await r.json();
      const name = meta.properties?.title || 'My Sheet';
      const tabs = (meta.sheets || []).map(s => s.properties.title);
      setSheetName(name);
      setSheetTabs(tabs.length ? tabs : ['Sheet1']);
      setSelectedTab(tabs[0] || 'Sheet1');
    } catch {
      toast.error('Could not fetch sheet tabs. Check URL and permissions.');
    } finally {
      setFetchingTabs(false);
    }
  };

  const handleRegister = async () => {
    if (!sheetId || !selectedTab) return;
    setRegistering(true);
    try {
      const result = await googleSheetsService.registerSheet({
        googleEmail: googleUser?.email || 'sync@shardacrm.com',
        sheetId,
        sheetName,
        tabName: selectedTab,
        sheetUrl,
        accessToken: googleUser?.accessToken || '',
      });
      onRegistered({ ...result, sheetName, tabName: selectedTab });
      setSheetUrl('');
      setSheetId('');
      setSheetName('');
      setSheetTabs([]);
      setSelectedTab('');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to register sheet');
    } finally {
      setRegistering(false);
    }
  };

  const handleBackToUrl = () => {
    setSheetTabs([]);
    setSelectedTab('');
    setSheetUrl('');
    setSheetId('');
    setSheetName('');
  };
  const handleClose = () => {
    setSheetUrl('');
    setSheetId('');
    setSheetName('');
    setSheetTabs([]);
    setSelectedTab('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalBox,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius['2xl'],
              borderTopRightRadius: borderRadius['2xl'],
            },
          ]}
        >
          {/* Grab handle — sheet feel */}
          <View style={styles.sheetHandleWrap}>
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.border }]}
            />
          </View>

          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[typography.h4, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                Add Google Sheet
              </Text>
              <Text
                style={[styles.modalSubtitle, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                {!googleUser
                  ? 'Step 1 of 3 — Sign in'
                  : !showTabSelection
                  ? 'Step 2 of 3 — Paste sheet URL'
                  : 'Step 3 of 3 — Select a tab'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Icon name="close" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ padding: 16 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* STEP 1: Google Account */}
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
              Google Account
            </Text>
            {!googleUser ? (
              <TouchableOpacity
                style={styles.googleSignInBtn}
                onPress={handleGoogleSignIn}
                disabled={signingIn}
              >
                {signingIn ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <View style={styles.googleIconBox}>
                      <Text style={styles.googleIconText}>G</Text>
                    </View>
                    <Text style={styles.googleSignInText}>
                      Sign in with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <ImprovedCard
                variant="outline"
                padding="medium"
                style={{ borderColor: colors.success }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {googleUser.avatar ? (
                    <Image
                      source={{ uri: googleUser.avatar }}
                      style={styles.avatar}
                    />
                  ) : (
                    <Avatar
                      name={googleUser.email}
                      size={36}
                      rounded={18}
                      variant="solid"
                    />
                  )}
                  <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                    <Text
                      style={[
                        styles.googleEmail,
                        { color: colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {googleUser.email}
                    </Text>
                    <Text style={styles.googleConnectedLabel}>Connected ✓</Text>
                  </View>
                  <ImprovedButton
                    title="Disconnect"
                    variant="ghost"
                    size="small"
                    onPress={handleDisconnect}
                    textStyle={{ color: colors.danger }}
                  />
                </View>
              </ImprovedCard>
            )}

            {/* STEP 2: Sheet URL */}
            {googleUser && !showTabSelection && (
              <>
                <View style={{ height: 20 }} />
                <ImprovedTextInput
                  label="Google Sheet URL *"
                  value={sheetUrl}
                  onChangeText={setSheetUrl}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  autoCapitalize="none"
                  keyboardType="url"
                  size="medium"
                />
                <View style={{ height: 14 }} />
                <ImprovedButton
                  title="Load Tabs"
                  icon="arrow-right"
                  variant="primary"
                  onPress={handleUrlSubmit}
                  loading={fetchingTabs}
                  disabled={fetchingTabs || !sheetUrl.trim()}
                  fullWidth
                />
              </>
            )}

            {/* STEP 3: Tab Selection */}
            {googleUser && showTabSelection && (
              <>
                <View style={{ height: 20 }} />
                <View style={addModalStyles.sheetChip}>
                  <Icon name="file-document" size={15} color="#0F9D58" />
                  <Text style={addModalStyles.sheetChipName} numberOfLines={1}>
                    {sheetName}
                  </Text>
                  <TouchableOpacity
                    onPress={handleBackToUrl}
                    style={{ padding: 2 }}
                  >
                    <Icon name="close" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <View style={{ height: 16 }} />
                <Text
                  style={[styles.inputLabel, { color: colors.textPrimary }]}
                >
                  Select a Tab *
                </Text>
                <Text
                  style={[
                    addModalStyles.tabHint,
                    { color: colors.textTertiary },
                  ]}
                >
                  Yeh sheet ke tabs hain — jo data import karna ho woh select
                  karo
                </Text>
                <View style={{ height: 10 }} />
                {sheetTabs.map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      addModalStyles.tabRow,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                      },
                      selectedTab === tab && addModalStyles.tabRowSelected,
                    ]}
                    onPress={() => setSelectedTab(tab)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        addModalStyles.tabIconBox,
                        selectedTab === tab &&
                          addModalStyles.tabIconBoxSelected,
                      ]}
                    >
                      <Icon
                        name="file-document"
                        size={14}
                        color={
                          selectedTab === tab
                            ? colors.primary
                            : colors.textTertiary
                        }
                      />
                    </View>
                    <Text
                      style={[
                        addModalStyles.tabLabel,
                        { color: colors.textSecondary },
                        selectedTab === tab && addModalStyles.tabLabelSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {tab}
                    </Text>
                    {selectedTab === tab && (
                      <Icon
                        name="check-circle"
                        size={16}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
                <View style={{ height: 20 }} />
                <ImprovedButton
                  title="Load Columns & Configure Mapping"
                  icon="upload"
                  variant="primary"
                  onPress={handleRegister}
                  loading={registering}
                  disabled={registering || !selectedTab}
                  fullWidth
                />
              </>
            )}
            <View style={{ height: 10 }} />
            <ImprovedButton
              title="Cancel"
              variant="outline"
              onPress={handleClose}
              fullWidth
            />
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ══════════════════════════════════════════════
   CUSTOM PICKER
══════════════════════════════════════════════ */
const CustomPicker = ({ value, options, onChange }) => {
  const { colors, borderRadius } = useUISystem();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.key === value);

  return (
    <View style={{ position: 'relative', width: 150 }}>
      <TouchableOpacity
        style={[
          customPickerStyles.trigger,
          {
            backgroundColor: colors.primarySoft,
            borderColor: colors.primaryBorder,
            borderRadius: borderRadius.lg,
          },
        ]}
        onPress={() => setOpen(!open)}
      >
        <Text
          style={[
            customPickerStyles.triggerText,
            { color: colors.textPrimary },
          ]}
          numberOfLines={1}
        >
          {selected?.label || 'Select field…'}
        </Text>
        <Icon name="chevron-down" size={14} color={colors.primary} />
      </TouchableOpacity>
      {open && (
        <View
          style={[
            customPickerStyles.dropdown,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[
                  customPickerStyles.option,
                  value === f.key && { backgroundColor: colors.primarySoft },
                ]}
                onPress={() => {
                  onChange(f.key);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    customPickerStyles.optionText,
                    { color: colors.textPrimary },
                    value === f.key && {
                      color: colors.primary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {f.label}
                  {f.required ? ' *' : ''}
                </Text>
                {value === f.key && (
                  <Icon name="check" size={14} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

/* ══════════════════════════════════════════════
   MAPPING MODAL
══════════════════════════════════════════════ */
const MappingModal = ({ visible, syncData, onSaved, onClose, settings }) => {
  const { colors, typography, borderRadius, spacing } = useUISystem();
  const toast = useKitToast();
  const [mappings, setMappings] = useState([]);
  const [fixedValues, setFixedValues] = useState([{ crmField: '', value: '' }]);
  const [saving, setSaving] = useState(false);

  const CRM_FIELDS = React.useMemo(() => {
    const customFields = (settings?.customColumns || [])
      .filter(c => c.visible)
      .map(c => ({ key: c.key, label: c.label, required: false }));
    return [
      ...BASE_CRM_FIELDS.filter(f => f.key !== 'skip'),
      ...customFields,
      { key: 'skip', label: '— Skip —', required: false },
    ];
  }, [settings]);

  useEffect(() => {
    if (syncData?.fieldMappings) setMappings(syncData.fieldMappings);
    if (syncData?.fixedValues)
      setFixedValues(
        syncData.fixedValues.length
          ? syncData.fixedValues
          : [{ crmField: '', value: '' }],
      );
  }, [syncData]);

  const updateMapping = (idx, crmField) =>
    setMappings(prev =>
      prev.map((m, i) => (i === idx ? { ...m, crmField } : m)),
    );

  const save = async () => {
    const mapped = mappings.map(m => m.crmField);
    if (!mapped.includes('name')) {
      toast.error('Map the Name column');
      return;
    }
    if (!mapped.includes('phone')) {
      toast.error('Map the Phone column');
      return;
    }
    const cleanFixed = fixedValues.filter(f => f.crmField && f.value);
    setSaving(true);
    try {
      await googleSheetsService.saveMapping(
        syncData.syncId,
        mappings,
        cleanFixed,
        syncData.isEdit ?? false,
      );
      toast.success(
        syncData.isEdit
          ? 'Mapping updated!'
          : 'Mapping saved! First import running…',
      );
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalBox,
            {
              maxHeight: '92%',
              paddingBottom: 20,
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius['2xl'],
              borderTopRightRadius: borderRadius['2xl'],
            },
          ]}
        >
          {/* Grab handle — sheet feel */}
          <View style={styles.sheetHandleWrap}>
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.border }]}
            />
          </View>

          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[typography.h4, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                Configure Field Mapping
              </Text>
              <Text
                style={[styles.modalSubtitle, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                {syncData?.sheetName} → {syncData?.tabName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ padding: spacing.lg }}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              Map sheet columns to CRM fields:
            </Text>
            {mappings.map((m, idx) => (
              <ImprovedCard
                key={idx}
                variant="outline"
                padding="medium"
                style={{ marginBottom: 8 }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        styles.mappingField,
                        { color: colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {m.sheetColumn}
                    </Text>
                    <Text
                      style={[
                        styles.mappingSample,
                        { color: colors.textTertiary },
                      ]}
                      numberOfLines={1}
                    >
                      Sample: {m.sampleData || '—'}
                    </Text>
                  </View>
                  <CustomPicker
                    value={m.crmField}
                    options={CRM_FIELDS}
                    onChange={key => updateMapping(idx, key)}
                  />
                </View>
              </ImprovedCard>
            ))}
            <Text
              style={[
                styles.sectionLabel,
                { marginTop: 20, color: colors.textPrimary },
              ]}
            >
              Fixed values for all leads:
            </Text>
            {fixedValues.map((fv, idx) => (
              <View
                key={idx}
                style={[styles.fixedRow, { alignItems: 'flex-start' }]}
              >
                <View style={{ flex: 1 }}>
                  <CustomPicker
                    value={fv.crmField}
                    options={BASE_CRM_FIELDS.filter(f => f.key !== 'skip')}
                    onChange={key =>
                      setFixedValues(prev =>
                        prev.map((f, i) =>
                          i === idx ? { ...f, crmField: key } : f,
                        ),
                      )
                    }
                  />
                </View>
                <ImprovedTextInput
                  value={fv.value}
                  onChangeText={val =>
                    setFixedValues(prev =>
                      prev.map((f, i) =>
                        i === idx ? { ...f, value: val } : f,
                      ),
                    )
                  }
                  placeholder="Fixed value…"
                  size="small"
                  containerStyle={{ flex: 1, marginLeft: 8 }}
                />
                <IconButton
                  name="trash-can-outline"
                  size={16}
                  color={colors.danger}
                  onPress={() =>
                    setFixedValues(prev => prev.filter((_, i) => i !== idx))
                  }
                  style={{ marginLeft: 8, marginTop: 4 }}
                />
              </View>
            ))}
            <ImprovedButton
              title="Add row"
              icon="plus"
              variant="ghost"
              size="small"
              onPress={() =>
                setFixedValues(prev => [...prev, { crmField: '', value: '' }])
              }
              style={{ marginTop: 4 }}
            />
            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                marginTop: 20,
                marginBottom: 40,
              }}
            >
              <ImprovedButton
                title="Back"
                variant="outline"
                onPress={onClose}
                disabled={saving}
                style={{ flex: 1 }}
              />
              <ImprovedButton
                title="Save Mapping & Start Sync"
                variant="primary"
                onPress={save}
                loading={saving}
                style={{ flex: 2 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ══════════════════════════════════════════════
   CONNECTION CARD
══════════════════════════════════════════════ */
const ConnectionCard = ({ conn, onDelete, onEditMapping }) => {
  const { colors, borderRadius } = useUISystem();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await googleSheetsService.deleteConnection(conn._id);
      onDelete(conn._id);
      setShowDeleteConfirm(false);
    } catch {
      Alert.alert('Error', 'Failed to remove connection');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ImprovedCard
        variant="outline"
        padding="medium"
        style={{ marginBottom: 10 }}
      >
        <View style={styles.connCardHeader}>
          <View
            style={[styles.sheetIconBox, { borderRadius: borderRadius.md }]}
          >
            <Icon name="file-document" size={18} color="#0F9D58" />
          </View>
          <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
            <Text
              style={[styles.connName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {conn.sheetName}
            </Text>
            <Text
              style={[styles.connSub, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              {conn.tabName} · {conn.googleEmail}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              conn.lastError
                ? styles.badgeError
                : conn.isActive
                ? styles.badgeActive
                : styles.badgeInactive,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                conn.lastError
                  ? styles.badgeErrorText
                  : conn.isActive
                  ? styles.badgeActiveText
                  : styles.badgeInactiveText,
              ]}
            >
              {conn.lastError ? 'Error' : conn.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <View style={styles.connStats}>
          <Text style={[styles.connStatText, { color: colors.textTertiary }]}>
            Imported:{' '}
            <Text style={[styles.connStatBold, { color: colors.textPrimary }]}>
              {(conn.totalImported || 0).toLocaleString('en-IN')}
            </Text>
          </Text>
          <Text style={[styles.connStatText, { color: colors.textTertiary }]}>
            Last sync:{' '}
            <Text style={[styles.connStatBold, { color: colors.textPrimary }]}>
              {conn.lastSyncedAt
                ? new Date(conn.lastSyncedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Never'}
            </Text>
          </Text>
        </View>
        {conn.lastError && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={12} color={colors.danger} />
            <Text style={styles.errorText} numberOfLines={2}>
              {conn.lastError}
            </Text>
          </View>
        )}
        <View style={styles.connActions}>
          <ImprovedButton
            title="Edit Mapping"
            icon="cog"
            variant="outline"
            size="small"
            onPress={() => onEditMapping(conn)}
          />
          {/* Remove — subtle ghost-danger (bada red solid button heavy lagta tha) */}
          <ImprovedButton
            title="Remove"
            icon="trash-can-outline"
            variant="ghost"
            size="small"
            onPress={() => setShowDeleteConfirm(true)}
            loading={deleting}
            textStyle={{ color: colors.danger }}
            style={{ marginLeft: 'auto' }}
          />
        </View>
      </ImprovedCard>
      <ConfirmDialog
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Remove Connection?"
        message={`"${conn.sheetName}" will be disconnected. Already imported leads won't be affected.`}
        confirmLabel="Yes, Remove"
        variant="danger"
        loading={deleting}
      />
    </>
  );
};

/* ══════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════ */
const ImportScreen = () => {
  const settings = useSelector(s => s.settings?.data);
  const { colors, borderRadius, spacing } = useUISystem();

  const [connections, setConnections] = useState([]);
  const [loadingConn, setLoadingConn] = useState(false);
  // Pull-to-refresh ka ALAG state — warna top indicator + section spinner
  // dono ek saath dikhke "double loader" ban jate hain
  const [refreshing, setRefreshing] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [showSourceReport, setShowSourceReport] = useState(false);
  const [syncData, setSyncData] = useState(null);

  // silent=true (pull-to-refresh) → sirf top indicator chale, cards waise rahe
  const loadConnections = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoadingConn(true);
    try {
      const data = await googleSheetsService.getConnections();
      setConnections(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      if (silent) setRefreshing(false);
      else setLoadingConn(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleRegistered = data => {
    setShowAddSheet(false);
    setSyncData(data);
    setShowMapping(true);
  };
  const handleMappingSaved = () => {
    setShowMapping(false);
    setSyncData(null);
    loadConnections();
  };
  const handleEditMapping = conn => {
    setSyncData({
      syncId: conn._id,
      sheetName: conn.sheetName,
      tabName: conn.tabName,
      fieldMappings: conn.fieldMappings,
      fixedValues: conn.fixedValues || [],
      isEdit: true,
    });
    setShowMapping(true);
  };

  const activeCount = connections.filter(c => c.isActive).length;
  const hasError = connections.some(c => c.lastError);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadConnections(true)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Slim header — title+subtitle left, + Sheet right ── */}
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.headerTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              Import Leads
            </Text>
            <Text
              style={[styles.headerSub, { color: colors.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Connect Google Sheets to auto-import leads
            </Text>
          </View>
          <ImprovedButton
            title="Sheet"
            icon="plus"
            size="small"
            onPress={() => setShowAddSheet(true)}
          />
        </View>

        {/* Dashboard Card */}
        <ImprovedCard
          variant="elevated"
          padding="large"
          style={{
            marginBottom: 16,
            borderColor: hasError ? colors.danger : colors.border,
          }}
        >
          <View style={styles.dashCardTop}>
            <View
              style={[styles.sheetIconLarge, { borderRadius: borderRadius.lg }]}
            >
              <Icon name="file-document" size={24} color="#0F9D58" />
            </View>
            <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
              <Text
                style={[styles.dashCardTitle, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                Google Sheets
              </Text>
              {/* Health chips — ek wrap row mein (Connected + Healthy / Error) */}
              <View style={styles.chipsRow}>
                {activeCount > 0 && (
                  <FilterChip
                    label={`Connected · ${activeCount}`}
                    active
                    color={colors.success}
                  />
                )}
                {hasError && (
                  <FilterChip
                    label={`Error · ${
                      connections.filter(c => c.lastError).length
                    }`}
                    active
                    color={colors.danger}
                  />
                )}
                {!hasError && activeCount > 0 && (
                  <FilterChip
                    label="All syncs healthy"
                    active
                    color={colors.success}
                  />
                )}
              </View>
            </View>
          </View>
          <Text style={[styles.dashCardDesc, { color: colors.textSecondary }]}>
            Connect your Google Sheet and create leads in Sharda CRM
          </Text>
          <View style={styles.dashActions}>
            <ImprovedButton
              title="Source Report"
              icon="chart-bar"
              variant="outline"
              size="small"
              onPress={() => setShowSourceReport(true)}
            />
            <ImprovedButton
              title="Refresh"
              icon="refresh"
              variant="outline"
              size="small"
              onPress={loadConnections}
            />
          </View>
        </ImprovedCard>

        {/* Connected Sheets — outer card HATAYA (double padding tha),
            ab connection cards full width pe */}
        {connections.length > 0 && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[styles.sectionTitle, { color: colors.textPrimary }]}
              >
                Connected Sheets
              </Text>
              <IconButton name="refresh" size={14} onPress={loadConnections} />
            </View>
            {loadingConn ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginTop: 16 }}
              />
            ) : (
              connections.map(conn => (
                <ConnectionCard
                  key={conn._id}
                  conn={conn}
                  onDelete={id =>
                    setConnections(prev => prev.filter(c => c._id !== id))
                  }
                  onEditMapping={handleEditMapping}
                />
              ))
            )}
          </View>
        )}

        {/* First load — blank na dikhe, ek center spinner */}
        {connections.length === 0 && loadingConn && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
        )}
        {connections.length === 0 && !loadingConn && (
          <EmptyState
            icon="link-variant"
            title="No sheets connected"
            message='Tap "+ Sheet" to connect your first Google Sheet'
          />
        )}
      </ScrollView>

      <AddSheetModal
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onRegistered={handleRegistered}
      />
      <MappingModal
        visible={showMapping}
        syncData={syncData}
        onSaved={handleMappingSaved}
        onClose={() => {
          setShowMapping(false);
          setSyncData(null);
        }}
        settings={settings}
      />
      <SourceReportModal
        visible={showSourceReport}
        connections={connections}
        onClose={() => setShowSourceReport(false)}
      />
    </View>
  );
};

/* ══════════════════════════════════════════════
   STYLES (reduced)
══════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 10, paddingBottom: 40 },

  // Slim header (Payments/Calendar standard)
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, marginTop: 1 },

  // Grab handle (modals)
  sheetHandleWrap: { alignItems: 'center', paddingTop: 8 },

  dashCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sheetIconLarge: {
    width: 44,
    height: 44,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashCardTitle: { fontSize: 15, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  dashCardDesc: { fontSize: 12, marginBottom: 12 },
  dashActions: { flexDirection: 'row', gap: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  connCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetIconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connName: { fontSize: 13, fontWeight: '700' },
  connSub: { fontSize: 11, marginTop: 2 },
  connStats: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  connStatText: { fontSize: 12 },
  connStatBold: { fontWeight: '600' },
  connActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  badgeActive: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  badgeActiveText: { color: '#16a34a' },
  badgeError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  badgeErrorText: { color: '#dc2626' },
  badgeInactive: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  badgeInactiveText: { color: '#6b7280' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  errorText: { fontSize: 11, color: '#dc2626', flex: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBox: { maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  mappingField: { fontSize: 13, fontWeight: '600' },
  mappingSample: { fontSize: 11, marginTop: 2 },
  fixedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  metricLabel: { fontSize: 10, marginBottom: 4 },
  metricVal: { fontSize: 20, fontWeight: '700' },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  barName: { fontSize: 11, width: 80 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  barVal: { fontSize: 11, width: 30, textAlign: 'right' },
  tableRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tableSheetName: { fontSize: 13, fontWeight: '600' },
  tableSubtext: { fontSize: 11, marginTop: 2 },
  tableImported: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  emptyText: { padding: 20, textAlign: 'center', fontSize: 13 },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 13,
  },
  googleIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: { fontSize: 14, fontWeight: '700', color: '#4285F4' },
  googleSignInText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  googleEmail: { fontSize: 13, fontWeight: '600' },
  googleConnectedLabel: { fontSize: 11, color: '#16a34a', marginTop: 2 },
  // Grab handle style yahan (sheetHandle bg color inline aata hai)
  sheetHandle: { width: 36, height: 4, borderRadius: 2 },
});

const addModalStyles = StyleSheet.create({
  sheetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetChipName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  tabHint: { fontSize: 11, marginBottom: 4, marginTop: -4 },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  tabRowSelected: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  tabIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconBoxSelected: { backgroundColor: '#dbeafe' },
  tabLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  tabLabelSelected: { color: '#2563eb', fontWeight: '600' },
});

const customPickerStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  triggerText: { flex: 1, fontSize: 12, fontWeight: '500' },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: 48,
    width: 200,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: { fontSize: 13 },
});

export default ImportScreen;
