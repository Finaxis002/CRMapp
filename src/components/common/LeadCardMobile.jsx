import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * LeadCardMobile
 * Mobile-only card representation of a single lead (replaces the table row on small screens).
 *
 * All data/formatting is passed in as props so this component stays dumb and reuses
 * the exact same logic that LeadsPage already has (colors, currency, assigned name...).
 *
 * Props:
 *  - lead
 *  - selected            (bool)
 *  - onToggleSelect(id)
 *  - onPreview(lead, e)
 *  - onEdit(lead)
 *  - onDelete(id, e)
 *  - canEditAnyLead      (bool)
 *  - canDeleteLead       (bool)
 *  - getStageColor(status) -> hex
 *  - getContrastTextColor(hex) -> hex
 *  - getPriorityColor(priority) -> { bg, text }
 *  - getAssignedName(lead) -> string
 *  - formatCurrency(value) -> string
 */

const openPhone = phoneNumber => {
  const rawPhone = String(phoneNumber || '').trim();
  if (!rawPhone) return;
  const hasCountryCode =
    rawPhone.startsWith('+') || rawPhone.replace(/\D/g, '').length > 10;
  const cleanDigits = rawPhone.replace(/\D/g, '');
  const telHref = hasCountryCode
    ? rawPhone.startsWith('+')
      ? `tel:${rawPhone}`
      : `tel:+${rawPhone}`
    : `tel:+91${cleanDigits}`;
  Linking.openURL(telHref);
};

const LeadCardMobile = ({
  lead,
  selected = false,
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
  const status = lead.status || 'New';
  const statusColor = getStageColor(status);
  const priority = lead.priority || 'Normal';
  const priorityColors = getPriorityColor(priority);

  const phone = String(lead.phone || '')
    .replace(/\D/g, '')
    .slice(-10);

  const isCrossSell = lead.isCrossSell || lead.crossSellRecord;

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      {/* ── Top row: checkbox + name + status badge ── */}
      <View style={styles.topRow}>
        <View style={styles.nameWrap}>
          {onToggleSelect && (
            <TouchableOpacity
              onPress={() => onToggleSelect(lead._id)}
              style={[styles.checkbox, selected && styles.checkboxChecked]}
              activeOpacity={0.7}
            >
              {selected ? (
                <Icon name="check" size={12} color="#ffffff" />
              ) : null}
            </TouchableOpacity>
          )}
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>
                {lead.name || '—'}
              </Text>
              {isCrossSell ? (
                <View style={styles.crossSellBadge}>
                  <Text style={styles.crossSellText}>🔁 Cross-Sell</Text>
                </View>
              ) : null}
            </View>
            {phone ? (
              <TouchableOpacity
                onPress={() => openPhone(lead.phone)}
                style={styles.phoneRow}
                activeOpacity={0.6}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Icon name="phone-outline" size={12} color="#16a34a" />
                <Text style={styles.phoneText}>{phone}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.phoneText}>—</Text>
            )}
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text
            style={[
              styles.statusText,
              { color: getContrastTextColor(statusColor) },
            ]}
          >
            {status}
          </Text>
        </View>
      </View>

      {/* ── Info grid: Deal Value / Priority / Assigned ── */}
      <View style={styles.infoGrid}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Deal Value</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {formatCurrency(lead.dealValue ?? lead.value)}
          </Text>
        </View>

        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Priority</Text>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: priorityColors.bg },
            ]}
          >
            <Text style={[styles.priorityText, { color: priorityColors.text }]}>
              {priority}
            </Text>
          </View>
        </View>

        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Assigned</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {getAssignedName(lead)}
          </Text>
        </View>
      </View>

      {/* ── Actions row ── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={e => onPreview(lead, e)}
          style={[styles.actionBtn, styles.actionBtnDefault]}
          activeOpacity={0.7}
        >
          <Icon name="eye-outline" size={13} color="#6b7280" />
          <Text style={styles.actionTextDefault}>Preview</Text>
        </TouchableOpacity>

        {canEditAnyLead && (
          <TouchableOpacity
            onPress={e => onEdit(lead)}
            style={[styles.actionBtn, styles.actionBtnDefault]}
            activeOpacity={0.7}
          >
            <Icon name="pencil-outline" size={13} color="#6b7280" />
            <Text style={styles.actionTextDefault}>Edit</Text>
          </TouchableOpacity>
        )}

        {canDeleteLead && (
          <TouchableOpacity
            onPress={e => onDelete(lead._id, e)}
            style={[styles.actionBtn, styles.actionBtnDanger]}
            activeOpacity={0.7}
          >
            <Icon name="trash-can-outline" size={13} color="#ef4444" />
            <Text style={styles.actionTextDanger}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#5a7bf6',
    backgroundColor: '#5a7bf60d',
    shadowColor: '#5a7bf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#5a7bf6',
    borderColor: '#5a7bf6',
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  nameText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#111827',
    flexShrink: 1,
  },
  crossSellBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  crossSellText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9333ea',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  phoneText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  infoCell: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#9ca3af',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1f2937',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  actionBtnDefault: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  actionBtnDanger: {
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
  },
  actionTextDefault: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  actionTextDanger: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ef4444',
  },
});

export default LeadCardMobile;
