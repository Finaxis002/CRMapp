import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

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
  onOpenDetails,
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
  const { colors, typography, borderRadius, elevation } = useUISystem();

  const status = lead.status || 'New';
  const statusColor = getStageColor(status);
  const priority = lead.priority || 'Normal';
  const priorityColors = getPriorityColor(priority);
  const phone = String(lead.phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  const isCrossSell = lead.isCrossSell || lead.crossSellRecord;

  const handleCardPress = () => {
    if (onOpenDetails) onOpenDetails(lead);
  };

  return (
    <View
      style={[
        styles.card,
        elevation.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
        },
        selected && {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primary,
        },
      ]}
    >
      <TouchableOpacity
        onPress={handleCardPress}
        activeOpacity={0.8}
        disabled={!onOpenDetails}
      >
        {/* ── Top row: checkbox + name + status badge ── */}
        <View style={styles.topRow}>
          <View style={styles.nameWrap}>
            {onToggleSelect && (
              <TouchableOpacity
                onPress={() => onToggleSelect(lead._id)}
                style={[
                  styles.checkbox,
                  {
                    borderColor: colors.borderSolid,
                    backgroundColor: colors.surface,
                  },
                  selected && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                activeOpacity={0.7}
              >
                {selected ? (
                  <Icon name="check" size={11} color="#ffffff" />
                ) : null}
              </TouchableOpacity>
            )}
            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text
                  style={[
                    typography.label,
                    {
                      color: colors.textPrimary,
                      fontSize: 13.5,
                      flexShrink: 1,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {lead.name || '—'}
                </Text>
                {isCrossSell ? (
                  <View
                    style={[
                      styles.crossSellBadge,
                      {
                        backgroundColor: colors.purpleSoft,
                        borderColor: colors.purple + '40',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: colors.purple,
                          fontWeight: '600',
                          fontSize: 9,
                        },
                      ]}
                    >
                      🔁 Cross-Sell
                    </Text>
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
                  <Icon name="phone-outline" size={11} color={colors.success} />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary, fontSize: 11 },
                    ]}
                  >
                    {phone}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, fontSize: 11 },
                  ]}
                >
                  —
                </Text>
              )}
            </View>
          </View>

          <View style={styles.statusWrap}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusColor,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getContrastTextColor(statusColor) },
                ]}
              >
                {status}
              </Text>
            </View>
            {onOpenDetails ? (
              <Icon
                name="chevron-right"
                size={16}
                color={colors.textTertiary}
                style={styles.statusChevron}
              />
            ) : null}
          </View>
        </View>

        {/* ── Info grid ── */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={[typography.overline, { color: colors.textTertiary }]}>
              Deal Value
            </Text>
            <Text
              style={[
                typography.body2,
                { color: colors.textPrimary, fontWeight: '500', fontSize: 12 },
              ]}
              numberOfLines={1}
            >
              {formatCurrency(lead.dealValue ?? lead.value)}
            </Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={[typography.overline, { color: colors.textTertiary }]}>
              Priority
            </Text>
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor: priorityColors.bg,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  {
                    color: priorityColors.text,
                    fontWeight: '600',
                    fontSize: 10,
                  },
                ]}
              >
                {priority}
              </Text>
            </View>
          </View>
          <View style={styles.infoCell}>
            <Text style={[typography.overline, { color: colors.textTertiary }]}>
              Assigned
            </Text>
            <Text
              style={[
                typography.body2,
                { color: colors.textPrimary, fontWeight: '500', fontSize: 12 },
              ]}
              numberOfLines={1}
            >
              {getAssignedName(lead)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={[styles.actionsRow, { borderTopColor: colors.borderLight }]}>
        <TouchableOpacity
          onPress={e => onPreview(lead, e)}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <Icon name="eye-outline" size={12} color={colors.textSecondary} />
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, fontWeight: '500', fontSize: 11 },
            ]}
          >
            Preview
          </Text>
        </TouchableOpacity>

        {canEditAnyLead && (
          <TouchableOpacity
            onPress={() => onEdit(lead)}
            style={[
              styles.actionBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            activeOpacity={0.7}
          >
            <Icon
              name="pencil-outline"
              size={12}
              color={colors.textSecondary}
            />
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  fontWeight: '500',
                  fontSize: 11,
                },
              ]}
            >
              Edit
            </Text>
          </TouchableOpacity>
        )}

        {canDeleteLead && (
          <TouchableOpacity
            onPress={e => onDelete(lead._id, e)}
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.dangerSoft,
              },
            ]}
            activeOpacity={0.7}
          >
            <Icon name="trash-can-outline" size={12} color={colors.danger} />
            <Text
              style={[
                typography.caption,
                { color: colors.danger, fontWeight: '500', fontSize: 11 },
              ]}
            >
              Delete
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginBottom: 8 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  nameBlock: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  crossSellBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
    alignSelf: 'flex-start',
  },
  statusWrap: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusChevron: {
    marginLeft: 0,
  },
  statusBadge: { flexShrink: 0, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  infoGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  infoCell: { flex: 1, gap: 2, minWidth: 0 },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 7,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
});

export default LeadCardMobile;
