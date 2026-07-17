/**
 * PageHeader — title + subtitle + right actions (Leads / Pipeline / Payments)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

export default function PageHeader({
  title,
  subtitle,
  right,
  style,
}) {
  const { colors, typography, spacing } = useUISystem();

  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1, marginRight: spacing.sm }}>
        <Text style={[typography.h2, { color: colors.textPrimary, fontSize: 22 }]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={[
              typography.body2,
              { color: colors.textSecondary, marginTop: 2, fontSize: 12 },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
