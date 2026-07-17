/**
 * ImprovedTextInput — theme-aware professional input
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

const SIZE_MAP = {
  small: { height: 40, fontSize: 14, padH: 12, icon: 18 },
  medium: { height: 48, fontSize: 15, padH: 14, icon: 20 },
  large: { height: 56, fontSize: 16, padH: 16, icon: 22 },
};

export default function ImprovedTextInput({
  label,
  placeholder,
  value,
  onChangeText,
  onBlur,
  onFocus,
  error,
  errorMessage,
  helperText,
  icon,
  prefix,
  suffix,
  required = false,
  maxLength,
  multiline = false,
  showCharCounter = false,
  size = 'medium',
  variant = 'outlined',
  keyboardType = 'default',
  secureTextEntry = false,
  editable = true,
  autoCapitalize,
  autoFocus,
  style,
  inputStyle,
  containerStyle,
  ...rest
}) {
  const { colors, typography, spacing, borderRadius } = useUISystem();
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const hasError = Boolean(error || errorMessage);
  const sizeCfg = SIZE_MAP[size] || SIZE_MAP.medium;
  const isFilled = variant === 'filled';
  const displayError =
    typeof error === 'string' && error.length ? error : errorMessage;

  const animateFocus = (to) => {
    Animated.timing(borderAnim, {
      toValue: to,
      duration: 160,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      hasError ? colors.borderError : colors.border,
      hasError ? colors.borderError : colors.borderFocus,
    ],
  });

  const bgColor = !editable
    ? colors.disabledBg
    : isFilled
      ? colors.backgroundSecondary
      : colors.surface;

  const iconColor = focused
    ? colors.primary
    : hasError
      ? colors.danger
      : colors.textTertiary;

  return (
    <View style={[styles.wrap, { marginBottom: spacing.md }, containerStyle]}>
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

      <Animated.View
        style={[
          styles.field,
          {
            minHeight: multiline ? sizeCfg.height + 40 : sizeCfg.height,
            borderRadius: borderRadius.md,
            backgroundColor: bgColor,
            borderWidth: 1.5,
            borderColor,
            paddingHorizontal: sizeCfg.padH,
            opacity: editable ? 1 : 0.7,
          },
          style,
        ]}
      >
        {!!icon && (
          <Icon
            name={icon}
            size={sizeCfg.icon}
            color={iconColor}
            style={{ marginRight: 8 }}
          />
        )}
        {!!prefix && <View style={styles.affix}>{prefix}</View>}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          editable={editable}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          onFocus={(e) => {
            setFocused(true);
            animateFocus(1);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            animateFocus(0);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            typography.body1,
            {
              fontSize: sizeCfg.fontSize,
              color: colors.textPrimary,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingTop: multiline ? 12 : 0,
              paddingBottom: multiline ? 12 : 0,
            },
            inputStyle,
          ]}
          {...rest}
        />

        {!!suffix && <View style={styles.affix}>{suffix}</View>}
      </Animated.View>

      <View style={styles.footer}>
        {hasError && displayError ? (
          <Text style={[typography.caption, { color: colors.danger, flex: 1 }]}>
            {displayError}
          </Text>
        ) : helperText ? (
          <Text
            style={[typography.caption, { color: colors.textTertiary, flex: 1 }]}
          >
            {helperText}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {showCharCounter && typeof maxLength === 'number' && (
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            {(value || '').length}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  field: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, padding: 0, margin: 0 },
  affix: { marginHorizontal: 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    minHeight: 16,
  },
});
