/**
 * useUISystem.js — theme tokens + form / async / pagination helpers
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

/** Optional toast bridge — works with kit Toast or your existing useToast */
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
