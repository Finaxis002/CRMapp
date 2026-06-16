import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

const BASE = `${API_BASE_URL}/gcal`;

const authHeaders = async () => {
  const token =
    (await AsyncStorage.getItem('accessToken')) ||
    (await AsyncStorage.getItem('token')) ||
    (await AsyncStorage.getItem('authToken')) ||
    '';

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const handleResponse = async res => {
  const json = await res.json();
  if (!res.ok)
    throw new Error(json?.message || 'Google Calendar request failed');
  return json.data;
};

export const googleCalendarService = {
  /**
   * Fetches the OAuth consent-screen URL from the backend,
   * then opens it in the device browser using Linking.
   * After the user approves, Google sends them to the callback URL,
   * which should be handled via Deep Linking back to the app.
   */
  async connect(originScreen = 'Integration') {
    const headers = await authHeaders();

    const res = await fetch(
      `${BASE}/auth-url?origin=${encodeURIComponent(originScreen)}`,
      { headers },
    );

    const data = await handleResponse(res);

    if (data.url) {
      await Linking.openURL(data.url);
    }
  },

  async disconnect() {
    const headers = await authHeaders();

    const res = await fetch(`${BASE}/disconnect`, {
      method: 'POST',
      headers,
    });
    return handleResponse(res);
  },

  /** Returns { connected: bool, user: string|null } */
  async getStatus() {
    const headers = await authHeaders();

    const res = await fetch(`${BASE}/status`, { headers });
    return handleResponse(res);
  },

  /** Returns { events: GoogleCalendarEvent[] } */
  async getEvents() {
    const headers = await authHeaders();

    const res = await fetch(`${BASE}/events`, { headers });
    return handleResponse(res);
  },

  /**
   * Creates a calendar event tied to a CRM action.
   * @param {{ title: string, description?: string, startTime: string,
   *            endTime?: string, leadId?: string }} payload
   * @returns {{ eventId: string, eventLink: string }}
   */
  async createEvent(payload) {
    const headers = await authHeaders();

    const res = await fetch(`${BASE}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
};
