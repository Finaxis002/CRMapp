
---
## File: src/components/ui/ActiveFilterBadge.jsx
```jsx
/**
 * ActiveFilterBadge â€” removable filter chip under search (LeadsScreen)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function ActiveFilterBadge({
  label,
  onRemove,
  icon,
  dotColor,
  style,
}) {
  const { colors, typography, borderRadius } = useUISystem();

  return (
    <Pressable
      onPress={onRemove}
      style={[
        styles.badge,
        {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primaryBorder || colors.border,
          borderRadius: borderRadius.full,
        },
        style,
      ]}
    >
      {dotColor ? (
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      ) : icon ? (
        <Icon name={icon} size={13} color={colors.primary} />
      ) : null}
      <Text style={[typography.caption, { color: colors.primary, fontWeight: '600', fontSize: 11 }]}>
        {label}
      </Text>
      <Icon name="close" size={13} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

```

---
## File: src/components/ui/Avatar.jsx
```jsx
/**
 * Avatar â€” initials circle / rounded square
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

const getInitials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

export default function Avatar({
  name = '',
  size = 40,
  rounded = 12,
  variant = 'soft', // soft | solid
  style,
  textStyle,
}) {
  const { colors, typography } = useUISystem();
  const bg = variant === 'solid' ? colors.primary : colors.primarySoft;
  const fg = variant === 'solid' ? colors.textInverse : colors.primary;
  const fontSize = Math.max(10, Math.round(size * 0.35));

  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: rounded,
          backgroundColor: bg,
          borderWidth: variant === 'soft' ? 1 : 0,
          borderColor: colors.primaryBorder,
        },
        style,
      ]}
    >
      <Text
        style={[
          typography.label,
          { color: fg, fontSize, fontWeight: '700' },
          textStyle,
        ]}
      >
        {getInitials(name) || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

```

---
## File: src/components/ui/BottomSheet.jsx
```jsx
/**
 * BottomSheet â€” filter / sort sheets shell
 * Header + scroll body + optional footer
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';
import ImprovedButton from './ImprovedButton';

export default function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footerLabel,
  onFooterPress,
  footer,
  maxHeight = '88%',
  rightHeader,
}) {
  const { colors, typography, borderRadius, spacing } = useUISystem();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius['3xl'] || 20,
              borderTopRightRadius: borderRadius['3xl'] || 20,
              maxHeight,
              paddingBottom: Platform.OS === 'ios' ? 30 : 16,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.borderSolid || colors.border }]}
          />

          <View
            style={[
              styles.header,
              {
                borderBottomColor: colors.border,
                paddingHorizontal: spacing.lg,
              },
            ]}
          >
            <Text style={[typography.h4, { color: colors.textPrimary, flex: 1 }]}>
              {title}
            </Text>
            <View style={styles.headerRight}>
              {rightHeader}
              <Pressable onPress={onClose} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ paddingHorizontal: spacing.lg }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
            <View style={{ height: 24 }} />
          </ScrollView>

          {footer
            ? footer
            : footerLabel && onFooterPress
              ? (
                <View style={{ paddingHorizontal: spacing.lg, paddingTop: 12 }}>
                  <ImprovedButton
                    title={footerLabel}
                    onPress={onFooterPress}
                    fullWidth
                    size="large"
                  />
                </View>
                )
              : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});

```

---
## File: src/components/ui/CheckboxRow.jsx
```jsx
/**
 * CheckboxRow â€” multi-select service / option rows
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function CheckboxRow({
  label,
  checked = false,
  onPress,
  style,
  disabled = false,
}) {
  const { colors, typography, borderRadius } = useUISystem();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.row,
        {
          borderColor: checked ? colors.primary : colors.borderSolid,
          borderWidth: checked ? 1.5 : 1,
          backgroundColor: checked ? colors.primarySoft : 'transparent',
          borderRadius: borderRadius.md,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.primary : colors.borderSolid,
            backgroundColor: checked ? colors.primary : 'transparent',
            borderRadius: 5,
          },
        ]}
      >
        {checked ? <Icon name="check" size={11} color="#fff" /> : null}
      </View>
      <Text style={[typography.body2, { color: colors.textPrimary, fontWeight: '500', fontSize: 13 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  box: {
    width: 18,
    height: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

```

---
## File: src/components/ui/ConfirmDialog.jsx
```jsx
/**
 * ConfirmDialog â€” delete / bulk confirm modals
 * Replaces inline DeleteModal patterns in LeadsScreen
 */

import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';
import ImprovedButton from './ImprovedButton';

export default function ConfirmDialog({
  visible,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = '',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger', // danger | primary
  loading = false,
}) {
  const { colors, typography, borderRadius, elevation, spacing } = useUISystem();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.card,
            elevation.lg,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius['2xl'],
              padding: spacing.xl,
            },
          ]}
        >
          <Text style={[typography.h4, { color: colors.textPrimary, marginBottom: 12 }]}>
            {title}
          </Text>
          {!!message && (
            <Text
              style={[
                typography.body2,
                { color: colors.textSecondary, marginBottom: 20, lineHeight: 20 },
              ]}
            >
              {message}
            </Text>
          )}
          <View style={styles.actions}>
            <ImprovedButton
              title={cancelLabel}
              variant="outline"
              onPress={onClose}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <ImprovedButton
              title={confirmLabel}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});

```

---
## File: src/components/ui/CountBadge.jsx
```jsx
/**
 * CountBadge â€” small numeric pill (reminders count, notification count)
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

```

---
## File: src/components/ui/CustomToast.jsx
```jsx
/**
 * Optional kit toast â€” use if you want to replace ToastContainer.
 * Your App already has ToastContainer from useToast; both can coexist.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';
import { registerToastApi } from '../../hooks/useUISystem';

const ToastContext = createContext(null);
const TOAST_DURATION = 3200;
const MAX_VISIBLE = 3;

const TYPE_META = {
  success: { icon: 'âœ“', colorKey: 'success', softKey: 'successSoft' },
  error: { icon: 'âœ•', colorKey: 'danger', softKey: 'dangerSoft' },
  warning: { icon: '!', colorKey: 'warning', softKey: 'warningSoft' },
  info: { icon: 'i', colorKey: 'info', softKey: 'infoSoft' },
};

function ToastItem({ toast, onDismiss }) {
  const { colors, spacing, borderRadius, elevation, typography } = useUISystem();
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const meta = TYPE_META[toast.type] || TYPE_META.info;
  const accent = colors[meta.colorKey];
  const soft = colors[meta.softKey];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    if (toast.duration !== 0) {
      const t = setTimeout(() => dismiss(), toast.duration || TOAST_DURATION);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -16,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(toast.id));
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        elevation.md,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderLeftWidth: 4,
          borderLeftColor: accent,
          marginBottom: spacing.sm,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: soft, borderRadius: borderRadius.full },
        ]}
      >
        <Text style={[styles.iconText, { color: accent }]}>{meta.icon}</Text>
      </View>

      <View style={styles.body}>
        {!!toast.title && (
          <Text
            style={[typography.label, { color: colors.textPrimary, marginBottom: 2 }]}
            numberOfLines={1}
          >
            {toast.title}
          </Text>
        )}
        <Text
          style={[typography.body2, { color: colors.textSecondary }]}
          numberOfLines={3}
        >
          {toast.message}
        </Text>
      </View>

      {toast.action?.label ? (
        <Pressable
          onPress={() => {
            toast.action.onPress?.();
            dismiss();
          }}
          hitSlop={8}
          style={styles.actionBtn}
        >
          <Text style={[typography.label, { color: accent }]}>
            {toast.action.label}
          </Text>
        </Pressable>
      ) : (
        <Pressable onPress={dismiss} hitSlop={8} style={styles.closeBtn}>
          <Text style={{ color: colors.textTertiary, fontSize: 18, lineHeight: 20 }}>
            Ã—
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((opts) => {
    const id = ++idRef.current;
    const toast = {
      id,
      type: opts.type || 'info',
      title: opts.title,
      message: opts.message || opts.title || '',
      duration: opts.duration,
      action: opts.action,
    };
    setToasts((prev) => [toast, ...prev].slice(0, MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(
    () => ({
      show,
      success: (message, extra) => show({ type: 'success', message, ...extra }),
      error: (message, extra) => show({ type: 'error', message, ...extra }),
      warning: (message, extra) => show({ type: 'warning', message, ...extra }),
      info: (message, extra) => show({ type: 'info', message, ...extra }),
      dismiss,
    }),
    [show, dismiss],
  );

  useEffect(() => {
    registerToastApi(api);
    return () => registerToastApi(null);
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={styles.container}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconText: { fontSize: 14, fontWeight: '700' },
  body: { flex: 1, paddingRight: 8 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
});

export default ToastProvider;

```

---
## File: src/components/ui/DateField.jsx
```jsx
/**
 * DateField / DateTimeField trigger
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
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const ph =
    placeholder || (mode === 'time' ? 'Select time' : 'Select date');

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.btn,
        {
          height: sizes.inputHeight,
          borderRadius: borderRadius.lg,
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
        size={16}
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
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

```

---
## File: src/components/ui/EmptyState.jsx
```jsx
/**
 * EmptyState â€” centered empty / error message for lists & cards
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

```

---
## File: src/components/ui/FilterChip.jsx
```jsx
/**
 * FilterChip â€” dashboard date filters, stage tabs, activity type pills
 * <FilterChip label="Today" active={active} onPress={...} />
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function FilterChip({
  label,
  active = false,
  onPress,
  icon,
  showDot = false,
  color, // optional override accent when active (hex)
  style,
  textStyle,
  disabled = false,
}) {
  const { colors, typography, borderRadius } = useUISystem();
  const activeBg = color || colors.primary;
  const activeText = colors.textInverse;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: borderRadius.lg,
          borderColor: colors.border,
          backgroundColor: active ? activeBg : colors.surface,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          borderWidth: active ? 0 : 1,
        },
        style,
      ]}
    >
      {!!icon && (
        <Icon
          name={icon}
          size={14}
          color={active ? activeText : colors.textSecondary}
          style={{ marginRight: 6 }}
        />
      )}
      <Text
        style={[
          typography.label,
          {
            color: active ? activeText : colors.textSecondary,
            fontWeight: active ? '600' : '500',
            fontSize: 13,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
      {showDot ? (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: colors.success,
              borderColor: active ? activeBg : colors.surface,
            },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
});

```

---
## File: src/components/ui/FormField.jsx
```jsx
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

```

---
## File: src/components/ui/FormModal.jsx
```jsx
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';
import ImprovedButton from './ImprovedButton';

export default function FormModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  onSubmit,
  submitLabel = 'Save',
  onCancel,
  cancelLabel = 'Cancel',
  isLoading = false,
  showFooter = true,
  fullScreen = false,
}) {
  const { colors, typography, spacing, borderRadius, elevation } = useUISystem();

  const handleCancel = () => {
    if (onCancel) onCancel();
    else onClose?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={!fullScreen}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          { backgroundColor: fullScreen ? colors.background : colors.overlay },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <View
            style={[
              styles.sheet,
              elevation.xl,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: fullScreen ? 0 : borderRadius['2xl'],
                borderTopRightRadius: fullScreen ? 0 : borderRadius['2xl'],
                maxHeight: fullScreen ? '100%' : '92%',
                flex: fullScreen ? 1 : undefined,
              },
            ]}
          >
            <View
              style={[
                styles.header,
                {
                  borderBottomColor: colors.border,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.lg,
                  paddingBottom: spacing.md,
                },
              ]}
            >
              <View style={styles.headerText}>
                {!!title && (
                  <Text
                    style={[typography.h3, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                )}
                {!!subtitle && (
                  <Text
                    style={[
                      typography.body2,
                      { color: colors.textSecondary, marginTop: 4 },
                    ]}
                    numberOfLines={2}
                  >
                    {subtitle}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={[
                  styles.close,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.lg,
                paddingBottom: spacing['2xl'],
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {showFooter && (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: colors.border,
                    padding: spacing.lg,
                    gap: spacing.sm,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <ImprovedButton
                  title={submitLabel}
                  onPress={onSubmit}
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading}
                />
                <ImprovedButton
                  title={cancelLabel}
                  onPress={handleCancel}
                  variant="secondary"
                  size="medium"
                  fullWidth
                  disabled={isLoading}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  kav: { width: '100%', maxHeight: '100%' },
  sheet: { width: '100%', overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, paddingRight: 12 },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});

```

---
## File: src/components/ui/FormSection.jsx
```jsx
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

```

---
## File: src/components/ui/IconButton.jsx
```jsx
/**
 * IconButton â€” circular / rounded icon press target (Topbar, cards)
 */

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function IconButton({
  name,
  onPress,
  size = 22,
  color,
  backgroundColor,
  hitSlop = 10,
  style,
  disabled = false,
}) {
  const { colors, borderRadius } = useUISystem();
  const iconColor = color || colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: backgroundColor || 'transparent',
          borderRadius: borderRadius.md,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

```

---
## File: src/components/ui/ImprovedButton.jsx
```jsx
/**
 * ImprovedButton â€” theme-aware
 * variants: primary | secondary | outline | danger | ghost
 */

import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

const SIZE_STYLES = {
  small: { height: 32, padH: 12, fontSize: 13, radius: 8, icon: 16 },
  medium: { height: 44, padH: 18, fontSize: 15, radius: 10, icon: 18 },
  large: { height: 52, padH: 22, fontSize: 16, radius: 12, icon: 20 },
};

export default function ImprovedButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  ...rest
}) {
  const { colors, typography } = useUISystem();
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;
  const sizeCfg = SIZE_STYLES[size] || SIZE_STYLES.medium;

  const palette =
    {
      primary: {
        bg: colors.primary,
        text: colors.textInverse,
        border: colors.primary,
        spinner: colors.textInverse,
      },
      secondary: {
        bg: colors.backgroundSecondary,
        text: colors.textPrimary,
        border: colors.backgroundSecondary,
        spinner: colors.textPrimary,
      },
      outline: {
        bg: 'transparent',
        text: colors.textPrimary,
        border: colors.border,
        spinner: colors.textPrimary,
      },
      danger: {
        bg: colors.danger,
        text: colors.textInverse,
        border: colors.danger,
        spinner: colors.textInverse,
      },
      ghost: {
        bg: 'transparent',
        text: colors.primary,
        border: 'transparent',
        spinner: colors.primary,
      },
    }[variant] || {
      bg: colors.primary,
      text: colors.textInverse,
      border: colors.primary,
      spinner: colors.textInverse,
    };

  const iconNode =
    typeof icon === 'string' ? (
      <Icon name={icon} size={sizeCfg.icon} color={palette.text} />
    ) : (
      icon
    );

  return (
    <Animated.View
      style={[fullWidth && { width: '100%' }, { transform: [{ scale }] }, style]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.97,
            useNativeDriver: true,
            friction: 6,
            tension: 120,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 6,
            tension: 120,
          }).start()
        }
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.btn,
          {
            height: sizeCfg.height,
            paddingHorizontal: sizeCfg.padH,
            borderRadius: sizeCfg.radius,
            backgroundColor: palette.bg,
            borderWidth: variant === 'outline' ? 1.5 : 0,
            borderColor: palette.border,
            opacity: isDisabled ? 0.55 : 1,
          },
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={palette.spinner} size="small" />
        ) : (
          <View style={styles.content}>
            {iconNode && iconPosition === 'left' ? (
              <View style={styles.iconLeft}>{iconNode}</View>
            ) : null}
            <Text
              style={[
                typography.button,
                { fontSize: sizeCfg.fontSize, color: palette.text },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {iconNode && iconPosition === 'right' ? (
              <View style={styles.iconRight}>{iconNode}</View>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});

```

---
## File: src/components/ui/ImprovedCard.jsx
```jsx
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

const PADDING = { small: 12, medium: 16, large: 20 };

export default function ImprovedCard({
  children,
  variant = 'elevated',
  padding = 'medium',
  pressable = false,
  onPress,
  disabled = false,
  borderRadius: radiusKey = 'lg',
  style,
  ...rest
}) {
  const { colors, borderRadius, elevation } = useUISystem();
  const scale = useRef(new Animated.Value(1)).current;
  const isPressable = pressable || typeof onPress === 'function';
  const pad = PADDING[padding] ?? PADDING.medium;
  const radius = borderRadius[radiusKey] ?? borderRadius.lg;

  const variantStyle = (() => {
    switch (variant) {
      case 'flat':
      case 'default':
        return { backgroundColor: colors.surface, borderWidth: 0, ...elevation.xs };
      case 'outline':
      case 'bordered':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...elevation.none,
        };
      case 'ghost':
        return {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...elevation.none,
        };
      case 'elevated':
      default:
        return { backgroundColor: colors.surface, borderWidth: 0, ...elevation.md };
    }
  })();

  const content = (
    <View
      style={[
        styles.card,
        variantStyle,
        {
          padding: pad,
          borderRadius: radius,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
      {...(!isPressable ? rest : {})}
    >
      {children}
    </View>
  );

  if (!isPressable) return content;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.98,
            useNativeDriver: true,
            friction: 7,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 7,
          }).start()
        }
        {...rest}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
});

```

---
## File: src/components/ui/ImprovedDropdown.jsx
```jsx
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';
import SelectInput from './SelectInput';

export default function ImprovedDropdown({
  label,
  items = [],
  selectedValue,
  onValueChange,
  placeholder = 'Select an option',
  searchable = true,
  disabled = false,
  error = false,
  errorMessage,
  renderItem,
  required = false,
  helperText,
  icon,
}) {
  const { colors, typography, spacing, borderRadius, elevation } = useUISystem();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = items.find((i) => i.value === selectedValue);
  const errText = typeof error === 'string' ? error : errorMessage;
  const hasError = Boolean(error || errorMessage);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        String(i.label).toLowerCase().includes(q) ||
        String(i.value).toLowerCase().includes(q),
    );
  }, [items, query, searchable]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (item) => {
    onValueChange?.(item.value, item);
    close();
  };

  const defaultRender = ({ item }) => {
    const isSelected = item.value === selectedValue;
    return (
      <Pressable
        onPress={() => pick(item)}
        style={[
          styles.option,
          {
            backgroundColor: isSelected ? colors.primarySoft : colors.surface,
            borderBottomColor: colors.borderLight,
          },
        ]}
      >
        <Text
          style={[
            typography.body1,
            {
              color: isSelected ? colors.primary : colors.textPrimary,
              fontWeight: isSelected ? '600' : '400',
              flex: 1,
            },
          ]}
        >
          {item.label}
        </Text>
        {isSelected && (
          <Icon name="check" size={18} color={colors.primary} />
        )}
      </Pressable>
    );
  };

  return (
    <>
      <SelectInput
        label={label}
        value={selectedValue}
        placeholder={placeholder}
        onPress={() => !disabled && setOpen(true)}
        error={hasError ? errText || true : undefined}
        helperText={helperText}
        required={required}
        disabled={disabled}
        icon={icon}
        renderValue={() => selected?.label}
      />

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={close}
        >
          <Pressable
            style={[
              styles.sheet,
              elevation.xl,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: borderRadius['2xl'],
                borderTopRightRadius: borderRadius['2xl'],
              },
            ]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={[styles.sheetHeader, { paddingHorizontal: spacing.lg }]}>
              <Text style={[typography.h4, { color: colors.textPrimary, flex: 1 }]}>
                {label || 'Select'}
              </Text>
              <Pressable onPress={close} hitSlop={10}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                  Close
                </Text>
              </Pressable>
            </View>

            {searchable && (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  marginBottom: spacing.sm,
                }}
              >
                <View
                  style={[
                    styles.searchWrap,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderRadius: borderRadius.md,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Icon
                    name="magnify"
                    size={18}
                    color={colors.textTertiary}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search..."
                    placeholderTextColor={colors.placeholder}
                    style={[
                      styles.search,
                      typography.body1,
                      { color: colors.textPrimary },
                    ]}
                  />
                </View>
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item, index) => String(item.value ?? index)}
              renderItem={
                renderItem
                  ? ({ item }) => renderItem(item, () => pick(item))
                  : defaultRender
              }
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 360 }}
              ListEmptyComponent={
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <Text style={[typography.body2, { color: colors.textTertiary }]}>
                    No options found
                  </Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', paddingBottom: 24 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  search: { flex: 1, padding: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

```

---
## File: src/components/ui/ImprovedTextInput.jsx
```jsx
/**
 * ImprovedTextInput â€” theme-aware professional input
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

```

---
## File: src/components/ui/ListDivider.jsx
```jsx
/**
 * ListDivider â€” thin separator between list rows
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

export default function ListDivider({ style, inset = 0 }) {
  const { colors } = useUISystem();
  return (
    <View
      style={[
        styles.line,
        {
          backgroundColor: colors.border,
          marginLeft: inset,
          opacity: 0.6,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth * 2 || 1,
  },
});

```

---
## File: src/components/ui/MetricCard.jsx
```jsx
/**
 * MetricCard â€” dashboard KPI tile
 * color: blue | yellow | green | purple | cyan
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, Dimensions } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useUISystem } from '../../hooks/useUISystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HALF = (SCREEN_WIDTH - 16 * 2 - 8) / 2;

const COLOR_MAP = {
  blue: { accent: 'primary', soft: 'primarySoft' },
  yellow: { accent: 'warning', soft: 'warningSoft' },
  green: { accent: 'success', soft: 'successSoft' },
  purple: { accent: 'purple', soft: 'purpleSoft' },
  cyan: { accent: 'cyan', soft: 'cyanSoft' },
};

export default function MetricCard({
  label,
  value,
  icon = 'users',
  color = 'blue',
  onPress,
  fullWidth = false,
  style,
}) {
  const { colors, typography, borderRadius, elevation } = useUISystem();
  const map = COLOR_MAP[color] || COLOR_MAP.blue;
  const top = colors[map.accent];
  const soft = colors[map.soft];

  const content = (
    <>
      <View style={[styles.icon, { backgroundColor: soft, borderRadius: borderRadius.md }]}>
        <Feather name={icon} size={18} color={top} />
      </View>
      <Text style={[typography.overline, { color: colors.textSecondary, marginTop: 8, marginBottom: 8 }]}>
        {label}
      </Text>
      <Text
        style={[
          typography.h2,
          {
            color: colors.textPrimary,
            fontSize: label === 'Collected' ? 22 : 26,
            lineHeight: 30,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </>
  );

  const baseStyle = [
    styles.card,
    elevation.xs,
    {
      width: fullWidth ? '100%' : HALF,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderTopColor: top,
      borderRadius: borderRadius.xl,
    },
    fullWidth && { marginBottom: 12 },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...baseStyle, { opacity: pressed ? 0.9 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderWidth: 1,
    borderTopWidth: 3,
    minHeight: 110,
  },
  icon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

```

---
## File: src/components/ui/OwnerChip.jsx
```jsx
/**
 * OwnerChip â€” avatar + first name (dashboard lead cards)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';
import Avatar from './Avatar';

export default function OwnerChip({ name = 'Unassigned', style }) {
  const { colors, typography } = useUISystem();
  const first = name?.split(' ')[0] || 'â€”';

  return (
    <View style={[styles.row, style]}>
      <Avatar name={name} size={26} rounded={13} variant="solid" />
      <Text style={[typography.body2, { color: colors.textPrimary, fontWeight: '500', fontSize: 13 }]}>
        {first}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

```

---
## File: src/components/ui/PageHeader.jsx
```jsx
/**
 * PageHeader â€” title + subtitle + right actions (Leads / Pipeline / Payments)
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

```

---
## File: src/hooks/useUISystem.js
```jsx
/**
 * useUISystem.js â€” theme tokens + form / async / pagination helpers
 * Reads live dark mode from ThemeContext when available.
 */

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getTheme } from '../themes/UnifiedThemeSystem';
import { ThemeContext } from '../contexts/ThemeContext';

/** Optional toast bridge â€” works with kit Toast or your existing useToast */
let externalToastApi = null;
export function registerToastApi(api) {
  externalToastApi = api;
}

export function useUISystem(isDarkOverride) {
  const ctx = useContext(ThemeContext);
  const isDark =
    typeof isDarkOverride === 'boolean'
      ? isDarkOverride
      : ctx?.isDark ?? ctx?.isDarkMode ?? false;

  return useMemo(() => {
    if (ctx?.theme && typeof isDarkOverride !== 'boolean') {
      return {
        ...ctx.theme,
        isDark: ctx.isDark ?? ctx.isDarkMode,
        colors: ctx.colors || ctx.theme.colors,
      };
    }
    return getTheme(isDark);
  }, [ctx, isDark, isDarkOverride]);
}

/**
 * Notification helpers.
 * Prefer your app's toast if registered; otherwise no-ops with console.
 */
export function useNotification() {
  const show = useCallback(opts => {
    if (externalToastApi?.show) return externalToastApi.show(opts);
    if (externalToastApi?.success && opts?.type === 'success') {
      return externalToastApi.success(opts.message);
    }
    // Fallback: try common patterns from many RN toast libs
    if (typeof externalToastApi === 'function') {
      return externalToastApi(opts?.message || '', opts);
    }
    console.log(`[toast:${opts?.type || 'info'}]`, opts?.message);
  }, []);

  return useMemo(
    () => ({
      show,
      showSuccess: (message, extra) =>
        externalToastApi?.success?.(message, extra) ||
        show({ type: 'success', message, ...extra }),
      showError: (message, extra) =>
        externalToastApi?.error?.(message, extra) ||
        show({ type: 'error', message, ...extra }),
      showWarning: (message, extra) =>
        externalToastApi?.warning?.(message, extra) ||
        show({ type: 'warning', message, ...extra }),
      showInfo: (message, extra) =>
        externalToastApi?.info?.(message, extra) ||
        show({ type: 'info', message, ...extra }),
      dismiss: id => externalToastApi?.dismiss?.(id),
    }),
    [show],
  );
}

function runRule(value, rule, allValues) {
  if (!rule) return '';
  const str = value == null ? '' : String(value);

  if (rule.required && !str.trim()) {
    return rule.message || 'This field is required';
  }
  if (rule.minLength != null && str.length > 0 && str.length < rule.minLength) {
    return rule.message || `Minimum ${rule.minLength} characters`;
  }
  if (rule.maxLength != null && str.length > rule.maxLength) {
    return rule.message || `Maximum ${rule.maxLength} characters`;
  }
  if (rule.pattern && str.length > 0 && !rule.pattern.test(str)) {
    return rule.message || 'Invalid format';
  }
  if (typeof rule.validate === 'function') {
    const result = rule.validate(value, allValues);
    if (result === false) return rule.message || 'Invalid value';
    if (typeof result === 'string') return result;
  }
  return '';
}

export function useFormValidation(initialValues = {}, rules = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = useCallback(
    (name, text) => {
      setValues(prev => {
        const next = { ...prev, [name]: text };
        if (touched[name] || errors[name]) {
          const msg = runRule(text, rules[name], next);
          setErrors(e => ({ ...e, [name]: msg }));
        }
        return next;
      });
    },
    [rules, touched, errors],
  );

  const handleBlur = useCallback(
    name => {
      setTouched(prev => ({ ...prev, [name]: true }));
      setValues(current => {
        const msg = runRule(current[name], rules[name], current);
        setErrors(e => ({ ...e, [name]: msg }));
        return current;
      });
    },
    [rules],
  );

  const validateAll = useCallback(() => {
    const nextErrors = {};
    let ok = true;
    Object.keys(rules).forEach(key => {
      const msg = runRule(values[key], rules[key], values);
      nextErrors[key] = msg;
      if (msg) ok = false;
    });
    setErrors(nextErrors);
    setTouched(
      Object.keys(rules).reduce((acc, k) => {
        acc[k] = true;
        return acc;
      }, {}),
    );
    return ok;
  }, [rules, values]);

  const reset = useCallback(
    (next = initialValues) => {
      setValues(next);
      setErrors({});
      setTouched({});
    },
    [initialValues],
  );

  const setFieldValue = useCallback((name, text) => {
    setValues(prev => ({ ...prev, [name]: text }));
  }, []);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    setValues,
    setFieldValue,
    setErrors,
  };
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useAsync(asyncFn, immediate = false) {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args) => {
      setStatus('pending');
      setError(null);
      try {
        const result = await asyncFn(...args);
        if (mounted.current) {
          setData(result);
          setStatus('success');
        }
        return result;
      } catch (err) {
        if (mounted.current) {
          setError(err);
          setStatus('error');
        }
        throw err;
      }
    },
    [asyncFn],
  );

  useEffect(() => {
    if (immediate) execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return {
    execute,
    status,
    data,
    error,
    isLoading: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error',
  };
}

export function usePagination(items = [], itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  return {
    currentItems,
    currentPage,
    totalPages,
    nextPage: () => setCurrentPage(p => Math.min(totalPages, p + 1)),
    prevPage: () => setCurrentPage(p => Math.max(1, p - 1)),
    goToPage: n => setCurrentPage(Math.min(totalPages, Math.max(1, n))),
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

export function useFocus() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    setFocused,
  };
}

export default {
  useUISystem,
  useNotification,
  useFormValidation,
  useDebounce,
  useAsync,
  usePagination,
  useFocus,
  registerToastApi,
};

```

---
## File: src/contexts/ThemeContext.js
```jsx
/**
 * ThemeContext â€” matches Sharda CRM API: isDark, toggleTheme
 * Place at: src/contexts/ThemeContext.jsx (same path your app already uses)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from '../themes/UnifiedThemeSystem';

const STORAGE_KEY = '@sharda_crm_theme';

export const ThemeContext = createContext({
  isDark: false,
  theme: getTheme(false),
  colors: getTheme(false).colors,
  toggleTheme: () => {},
  setDarkMode: () => {},
});

export function ThemeProvider({ children, initialDark }) {
  const system = useColorScheme();
  const [isDark, setIsDark] = useState(
    typeof initialDark === 'boolean' ? initialDark : false,
  );
  const [ready, setReady] = useState(typeof initialDark === 'boolean');

  useEffect(() => {
    if (typeof initialDark === 'boolean') return;
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (saved === 'dark') setIsDark(true);
        else if (saved === 'light') setIsDark(false);
        else setIsDark(system === 'dark');
      } catch {
        if (mounted) setIsDark(system === 'dark');
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initialDark, system]);

  const setDarkMode = useCallback(value => {
    const next = Boolean(value);
    setIsDark(next);
    AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(
        () => {},
      );
      return next;
    });
  }, []);

  const theme = useMemo(() => getTheme(isDark), [isDark]);

  const value = useMemo(
    () => ({
      isDark,
      isDarkMode: isDark, // alias for newer kit code
      theme,
      colors: theme.colors,
      typography: theme.typography,
      spacing: theme.spacing,
      elevation: theme.elevation,
      borderRadius: theme.borderRadius,
      sizes: theme.sizes,
      toggleTheme,
      setDarkMode,
      ready,
    }),
    [isDark, theme, toggleTheme, setDarkMode, ready],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;

```

---
## File: src\themes\UnifiedThemeSystem.js
```js
/**
 * UnifiedThemeSystem.js
 * Single source of truth for Sharda CRM professional UI.
 * Use: import { getTheme, COLORS } from '../themes/UnifiedThemeSystem'
 * Or:  const { colors, spacing, typography } = useUISystem() / useTheme()
 */

export const lightColors = {
  // Brand
  primary: '#5a7bf6',
  primaryDark: '#4a68e0',
  primaryLight: '#7c96ff',
  primarySoft: 'rgba(90,123,246,0.10)',
  primaryBorder: 'rgba(90,123,246,0.20)',
  primaryShadow: 'rgba(90,123,246,0.25)',

  // Semantic
  success: '#12B76A',
  successSoft: 'rgba(18,183,106,0.10)',
  warning: '#F79009',
  warningSoft: 'rgba(247,144,9,0.10)',
  danger: '#F04438',
  dangerSoft: 'rgba(240,68,56,0.10)',
  info: '#0BA5EC',
  infoSoft: 'rgba(11,165,236,0.10)',
  purple: '#7A5AF8',
  purpleSoft: 'rgba(122,90,248,0.10)',
  cyan: '#0BA5EC',
  cyanSoft: 'rgba(11,165,236,0.10)',

  // Status badges
  statusNew: '#3b82f6',
  statusProcessing: '#F79009',
  statusCompleted: '#12B76A',
  statusCancelled: '#F04438',

  // Surfaces
  white: '#ffffff',
  black: '#000000',
  background: '#F8FAFC',
  backgroundSecondary: '#f3f4f6',
  backgroundTertiary: '#e5e7eb',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  cardBg: 'rgba(0,0,0,0.04)',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#ffffff',
  textLink: '#5a7bf6',

  // Borders & states
  border: 'rgba(0,0,0,0.09)',
  borderSolid: '#e5e7eb',
  borderLight: '#f3f4f6',
  borderFocus: '#5a7bf6',
  borderError: '#F04438',
  disabledBg: '#f3f4f6',
  disabledText: '#d1d5db',
  placeholder: '#9CA3AF',
  overlay: 'rgba(17, 24, 39, 0.45)',
  shadow: '#000000',

  // Skeleton
  skeletonBase: '#e5e7eb',
  skeletonHighlight: '#f3f4f6',

  // Aliases used by existing DashboardScreen local palette
  accent: '#5a7bf6',
  accentDark: '#4a68e0',
  accentSoft: 'rgba(90,123,246,0.10)',
  accentBorder: 'rgba(90,123,246,0.20)',
  accentShadow: 'rgba(90,123,246,0.25)',
  warn: '#F79009',
  warnSoft: 'rgba(247,144,9,0.10)',
  red: '#F04438',
  redSoft: 'rgba(240,68,56,0.10)',
  text1: '#111827',
  text2: '#6B7280',
  text3: '#9CA3AF',
  gradientStart: '#5a7bf6',
  gradientEnd: '#7A5AF8',
};

export const darkColors = {
  primary: '#6b8fff',
  primaryDark: '#5a7bf6',
  primaryLight: '#8aa4ff',
  primarySoft: 'rgba(90,123,246,0.15)',
  primaryBorder: 'rgba(90,123,246,0.22)',
  primaryShadow: 'rgba(90,123,246,0.25)',

  success: '#12B76A',
  successSoft: 'rgba(18,183,106,0.13)',
  warning: '#F79009',
  warningSoft: 'rgba(247,144,9,0.13)',
  danger: '#F04438',
  dangerSoft: 'rgba(240,68,56,0.13)',
  info: '#0BA5EC',
  infoSoft: 'rgba(11,165,236,0.13)',
  purple: '#7A5AF8',
  purpleSoft: 'rgba(122,90,248,0.13)',
  cyan: '#0BA5EC',
  cyanSoft: 'rgba(11,165,236,0.13)',

  statusNew: '#60a5fa',
  statusProcessing: '#FBBF24',
  statusCompleted: '#34d399',
  statusCancelled: '#f87171',

  white: '#ffffff',
  black: '#000000',
  background: '#0F172A',
  backgroundSecondary: '#1f2937',
  backgroundTertiary: '#374151',
  surface: '#1E293B',
  surfaceElevated: '#273449',
  cardBg: 'rgba(255,255,255,0.04)',

  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0F172A',
  textLink: '#6b8fff',

  border: 'rgba(255,255,255,0.09)',
  borderSolid: '#334155',
  borderLight: '#1f2937',
  borderFocus: '#6b8fff',
  borderError: '#f87171',
  disabledBg: '#374151',
  disabledText: '#6b7280',
  placeholder: '#64748B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',

  skeletonBase: '#374151',
  skeletonHighlight: '#4b5563',

  accent: '#5a7bf6',
  accentDark: '#4a68e0',
  accentSoft: 'rgba(90,123,246,0.15)',
  accentBorder: 'rgba(90,123,246,0.22)',
  accentShadow: 'rgba(90,123,246,0.25)',
  warn: '#F79009',
  warnSoft: 'rgba(247,144,9,0.13)',
  red: '#F04438',
  redSoft: 'rgba(240,68,56,0.13)',
  text1: '#F8FAFC',
  text2: '#94A3B8',
  text3: '#64748B',
  gradientStart: '#5a7bf6',
  gradientEnd: '#7A5AF8',
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700', lineHeight: 40, letterSpacing: -0.5 },
  h2: { fontSize: 26, fontWeight: '700', lineHeight: 32, letterSpacing: -0.5 },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 28, letterSpacing: -0.2 },
  h4: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  body1: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body2: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  button: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const borderRadius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 20,
  full: 9999,
};

export const sizes = {
  buttonHeightSmall: 32,
  buttonHeightMedium: 44,
  buttonHeightLarge: 52,
  inputHeight: 44,
  inputHeightSmall: 40,
  inputHeightLarge: 52,
  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
  iconXl: 32,
  avatarSm: 26,
  avatarMd: 40,
  avatarLg: 56,
  hitSlop: 8,
};

export const createElevation = (shadowColor = '#000000') => ({
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
});

export const elevation = createElevation(lightColors.shadow);

export function getTheme(isDark = false) {
  const colors = isDark ? darkColors : lightColors;
  return {
    isDark,
    colors,
    typography,
    spacing,
    borderRadius,
    sizes,
    elevation: createElevation(colors.shadow),
  };
}

/** Flat COLORS for simple imports (light mode defaults) */
export const COLORS = {
  ...lightColors,
  bgLight: lightColors.background,
  bgHover: lightColors.backgroundSecondary,
  borderColor: lightColors.borderSolid,
  error: lightColors.danger,
  disabled: lightColors.disabledText,
};

export default {
  lightColors,
  darkColors,
  typography,
  spacing,
  borderRadius,
  sizes,
  elevation,
  getTheme,
  COLORS,
};

```

