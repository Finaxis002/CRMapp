/**
 * CountBadge — small numeric pill (reminders count, notification count)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

export default function CountBadge({ count = 0, style, textStyle }) {
  const { colors, typography, borderRadius } = useUISystem();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primaryBorder,
          borderRadius: borderRadius.full,
        },
        style,
      ]}
    >
      <Text
        style={[
          typography.label,
          { color: colors.primary, fontWeight: '700', fontSize: 14 },
          textStyle,
        ]}
      >
        {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
});
