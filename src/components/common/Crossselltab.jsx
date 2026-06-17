import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

// Service meta with colors and icons
const SERVICE_META = {
  MSME: { bg: '#E6F1FB', badge: '#185FA5', icon: 'briefcase' },
  'GST Registration': { bg: '#EAF3DE', badge: '#3B6D11', icon: 'file-text' },
  'GST Return': { bg: '#FAEEDA', badge: '#854F0B', icon: 'bar-chart-2' },
  'Income Tax Return': { bg: '#EEEDFE', badge: '#534AB7', icon: 'briefcase' },
  'Income Tax Audit': { bg: '#FCEBEB', badge: '#A32D2D', icon: 'search' },
  'Project Report': { bg: '#FAEEDA', badge: '#854F0B', icon: 'file-text' },
  'Subsidy Services': { bg: '#E1F5EE', badge: '#0F6E56', icon: 'dollar-sign' },
  'Trade Mark': { bg: '#FBEAF0', badge: '#993556', icon: 'tag' },
  'IEC Code': { bg: '#E6F1FB', badge: '#185FA5', icon: 'globe' },
};

const getServiceStyle = service =>
  SERVICE_META[service] || {
    bg: '#F1EFE8',
    badge: '#5F5E5A',
    icon: 'package',
  };

// Status config
const STATUS_CFG = {
  Pending: { color: '#888780', label: 'Pending', icon: 'clock' },
  Interested: { color: '#639922', label: 'Interested', icon: 'check-circle' },
  'Not Interested': {
    color: '#E24B4A',
    label: 'Not interested',
    icon: 'x-circle',
  },
  Converted: { color: '#378ADD', label: 'Converted', icon: 'award' },
};

const CrossSellTab = ({ lead, onSaved }) => {
  const [activeSubTab, setActiveSubTab] = useState('recommendations');
  const [data, setData] = useState(null);
  const [responding, setResponding] = useState(null);
  const [automating, setAutomating] = useState(false);
  const [noteInput, setNoteInput] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [scheduleStates, setScheduleStates] = useState({});
  const [scheduling, setScheduling] = useState(null);
  const sendingRef = useRef(false);

  const dynamicServicesList = [
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

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    if (!lead?._id) return;
    try {
      // TODO: Replace with real API
      // const res = await api.get(`/cross-sell/recommendations/${lead._id}`);
      setData({
        recommendations: [],
        originalService: lead.product || 'Unknown',
      });
    } catch {
      setData({
        recommendations: [],
        originalService: lead.product || 'Unknown',
      });
    }
  }, [lead?._id]);

  const fetchScheduledEmails = useCallback(async () => {
    if (!lead?._id) return;
    try {
      // TODO: API call
      setScheduledEmails([]);
    } catch {}
  }, [lead?._id]);

  useEffect(() => {
    fetchRecommendations();
    fetchScheduledEmails();
  }, [fetchRecommendations, fetchScheduledEmails]);

  const handleRespond = async (service, status) => {
    if (!lead?._id) return;
    setResponding(service + status);

    try {
      // TODO: API call
      // await api.post('/cross-sell/respond', {...});

      setData(prev => {
        const exists = prev.recommendations?.find(r => r.service === service);
        const updatedRecs = exists
          ? prev.recommendations.map(r =>
              r.service === service
                ? { ...r, status, respondedAt: new Date().toISOString() }
                : r,
            )
          : [
              ...(prev.recommendations || []),
              { service, status, respondedAt: new Date().toISOString() },
            ];
        return { ...prev, recommendations: updatedRecs };
      });

      if (onSaved) onSaved();
    } catch {
      alert('Failed to update');
    } finally {
      setResponding(null);
    }
  };

  const handleSendAutomation = async channel => {
    if (!lead?._id || sendingRef.current) return;
    sendingRef.current = true;
    setAutomating(true);

    try {
      // TODO: API call
      setData(prev => ({ ...prev, automationSent: true }));
      alert(`${channel} automation triggered!`);
    } catch {
      alert('Automation failed');
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
    if (!s.date || !s.time) {
      alert('Please select both date and time');
      return;
    }
    setScheduling(svc);

    try {
      // TODO: API call
      alert('Email scheduled!');
      setScheduleStates(prev => ({
        ...prev,
        [svc]: { open: false, date: '', time: '', message: '' },
      }));
    } catch {
      alert('Scheduling failed');
    } finally {
      setScheduling(null);
    }
  };

  const handleCancelEmail = async emailId => {
    try {
      // TODO: API
      setScheduledEmails(prev => prev.filter(e => e._id !== emailId));
      alert('Email cancelled');
    } catch {
      alert('Cancel failed');
    }
  };

  const toggleRow = service => {
    setExpandedRow(prev => (prev === service ? null : service));
  };

  const mergedRecommendations = dynamicServicesList.map(svc => {
    const existing = data?.recommendations?.find(r => r.service === svc);
    return existing
      ? { ...existing, status: existing.status || 'Pending' }
      : { service: svc, status: 'Pending' };
  });

  if (!lead?._id) {
    return (
      <View style={styles.emptyState}>
        <Feather name="lightbulb" size={24} color="#185FA5" />
        <Text style={styles.emptyText}>
          Save the lead to view cross-sell recommendations.
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.emptyState}>
        <Feather name="package" size={24} color="#94a3b8" />
        <Text style={styles.emptyText}>
          Enter the service in Product field to see recommendations.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.leadInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {lead.name?.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.leadName}>{lead.name}</Text>
            <Text style={styles.originalService}>{data.originalService}</Text>
          </View>
        </View>

        <View style={styles.counts}>
          {mergedRecommendations.filter(r => r.status === 'Pending').length >
            0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>
                {
                  mergedRecommendations.filter(r => r.status === 'Pending')
                    .length
                }{' '}
                pending
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Sub Tabs */}
      <View style={styles.subTabs}>
        {[
          { key: 'recommendations', label: 'Recom' },
          { key: 'automation', label: 'Automation' },
          { key: 'scheduled', label: 'Scheduled' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.subTab,
              activeSubTab === tab.key && styles.subTabActive,
            ]}
            onPress={() => setActiveSubTab(tab.key)}
          >
            <Text
              style={[
                styles.subTabText,
                activeSubTab === tab.key && styles.subTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recommendations Tab */}
      {activeSubTab === 'recommendations' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="sparkles" size={14} color="#64748b" />
            <Text style={styles.sectionTitle}>Recommendations</Text>
          </View>

          {mergedRecommendations.map((rec, index) => {
            const style = getServiceStyle(rec.service);
            const isOpen = expandedRow === rec.service;
            const statusCfg = STATUS_CFG[rec.status] || STATUS_CFG.Pending;

            return (
              <View key={rec.service} style={styles.recCard}>
                <TouchableOpacity
                  style={styles.recRow}
                  onPress={() => toggleRow(rec.service)}
                >
                  <View style={styles.recLeft}>
                    <View
                      style={[
                        styles.serviceIcon,
                        { backgroundColor: style.bg },
                      ]}
                    >
                      <Feather
                        name={style.icon}
                        size={16}
                        color={style.badge}
                      />
                    </View>
                    <View>
                      <Text style={styles.serviceName}>{rec.service}</Text>
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusCfg.color },
                          ]}
                        />
                        <Text style={{ color: statusCfg.color, fontSize: 12 }}>
                          {statusCfg.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.recRight}>
                    <Feather
                      name="chevron-down"
                      size={18}
                      color="#94a3b8"
                      style={{
                        transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
                      }}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded Content */}
                {isOpen && (
                  <View style={styles.expandedContent}>
                    {rec.status === 'Pending' && (
                      <TextInput
                        style={styles.noteInput}
                        placeholder="Add a note..."
                        value={noteInput[rec.service] || ''}
                        onChangeText={text =>
                          setNoteInput(prev => ({
                            ...prev,
                            [rec.service]: text,
                          }))
                        }
                      />
                    )}

                    <View style={styles.actionButtons}>
                      {rec.status !== 'Interested' && (
                        <TouchableOpacity
                          style={styles.interestedBtn}
                          onPress={() =>
                            handleRespond(rec.service, 'Interested')
                          }
                        >
                          <Text style={styles.interestedText}>Interested</Text>
                        </TouchableOpacity>
                      )}
                      {rec.status !== 'Not Interested' && (
                        <TouchableOpacity
                          style={styles.notInterestedBtn}
                          onPress={() =>
                            handleRespond(rec.service, 'Not Interested')
                          }
                        >
                          <Text style={styles.notInterestedText}>
                            Not interested
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Automation Tab */}
      {activeSubTab === 'automation' && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.automationBtn}
            onPress={() => handleSendAutomation('email')}
            disabled={automating}
          >
            <Feather name="mail" size={16} color="#fff" />
            <Text style={styles.automationText}>
              {data?.automationSent ? 'Already Sent ✓' : 'Send Email'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scheduled Tab */}
      {activeSubTab === 'scheduled' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Scheduled Emails ({scheduledEmails.length})
          </Text>
          {scheduledEmails.length === 0 ? (
            <View style={styles.emptyScheduled}>
              <Feather name="inbox" size={28} color="#d1d5db" />
              <Text style={{ color: '#94a3b8', marginTop: 8 }}>
                No scheduled emails
              </Text>
            </View>
          ) : (
            scheduledEmails.map(mail => (
              <View key={mail._id} style={styles.scheduledItem}>
                <Text>{new Date(mail.scheduledAt).toLocaleString()}</Text>
                <TouchableOpacity onPress={() => handleCancelEmail(mail._id)}>
                  <Text style={{ color: '#ef4444' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F1FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#185FA5',
    fontWeight: '700',
    fontSize: 13,
  },
  leadName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  originalService: {
    fontSize: 12,
    color: '#64748b',
  },
  counts: {
    flexDirection: 'row',
    gap: 6,
  },
  pendingBadge: {
    backgroundColor: '#FAEEDA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pendingText: {
    color: '#854F0B',
    fontSize: 11,
    fontWeight: '600',
  },
  subTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  subTabText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#0f172a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  recCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  recRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  recLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: '#f8fafc',
  },
  noteInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  interestedBtn: {
    flex: 1,
    backgroundColor: '#EAF3DE',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  interestedText: {
    color: '#3B6D11',
    fontWeight: '600',
    fontSize: 13,
  },
  notInterestedBtn: {
    flex: 1,
    backgroundColor: '#FCEBEB',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  notInterestedText: {
    color: '#A32D2D',
    fontWeight: '600',
    fontSize: 13,
  },
  automationBtn: {
    backgroundColor: '#185FA5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  automationText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#64748b',
    textAlign: 'center',
    fontSize: 13,
  },
  emptyScheduled: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  scheduledItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
});

export default CrossSellTab;
