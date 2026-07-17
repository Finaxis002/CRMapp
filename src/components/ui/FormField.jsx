/**
 * FormField (FieldBlock) + FormRow
 * Layout helpers for LeadFormModal & any multi-column forms
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

export function FormField({ label, required = false, children, style, hint, error }) {
  const { colors, typography, spacing } = useUISystem();

  return (
    <View style={[{ flex: 1 }, style]}>
      {!!label && (
        <Text
          style={[
            typography.label,
            { color: colors.textPrimary, marginBottom: spacing.xs },
          ]}
        >
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      )}
      {children}
      {!!error && (
        <Text style={[typography.caption, { color: colors.danger, marginTop: 4 }]}>
          {error}
        </Text>
      )}
      {!error && !!hint && (
        <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
          {hint}
        </Text>
      )}
    </View>
  );
}

/** Alias used in your LeadFormModal as FieldBlock */
export const FieldBlock = FormField;

export function FormRow({ children, columns = 1, style }) {
  const gap = columns === 3 ? 10 : 14;
  return (
    <View
      style={[
        { gap },
        columns > 1 && { flexDirection: 'row' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default FormField;
