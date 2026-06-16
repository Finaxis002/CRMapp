import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notificationService';

export const loadNotifications = createAsyncThunk(
  'notifications/load',
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchNotifications();
      return data; // { data: [...], unreadCount: X, page: 1, ... }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to load notifications',
      );
    }
  },
);

/**
 * Async thunk to mark a single notification as read
 */
export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      const result = await markNotificationRead(notificationId);
      return result; // Returns notificationId
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to mark as read',
      );
    }
  },
);

/**
 * Async thunk to mark all notifications as read
 */
export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      await markAllNotificationsRead();
      return;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to mark all as read',
      );
    }
  },
);

const initialState = {
  notifications: [], // Array of notification objects
  unreadCount: 0, // Count of unread notifications
  loading: false, // Loading state for async operations
  error: null, // Error message if any
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Add a new notification to the list (used for real-time updates)
     */
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },

    /**
     * Remove a notification from the list
     */
    removeNotification: (state, action) => {
      const index = state.notifications.findIndex(
        n => n._id === action.payload,
      );
      if (index !== -1) {
        const wasUnread = !state.notifications[index].isRead;
        state.notifications.splice(index, 1);
        if (wasUnread) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      }
    },

    /**
     * Clear all notifications from the list
     */
    clearAllNotifications: state => {
      state.notifications = [];
      state.unreadCount = 0;
    },

    /**
     * Set loading state
     */
    setLoading: (state, action) => {
      state.loading = action.payload;
    },

    /**
     * Set error state
     */
    setError: (state, action) => {
      state.error = action.payload;
    },

    /**
     * Clear error state
     */
    clearError: state => {
      state.error = null;
    },
  },

  extraReducers: builder => {
    // -- Load Notifications --
    builder.addCase(loadNotifications.pending, state => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(loadNotifications.fulfilled, (state, action) => {
      state.loading = false;
      state.notifications = action.payload.data || [];
      state.unreadCount = action.payload.unreadCount || 0;
    });

    builder.addCase(loadNotifications.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // -- Mark as Read --
    builder.addCase(markAsRead.pending, state => {
      state.error = null;
    });

    builder.addCase(markAsRead.fulfilled, (state, action) => {
      const notification = state.notifications.find(
        n => n._id === action.payload,
      );
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    });

    builder.addCase(markAsRead.rejected, (state, action) => {
      state.error = action.payload;
    });

    // -- Mark All as Read --
    builder.addCase(markAllAsRead.pending, state => {
      state.error = null;
    });

    builder.addCase(markAllAsRead.fulfilled, state => {
      state.notifications.forEach(n => {
        n.isRead = true;
        n.readAt = new Date().toISOString();
      });
      state.unreadCount = 0;
    });

    builder.addCase(markAllAsRead.rejected, (state, action) => {
      state.error = action.payload;
    });
  },
});

export const {
  addNotification,
  removeNotification,
  clearAllNotifications,
  setLoading,
  setError,
  clearError,
} = notificationSlice.actions;

export default notificationSlice.reducer;
