import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../services/api';

const SERVICE_META = {
  MSME: { bg: '#E6F1FB', border: '#B5D4F4', badge: '#185FA5', icon: 'factory' },
  'GST Registration': {
    bg: '#EAF3DE',
    border: '#C0DD97',
    badge: '#3B6D11',
    icon: 'file-document-outline',
  },
  'GST Return': {
    bg: '#FAEEDA',
    border: '#FAC775',
    badge: '#854F0B',
    icon: 'chart-bar',
  },
  'Income Tax Return': {
    bg: '#EEEDFE',
    border: '#CECBF6',
    badge: '#534AB7',
    icon: 'briefcase-outline',
  },
  'Income Tax Audit': {
    bg: '#FCEBEB',
    border: '#F7C1C1',
    badge: '#A32D2D',
    icon: 'magnify',
  },
  'Project Report': {
    bg: '#FAEEDA',
    border: '#FAC775',
    badge: '#854F0B',
    icon: 'file-chart-outline',
  },
  'Subsidy Services': {
    bg: '#E1F5EE',
    border: '#9FE1CB',
    badge: '#0F6E56',
    icon: 'currency-usd',
  },
  'Trade Mark': {
    bg: '#FBEAF0',
    border: '#F4C0D1',
    badge: '#993556',
    icon: 'tag-outline',
  },
  'IEC Code': {
    bg: '#E6F1FB',
    border: '#B5D4F4',
    badge: '#185FA5',
    icon: 'earth',
  },
};

const getServiceStyle = service =>
  SERVICE_META[service] || {
    bg: '#F1EFE8',
    border: '#D3D1C7',
    badge: '#5F5E5A',
    icon: 'package-variant-closed',
  };

const STATUS_CFG = {
  Pending: { dot: '#888780', label: 'Pending', icon: 'clock-outline' },
  Interested: {
    dot: '#639922',
    label: 'Interested',
    icon: 'check-circle-outline',
  },
  'Not Interested': {
    dot: '#E24B4A',
    label: 'Not interested',
    icon: 'close-circle-outline',
  },
  Converted: { dot: '#378ADD', label: 'Converted', icon: 'trophy-outline' },
};

const MAIL_STATUS_CFG = {
  sent: {
    bg: '#EAF3DE',
    text: '#3B6D11',
    icon: 'check-circle-outline',
    label: 'Sent',
  },
  failed: {
    bg: '#FCEBEB',
    text: '#A32D2D',
    icon: 'close-circle-outline',
    label: 'Failed',
  },
  cancelled: {
    bg: '#f1f5f9',
    text: '#64748b',
    icon: 'close',
    label: 'Cancelled',
  },
  pending: {
    bg: '#FAEEDA',
    text: '#854F0B',
    icon: 'clock-outline',
    label: 'Pending',
  },
};

const DEFAULT_SERVICES = [
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

const showToast = (title, message) => Alert.alert(title, message);

const Spin = ({ size = 14, color = '#185FA5' }) => (
  <ActivityIndicator size={size} color={color} />
);

const toDateString = date => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
};

const toTimeString = date => {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
};

const CrossSellTab = ({ lead, onSaved }) => {
  const dark = false;
  const [loading, setLoading] = useState(false);
  const [responding, setResponding] = useState(null);
  const [automating, setAutomating] = useState(false);
  const [data, setData] = useState(null);
  const sendingRef = useRef(false);
  const [noteInput, setNoteInput] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('recommendations');
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [scheduleStates, setScheduleStates] = useState({});
  const [scheduling, setScheduling] = useState(null);
  const [dynamicServicesList, setDynamicServicesList] =
    useState(DEFAULT_SERVICES);
  const [pickerTarget, setPickerTarget] = useState(null); // { svc, field: 'date' | 'time' }

  const fetchRecommendations = useCallback(async () => {
    if (!lead?._id) return;
    setLoading(true);
    try {
      const res = await api.get(`/cross-sell/recommendations/${lead._id}`);
      setData(res.data?.data || null);
    } catch {
      setData({
        recommendations: [],
        originalService: lead.product || 'Unknown',
      });
    } finally {
      setLoading(false);
    }
  }, [lead?._id, lead?.product]);

  const fetchScheduledEmails = useCallback(async () => {
    if (!lead?._id) return;
    try {
      const res = await api.get(`/cross-sell/scheduled-emails/${lead._id}`);
      setScheduledEmails(res.data?.data || []);
    } catch {}
  }, [lead?._id]);

  useEffect(() => {
    fetchRecommendations();
    fetchScheduledEmails();
  }, [fetchRecommendations, fetchScheduledEmails]);

  useEffect(() => {
    api
      .get('/cross-sell/rules')
      .then(res => {
        const rules = res.data?.data || [];
        if (rules.length > 0) {
          const services = rules
            .filter(r => r.isActive)
            .map(r => r.triggerService);
          const unique = [...new Set(services)];
          if (unique.length > 0) setDynamicServicesList(unique);
        }
      })
      .catch(() => {});
  }, []);

  const mergedRecommendations = useMemo(
    () =>
      dynamicServicesList.map(svc => {
        const existing = data?.recommendations?.find(r => r.service === svc);
        if (existing)
          return { ...existing, status: existing.status || 'Pending' };
        return { service: svc, status: 'Pending', pitch: '', notes: '' };
      }),
    [dynamicServicesList, data?.recommendations],
  );

  const handleRespond = async (service, status) => {
    if (!lead?._id) return;
    setResponding(service + status);
    try {
      await api.post('/cross-sell/respond', {
        leadId: lead._id,
        service,
        status,
        notes: noteInput[service] || '',
      });

      setData(prev => {
        const exists = prev?.recommendations?.find(r => r.service === service);
        const updatedRecs = exists
          ? prev.recommendations.map(r =>
              r.service === service
                ? {
                    ...r,
                    status,
                    respondedAt: new Date().toISOString(),
                    notes: noteInput[service] || '',
                  }
                : r,
            )
          : [
              ...(prev?.recommendations || []),
              {
                service,
                status,
                respondedAt: new Date().toISOString(),
                notes: noteInput[service] || '',
              },
            ];
        return { ...prev, recommendations: updatedRecs };
      });

      showToast(
        'Updated',
        status === 'Interested'
          ? `${service} marked Interested - follow-up created.`
          : `Updated: ${service} -> ${status}`,
      );
      if (onSaved) onSaved();
    } catch (err) {
      showToast('Error', err?.response?.data?.message || 'Failed to update.');
    } finally {
      setResponding(null);
    }
  };

  const handleSendAutomation = async channel => {
    if (!lead?._id) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    setAutomating(true);
    try {
      const interestedServices = data?.recommendations
        ?.filter(r => r.status === 'Pending' || r.status === 'Interested')
        ?.map(r => r.service)
        ?.join(', ');
      await api.post(`/cross-sell/send-automation/${lead._id}`, {
        channel,
        message: `Hello ${lead.name}! Along with your ${
          data?.originalService || 'service'
        }, these services may also be helpful: ${interestedServices}. Would you like to know more?`,
      });
      setData(prev => ({ ...prev, automationSent: true }));
      await fetchScheduledEmails();
      showToast(
        'Success',
        `${
          channel === 'whatsapp' ? 'WhatsApp' : 'Email'
        } automation triggered!`,
      );
    } catch (err) {
      showToast('Error', err?.response?.data?.message || 'Automation failed.');
    } finally {
      setAutomating(false);
      sendingRef.current = false;
    }
  };

  const toggleSchedule = svc => {
    setScheduleStates(prev => ({
      ...prev,
      [svc]: {
        ...prev[svc],
        open: !prev[svc]?.open,
        date: prev[svc]?.date || '',
        time: prev[svc]?.time || '',
        message: prev[svc]?.message || '',
      },
    }));
  };

  const updateScheduleField = (svc, field, value) => {
    setScheduleStates(prev => ({
      ...prev,
      [svc]: { ...prev[svc], [field]: value },
    }));
  };

  const handleScheduleEmail = async svc => {
    const s = scheduleStates[svc] || {};
    if (!s.date || !s.time)
      return showToast('Error', 'Please select both date and time');
    if (!lead?.email) return showToast('Error', 'Lead email is missing');
    const scheduledAt = new Date(`${s.date}T${s.time}:00`);
    if (scheduledAt <= new Date())
      return showToast('Error', 'Please select a future date/time');
    setScheduling(svc);
    try {
      await api.post(`/cross-sell/schedule-email/${lead._id}`, {
        scheduledAt: scheduledAt.toISOString(),
        message: s.message || '',
        recommendationService: svc,
        includeOtherServices: false,
      });
      showToast('Success', 'Email scheduled!');
      setScheduleStates(prev => ({
        ...prev,
        [svc]: { open: false, date: '', time: '', message: '' },
      }));
      fetchScheduledEmails();
    } catch (err) {
      showToast('Error', err?.response?.data?.message || 'Scheduling failed');
    } finally {
      setScheduling(null);
    }
  };

  const handleCancelEmail = async emailId => {
    try {
      await api.delete(`/cross-sell/scheduled-emails/${emailId}`);
      showToast('Success', 'Email cancelled');
      setScheduledEmails(prev => prev.filter(e => e._id !== emailId));
    } catch {
      showToast('Error', 'Cancel failed');
    }
  };

  const toggleRow = service =>
    setExpandedRow(prev => (prev === service ? null : service));

  if (!lead?._id) {
    return (
      <EmptyState icon="lightbulb-outline">
        Save the lead to view cross-sell recommendations.
      </EmptyState>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <Spin size="large" />
        <Text style={styles.mutedText}>Loading recommendations...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <EmptyState icon="package-variant-closed">
        Enter the service in the Product field under Profile tab -
        recommendations will appear here.
      </EmptyState>
    );
  }

  const originalStyle = getServiceStyle(data.originalService);
  const pendingCount = mergedRecommendations.filter(
    r => r.status === 'Pending',
  ).length;
  const interestedCount = mergedRecommendations.filter(r =>
    ['Interested', 'Converted'].includes(r.status),
  ).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <View style={styles.leadInfoRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {lead.name?.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.leadName}>{lead.name}</Text>
            <View style={styles.originalRow}>
              <Icon name={originalStyle.icon} size={12} color="#6b7280" />
              <Text style={styles.originalText}>{data.originalService}</Text>
            </View>
          </View>
        </View>
        <View style={styles.countsRow}>
          {pendingCount > 0 ? (
            <Badge
              bg="#FAEEDA"
              text="#854F0B"
              label={`${pendingCount} pending`}
            />
          ) : null}
          {interestedCount > 0 ? (
            <Badge
              bg="#EAF3DE"
              text="#3B6D11"
              label={`${interestedCount} interested`}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.subTabs}>
        {[
          {
            key: 'recommendations',
            label: 'Recom',
            count: mergedRecommendations.length,
          },
          { key: 'automation', label: 'Automation', count: null },
          {
            key: 'scheduled',
            label: 'Scheduled',
            count: scheduledEmails.length || null,
          },
        ].map(tab => {
          const active = activeSubTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveSubTab(tab.key)}
              style={[styles.subTabBtn, active && styles.subTabActive]}
            >
              <Text
                style={[styles.subTabText, active && styles.subTabTextActive]}
              >
                {tab.label}
              </Text>
              {tab.count !== null ? (
                <Text
                  style={[
                    styles.subTabCount,
                    active && styles.subTabTextActive,
                  ]}
                >
                  {tab.count}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeSubTab === 'recommendations' ? (
        <View style={styles.cardBlock}>
          <BlockHeader icon="sparkles" title="Recommendations" />
          {mergedRecommendations.map((rec, idx) => (
            <RecommendationRow
              key={rec.service}
              rec={rec}
              isLast={idx === mergedRecommendations.length - 1}
              isOpen={expandedRow === rec.service}
              toggleRow={toggleRow}
              noteInput={noteInput}
              setNoteInput={setNoteInput}
              responding={responding}
              handleRespond={handleRespond}
            />
          ))}
        </View>
      ) : null}

      {activeSubTab === 'automation' ? (
        <View style={styles.cardBlock}>
          <BlockHeader icon="send" title="Automation" />
          <View style={styles.automationBody}>
            <TouchableOpacity
              disabled={automating || !lead?.email || data?.automationSent}
              onPress={() => handleSendAutomation('email')}
              style={[
                styles.emailBtn,
                (automating || !lead?.email || data?.automationSent) &&
                  styles.disabled,
              ]}
            >
              {automating ? (
                <Spin color="#fff" />
              ) : (
                <Icon name="email-outline" size={16} color="#fff" />
              )}
              <Text style={styles.emailBtnText}>
                {data?.automationSent ? 'Already Sent ✓' : 'Send email'}
              </Text>
            </TouchableOpacity>
            {!lead?.email ? (
              <WarningText text="Email missing - disabled" />
            ) : null}

            <Text style={styles.sectionMiniTitle}>
              Schedule email per service
            </Text>
            {mergedRecommendations.map(rec => {
              const style = getServiceStyle(rec.service);
              const ss = scheduleStates[rec.service] || {};
              const isOpen = ss.open || false;
              return (
                <View
                  key={rec.service}
                  style={[
                    styles.scheduleCard,
                    isOpen && styles.scheduleCardOpen,
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => toggleSchedule(rec.service)}
                    style={styles.scheduleTopRow}
                  >
                    <View
                      style={[
                        styles.serviceIcon,
                        { backgroundColor: style.bg },
                      ]}
                    >
                      <Icon name={style.icon} size={14} color={style.badge} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.serviceName}>{rec.service}</Text>
                      <Text
                        style={[styles.serviceStatus, { color: style.badge }]}
                      >
                        {rec.status}
                      </Text>
                    </View>
                    <View style={styles.scheduleMiniBtn}>
                      <Icon name="calendar-clock" size={12} color="#185FA5" />
                      <Text style={styles.scheduleMiniBtnText}>
                        {isOpen ? 'Cancel' : 'Schedule'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isOpen ? (
                    <View style={styles.scheduleForm}>
                      {!lead?.email ? (
                        <WarningText text="Lead email is missing - email will not be sent" />
                      ) : null}
                      <View style={styles.twoCols}>
                        <DateTimeButton
                          label="Date"
                          value={ss.date || ''}
                          onPress={() =>
                            setPickerTarget({ svc: rec.service, field: 'date' })
                          }
                        />
                        <DateTimeButton
                          label="Time"
                          value={ss.time || ''}
                          onPress={() =>
                            setPickerTarget({ svc: rec.service, field: 'time' })
                          }
                        />
                      </View>
                      <Text style={styles.fieldLabel}>
                        Extra message (optional)
                      </Text>
                      <TextInput
                        multiline
                        numberOfLines={2}
                        value={ss.message || ''}
                        onChangeText={v =>
                          updateScheduleField(rec.service, 'message', v)
                        }
                        placeholder="Special message for the client..."
                        placeholderTextColor="#9ca3af"
                        style={styles.messageInput}
                      />
                      <TouchableOpacity
                        disabled={
                          scheduling === rec.service || !ss.date || !ss.time
                        }
                        onPress={() => handleScheduleEmail(rec.service)}
                        style={[
                          styles.scheduleSubmit,
                          (scheduling === rec.service ||
                            !ss.date ||
                            !ss.time) &&
                            styles.disabled,
                        ]}
                      >
                        {scheduling === rec.service ? (
                          <Spin color="#fff" />
                        ) : (
                          <Icon name="calendar-check" size={15} color="#fff" />
                        )}
                        <Text style={styles.scheduleSubmitText}>
                          {scheduling === rec.service
                            ? 'Scheduling...'
                            : 'Schedule email'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {activeSubTab === 'scheduled' ? (
        <View style={styles.cardBlock}>
          <BlockHeader
            icon="inbox-outline"
            title={`Scheduled (${scheduledEmails.length})`}
          />
          <View style={styles.scheduledBody}>
            {scheduledEmails.length === 0 ? (
              <View style={styles.noScheduled}>
                <Icon name="inbox-outline" size={30} color="#d1d5db" />
                <Text style={styles.mutedText}>No scheduled emails</Text>
              </View>
            ) : (
              scheduledEmails.map(mail => (
                <View key={mail._id} style={styles.mailRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.mailDate}>
                      {new Date(mail.scheduledAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                    <Text style={styles.mailSubject} numberOfLines={1}>
                      {mail.subject || `To: ${mail.to}`}
                    </Text>
                  </View>
                  <MailStatusBadge status={mail.status} />
                  {mail.status === 'pending' ? (
                    <TouchableOpacity
                      onPress={() => handleCancelEmail(mail._id)}
                      style={styles.cancelMailBtn}
                    >
                      <Icon name="close" size={12} color="#ef4444" />
                      <Text style={styles.cancelMailText}>Cancel</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>
      ) : null}

      {pickerTarget ? (
        <DateTimePicker
          value={new Date()}
          mode={pickerTarget.field === 'date' ? 'date' : 'time'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={pickerTarget.field === 'date' ? new Date() : undefined}
          onValueChange={(event, selectedDate) => {
            if (event?.type === 'dismissed') return;
            if (selectedDate) {
              if (Platform.OS === 'android') setPickerTarget(null);
              updateScheduleField(
                pickerTarget.svc,
                pickerTarget.field,
                pickerTarget.field === 'date'
                  ? toDateString(selectedDate)
                  : toTimeString(selectedDate),
              );
            }
          }}
          onDismiss={() => {
            if (Platform.OS === 'android') setPickerTarget(null);
          }}
        />
      ) : null}
    </ScrollView>
  );
};

const RecommendationRow = ({
  rec,
  isLast,
  isOpen,
  toggleRow,
  noteInput,
  setNoteInput,
  responding,
  handleRespond,
}) => {
  const style = getServiceStyle(rec.service);
  const statusCfg = STATUS_CFG[rec.status] || STATUS_CFG.Pending;
  const isRespondingThis = responding?.startsWith(rec.service);
  return (
    <View style={!isLast ? styles.borderBottom : null}>
      <TouchableOpacity
        onPress={() => toggleRow(rec.service)}
        style={styles.recRow}
      >
        <View style={[styles.serviceIcon, { backgroundColor: style.bg }]}>
          <Icon name={style.icon} size={15} color={style.badge} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.serviceName}>{rec.service}</Text>
          <View style={styles.statusLine}>
            <View
              style={[styles.statusDot, { backgroundColor: statusCfg.dot }]}
            />
            <Text style={[styles.statusLineText, { color: statusCfg.dot }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>
        <StatusPill status={rec.status} />
        <Icon
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#9ca3af"
        />
      </TouchableOpacity>

      {isOpen ? (
        <View style={styles.expandedPanel}>
          {rec.pitch ? (
            <View>
              <Text style={styles.pitchTitle}>Sales pitch</Text>
              <Text style={styles.pitchBox}>{rec.pitch}</Text>
            </View>
          ) : null}

          {rec.status === 'Pending' ? (
            <TextInput
              value={noteInput[rec.service] || ''}
              onChangeText={v =>
                setNoteInput(p => ({ ...p, [rec.service]: v }))
              }
              placeholder="Add a note..."
              placeholderTextColor="#9ca3af"
              style={styles.noteInput}
            />
          ) : rec.notes ? (
            <Text style={styles.noteText}>{rec.notes}</Text>
          ) : null}

          <View style={styles.actionWrap}>
            {rec.status !== 'Converted' ? (
              <>
                {rec.status !== 'Interested' ? (
                  <ActionButton
                    label="Interested"
                    color="#3B6D11"
                    bg="#EAF3DE"
                    border="#C0DD97"
                    loading={
                      isRespondingThis &&
                      responding === rec.service + 'Interested'
                    }
                    onPress={() => handleRespond(rec.service, 'Interested')}
                  />
                ) : null}
                {rec.status !== 'Not Interested' ? (
                  <ActionButton
                    label="Not interested"
                    color="#A32D2D"
                    bg="#FCEBEB"
                    border="#F7C1C1"
                    loading={
                      isRespondingThis &&
                      responding === rec.service + 'Not Interested'
                    }
                    onPress={() => handleRespond(rec.service, 'Not Interested')}
                  />
                ) : null}
                {rec.status === 'Interested' ? (
                  <ActionButton
                    label="Mark converted"
                    color="#185FA5"
                    bg="#E6F1FB"
                    border="#B5D4F4"
                    loading={
                      isRespondingThis &&
                      responding === rec.service + 'Converted'
                    }
                    onPress={() => handleRespond(rec.service, 'Converted')}
                  />
                ) : null}
              </>
            ) : (
              <Text style={styles.convertedText}>Successfully converted</Text>
            )}

            {rec.status !== 'Pending' ? (
              <TouchableOpacity
                disabled={!!isRespondingThis}
                onPress={() => handleRespond(rec.service, 'Pending')}
                style={styles.resetBtn}
              >
                <Icon name="restore" size={12} color="#9ca3af" />
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const ActionButton = ({ label, color, bg, border, loading, onPress }) => (
  <TouchableOpacity
    disabled={loading}
    onPress={onPress}
    style={[
      styles.actionButton,
      { backgroundColor: bg, borderColor: border, opacity: loading ? 0.5 : 1 },
    ]}
  >
    {loading ? (
      <Spin color={color} />
    ) : (
      <Icon name="check-circle-outline" size={13} color={color} />
    )}
    <Text style={[styles.actionButtonText, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.Pending;
  return (
    <View style={[styles.statusPill, { backgroundColor: `${cfg.dot}1f` }]}>
      <Icon name={cfg.icon} size={11} color={cfg.dot} />
      <Text style={[styles.statusPillText, { color: cfg.dot }]}>
        {cfg.label}
      </Text>
    </View>
  );
};

const MailStatusBadge = ({ status }) => {
  const cfg = MAIL_STATUS_CFG[status] || MAIL_STATUS_CFG.pending;
  return (
    <View style={[styles.mailStatus, { backgroundColor: cfg.bg }]}>
      <Icon name={cfg.icon} size={10} color={cfg.text} />
      <Text style={[styles.mailStatusText, { color: cfg.text }]}>
        {cfg.label}
      </Text>
    </View>
  );
};

const Badge = ({ bg, text, label }) => (
  <View style={[styles.badge, { backgroundColor: bg }]}>
    <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
  </View>
);

const BlockHeader = ({ icon, title }) => (
  <View style={styles.blockHeader}>
    <Icon name={icon} size={13} color="#9ca3af" />
    <Text style={styles.blockHeaderText}>{title}</Text>
  </View>
);

const WarningText = ({ text }) => (
  <View style={styles.warning}>
    <Icon name="alert-outline" size={12} color="#d97706" />
    <Text style={styles.warningText}>{text}</Text>
  </View>
);

const DateTimeButton = ({ label, value, onPress }) => (
  <View style={styles.flex1}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TouchableOpacity onPress={onPress} style={styles.dateTimeBtn}>
      <Text style={styles.dateTimeText}>
        {value || `Select ${label.toLowerCase()}`}
      </Text>
      <Icon
        name={label === 'Date' ? 'calendar' : 'clock-outline'}
        size={14}
        color="#64748b"
      />
    </TouchableOpacity>
  </View>
);

const EmptyState = ({ icon, children }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <Icon name={icon} size={20} color="#185FA5" />
    </View>
    <Text style={styles.emptyText}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 16 },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  mutedText: { fontSize: 13, color: '#9ca3af' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leadInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '600', color: '#185FA5' },
  leadName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  originalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  originalText: { fontSize: 12, color: '#6b7280' },
  countsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  subTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  subTabActive: { backgroundColor: '#fff' },
  subTabText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  subTabTextActive: { color: '#0f172a' },
  subTabCount: { fontSize: 10, fontWeight: '700' },
  cardBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  blockHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  serviceIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },
  serviceName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  serviceStatus: { fontSize: 11, marginTop: 2 },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: { width: 5, height: 5, borderRadius: 999 },
  statusLineText: { fontSize: 11 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  expandedPanel: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  pitchTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 6,
  },
  pitchBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 10,
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 18,
  },
  noteInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: '#374151',
  },
  noteText: { fontSize: 12, color: '#6b7280', fontStyle: 'italic' },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionButtonText: { fontSize: 12, fontWeight: '600' },
  convertedText: { fontSize: 12, fontWeight: '600', color: '#185FA5' },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  resetText: {
    fontSize: 11,
    color: '#9ca3af',
    textDecorationLine: 'underline',
  },
  automationBody: { padding: 14, gap: 12 },
  emailBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#185FA5',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emailBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.2)',
    backgroundColor: 'rgba(217,119,6,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  warningText: { fontSize: 11, color: '#d97706' },
  sectionMiniTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 4,
  },
  scheduleCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  scheduleCardOpen: {
    borderColor: 'rgba(24,95,165,0.35)',
    backgroundColor: 'rgba(24,95,165,0.03)',
  },
  scheduleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  scheduleMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(24,95,165,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scheduleMiniBtnText: { fontSize: 11, fontWeight: '600', color: '#185FA5' },
  scheduleForm: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    padding: 12,
    gap: 8,
  },
  twoCols: { flexDirection: 'row', gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  dateTimeBtn: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: { fontSize: 12, color: '#111827' },
  messageInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 12,
    color: '#111827',
  },
  scheduleSubmit: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#185FA5',
    paddingVertical: 10,
  },
  scheduleSubmitText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  scheduledBody: { padding: 14, gap: 8 },
  noScheduled: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  mailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mailDate: { fontSize: 12, fontWeight: '600', color: '#374151' },
  mailSubject: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  mailStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mailStatusText: { fontSize: 10, fontWeight: '600' },
  cancelMailBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cancelMailText: {
    color: '#ef4444',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#E6F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CrossSellTab;
