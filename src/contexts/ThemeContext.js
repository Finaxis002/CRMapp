/**
 * ThemeContext — matches Sharda CRM API: isDark, toggleTheme
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
