// callLogsService.js  — React Native port (no browser APIs)
import api from './api.js';
export const getRecordingUrl = recordingUrl => {
  if (!recordingUrl) return null;
  if (/^https?:\/\//i.test(recordingUrl)) return recordingUrl; // already absolute

  let origin = '';
  try {
    const base = api.defaults?.baseURL || '';
    if (base && /^https?:\/\//i.test(base)) {
      const match = base.match(/^(https?:\/\/[^/]+)/i);
      origin = match ? match[1] : base;
    }
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

// all call logs (admin/manager)
export const getAllCallLogs = async (opts = {}) => {
  const { userId, startDate, endDate, page = 1, limit } = opts;
  const params = { userId, startDate, endDate, page };
  if (limit) params.limit = limit; 

  const response = await api.get('/call-logs/all', { params });
  const data = response.data?.data || {};
  return {
    logs: Array.isArray(data.logs) ? data.logs : [],
    total: data.total || 0,
    page: data.page || 1,
  };
};

// per-user call tracing stats (calls made, answered, missed, recorded)
// Backend route: GET /call-logs/stats
export const getCallStats = async (opts = {}) => {
  const { startDate, endDate } = opts;
  const response = await api.get('/call-logs/stats', {
    params: { startDate, endDate },
  });
  return response.data?.data || [];
};

export default {
  getRecordingUrl,
  getCallLogsForLead,
  getCallLogById,
  getAllCallLogs,
  getCallStats,
};