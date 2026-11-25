import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import axios from "axios";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string; // Single role (new)
  roles?: string[]; // Backward compat
  force_password_change: boolean;
}

// Helper to get the user's role
export const getUserRole = (user: User | null): string | null => {
  if (!user) return null;
  return user.role || user.roles?.[0] || null;
};

// Helper to get landing route for a role
export const getLandingRouteForRole = (role: string | null): string => {
  switch (role) {
    case "system_admin":
      return "/admin/users";
    case "section_controller":
      return "/dashboard/controller";
    case "signal_operator":
      return "/dashboard/signals";
    case "loco_pilot":
      return "/dashboard/driver";
    default:
      return "/";
  }
};

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (oldPassword: string | null, newPassword: string) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (
    envUrl &&
    typeof envUrl === "string" &&
    envUrl !== "undefined" &&
    envUrl !== "serverurl" &&
    envUrl.startsWith("http")
  ) {
    return envUrl;
  }
  return "http://localhost:3000";
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const storedAccessToken = localStorage.getItem("access_token");
    const storedRefreshToken = localStorage.getItem("refresh_token");
    const storedUser = localStorage.getItem("user");

    if (storedAccessToken && storedUser) {
      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
      }
    }
    setLoading(false);
  }, []);

  // Setup axios interceptor for token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
          originalRequest._retry = true;

          try {
            await refreshAccessToken();
            const freshToken = localStorage.getItem("access_token") || accessToken;
            if (freshToken) {
              originalRequest.headers.Authorization = `Bearer ${freshToken}`;
            }
            return axios(originalRequest);
          } catch (refreshError) {
            logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [refreshToken, accessToken]);

  // Setup axios interceptor for adding auth header
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, [accessToken]);

  const login = async (email: string, password: string) => {
    // Clear any stale data first
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    try {
      const response = await axios.post(`${getApiBaseUrl()}/api/v1/auth/login`, {
        email,
        password,
      });

      const { access_token, refresh_token, user: userData } = response.data;

      // Normalize user data to ensure role is set
      const normalizedUser: User = {
        ...userData,
        role: userData.role || userData.roles?.[0] || 'loco_pilot',
        roles: userData.roles || [userData.role],
      };

      console.log('[Auth] Login response user:', userData);
      console.log('[Auth] Normalized user role:', normalizedUser.role);

      setAccessToken(access_token);
      setRefreshToken(refresh_token);
      setUser(normalizedUser);

      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Login failed");
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  };

  const changePassword = async (oldPassword: string | null, newPassword: string) => {
    try {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/v1/auth/change-password`,
        {
          old_password: oldPassword,
          new_password: newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // Update user from response if available, otherwise just clear force_password_change
      if (response.data.user) {
        const userData = response.data.user;
        const normalizedUser: User = {
          ...userData,
          role: userData.role || userData.roles?.[0] || user?.role || 'loco_pilot',
          roles: userData.roles || [userData.role],
          force_password_change: false,
        };
        setUser(normalizedUser);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
      } else if (user) {
        const updatedUser = { ...user, force_password_change: false };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      // Update tokens if returned
      if (response.data.access_token) {
        setAccessToken(response.data.access_token);
        localStorage.setItem("access_token", response.data.access_token);
      }
      if (response.data.refresh_token) {
        setRefreshToken(response.data.refresh_token);
        localStorage.setItem("refresh_token", response.data.refresh_token);
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Password change failed");
    }
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await axios.post(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken, user: userData } = response.data;

      setAccessToken(access_token);
      setRefreshToken(newRefreshToken);

      // Update user if returned
      if (userData) {
        const normalizedUser: User = {
          ...userData,
          role: userData.role || userData.roles?.[0] || user?.role || 'loco_pilot',
          roles: userData.roles || [userData.role],
        };
        setUser(normalizedUser);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
      }

      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", newRefreshToken);
    } catch (error: any) {
      logout();
      throw new Error(error.response?.data?.error || "Token refresh failed");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        login,
        logout,
        changePassword,
        refreshAccessToken,
        isAuthenticated: !!user && !!accessToken,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
