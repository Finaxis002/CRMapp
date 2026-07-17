/**
 * Optional kit toast — use if you want to replace ToastContainer.
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
  success: { icon: '✓', colorKey: 'success', softKey: 'successSoft' },
  error: { icon: '✕', colorKey: 'danger', softKey: 'dangerSoft' },
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
            ×
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
