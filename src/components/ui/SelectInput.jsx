/**
 * SelectInput — trigger-only component for ImprovedDropdown
 * Shows label, selected value, chevron icon, error/helper text.
 * Tapping it calls onPress (parent opens the dropdown modal).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function SelectInput({
  label,
  value,
  placeholder = 'Select',
  onPress,
  error,
  helperText,
  required = false,
  disabled = false,
  icon,
  renderValue,
}) {
  const { colors, typography, borderRadius, sizes } = useUISystem();

  const hasError = Boolean(error);
  const displayError = typeof error === 'string' ? error : null;
  const displayValue = renderValue ? renderValue() : value;
  const isEmpty = !displayValue;

  const triggerHeight = Math.min(sizes.inputHeight ?? 44, 44);

  return (
    <View style={styles.wrap}>
      {!!label && (
        <Text
          style={[
            typography.label,
            {
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: '600',
              marginBottom: 3,
            },
          ]}
        >
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      )}

      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.trigger,
          {
            height: triggerHeight,
            borderRadius: borderRadius.md,
            borderColor: hasError ? colors.borderError : colors.border,
            backgroundColor: disabled ? colors.disabledBg : colors.surface,
            opacity: disabled ? 0.6 : pressed ? 0.92 : 1,
          },
        ]}
      >
        {!!icon && (
          <Icon
            name={icon}
            size={16}
            color={colors.textTertiary}
            style={{ marginRight: 6 }}
          />
        )}

        <Text
          style={[
            typography.body2,
            {
              flex: 1,
              color: isEmpty ? colors.placeholder : colors.textPrimary,
              fontSize: 13,
            },
          ]}
          numberOfLines={1}
        >
          {displayValue || placeholder}
        </Text>

        <Icon name="chevron-down" size={18} color={colors.textTertiary} />
      </Pressable>

      {hasError && displayError ? (
        <Text
          style={[
            typography.caption,
            { color: colors.danger, fontSize: 11, marginTop: 2 },
          ]}
        >
          {displayError}
        </Text>
      ) : helperText ? (
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
  },
});
