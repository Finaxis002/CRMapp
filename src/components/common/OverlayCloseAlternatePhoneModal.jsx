import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { IconSearch, IconX, IconCheck } from '@tabler/icons-react-native';
import { leadsService } from '../../services/leadsService';

const SEARCH_DEBOUNCE_MS = 350;

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
  const [saveError, setSaveError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef(null);

  const normalizePhoneValue = value => {
    const digits = String(value || '')
      .replace(/\D/g, '')
      .trim();
    if (!digits) return '';
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const getLeadKey = lead =>
    lead?._id || lead?.id || `${lead?.name || ''}-${lead?.phone || ''}` || null;

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
    setSaveError('');
    setHasSearched(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [visible, phoneNumber]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const performSearch = async term => {
    const searchTerms = collectSearchCandidates(term);
    if (!searchTerms.length) {
      setResults([]);
      setLoading(false);
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
          const key = getLeadKey(lead);
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

  const handleQueryChange = text => {
    setQuery(text);
    setSelectedLead(null);
    setSaveError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (!trimmed) {
      setHasSearched(false);
      setResults([]);
      setLoading(false);
      return;
    }

    setHasSearched(true);
    debounceRef.current = setTimeout(() => {
      performSearch(text);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSelectLead = lead => {
    const leadKey = getLeadKey(lead);
    const alreadySelected = !!leadKey && getLeadKey(selectedLead) === leadKey;

    setSelectedLead(alreadySelected ? null : lead);
    setSaveError('');
    Keyboard.dismiss();
  };

  const handleSave = async () => {
    const leadId = selectedLead?._id || selectedLead?.id;
    if (!leadId) return;

    const normalized = normalizePhoneValue(phoneNumber || '');
    if (!normalized) {
      setSaveError('No valid phone number to save.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      await leadsService.updateLead(leadId, {
        alternatePhone: normalized,
      });
      onClose();
    } catch (error) {
      console.warn('Unable to save alternatePhone', error);
      setSaveError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderResultsBody = () => {
    if (loading) {
      return (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Searching...</Text>
        </View>
      );
    }

    if (!hasSearched) {
      return (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Type a name or number to search</Text>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>No leads found</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.resultList}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {results.map(lead => {
          const leadKey = getLeadKey(lead);
          const isSelected = !!leadKey && getLeadKey(selectedLead) === leadKey;
          return (
            <TouchableOpacity
              key={leadKey}
              style={[
                styles.resultItem,
                isSelected && styles.selectedResultItem,
              ]}
              onPress={() => handleSelectLead(lead)}
            >
              <View style={styles.resultTopRow}>
                <Text
                  style={[
                    styles.resultTitle,
                    isSelected && styles.resultTitleSelected,
                  ]}
                >
                  {lead.name || 'Unnamed lead'}
                </Text>
                {isSelected ? (
                  <View style={styles.selectedBadge}>
                    <IconCheck size={13} color="#FFFFFF" strokeWidth={3} />
                    <Text style={styles.selectedLabel}>Selected</Text>
                  </View>
                ) : (
                  <Text style={styles.selectLabel}>Select</Text>
                )}
              </View>
              <Text style={styles.resultSubtitle}>
                {lead.phone || lead.alternatePhone || 'No phone found'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Add Alternate Phone</Text>
              <Text style={styles.subtitle}>{phoneNumber}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close modal"
            >
              <IconX size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <IconSearch size={20} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={handleQueryChange}
              placeholder="Search existing lead to map"
              keyboardType="default"
              returnKeyType="search"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.resultListContainer}>{renderResultsBody()}</View>

          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

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
      </KeyboardAvoidingView>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeButton: {
    padding: 6,
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#64748B',
    marginBottom: 0,
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
    marginBottom: 12,
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
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  selectedResultItem: {
    borderWidth: 2,
    borderColor: '#5A7BF6',
    backgroundColor: '#EFF6FF',
    shadowColor: '#5A7BF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5A7BF6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  selectedLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
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
    color: '#0F172A',
  },
  resultTitleSelected: {
    color: '#1D4ED8',
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
