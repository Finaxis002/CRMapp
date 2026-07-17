/**
 * OwnerChip — avatar + first name (dashboard lead cards)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';
import Avatar from './Avatar';

export default function OwnerChip({ name = 'Unassigned', style }) {
  const { colors, typography } = useUISystem();
  const first = name?.split(' ')[0] || '—';

  return (
    <View style={[styles.row, style]}>
      <Avatar name={name} size={26} rounded={13} variant="solid" />
      <Text style={[typography.body2, { color: colors.textPrimary, fontWeight: '500', fontSize: 13 }]}>
        {first}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
