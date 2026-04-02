import AsyncStorage from '@react-native-async-storage/async-storage';

// Point to your backend — change for production
export const API_BASE = 'https://kyroo.de';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('kyroo_token');
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  });
  return res;
}
