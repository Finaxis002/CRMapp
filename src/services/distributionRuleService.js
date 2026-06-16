import api from './api';

export const distributionRuleService = {
  getRules: async () => {
    const res = await api.get('/distribution-rules');
    return res.data?.data || [];
  },

  createRule: async payload => {
    const res = await api.post('/distribution-rules', payload);
    return res.data?.data;
  },

  updateRule: async (id, payload) => {
    const res = await api.put(`/distribution-rules/${id}`, payload);
    return res.data?.data;
  },

  deleteRule: async id => {
    const res = await api.delete(`/distribution-rules/${id}`);
    return res.data?.data;
  },
};
