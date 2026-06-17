import { Platform } from 'react-native';

const BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

const RENDER_BACKEND_URL = 'https://shardacrm-backend.onrender.com';

export const API_BASE_URL = __DEV__
  ? `${BASE_URL}/api/v1`
  : 'https://shardacrmbe.sharda.co.in/api/v1';

export const APP_CONFIG = {
  appName: 'ShardaCRM',
  version: '1.0.0',
};
