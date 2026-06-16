import api from './api';

export const reminderService = {
  getReminders: async (filters = {}, page = 1, limit = 20) => {
    const response = await api.get('/reminders', {
      params: {
        ...filters,
        page,
        limit,
      },
    });
    return response.data.data;
  },

  getReminder: async id => {
    const response = await api.get(`/reminders/${id}`);
    return response.data.data;
  },

  createReminder: async data => {
    const response = await api.post('/reminders', data);
    return response.data.data;
  },

  updateReminder: async (id, data) => {
    const response = await api.put(`/reminders/${id}`, data);
    return response.data.data;
  },

  markDone: async id => {
    const response = await api.patch(`/reminders/${id}/done`, {});
    return response.data.data;
  },

  deleteReminder: async id => {
    const response = await api.delete(`/reminders/${id}`);
    return response.data.data;
  },

  getTodayReminders: async () => {
    const response = await api.get('/reminders/today/pending');
    return response.data.data;
  },
};
