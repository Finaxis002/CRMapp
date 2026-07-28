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

const formatTimeDisplay = value => {
  if (!value) return '';

  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);

  if (!match) return raw;

  const hours = Number(match[1]);
  const minutes = String(match[2]).padStart(2, '0');
  const meridiem = match[3]?.toUpperCase();

  if (meridiem) {
    const normalizedHours = hours % 12 || 12;
    return `${String(normalizedHours).padStart(2, '0')}:${minutes} ${meridiem}`;
  }

  const normalizedHours = hours % 24;
  const suffix = normalizedHours >= 12 ? 'PM' : 'AM';
  const displayHours = normalizedHours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${minutes} ${suffix}`;
};

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
  const displayValue = mode === 'time' ? formatTimeDisplay(value) : value;

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
        {displayValue || ph}
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
