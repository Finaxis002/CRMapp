import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });

    if (response.data.data.accessToken) {
      await AsyncStorage.setItem('accessToken', response.data.data.accessToken);
    }

    if (response.data.data.refreshToken) {
      await AsyncStorage.setItem(
        'refreshToken',
        response.data.data.refreshToken,
      );
    }

    return response.data.data;
  },

  logout: async () => {
    try {
      if (api && typeof api.post === 'function') {
        await api.post('/auth/logout');
      } else {
        console.error('authService.logout: api.post is not a function', api);
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
      } else {
        console.error(
          'authService.logout: AsyncStorage.removeItem is not a function',
          AsyncStorage,
        );
      }
    }
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data.data;
  },

  updateProfile: async data => {
    const response = await api.put('/auth/profile', data);
    return response.data.data;
  },
};
