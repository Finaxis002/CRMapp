/**
 * FormField (FieldBlock) + FormRow — compact version
 * Layout helpers for LeadFormModal & any multi-column forms
 */

import React from 'react';
import { Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

export function FormField({
  label,
  required = false,
  children,
  style,
  hint,
  error,
}) {
  const { colors, typography } = useUISystem();

  return (
    <View style={[{ flex: 1 }, style]}>
      {!!label && (
        <Text
          style={[
            typography.label,
            {
              color: colors.textSecondary,
              marginBottom: 3,
              fontSize: 11,
              fontWeight: '600',
            },
          ]}
        >
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      )}
      {children}
      {!!error && (
        <Text
          style={[
            typography.caption,
            { color: colors.danger, marginTop: 3, fontSize: 11 },
          ]}
        >
          {error}
        </Text>
      )}
      {!error && !!hint && (
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, marginTop: 3, fontSize: 11 },
          ]}
        >
          {hint}
        </Text>
      )}
    </View>
  );
}

/** Alias used in your LeadFormModal as FieldBlock */
export const FieldBlock = FormField;

export function FormRow({ children, columns = 1, style }) {
  const gap = columns === 3 ? 8 : 10;
  return (
    <View style={[{ gap }, columns > 1 && { flexDirection: 'row' }, style]}>
      {children}
    </View>
  );
}

export default FormField;
