import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

// ============================================================
// TOAST CONFIG
// ============================================================
const toastConfig = {
  success: {
    iconBg: '#eef3ff',
    iconColor: '#5A7BF6',
    accent: '#5A7BF6',
    progressColor: '#5A7BF6',
    icon: '\u2713',
  },
  error: {
    iconBg: '#fff1f1',
    iconColor: '#ef4444',
    accent: '#ef4444',
    progressColor: '#ef4444',
    icon: '\u2717',
  },
  loading: {
    iconBg: '#eef3ff',
    iconColor: '#5A7BF6',
    accent: '#5A7BF6',
    progressColor: '#5A7BF6',
    icon: '\u21BB',
  },
  info: {
    iconBg: '#f0fdf4',
    iconColor: '#22c55e',
    accent: '#22c55e',
    progressColor: '#22c55e',
    icon: 'i',
  },
};

// ============================================================
// GLOBAL TOAST STORE (imperative API)
// ============================================================
let toasts = [];
let subscribers = [];
let idCounter = 0;

const notifySubscribers = () => {
  subscribers.forEach(cb => cb([...toasts]));
};

const show = (message, type = 'success', duration = 4000) => {
  const id = ++idCounter;
  toasts = [...toasts, { id, message, type, duration }];
  notifySubscribers();
  return id;
};

const remove = id => {
  toasts = toasts.filter(t => t.id !== id);
  notifySubscribers();
};

const subscribe = cb => {
  subscribers.push(cb);
  return () => {
    subscribers = subscribers.filter(c => c !== cb);
  };
};

export const toast = {
  success: (msg, duration) => show(msg, 'success', duration),
  error: (msg, duration) => show(msg, 'error', duration),
  loading: msg => show(msg, 'loading', 999999),
  info: (msg, duration) => show(msg, 'info', duration),
  dismiss: id => remove(id),
};

// For backward compatibility with components using useToast()
const useToast = () => toast;

// ============================================================
// SINGLE TOAST COMPONENT
// ============================================================
const Toast = ({
  id,
  message,
  type = 'success',
  duration = 4000,
  onRemove,
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const config = toastConfig[type] || toastConfig.success;

  useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animation (non-loading toasts only)
    if (type !== 'loading') {
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      const hideTimer = setTimeout(() => handleRemove(), duration);
      return () => clearTimeout(hideTimer);
    }
  }, []);

  // Loading icon spin
  useEffect(() => {
    if (type !== 'loading') return;
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [type]);

  const handleRemove = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 350,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onRemove(id);
    });
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          borderLeftColor: config.accent,
          transform: [{ translateX: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {/* Icon Circle */}
      <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
        {type === 'loading' ? (
          <Animated.Text
            style={[
              styles.iconText,
              { color: config.iconColor },
              { transform: [{ rotate: spin }] },
            ]}
          >
            {config.icon}
          </Animated.Text>
        ) : (
          <Text style={[styles.iconText, { color: config.iconColor }]}>
            {config.icon}
          </Text>
        )}
      </View>

      {/* Message */}
      <Text style={styles.message} numberOfLines={4}>
        {message}
      </Text>

      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleRemove}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.closeIcon}>{'\u2715'}</Text>
      </TouchableOpacity>

      {/* Progress Bar */}
      {type !== 'loading' && (
        <Animated.View
          style={[
            styles.progressBar,
            {
              backgroundColor: config.progressColor,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      )}
    </Animated.View>
  );
};

// ============================================================
// TOAST CONTAINER (render once in app root)
// ============================================================
export const ToastContainer = () => {
  const [toastList, setToastList] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribe(setToastList);
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toastList.map(t => (
        <Toast key={t.id} {...t} onRemove={remove} />
      ))}
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8ecf8',
    borderLeftWidth: 3.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    width: '92%',
    maxWidth: 380,
    overflow: 'hidden',
    shadowColor: '#5A7BF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  message: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: '#2d3a5e',
    lineHeight: 19,
  },
  closeButton: {
    padding: 2,
    marginLeft: 8,
  },
  closeIcon: {
    fontSize: 14,
    color: '#9aa5c2',
    fontWeight: '600',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
    opacity: 0.35,
  },
});

export default useToast;
