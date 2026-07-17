/**
 * EmptyState — centered empty / error message for lists & cards
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';
import ImprovedButton from './ImprovedButton';

export default function EmptyState({
  icon = 'inbox-outline',
  title,
  message,
  actionLabel,
  onAction,
  style,
}) {
  const { colors, typography, spacing } = useUISystem();

  return (
    <View style={[styles.wrap, { paddingVertical: spacing['3xl'] }, style]}>
      {!!icon && <Icon name={icon} size={40} color={colors.borderSolid} />}
      {!!title && (
        <Text
          style={[
            typography.label,
            { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
          ]}
        >
          {title}
        </Text>
      )}
      {!!message && (
        <Text
          style={[
            typography.body2,
            {
              color: colors.textTertiary,
              marginTop: spacing.xs,
              textAlign: 'center',
              fontWeight: '500',
            },
          ]}
        >
          {message}
        </Text>
      )}
      {actionLabel && onAction ? (
        <ImprovedButton
          title={actionLabel}
          onPress={onAction}
          variant="outline"
          size="small"
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
