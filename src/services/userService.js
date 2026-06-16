import api from './api';

export const userService = {
  getUsers: async (page = 1, limit = 100, filters = {}) => {
    const response = await api.get('/users', {
      params: {
        page,
        limit,
        ...filters,
      },
    });
    return response.data.data;
  },

  getUser: async id => {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  },

  createUser: async data => {
    const response = await api.post('/users', data);
    return response.data.data;
  },

  updateUser: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data.data;
  },

  deleteUser: async id => {
    const response = await api.delete(`/users/${id}`);
    return response.data.data;
  },

  updateRole: async (id, role) => {
    const response = await api.patch(`/users/${id}/role`, { role });
    return response.data.data;
  },

  getTeamStats: async () => {
    const response = await api.get('/users/stats/summary');
    return response.data.data;
  },

  getAllUsers: async () => {
    let page = 1;
    let allUsers = [];

    while (true) {
      const res = await userService.getUsers(page, 100);
      const batch = Array.isArray(res) ? res : res?.data || [];
      if (!batch.length) break;
      allUsers = [...allUsers, ...batch];
      if (batch.length < 100) break;
      page++;
    }

    return allUsers;
  },
};
