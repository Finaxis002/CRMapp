import api from './api';

export const settingsService = {
  getSettings: async () => {
    const response = await api.get('/settings');
    return response.data.data;
  },

  updateSettings: async settings => {
    const response = await api.patch('/settings', settings);
    return response.data.data;
  },

  exportData: async () => {
    const response = await api.get('/settings/export');
    return response.data.data;
  },

  exportLeads: async () => {
    const response = await api.get('/settings/export-leads');
    return response.data.data;
  },

  clearLeads: async () => {
    const response = await api.delete('/settings/clear-leads');
    return response.data.data;
  },
};
