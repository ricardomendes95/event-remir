import { useEffect, useState } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        setIsAuthenticated(true);
      }
    }
  }, []);

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    });
  };

  return {
    token,
    isAuthenticated,
    makeAuthenticatedRequest,
  };
}
