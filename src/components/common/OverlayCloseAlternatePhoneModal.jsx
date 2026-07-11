import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { IconSearch } from '@tabler/icons-react-native';
import { leadsService } from '../../services/leadsService';

export default function OverlayCloseAlternatePhoneModal({
  visible,
  phoneNumber,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const normalizePhoneValue = value => {
    const digits = String(value || '')
      .replace(/\D/g, '')
      .trim();
    if (!digits) return '';
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const collectSearchCandidates = term => {
    const rawValue = String(term || '').trim();
    const digitsValue = normalizePhoneValue(rawValue);
    const candidates = [];
    if (rawValue) candidates.push(rawValue);
    if (digitsValue) candidates.push(digitsValue);
    return [...new Set(candidates)];
  };

  useEffect(() => {
    setQuery('');
    setResults([]);
    setSelectedLead(null);
  }, [visible, phoneNumber]);

  const performSearch = async term => {
    const searchTerms = collectSearchCandidates(term);
    if (!searchTerms.length) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const mergedResults = [];
      const seenKeys = new Set();

      for (const candidate of searchTerms) {
        const leads = await leadsService.getLeads({ search: candidate }, 1, 10);
        const items = Array.isArray(leads)
          ? leads
          : Array.isArray(leads?.data)
          ? leads.data
          : Array.isArray(leads?.items)
          ? leads.items
          : [];

        for (const lead of items) {
          const key =
            lead?._id || lead?.id || `${lead?.name || ''}-${lead?.phone || ''}`;
          if (!key || seenKeys.has(key)) continue;
          seenKeys.add(key);
          mergedResults.push(lead);
        }

        if (mergedResults.length >= 10) break;
      }

      setResults(mergedResults);
    } catch (error) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const leadId = selectedLead?._id || selectedLead?.id;
    if (!leadId) return;

    const normalized = normalizePhoneValue(phoneNumber || query || '');
    if (!normalized) return;

    setSaving(true);
    try {
      await leadsService.updateLead(leadId, {
        alternatePhone: normalized,
      });
      onClose();
    } catch (error) {
      console.warn('Unable to save alternatePhone', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Add Alternate Phone ({phoneNumber})</Text>
          <Text style={styles.subtitle}>Search lead name or number</Text>

          <View style={styles.searchContainer}>
            <IconSearch size={20} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={text => {
                setQuery(text);
                performSearch(text);
              }}
              placeholder="Enter lead name or phone"
              keyboardType="default"
              returnKeyType="search"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.resultListContainer}>
            {loading ? (
              <View style={styles.statusBox}>
                <Text style={styles.statusText}>Searching...</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.statusBox}>
                <Text style={styles.statusText}>No leads found</Text>
              </View>
            ) : (
              <ScrollView style={styles.resultList} nestedScrollEnabled>
                {results.map(lead => (
                  <TouchableOpacity
                    key={lead._id || lead.id}
                    style={[
                      styles.resultItem,
                      (selectedLead?._id === lead._id ||
                        selectedLead?.id === lead.id) &&
                        styles.selectedResultItem,
                    ]}
                    onPress={() => setSelectedLead(lead)}
                  >
                    <View style={styles.resultTopRow}>
                      <Text style={styles.resultTitle}>
                        {lead.name || 'Unnamed lead'}
                      </Text>
                      <Text
                        style={
                          selectedLead?._id === lead._id ||
                          selectedLead?.id === lead.id
                            ? styles.selectedLabel
                            : styles.selectLabel
                        }
                      >
                        {selectedLead?._id === lead._id ||
                        selectedLead?.id === lead.id
                          ? 'Selected'
                          : 'Select'}
                      </Text>
                    </View>
                    <Text style={styles.resultSubtitle}>
                      {lead.phone || lead.alternatePhone || 'No phone found'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!selectedLead || saving) && styles.disabledBtn,
              ]}
              onPress={handleSave}
              disabled={!selectedLead || saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748B',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  resultListContainer: {
    maxHeight: 260,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  resultList: {
    maxHeight: 260,
  },
  statusBox: {
    padding: 20,
    alignItems: 'center',
  },
  statusText: {
    color: '#64748B',
    textAlign: 'center',
  },
  selectedResultItem: {
    borderColor: '#5A7BF6',
    backgroundColor: '#EFF6FF',
  },
  resultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedLabel: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  selectLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  resultSubtitle: {
    color: '#475569',
    marginTop: 4,
  },
  resultItem: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 8,
    marginVertical: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: '#5A7BF6',
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
  },
});