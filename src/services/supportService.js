import api from './api';

const multipartConfig = {
  headers: { 'Content-Type': 'multipart/form-data' },
  // Keep the existing React Native upload behaviour for FormData requests.
  transformRequest: data => data,
};

const toMessageFormData = payload => {
  // Backward compatibility while old text-only reply UI is still being replaced.
  if (typeof payload === 'string') {
    const formData = new FormData();
    formData.append('text', payload);
    return formData;
  }

  return payload;
};

export const supportService = {
  // Initial ticket: FormData with contact fields, message, and optional attachments.
  createTicket: formData =>
    api.post('/support', formData, multipartConfig).then(res => res.data.data),

  getMyTickets: () => api.get('/support/mine').then(res => res.data.data),

  getAllTickets: (params = {}) =>
    api.get('/support', { params }).then(res => res.data.data),

  updateTicket: (id, payload) =>
    api.patch(`/support/${id}`, payload).then(res => res.data.data),

  deleteTicket: id => api.delete(`/support/${id}`).then(res => res.data),

  // Later ticket reply: FormData with `text` and optional `attachments`.
  // A string is also temporarily accepted so existing text-only UI keeps working.
  addMessage: (id, payload) =>
    api
      .post(
        `/support/${id}/messages`,
        toMessageFormData(payload),
        multipartConfig,
      )
      .then(res => res.data.data),

  getUnreadCount: () =>
    api.get('/support/unread-count').then(res => res.data.count),

  markRead: id => api.patch(`/support/${id}/read`).then(res => res.data.data),
};

export default supportService;
