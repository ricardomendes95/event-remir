import { useEffect, useState } from "react";

interface UserInfo {
  id: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  name?: string;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Função para decodificar JWT (apenas payload, sem verificação)
  const decodeJWT = (token: string): UserInfo | null => {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        name: payload.name || payload.email?.split("@")[0], // Fallback para nome baseado no email
      };
    } catch {
      return null;
    }
  };

  // Função para buscar dados completos do servidor (opcional)
  const fetchUserData = async (token: string): Promise<UserInfo | null> => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.user) {
          return {
            id: result.data.user.id,
            email: result.data.user.email,
            role: result.data.user.role,
            name:
              result.data.user.name || result.data.user.email?.split("@")[0],
          };
        }
      }
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
    }
    return null;
  };

  useEffect(() => {
    const initAuth = async () => {
      if (typeof window !== "undefined") {
        const storedToken = localStorage.getItem("token");
        if (storedToken) {
          // Primeiro, tentar decodificar o token local para resposta rápida
          const decodedUser = decodeJWT(storedToken);
          if (decodedUser) {
            setToken(storedToken);
            setUser(decodedUser);
            setIsAuthenticated(true);

            // Em seguida, buscar dados atualizados do servidor (opcional)
            const serverUser = await fetchUserData(storedToken);
            if (serverUser) {
              setUser(serverUser);
            }
          } else {
            // Token inválido, remover
            localStorage.removeItem("token");
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const makeAuthenticatedRequest = async (
    url: string,
    options: RequestInit = {}
  ) => {
    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    });
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return {
    token,
    isAuthenticated,
    user,
    loading,
    makeAuthenticatedRequest,
    logout,
  };
}
