import { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const POST_INTERVAL_MS = 30000;

async function requestPermission() {
  if (Platform.OS === 'android') {
    // Pehle check karo current status
    const current = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (current) return true;

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'ShardaCRM needs your location to track field agents on the map.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      }
    );

    if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      // User ne "Never ask again" kiya — Settings me bhejna padega
      Alert.alert(
        'Location Permission Required',
        'Please enable location permission from app settings to use this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

async function postLocation(lat, lng) {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    console.log('[LocationTracker] posting location, token exists:', !!token, 'lat:', lat, 'lng:', lng);
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/location/update`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng }),
    });
    console.log('[LocationTracker] POST response status:', res.status);
  } catch (e) {
    console.log('[LocationTracker] POST error:', e.message);
  }
}

export function useLocationTracker(isAuthenticated = true) {
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const lastPosRef = useRef(null);

  useEffect(() => {
    console.log('[LocationTracker] hook fired, isAuthenticated:', isAuthenticated);
    if (!isAuthenticated) return;
    let active = true;

    (async () => {
      console.log('[LocationTracker] requesting permission...');
      const allowed = await requestPermission();
      console.log('[LocationTracker] permission result:', allowed);
      if (!allowed || !active) return;

      console.log('[LocationTracker] calling getCurrentPosition...');
      try {
        Geolocation.getCurrentPosition(
          (pos) => {
            console.log('[LocationTracker] got position:', pos.coords);
            const { latitude: lat, longitude: lng } = pos.coords;
            lastPosRef.current = { lat, lng };
            postLocation(lat, lng);
          },
          (err) => console.log('[Location] getCurrentPosition error:', err.code, err.message),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
        );
      } catch(e) {
        console.log('[LocationTracker] getCurrentPosition threw:', e.message);
      }

      watchIdRef.current = Geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          lastPosRef.current = { lat, lng };
        },
        (err) => console.log('[Location] watch error:', err.message),
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 10000,
          fastestInterval: 5000,
        }
      );

      intervalRef.current = setInterval(() => {
        if (lastPosRef.current) {
          postLocation(lastPosRef.current.lat, lastPosRef.current.lng);
        }
      }, POST_INTERVAL_MS);
    })();

    return () => {
      active = false;
      if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated]);
}