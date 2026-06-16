import api from './api';

export const activityService = {
  getActivities: async (leadId, page = 1, limit = 20) => {
    const response = await api.get(`/leads/${leadId}/activities`, {
      params: {
        page,
        limit,
      },
    });
    return response.data.data;
  },

  addActivity: async (leadId, data) => {
    const response = await api.post(`/leads/${leadId}/activities`, data);
    return response.data.data;
  },

  updateActivity: async (leadId, activityId, data) => {
    const response = await api.put(
      `/leads/${leadId}/activities/${activityId}`,
      data,
    );
    return response.data.data;
  },

  deleteActivity: async (leadId, activityId) => {
    const response = await api.delete(
      `/leads/${leadId}/activities/${activityId}`,
    );
    return response.data.data;
  },

  addNote: async (leadId, noteText) => {
    const response = await api.post(`/leads/${leadId}/activities`, {
      type: 'Note',
      text: noteText,
    });
    return response.data.data;
  },

  logCall: async (leadId, data) => {
    const response = await api.post(`/leads/${leadId}/activities`, {
      type: 'Call',
      ...data,
    });
    return response.data.data;
  },

  uploadRecording: async (leadId, formData) => {
    const response = await api.post(
      `/leads/${leadId}/activities/recording`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data.data;
  },

  getActivityTimeline: async leadId => {
    const response = await api.get(`/leads/${leadId}/timeline`);
    return response.data.data;
  },
};
