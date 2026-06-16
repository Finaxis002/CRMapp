import api from './api';

export const dashboardService = {
  getOverview: async ({ filter = 'today' } = {}) => {
    const response = await api.get(`/dashboard/overview?filter=${filter}`);
    return response.data.data;
  },
};
