import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Feather';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { googleSheetsService } from '../../services/googleSheetsService';

/* ══════════════════════════════════════════════
   GOOGLE SIGNIN CONFIG
══════════════════════════════════════════════ */
GoogleSignin.configure({
  webClientId: '66533216580-4s8r76d7cnb8tl4scit5h2glnmfqmn2i.apps.googleusercontent.com',
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
  '#185FA5', '#0F6E56', '#993C1D', '#993556',
  '#534AB7', '#3B6D11', '#854F0B', '#A32D2D',
];

/* ══════════════════════════════════════════════
   SOURCE REPORT MODAL
══════════════════════════════════════════════ */
const SourceReportModal = ({ visible, connections, onClose }) => {
  const { isDark } = useTheme();
const t = {
  bg: isDark ? '#1e293b' : '#ffffff',
  border: isDark ? '#334155' : '#e5e7eb',
  text: isDark ? '#f1f5f9' : '#111827',
  subtext: isDark ? '#94a3b8' : '#9ca3af',
  inputBg: isDark ? '#0f172a' : '#f9fafb',
  overlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)',
};
  const total = connections.reduce((s, c) => s + (c.totalImported || 0), 0);
  const active = connections.filter(c => c.isActive).length;
  const errored = connections.filter(c => c.lastError).length;
  const maxVal = Math.max(...connections.map(c => c.totalImported || 0), 1);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: t.overlay }]}>
  <View style={[styles.modalBox, { backgroundColor: t.bg, borderColor: t.border }]}>
          <View style={[styles.modalHeader, { borderColor: isDark ? '#334155' : '#f3f4f6' }]}>
            <View>
              <Text style={[styles.modalTitle, { color: t.text }]}>Source Report</Text>
<Text style={[styles.modalSubtitle, { color: t.subtext }]}>Leads imported per connected sheet</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

         <ScrollView 
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ paddingBottom: 40 }}
>
            <View style={styles.metricRow}>
              {[
                { label: 'Total imported', val: total.toLocaleString('en-IN') },
                { label: 'Active sheets', val: active },
                { label: 'Errors', val: errored },
              ].map(card => (
                <View key={card.label} style={[styles.metricCard, { backgroundColor: t.inputBg, borderColor: t.border }]}>
  <Text style={[styles.metricLabel, { color: t.subtext }]}>{card.label}</Text>
  <Text style={[styles.metricVal, { color: t.text }]}>{card.val}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { paddingHorizontal: 16, marginTop: 16, color: t.text }]}>Leads per sheet</Text>
            {connections.map((conn, i) => (
              <View key={conn._id} style={styles.barRow}>
               <Text style={[styles.barName, { color: t.text }]} numberOfLines={1}>{conn.sheetName}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, {
                    width: `${((conn.totalImported || 0) / maxVal) * 100}%`,
                    backgroundColor: PALETTE[i % PALETTE.length],
                  }]} />
                </View>
                <Text style={[styles.barVal, { color: t.text }]}>{conn.totalImported || 0}</Text>
              </View>
            ))}

            <Text style={[styles.sectionLabel, { paddingHorizontal: 16, marginTop: 16, color: t.text }]}>Sheet Details</Text>
            <View style={[styles.tableBox, { borderColor: t.border }]}>
              {connections.map((conn, i) => (
                <View key={conn._id} style={[styles.tableRow, i > 0 && styles.tableRowBorder]}>
                  <View style={[styles.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tableSheetName, { color: t.text }]} numberOfLines={1}>{conn.sheetName}</Text>
<Text style={[styles.tableSubtext, { color: t.subtext }]}>{conn.tabName} · {conn.googleEmail}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.tableImported, { color: t.text }]}>{(conn.totalImported || 0).toLocaleString('en-IN')}</Text>
                    <View style={[
                      styles.statusBadge,
                      conn.lastError ? styles.badgeError : conn.isActive ? styles.badgeActive : styles.badgeInactive,
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        conn.lastError ? styles.badgeErrorText : conn.isActive ? styles.badgeActiveText : styles.badgeInactiveText,
                      ]}>
                        {conn.lastError ? 'Error' : conn.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              {connections.length === 0 && (
                <Text style={styles.emptyText}>No connections to report on.</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ══════════════════════════════════════════════
   ADD SHEET MODAL — Web jaisa flow
   Step 1: Google Sign-In
   Step 2: Sheet URL paste → Load Tabs
   Step 3: Tab select → Configure Mapping
══════════════════════════════════════════════ */
const AddSheetModal = ({ visible, onClose, onRegistered }) => {
  const { isDark } = useTheme();
const t = {
  bg: isDark ? '#1e293b' : '#ffffff',
  border: isDark ? '#334155' : '#e5e7eb',
  text: isDark ? '#f1f5f9' : '#111827',
  subtext: isDark ? '#94a3b8' : '#9ca3af',
  inputBg: isDark ? '#0f172a' : '#f9fafb',
  overlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)',
};
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

  /* ── Google Sign-In ── */
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
        Alert.alert('Sign-in Error', 'Google sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleDisconnect = async () => {
    try { await GoogleSignin.signOut(); } catch {}
    setGoogleUser(null);
    setSheetUrl('');
    setSheetId('');
    setSheetName('');
    setSheetTabs([]);
    setSelectedTab('');
  };

  /* ── Extract Sheet ID from URL ── */
  const extractSheetId = (url) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  /* ── Step 2: URL submit → fetch tabs ── */
  const handleUrlSubmit = async () => {
    const id = extractSheetId(sheetUrl);
    if (!id) {
      Alert.alert('Invalid URL', 'Please enter a valid Google Sheets URL');
      return;
    }
    setSheetId(id);
    setFetchingTabs(true);
    setSheetTabs([]);
    setSelectedTab('');
    try {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets.properties`,
        { headers: { Authorization: `Bearer ${googleUser.accessToken}` } }
      );
      const meta = await r.json();
      const name = meta.properties?.title || 'My Sheet';
      const tabs = (meta.sheets || []).map(s => s.properties.title);
      setSheetName(name);
      setSheetTabs(tabs.length ? tabs : ['Sheet1']);
      setSelectedTab(tabs[0] || 'Sheet1');
    } catch {
      Alert.alert('Error', 'Could not fetch sheet tabs. Check URL and permissions.');
    } finally {
      setFetchingTabs(false);
    }
  };

  /* ── Step 3: Register + open mapping ── */
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
      // reset state
      setSheetUrl(''); setSheetId(''); setSheetName('');
      setSheetTabs([]); setSelectedTab('');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to register sheet');
    } finally {
      setRegistering(false);
    }
  };

  /* ── Go back to URL step ── */
  const handleBackToUrl = () => {
    setSheetTabs([]);
    setSelectedTab('');
    setSheetUrl('');
    setSheetId('');
    setSheetName('');
  };

  const handleClose = () => {
    setSheetUrl(''); setSheetId(''); setSheetName('');
    setSheetTabs([]); setSelectedTab('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={[styles.modalOverlay, { backgroundColor: t.overlay }]}>
  <View style={[styles.modalBox, { backgroundColor: t.bg, borderColor: t.border }]}>

          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: t.text }]}>Add Google Sheet</Text>
<Text style={[styles.modalSubtitle, { color: t.subtext }]}>
                {!googleUser
                  ? 'Step 1 of 3 — Sign in'
                  : !showTabSelection
                  ? 'Step 2 of 3 — Paste sheet URL'
                  : 'Step 3 of 3 — Select a tab'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Icon name="x" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView 
  style={{ padding: 16 }} 
  contentContainerStyle={{ paddingBottom: 40 }}
  showsVerticalScrollIndicator={false}
>

            {/* ════ STEP 1: Google Account ════ */}
            <Text style={[styles.inputLabel, { color: t.text }]}>Google Account</Text>
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
                    <Text style={styles.googleSignInText}>Sign in with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.googleConnectedBox, { backgroundColor: isDark ? '#0f172a' : '#f0fdf4', borderColor: isDark ? '#334155' : '#86efac' }]}>
                {googleUser.avatar ? (
                  <Image source={{ uri: googleUser.avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {googleUser.email?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.googleEmail, { color: t.text }]} numberOfLines={1}>{googleUser.email}</Text>
                  <Text style={styles.googleConnectedLabel}>Connected ✓</Text>
                </View>
                <TouchableOpacity onPress={handleDisconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ════ STEP 2: Sheet URL (Google sign-in ke baad, tabs aane se pehle) ════ */}
            {googleUser && !showTabSelection && (
              <>
                <View style={{ height: 20 }} />
                <Text style={[styles.inputLabel, { color: t.text }]}>Google Sheet URL *</Text>
<TextInput
  style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
  value={sheetUrl}
                  onChangeText={setSheetUrl}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <View style={{ height: 14 }} />
                <TouchableOpacity
                  style={[styles.primaryBtn, (fetchingTabs || !sheetUrl.trim()) && styles.btnDisabled]}
                  onPress={handleUrlSubmit}
                  disabled={fetchingTabs || !sheetUrl.trim()}
                >
                  {fetchingTabs ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="arrow-right" size={15} color="#fff" />
                      <Text style={styles.primaryBtnText}>Load Tabs</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ════ STEP 3: Tab Selection (tabs fetch hone ke baad) ════ */}
            {googleUser && showTabSelection && (
              <>
                <View style={{ height: 20 }} />

                {/* Sheet name chip */}
                <View style={addModalStyles.sheetChip}>
                  <Icon name="file-text" size={15} color="#0F9D58" />
                  <Text style={addModalStyles.sheetChipName} numberOfLines={1}>{sheetName}</Text>
                  <TouchableOpacity onPress={handleBackToUrl} style={{ padding: 2 }}>
                    <Icon name="x" size={14} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                <View style={{ height: 16 }} />
                <Text style={[styles.inputLabel, { color: t.text }]}>Select a Tab *</Text>
<Text style={[addModalStyles.tabHint, { color: t.subtext }]}>
                  Yeh sheet ke tabs hain — jo data import karna ho woh select karo
                </Text>
                <View style={{ height: 10 }} />

                {sheetTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                   style={[
  addModalStyles.tabRow,
  { backgroundColor: t.inputBg, borderColor: t.border },
  selectedTab === tab && addModalStyles.tabRowSelected,
]}
                    onPress={() => setSelectedTab(tab)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      addModalStyles.tabIconBox,
                      selectedTab === tab && addModalStyles.tabIconBoxSelected,
                    ]}>
                      <Icon
                        name="file-text"
                        size={14}
                        color={selectedTab === tab ? '#2563eb' : '#9ca3af'}
                      />
                    </View>
                    <Text style={[
  addModalStyles.tabLabel,
  { color: t.subtext },
  selectedTab === tab && addModalStyles.tabLabelSelected,
]}>
                      {tab}
                    </Text>
                    {selectedTab === tab && (
                      <Icon name="check-circle" size={16} color="#2563eb" />
                    )}
                  </TouchableOpacity>
                ))}

                <View style={{ height: 20 }} />
                <TouchableOpacity
                  style={[styles.primaryBtn, (registering || !selectedTab) && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={registering || !selectedTab}
                >
                  {registering ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="upload" size={15} color="#fff" />
                      <Text style={styles.primaryBtnText}>Load Columns & Configure Mapping</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 10 }} />
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ══════════════════════════════════════════════
   MAPPING MODAL
══════════════════════════════════════════════ */
const { Picker } = require('@react-native-picker/picker');

const MappingModal = ({ visible, syncData, onSaved, onClose, settings }) => {
  const { isDark } = useTheme();
const t = {
  bg: isDark ? '#1e293b' : '#ffffff',
  border: isDark ? '#334155' : '#e5e7eb',
  text: isDark ? '#f1f5f9' : '#111827',
  subtext: isDark ? '#94a3b8' : '#9ca3af',
  inputBg: isDark ? '#0f172a' : '#f9fafb',
  overlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)',
  rowBg: isDark ? '#0f172a' : '#f9fafb',
};
  const [mappings, setMappings] = useState([]);
  const [fixedValues, setFixedValues] = useState([{ crmField: '', value: '' }]);
  const [saving, setSaving] = useState(false);
const [openPickerIdx, setOpenPickerIdx] = useState(null);
const [openFixedPickerIdx, setOpenFixedPickerIdx] = useState(null);
  const CRM_FIELDS = React.useMemo(() => {
    const customFields = (settings?.customColumns || [])
      .filter(c => c.visible)
      .map(c => ({ key: c.key, label: c.label, required: false }));
    return [...BASE_CRM_FIELDS.filter(f => f.key !== 'skip'), ...customFields, { key: 'skip', label: '— Skip —', required: false }];
  }, [settings]);

  useEffect(() => {
    if (syncData?.fieldMappings) setMappings(syncData.fieldMappings);
    if (syncData?.fixedValues) setFixedValues(syncData.fixedValues.length ? syncData.fixedValues : [{ crmField: '', value: '' }]);
  }, [syncData]);

  const updateMapping = (idx, crmField) =>
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, crmField } : m));

  const save = async () => {
    const mapped = mappings.map(m => m.crmField);
    if (!mapped.includes('name')) { Alert.alert('Required', 'Map the Name column'); return; }
    if (!mapped.includes('phone')) { Alert.alert('Required', 'Map the Phone column'); return; }
    const cleanFixed = fixedValues.filter(f => f.crmField && f.value);
    setSaving(true);
    try {
      await googleSheetsService.saveMapping(syncData.syncId, mappings, cleanFixed, syncData.isEdit ?? false);
      Alert.alert('Success', syncData.isEdit ? 'Mapping updated!' : 'Mapping saved! First import running…');
      onSaved();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: t.overlay }]}>
  <View style={[styles.modalBox, { maxHeight: '92%', paddingBottom: 20, backgroundColor: t.bg, borderColor: t.border }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: t.text }]}>Configure Field Mapping</Text>
<Text style={[styles.modalSubtitle, { color: t.subtext }]}>{syncData?.sheetName} → {syncData?.tabName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView 
  style={{ padding: 16 }} 
  contentContainerStyle={{ paddingBottom: 60 }}
  showsVerticalScrollIndicator={false}
>
            <Text style={[styles.sectionLabel, { color: t.text }]}>Map sheet columns to CRM fields:</Text>

            {mappings.map((m, idx) => (
  <View key={idx} style={[styles.mappingRow, { zIndex: openPickerIdx === idx ? 100 : 1, backgroundColor: t.rowBg, borderColor: t.border }]}>
    <View style={{ flex: 1 }}>
     <Text style={[styles.mappingField, { color: t.text }]}>{m.sheetColumn}</Text>
<Text style={[styles.mappingSample, { color: t.subtext }]} numberOfLines={1}>
        Sample: {m.sampleData || '—'}
      </Text>
    </View>

    <View style={{ position: 'relative' }}>
      <TouchableOpacity
        style={[customPickerStyles.trigger, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', borderColor: isDark ? '#3b82f6' : '#bfdbfe' }]}
onPress={() => setOpenPickerIdx(openPickerIdx === idx ? null : idx)}
      >
        <Text style={customPickerStyles.triggerText} numberOfLines={1}>
          {CRM_FIELDS.find(f => f.key === m.crmField)?.label || 'Select field…'}
        </Text>
        <Icon name="chevron-down" size={14} color="#2563eb" />
      </TouchableOpacity>

      {openPickerIdx === idx && (
        <View style={[customPickerStyles.dropdown, { backgroundColor: t.bg, borderColor: t.border }]}>
  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {CRM_FIELDS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[
                  customPickerStyles.option,
                  m.crmField === f.key && customPickerStyles.optionSelected,
                ]}
                onPress={() => {
                  updateMapping(idx, f.key);
                  setOpenPickerIdx(null);
                }}
              >
                <Text style={[
                  customPickerStyles.optionText,
                  m.crmField === f.key && customPickerStyles.optionTextSelected,
                ]}>
                  {f.label}{f.required ? ' *' : ''}
                </Text>
                {m.crmField === f.key && <Icon name="check" size={14} color="#2563eb" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  </View>
))}

            <Text style={[styles.sectionLabel, { marginTop: 20, color: t.text }]}>Fixed values for all leads:</Text>
            {fixedValues.map((fv, idx) => (
  <View key={idx} style={[styles.fixedRow, { zIndex: openFixedPickerIdx === idx ? 100 : 1, alignItems: 'flex-start' }]}>
    <View style={{ position: 'relative', flex: 1 }}>
      <TouchableOpacity
        style={[customPickerStyles.trigger, { width: '100%', backgroundColor: t.inputBg, borderColor: t.border }]}
        onPress={() => setOpenFixedPickerIdx(openFixedPickerIdx === idx ? null : idx)}
      >
        <Text style={[customPickerStyles.triggerText, { color: t.text }]} numberOfLines={1}>
          {BASE_CRM_FIELDS.find(f => f.key === fv.crmField)?.label || 'Select…'}
        </Text>
       <Icon name="chevron-down" size={14} color={t.subtext} />
      </TouchableOpacity>

      {openFixedPickerIdx === idx && (
        <View style={[customPickerStyles.dropdown, { right: 'auto', left: 0, width: '100%', backgroundColor: t.bg, borderColor: t.border }]}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {BASE_CRM_FIELDS.filter(f => f.key !== 'skip').map(f => (
              <TouchableOpacity
                key={f.key}
                style={[
                  customPickerStyles.option,
                  fv.crmField === f.key && customPickerStyles.optionSelected,
                ]}
                onPress={() => {
                  setFixedValues(prev => prev.map((item, i) => i === idx ? { ...item, crmField: f.key } : item));
                  setOpenFixedPickerIdx(null);
                }}
              >
                <Text style={[
                  customPickerStyles.optionText,
                  fv.crmField === f.key && customPickerStyles.optionTextSelected,
                ]}>
                  {f.label}
                </Text>
                {fv.crmField === f.key && <Icon name="check" size={14} color="#2563eb" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>

    <TextInput
      style={[styles.input, { flex: 1, marginTop: 0, marginLeft: 8, backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
      value={fv.value}
      onChangeText={val =>
        setFixedValues(prev => prev.map((f, i) => i === idx ? { ...f, value: val } : f))
      }
      placeholder="Fixed value…"
      placeholderTextColor="#9ca3af"
    />
    <TouchableOpacity
      onPress={() => setFixedValues(prev => prev.filter((_, i) => i !== idx))}
      style={{ marginLeft: 8, padding: 4, marginTop: 10 }}
    >
      <Icon name="trash-2" size={16} color="#ef4444" />
    </TouchableOpacity>
  </View>
))}

            <TouchableOpacity
              onPress={() => setFixedValues(prev => [...prev, { crmField: '', value: '' }])}
              style={styles.addRowBtn}
            >
              <Icon name="plus" size={14} color="#2563eb" />
              <Text style={styles.addRowText}>Add row</Text>
            </TouchableOpacity>

           <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 40, paddingBottom: 20 }}>
              <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={onClose} disabled={saving}>
               <Text style={[styles.secondaryBtnText, { color: t.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 2 }, saving && styles.btnDisabled]}
                onPress={save}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryBtnText}>Save Mapping & Start Sync</Text>
                }
              </TouchableOpacity>
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
const ConnectionCard = ({ conn, onDelete, onEditMapping, isDark }) => {
  const [deleting, setDeleting] = useState(false);
  const t = {
    card: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '#334155' : '#e5e7eb',
    text: isDark ? '#f1f5f9' : '#111827',
    subtext: isDark ? '#94a3b8' : '#9ca3af',
  };

  const confirmDelete = () => {
    Alert.alert(
      'Remove Connection?',
      `"${conn.sheetName}" will be disconnected. Already imported leads won't be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Remove',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await googleSheetsService.deleteConnection(conn._id);
              onDelete(conn._id);
            } catch {
              Alert.alert('Error', 'Failed to remove connection');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.connCard, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.connCardHeader}>
        <View style={styles.sheetIconBox}>
          <Icon name="file-text" size={18} color="#0F9D58" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.connName, { color: t.text }]} numberOfLines={1}>{conn.sheetName}</Text>
<Text style={[styles.connSub, { color: t.subtext }]}>{conn.tabName} · {conn.googleEmail}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          conn.lastError ? styles.badgeError : conn.isActive ? styles.badgeActive : styles.badgeInactive,
        ]}>
          <Text style={[
            styles.statusBadgeText,
            conn.lastError ? styles.badgeErrorText : conn.isActive ? styles.badgeActiveText : styles.badgeInactiveText,
          ]}>
            {conn.lastError ? 'Error' : conn.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.connStats}>
        <Text style={[styles.connStatText, { color: t.subtext }]}>
  Imported: <Text style={[styles.connStatBold, { color: t.text }]}>{conn.totalImported || 0}</Text>
</Text>
<Text style={[styles.connStatText, { color: t.subtext }]}>
  Last sync:{' '}
          <Text style={styles.connStatBold}>
            {conn.lastSyncedAt
              ? new Date(conn.lastSyncedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Never'}
          </Text>
        </Text>
      </View>

      {conn.lastError && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={12} color="#ef4444" />
          <Text style={styles.errorText}>{conn.lastError}</Text>
        </View>
      )}

      <View style={styles.connActions}>
        <TouchableOpacity style={styles.actionBtnBlue} onPress={() => onEditMapping(conn)}>
          <Icon name="settings" size={12} color="#2563eb" />
          <Text style={styles.actionBtnBlueText}>Edit Mapping</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtnRed, deleting && styles.btnDisabled]}
          onPress={confirmDelete}
          disabled={deleting}
        >
          {deleting
            ? <ActivityIndicator size="small" color="#ef4444" />
            : <Icon name="trash-2" size={12} color="#ef4444" />
          }
          <Text style={styles.actionBtnRedText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ══════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════ */
const ImportScreen = () => {
  const settings = useSelector(s => s.settings?.data);
  const { isDark } = useTheme();
  const t = {
    bg: isDark ? '#0f172a' : '#f9fafb',
    card: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '#334155' : '#e5e7eb',
    text: isDark ? '#f1f5f9' : '#111827',
    subtext: isDark ? '#94a3b8' : '#6b7280',
    muted: isDark ? '#475569' : '#9ca3af',
    inputBg: isDark ? '#0f172a' : '#f9fafb',
  };
  const [connections, setConnections] = useState([]);
  const [loadingConn, setLoadingConn] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [showSourceReport, setShowSourceReport] = useState(false);
  const [syncData, setSyncData] = useState(null);

  const loadConnections = useCallback(async () => {
    setLoadingConn(true);
    try {
      const data = await googleSheetsService.getConnections();
      setConnections(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoadingConn(false); }
  }, []);

  useEffect(() => { loadConnections(); }, [loadConnections]);

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
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loadingConn} onRefresh={loadConnections} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
  <Text style={[styles.pageTitle, { color: t.text }]}>Import Leads</Text>
  <Text style={[styles.pageSubtitle, { color: t.subtext }]}>Connect Google Sheets to auto-import leads into Sharda CRM</Text>
        </View>

        {/* Dashboard Card */}
        <View style={[styles.dashCard, hasError && styles.dashCardError, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.dashCardTop}>
            <View style={styles.sheetIconLarge}>
              <Icon name="file-text" size={24} color="#0F9D58" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.dashCardTitle, { color: t.text }]}>Google Sheets</Text>
              {activeCount > 0 && (
                <View style={[styles.badgeActive, { marginTop: 4, alignSelf: 'flex-start' }]}>
                  <Text style={styles.badgeActiveText}>Connected · {activeCount}</Text>
                </View>
              )}
              {hasError && (
                <View style={[styles.badgeError, { marginTop: 4, alignSelf: 'flex-start' }]}>
                  <Text style={styles.badgeErrorText}>Error · {connections.filter(c => c.lastError).length}</Text>
                </View>
              )}
              {!hasError && activeCount > 0 && (
                <View style={[styles.badgeActive, { marginTop: 4, alignSelf: 'flex-start' }]}>
                  <Text style={styles.badgeActiveText}>All syncs healthy</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={[styles.dashCardDesc, { color: t.subtext }]}>Connect your Google Sheet and create leads in Sharda CRM</Text>

          <View style={styles.dashActions}>
            <TouchableOpacity style={[styles.dashActionBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={() => setShowSourceReport(true)}>
  <Icon name="bar-chart-2" size={13} color={t.subtext} />
  <Text style={[styles.dashActionText, { color: t.text }]}>Source Report</Text>
</TouchableOpacity>
<TouchableOpacity style={[styles.dashActionBtn, { borderColor: t.border, backgroundColor: t.inputBg }]} onPress={loadConnections}>
  <Icon name="refresh-cw" size={13} color={t.subtext} />
  <Text style={[styles.dashActionText, { color: t.text }]}>Refresh</Text>
</TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.addSheetBtn} onPress={() => setShowAddSheet(true)}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={styles.addSheetBtnText}>Add Sheet</Text>
          </TouchableOpacity>
        </View>

        {/* Connected Sheets */}
        {connections.length > 0 && (
         <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Connected Sheets</Text>
              <TouchableOpacity onPress={loadConnections} disabled={loadingConn}>
                <Icon name="refresh-cw" size={14} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {loadingConn ? (
              <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 16 }} />
            ) : (
              connections.map(conn => (
  <ConnectionCard
    key={conn._id}
    conn={conn}
    isDark={isDark}
    onDelete={id => setConnections(prev => prev.filter(c => c._id !== id))}
    onEditMapping={handleEditMapping}
  />
))
            )}
          </View>
        )}

        {connections.length === 0 && !loadingConn && (
          <View style={styles.emptyState}>
            <Icon name="link" size={32} color="#d1d5db" />
            <Text style={[styles.emptyTitle, { color: t.subtext }]}>No sheets connected</Text>
<Text style={[styles.emptyDesc, { color: t.muted }]}>Tap "Add Sheet" to connect your first Google Sheet</Text>
          </View>
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
        onClose={() => { setShowMapping(false); setSyncData(null); }}
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
   STYLES
══════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  pageHeader: { marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  pageSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  dashCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  dashCardError: { borderColor: '#fecaca' },
  dashCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  sheetIconLarge: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    alignItems: 'center', justifyContent: 'center',
  },
  dashCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  dashCardDesc: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  dashActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dashActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  dashActionText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  addSheetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12,
  },
  addSheetBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 },
  connCard: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14,
    padding: 14, marginBottom: 10, backgroundColor: '#fff',
  },
  connCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sheetIconBox: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center',
  },
  connName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  connSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  connStats: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  connStatText: { fontSize: 12, color: '#9ca3af' },
  connStatBold: { color: '#374151', fontWeight: '600' },
  connActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtnBlue: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff',
  },
  actionBtnBlueText: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  actionBtnRed: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2',
    marginLeft: 'auto',
  },
  actionBtnRedText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  badgeActive: { backgroundColor: '#f0fdf4', borderColor: '#86efac', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeActiveText: { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  badgeError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeErrorText: { color: '#dc2626', fontSize: 11, fontWeight: '600' },
  badgeInactive: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeInactiveText: { color: '#6b7280', fontSize: 11, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 8, padding: 8, marginBottom: 8,
  },
  errorText: { fontSize: 11, color: '#dc2626', flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  closeBtn: { padding: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: '#111827', backgroundColor: '#f9fafb',
  },
  primaryBtn: {
    backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: '#374151', fontWeight: '500', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  mappingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 8, backgroundColor: '#f9fafb',
  },
  mappingField: { fontSize: 13, fontWeight: '600', color: '#111827' },
  mappingSample: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  pickerWrapper: { width: 150, borderRadius: 10, backgroundColor: '#2563eb', overflow: 'hidden' },
  picker: { color: '#fff', height: 44 },
  fixedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  addRowText: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  metricRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  metricCard: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  metricLabel: { fontSize: 10, color: '#9ca3af', marginBottom: 4 },
  metricVal: { fontSize: 22, fontWeight: '700', color: '#111827' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, paddingHorizontal: 16 },
  barName: { fontSize: 11, color: '#374151', width: 80 },
  barTrack: { flex: 1, height: 10, backgroundColor: '#f3f4f6', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  barVal: { fontSize: 11, color: '#374151', width: 30, textAlign: 'right' },
  tableBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden', margin: 16, marginTop: 0 },
  tableRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  tableRowBorder: { borderTopWidth: 1, borderColor: '#f3f4f6' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tableSheetName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  tableSubtext: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  tableImported: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#9ca3af' },
  emptyDesc: { fontSize: 13, color: '#d1d5db', textAlign: 'center' },
  emptyText: { padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 },

  // Google Sign-In
  googleSignInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#4285F4', borderRadius: 12, paddingVertical: 13,
  },
  googleIconBox: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  googleIconText: { fontSize: 14, fontWeight: '700', color: '#4285F4' },
  googleSignInText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  googleConnectedBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac',
    borderRadius: 12, padding: 12,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  googleEmail: { fontSize: 13, fontWeight: '600', color: '#111827' },
  googleConnectedLabel: { fontSize: 11, color: '#16a34a', marginTop: 2 },
  disconnectText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },
});

/* ══════════════════════════════════════════════
   ADD MODAL SPECIFIC STYLES
══════════════════════════════════════════════ */
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
  sheetChipName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  tabHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
    marginTop: -4,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  tabRowSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  tabIconBox: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  tabIconBoxSelected: {
    backgroundColor: '#dbeafe',
  },
  tabLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  tabLabelSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
const customPickerStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: 150, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 10,
    backgroundColor: '#eff6ff',
  },
  triggerText: { flex: 1, fontSize: 12, color: '#2563eb', fontWeight: '500' },
  dropdown: {
    position: 'absolute', right: 0, top: 48, width: 200,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
    elevation: 10, zIndex: 999,
  },
  option: {
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  optionSelected: { backgroundColor: '#eff6ff' },
  optionText: { fontSize: 13, color: '#374151' },
  optionTextSelected: { color: '#2563eb', fontWeight: '600' },
});
export default ImportScreen;