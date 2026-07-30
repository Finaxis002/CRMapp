import api from './api';

export const supportService = {
  createTicket: formData =>
    api
      .post('/support', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: d => d,
      })
      .then(res => res.data.data),

  getMyTickets: () => api.get('/support/mine').then(res => res.data.data),

  getAllTickets: (params = {}) =>
    api.get('/support', { params }).then(res => res.data.data),

  updateTicket: (id, payload) =>
    api.patch(`/support/${id}`, payload).then(res => res.data.data),

  deleteTicket: id => api.delete(`/support/${id}`).then(res => res.data),

  addMessage: (id, text) =>
    api.post(`/support/${id}/messages`, { text }).then(res => res.data.data),

  getUnreadCount: () =>
    api.get('/support/unread-count').then(res => res.data.count),

  markRead: id => api.patch(`/support/${id}/read`).then(res => res.data.data),
};

export default supportService;
