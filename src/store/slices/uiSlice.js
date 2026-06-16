import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
  sidebarOpen: true,
  // AsyncStorage is async, so default to "light".
  // Load the saved theme later in your app (e.g., on startup).
  theme: 'light',
  modals: {
    leadModal: false,
    reminderModal: false,
    paymentModal: false,
  },
  notifications: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: state => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
      // AsyncStorage is async; fire-and-forget (no await in reducer)
      AsyncStorage.setItem('theme', action.payload).catch(() => {});
    },
    openModal: (state, action) => {
      state.modals[action.payload] = true;
    },
    closeModal: (state, action) => {
      state.modals[action.payload] = false;
    },
    addNotification: (state, action) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        n => n.id !== action.payload,
      );
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  openModal,
  closeModal,
  addNotification,
  removeNotification,
} = uiSlice.actions;
export default uiSlice.reducer;
