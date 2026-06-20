// callLogsService.js  — React Native port (no browser APIs)
import api from './api.js';

/**
 * callLogsService.js  (React Native)
 * Client for the ShardaCRM call-logs backend (/api/v1/call-logs).
 *
 * IMPORTANT: backend stores recordingUrl as a RELATIVE path like
 * "/uploads/call-recordings/9876543210-xxx.m4a". Use getRecordingUrl()
 * to prefix the backend origin before passing to expo-av / react-native-track-player.
 *
 * NOTE: window.location is not available in RN — falls back to api.defaults.baseURL origin.
 */

// relative path -> full https URL (prefix backend origin)
export const getRecordingUrl = recordingUrl => {
  if (!recordingUrl) return null;
  if (/^https?:\/\//i.test(recordingUrl)) return recordingUrl; // already absolute

  let origin = '';
  try {
    const base = api.defaults?.baseURL || '';
    if (base && /^https?:\/\//i.test(base)) {
      // Extract origin manually (no URL constructor issues on older Hermes)
      const match = base.match(/^(https?:\/\/[^/]+)/i);
      origin = match ? match[1] : base;
    }
    // No window.location fallback in React Native — origin stays "" if baseURL missing
  } catch {
    origin = '';
  }

  return `${origin}${recordingUrl}`;
};

// per-lead call logs
export const getCallLogsForLead = async leadId => {
  const response = await api.get('/call-logs', {
    params: { leadId, limit: 50 },
  });
  return response.data?.data || [];
};

// single call log
export const getCallLogById = async id => {
  const response = await api.get(`/call-logs/${id}`);
  return response.data?.data;
};

// all call logs (admin/manager) — optional, for a future dashboard
export const getAllCallLogs = async (opts = {}) => {
  const { userId, startDate, endDate, page = 1, limit = 50 } = opts;
  const response = await api.get('/call-logs/all', {
    params: { userId, startDate, endDate, page, limit },
  });
  const data = response.data?.data || {};
  return {
    logs: Array.isArray(data.logs) ? data.logs : [],
    total: data.total || 0,
    page: data.page || 1,
  };
};

export default {
  getRecordingUrl,
  getCallLogsForLead,
  getCallLogById,
  getAllCallLogs,
};
