import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

const GAP = { small: 8, medium: 12, large: 16 };

export default function FormSection({
  title,
  description,
  children,
  spacing: gapKey = 'medium',
  style,
}) {
  const { colors, typography, spacing } = useUISystem();
  const gap = GAP[gapKey] ?? GAP.medium;

  return (
    <View style={[styles.section, { marginBottom: spacing.xl }, style]}>
      {(title || description) && (
        <View style={{ marginBottom: spacing.md }}>
          {!!title && (
            <Text style={[typography.h4, { color: colors.textPrimary }]}>
              {title}
            </Text>
          )}
          {!!description && (
            <Text
              style={[
                typography.body2,
                { color: colors.textSecondary, marginTop: spacing.xs },
              ]}
            >
              {description}
            </Text>
          )}
        </View>
      )}
      <View style={{ gap }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%' },
});
