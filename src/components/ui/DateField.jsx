/**
 * DateField / DateTimeField trigger — compact version
 * Parent still owns DateTimePicker visibility state (pickerTargets pattern).
 *
 * <DateField
 *   value={form.closeDate}
 *   placeholder="Select date"
 *   mode="date" // or "time"
 *   onPress={() => setPickerTargets(p => ({ ...p, closeDate: 'date' }))}
 * />
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function DateField({
  value,
  onPress,
  mode = 'date',
  placeholder,
  disabled = false,
  error = false,
  style,
}) {
  const { colors, typography, borderRadius, sizes } = useUISystem();
  const ph = placeholder || (mode === 'time' ? 'Select time' : 'Select date');

  const height =
    sizes?.inputHeight != null ? Math.min(sizes.inputHeight, 44) : 44;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.btn,
        {
          height,
          borderRadius: borderRadius.md,
          borderColor: error ? colors.borderError : colors.borderSolid,
          backgroundColor: disabled ? colors.disabledBg : colors.surface,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          typography.body2,
          {
            fontSize: 13,
            color: value ? colors.textPrimary : colors.placeholder,
            flex: 1,
          },
        ]}
        numberOfLines={1}
      >
        {value || ph}
      </Text>
      <Icon
        name={mode === 'time' ? 'clock-outline' : 'calendar'}
        size={14}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}

/** Alias for LeadFormModal DateTimeField UI (trigger only) */
export function DateTimeFieldTrigger(props) {
  return <DateField {...props} />;
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
