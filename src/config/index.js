import { Platform } from 'react-native';
import { Buffer } from 'buffer';
global.Buffer = Buffer;


// export const BASE_URL =
//   Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

export const BASE_URL = 'https://shardacrmbe.sharda.co.in';

// export const BASE_URL = 'http://192.168.29.154:5000';
export const API_BASE_URL = `${BASE_URL}/api/v1`;

export const APP_CONFIG = {
  appName: 'ShardaCRM',
  version: '1.0.0',
};
