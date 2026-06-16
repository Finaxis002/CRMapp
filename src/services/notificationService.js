import api from './api';

/**
 * Fetch notifications for current user
 * Returns only unread notifications, limit 10, page 1
 */
export const fetchNotifications = async () => {
  try {
    const response = await api.get(
      '/notifications?limit=10&page=1&isRead=false',
    );
    return response.data.data; // Returns { data: [...], unreadCount: X, page: 1, ... }
  } catch (error) {
    throw error;
  }
};

/**
 * Mark a single notification as read
 * @param {string} notificationId - The notification ID
 * @returns {string} - The notification ID that was marked as read
 */
export const markNotificationRead = async notificationId => {
  try {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return notificationId; // Return just the ID for slice to find and update
  } catch (error) {
    throw error;
  }
};

/**
 * Mark all notifications as read for current user
 */
export const markAllNotificationsRead = async () => {
  try {
    const response = await api.patch('/notifications/read-all');
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch all notifications (read and unread)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Notifications per page (default: 10)
 */
export const fetchAllNotifications = async (page = 1, limit = 10) => {
  try {
    const response = await api.get(
      `/notifications?limit=${limit}&page=${page}`,
    );
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a single notification
 * @param {string} notificationId - The notification ID
 */
export const deleteNotification = async notificationId => {
  try {
    const response = await api.delete(`/notifications/${notificationId}`);
    return notificationId;
  } catch (error) {
    throw error;
  }
};

/**
 * Clear all notifications for current user
 */
export const clearAllNotifications = async () => {
  try {
    const response = await api.delete('/notifications/clear-all');
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async () => {
  try {
    const response = await api.get('/notifications/unread/count');
    return response.data.data.unreadCount;
  } catch (error) {
    throw error;
  }
};
