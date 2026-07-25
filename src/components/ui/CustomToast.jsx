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
  const { colors } = useUISystem();
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
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={toast.action?.label ? undefined : dismiss}
        style={styles.toastPill}
      >
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.toastText} numberOfLines={2}>
          {toast.title ? `${toast.title} — ${toast.message}` : toast.message}
        </Text>
        {toast.action?.label && (
          <Pressable
            onPress={() => {
              toast.action.onPress?.();
              dismiss();
            }}
            hitSlop={8}
            style={{ marginLeft: 8 }}
          >
            <Text style={[styles.toastText, { color: accent, fontWeight: '700' }]}>
              {toast.action.label}
            </Text>
          </Pressable>
        )}
      </Pressable>
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
    bottom: Platform.OS === 'ios' ? 40 : 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    marginBottom: 8,
    maxWidth: '88%',
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.94)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  toastText: {
    fontSize: 13,
    color: '#fff',
    flexShrink: 1,
  },
});

export default ToastProvider;
