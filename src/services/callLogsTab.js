import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCallLogsForLead } from './callLogsService.js';
import CallLogCard from './callLogCard.js';

const callLogsTab = ({ leadId, refreshTrigger, theme = {} }) => {
  const [loading, setLoading] = useState(true);
  const [callLogs, setCallLogs] = useState([]);
  const [error, setError] = useState('');

  const bgContent = theme?.bgContent || '#f8f9fb';
  const bgSurface = theme?.bgSurface || '#f9fafb';
  const border = theme?.border || '#e5e7eb';
  const textPrimary = theme?.textPrimary || '#1f2937';
  const textMuted = theme?.textMuted || '#6b7280';
  const accent = theme?.accent || '#7c3aed';

  useEffect(() => {
    let active = true;
    const loadLogs = async () => {
      if (!leadId) {
        setCallLogs([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const logs = await getCallLogsForLead(leadId);
        if (active) setCallLogs(logs);
      } catch (err) {
        if (active) setError('Unable to load call logs. Please refresh.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadLogs();
    return () => {
      active = false;
    };
  }, [leadId, refreshTrigger]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bgContent }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header info box */}
      <View
        style={[
          styles.infoBox,
          { backgroundColor: bgSurface, borderColor: border },
        ]}
      >
        <View style={styles.infoRow}>
          <Icon name="call" size={20} color={accent} />
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: textPrimary }]}>
              Call Logs
            </Text>
            <Text style={[styles.infoSub, { color: textMuted }]}>
              Automatically tracked calls for this lead.
            </Text>
          </View>
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={styles.centerText}>Loading call logs...</Text>
        </View>
      )}

      {/* Error */}
      {!!error && (
        <View
          style={[
            styles.errorBox,
            { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
          ]}
        >
          <Text style={[styles.errorText, { color: '#b91c1c' }]}>{error}</Text>
        </View>
      )}

      {/* Empty */}
      {!loading && !error && callLogs.length === 0 && (
        <View style={styles.centerBox}>
          <Text style={styles.centerText}>
            No auto-tracked calls were found for this lead.
          </Text>
        </View>
      )}

      {/* Call log cards */}
      {callLogs.map(log => (
        <CallLogCard key={log._id} callLog={log} theme={theme} />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  infoBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 16,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  centerBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  centerText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  errorBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
    padding: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
  },
});

export default callLogsTab;
