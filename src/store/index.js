import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import leadsReducer from './slices/leadsSlice';
import uiReducer from './slices/uiSlice';
import settingsReducer from './slices/settingsSlice';
import notificationReducer from './slices/notificationSlice';
import searchReducer from './slices/searchSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    leads: leadsReducer,
    ui: uiReducer,
    settings: settingsReducer,
    notifications: notificationReducer,
    search: searchReducer,
  },
});

export default store;
