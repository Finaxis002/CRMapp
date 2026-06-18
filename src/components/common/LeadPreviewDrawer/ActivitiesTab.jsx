import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import api from '../../../services/api.js';

const getActivityIcon = type => {
  const raw = String(type || '').toLowerCase();
  if (raw === 'call') return '📞';
  if (raw === 'task') return '📌';
  if (raw === 'email') return '✉️';
  if (raw === 'meeting') return '🗓️';
  if (raw === 'recording') return '🎙️';
  if (raw === 'payment') return '💰';
  if (raw === 'status change') return '🔄';
  if (raw === 'lead reassignment') return '🔁';
  if (raw === 'reminder') return '🔔';
  return '📝';
};

const getCallOutcomeMeta = outcome => {
  switch (outcome) {
    case 'Spoke':
      return {
        label: 'Spoke',
        color: '#16a34a',
        bg: 'rgba(34, 197, 94, 0.12)',
        border: 'rgba(34, 197, 94, 0.35)',
      };
    case 'No Answer':
      return {
        label: 'No Answer',
        color: '#dc2626',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.35)',
      };
    case 'Left Voicemail':
      return {
        label: 'Left Voicemail',
        color: '#d97706',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)',
      };
    default:
      return null;
  }
};

const ActivitiesTab = ({ leadId, theme, activityRefreshTrigger }) => {
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLatest = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await api.get(`/activities/lead/${leadId}`);
      const payload = res?.data?.data;
      const activities = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];
      const sorted = activities.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt),
      );
      setLatest(sorted[0] || null);
    } catch {
      setLatest(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest, activityRefreshTrigger]);

  const formatDate = item => {
    const date = item?.updatedAt || item?.createdAt;
    if (!date) return '';
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openRecordingUrl = url => {
    if (url) Linking.openURL(url);
  };

  const renderActivitySummary = item => {
    const rawType = String(item.type || 'Note').toLowerCase();
    const text = item.text?.trim();

    switch (rawType) {
      case 'call': {
        const outcomeMeta = getCallOutcomeMeta(item.callOutcome);
        return (
          <>
            <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
              {text || 'Call logged.'}
            </Text>
            <View style={styles.callMetaRow}>
              {item.callDirection ? (
                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  {item.callDirection}
                </Text>
              ) : null}
              {outcomeMeta ? (
                <View
                  style={[
                    styles.outcomeBadge,
                    {
                      backgroundColor: outcomeMeta.bg,
                      borderColor: outcomeMeta.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.outcomeDot,
                      { backgroundColor: outcomeMeta.color },
                    ]}
                  />
                  <Text
                    style={[styles.outcomeText, { color: outcomeMeta.color }]}
                  >
                    {outcomeMeta.label}
                  </Text>
                </View>
              ) : item.callOutcome ? (
                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  Outcome: {item.callOutcome}
                </Text>
              ) : null}
              {item.callDuration ? (
                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  Duration: {item.callDuration}
                </Text>
              ) : null}
            </View>
          </>
        );
      }
      case 'task':
        return (
          <>
            <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
              {text || 'Task recorded.'}
            </Text>
            {item.taskDueDate ? (
              <Text style={[styles.dueText, { color: theme.textMuted }]}>
                Due by{' '}
                {new Date(item.taskDueDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            ) : null}
            {item.isCompleted ? (
              <Text style={styles.completedText}>Completed</Text>
            ) : null}
          </>
        );
      case 'email':
        return (
          <>
            {item.emailSubject ? (
              <Text style={[styles.emailSubject, { color: theme.textPrimary }]}>
                {item.emailSubject}
              </Text>
            ) : null}
            <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
              {item.emailBody || text || 'Email activity logged.'}
            </Text>
          </>
        );
      case 'meeting':
        return (
          <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
            {text || 'Meeting activity recorded.'}
          </Text>
        );
      case 'recording':
        return (
          <>
            <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
              {text || 'Recording added.'}
            </Text>
            {item.recordingUrl ? (
              <TouchableOpacity
                onPress={() => openRecordingUrl(item.recordingUrl)}
              >
                <Text style={[styles.linkText, { color: theme.accent }]}>
                  View recording
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        );
      case 'status change':
        return (
          <>
            <Text
              style={[styles.statusChangeText, { color: theme.textPrimary }]}
            >
              {item.statusFrom || ''} → {item.statusTo || ''}
            </Text>
            <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
              {text || 'Status update recorded.'}
            </Text>
          </>
        );
      case 'payment':
        return (
          <>
            <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
              {text || 'Payment activity recorded.'}
            </Text>
            {item.paymentAmount != null ||
            item.paymentMode ||
            item.paymentStatus ||
            item.paymentReference ? (
              <Text style={[styles.paymentMeta, { color: theme.textMuted }]}>
                {item.paymentAmount != null
                  ? `Amount: ₹${item.paymentAmount}`
                  : ''}
                {item.paymentMode ? ` · Mode: ${item.paymentMode}` : ''}
                {item.paymentStatus ? ` · Status: ${item.paymentStatus}` : ''}
                {item.paymentReference
                  ? ` · Ref: ${item.paymentReference}`
                  : ''}
              </Text>
            ) : null}
          </>
        );
      case 'reminder':
        return (
          <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
            {text || 'Reminder recorded.'}
          </Text>
        );
      default:
        return (
          <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
            {text || 'Note activity recorded.'}
          </Text>
        );
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!latest) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No interactions yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        Latest Interaction
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.bgSurface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.icon}>{getActivityIcon(latest.type)}</Text>
          <Text style={[styles.typeText, { color: theme.textPrimary }]}>
            {latest.type || 'Note'}
          </Text>
          <View
            style={[
              styles.latestBadge,
              {
                backgroundColor: theme.bgSurface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.latestBadgeText, { color: theme.accent }]}>
              Latest
            </Text>
          </View>
        </View>

        <View style={styles.summaryWrap}>{renderActivitySummary(latest)}</View>

        <View
          style={[styles.cardFooter, { borderTopColor: theme.borderSubtle }]}
        >
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            {latest.createdBy?.name || 'You'}
          </Text>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            {formatDate(latest)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  centered: {
    paddingTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { marginTop: 8, fontSize: 13 },
  emptyText: { fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: '600' },
  card: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: { fontSize: 16 },
  typeText: { fontSize: 13, fontWeight: '700' },
  latestBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  latestBadgeText: { fontSize: 11, fontWeight: '600' },
  summaryWrap: { gap: 6 },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  callMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaText: { fontSize: 12 },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  outcomeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  outcomeText: { fontSize: 11, fontWeight: '700' },
  dueText: { fontSize: 12 },
  completedText: { fontSize: 12, color: '#22c55e' },
  emailSubject: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  statusChangeText: {
    fontSize: 13,
    marginBottom: 6,
  },
  paymentMeta: { fontSize: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  footerText: { fontSize: 11 },
});

export default ActivitiesTab;
