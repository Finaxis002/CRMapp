/**
 * ActiveFilterBadge — removable filter chip under search (LeadsScreen)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function ActiveFilterBadge({
  label,
  onRemove,
  icon,
  dotColor,
  style,
}) {
  const { colors, typography, borderRadius } = useUISystem();

  return (
    <Pressable
      onPress={onRemove}
      style={[
        styles.badge,
        {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primaryBorder || colors.border,
          borderRadius: borderRadius.full,
        },
        style,
      ]}
    >
      {dotColor ? (
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      ) : icon ? (
        <Icon name={icon} size={13} color={colors.primary} />
      ) : null}
      <Text style={[typography.caption, { color: colors.primary, fontWeight: '600', fontSize: 11 }]}>
        {label}
      </Text>
      <Icon name="close" size={13} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
