import api from './api';

export const leadsService = {
  getLeads: async (filters = {}, page = 1, limit = 10) => {
    const response = await api.get('/leads', {
      params: {
        ...filters,
        page,
        limit,
      },
    });
    return response.data.data;
  },

  getLead: async id => {
    const response = await api.get(`/leads/${id}`);
    return response.data.data;
  },

  createLead: async data => {
    const response = await api.post('/leads', data);
    return response.data.data;
  },

  updateLead: async (id, data) => {
    const response = await api.put(`/leads/${id}`, data);
    return response.data.data;
  },

  deleteLead: async id => {
    const response = await api.delete(`/leads/${id}`);
    return response.data.data;
  },

  assignLead: async (id, userId) => {
    const response = await api.patch(`/leads/${id}/assign`, {
      assignedTo: userId,
    });
    return response.data.data;
  },

  addCoAssignee: async (id, userId) => {
    const response = await api.post(`/leads/${id}/co-assignees`, { userId });
    return response.data.data;
  },

  removeCoAssignee: async (id, userId) => {
    const response = await api.delete(`/leads/${id}/co-assignees/${userId}`);
    return response.data.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.patch(`/leads/${id}/status`, { status });
    return response.data.data;
  },
};
