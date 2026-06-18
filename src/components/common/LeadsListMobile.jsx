import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import LeadCardMobile from './LeadCardMobile.jsx';

/**
 * LeadsListMobile
 * Renders the leads as a stack of cards on mobile (replaces the <table> on small screens).
 *
 * Props: (mostly pass-through to LeadCardMobile)
 *  - leads            (array)
 *  - loading          (bool)
 *  - selectedIds      (Set)
 *  - onToggleSelect(id)
 *  - onPreview(lead, e)
 *  - onEdit(lead)
 *  - onDelete(id, e)
 *  - canEditAnyLead, canDeleteLead
 *  - getStageColor, getContrastTextColor, getPriorityColor, getAssignedName, formatCurrency
 */
const LeadsListMobile = ({
  leads,
  loading,
  selectedIds,
  onToggleSelect,
  onPreview,
  onEdit,
  onDelete,
  canEditAnyLead,
  canDeleteLead,
  getStageColor,
  getContrastTextColor,
  getPriorityColor,
  getAssignedName,
  formatCurrency,
}) => {
  // ── Loading skeletons ──
  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.listContainer}>
        {[...Array(5)].map((_, idx) => (
          <View key={`m-skel-${idx}`} style={styles.skeletonCard}>
            <View style={styles.skeletonHeader}>
              <View style={[styles.skeletonLine, { width: 128 }]} />
              <View style={[styles.skeletonBadge, { width: 64 }]} />
            </View>
            <View style={[styles.skeletonLine, { width: 96, marginTop: 8 }]} />
            <View style={styles.skeletonGrid}>
              <View style={styles.skeletonBlock} />
              <View style={styles.skeletonBlock} />
              <View style={styles.skeletonBlock} />
            </View>
            <View
              style={[styles.skeletonBlock, { marginTop: 12, height: 32 }]}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  // ── Empty state ──
  if (!leads || leads.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📄</Text>
        <Text style={styles.emptyTitle}>No leads found</Text>
        <Text style={styles.emptySubtitle}>Try adjusting your filters</Text>
      </View>
    );
  }

  // ── Cards ──
  return (
    <ScrollView contentContainerStyle={styles.listContainer}>
      {leads.map(lead => (
        <LeadCardMobile
          key={lead._id}
          lead={lead}
          selected={selectedIds?.has(lead._id)}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          onEdit={onEdit}
          onDelete={onDelete}
          canEditAnyLead={canEditAnyLead}
          canDeleteLead={canDeleteLead}
          getStageColor={getStageColor}
          getContrastTextColor={getContrastTextColor}
          getPriorityColor={getPriorityColor}
          getAssignedName={getAssignedName}
          formatCurrency={formatCurrency}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 12,
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  skeletonBadge: {
    height: 20,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  skeletonGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  skeletonBlock: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 80,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default LeadsListMobile;
