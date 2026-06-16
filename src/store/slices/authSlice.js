import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  isInitializing: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.isInitializing = false;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    setInitializing: (state, action) => {
      state.isInitializing = action.payload;
    },
    logout: state => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
      state.isInitializing = false;
    },
  },
});

export const { setUser, setLoading, setError, logout, setInitializing } =
  authSlice.actions;
export default authSlice.reducer;
