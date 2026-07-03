import React, { useEffect } from 'react';
import { View, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { store } from './src/store';
import { navigationRef } from './src/services/navigationService';
import { setUser, setInitializing, logout } from './src/store/slices/authSlice';
import { fetchSettings } from './src/store/slices/settingsSlice';
import { authService } from './src/services/authService';
import {
  initCallTracker,
  requestCallPermissions,
  startCallTracker,
  hasOverlayPermission,
  requestOverlayPermission,
} from './src/services/callTrackerService';
import { useLocationTracker } from './src/hooks/useLocationTracker';

import AppNavigator from './src/navigation/AppNavigator';
import { ToastContainer } from './src/hooks/useToast';

const BRAND = '#5a7bf6';

const AppContent = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isInitializing } = useSelector(state => state.auth);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        try {
          const user = await authService.getCurrentUser();
          dispatch(setUser(user));
          await AsyncStorage.setItem('currentUserId', user._id);
        } catch (error) {
          await AsyncStorage.multiRemove([
            'accessToken',
            'refreshToken',
            'currentUserId',
          ]);
          dispatch(logout());
        }
      } else {
        dispatch(setInitializing(false));
      }
    };
    initializeAuth();
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(fetchSettings());
  }, [dispatch, isAuthenticated]);

  useLocationTracker(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    const initTracking = async () => {
      if (Platform.OS !== 'android') return;
      const granted = await requestCallPermissions();
      if (!granted) return;
      await initCallTracker();
      await startCallTracker();

      const overlayOk = await hasOverlayPermission();
      if (!overlayOk) {
        await requestOverlayPermission(); // Settings screen khulegi, user ek baar "Allow" karega
      }
    };

    initTracking();
  }, [isAuthenticated]);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <AppNavigator isAuthenticated={isAuthenticated} />
      <ToastContainer />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <AppContent />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}
