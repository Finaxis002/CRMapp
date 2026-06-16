import api from './api';

export const paymentService = {
  getPayments: async (filters = {}, page = 1, limit = 20) => {
    const response = await api.get('/payments', {
      params: {
        ...filters,
        page,
        limit,
      },
    });
    return response.data.data;
  },

  getPayment: async id => {
    const response = await api.get(`/payments/${id}`);
    return response.data.data;
  },

  getPaymentsByLead: async leadId => {
    const response = await api.get(`/leads/${leadId}/payments`);
    return response.data.data;
  },

  recordPayment: async data => {
    const response = await api.post('/payments', data);
    return response.data.data;
  },

  updatePayment: async (id, data) => {
    const response = await api.put(`/payments/${id}`, data);
    return response.data.data;
  },

  deletePayment: async id => {
    const response = await api.delete(`/payments/${id}`);
    return response.data.data;
  },

  generatePaymentLink: async data => {
    const response = await api.post('/payments/generate-link', data);
    return response.data.data;
  },

  verifyPayment: async id => {
    const response = await api.post(`/payments/${id}/verify`, {});
    return response.data.data;
  },

  getPaymentStats: async () => {
    const response = await api.get('/payments/stats/overview');
    return response.data.data;
  },
};
