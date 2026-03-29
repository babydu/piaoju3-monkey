import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_USER = "@ticket_manager_user";
const STORAGE_KEY_TOKEN = "@ticket_manager_token";

export interface User {
  id: string;
  phone: string;
  avatar?: string;
  nickname?: string;
  memberLevel: "free" | "pro" | "trial";
  memberExpiredAt?: string;
  storageUsed: number;
  storageLimit: number;
  ticketCount?: number;
  ticketLimit?: number;
  ocrCount?: number;
  ocrLimit?: number;
  trialUsed?: boolean;
  biometricEnabled?: boolean;
  preferences: {
    ocrMode?: "local" | "cloud" | "cloud-first";
    cloudBackup?: boolean;
    allowPrivateBackup?: boolean;
    theme?: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  oneClickLogin: (token: string, operator: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  sendVerificationCode: (phone: string) => Promise<{ success: boolean; error?: string; code?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时从存储中加载用户信息
  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(STORAGE_KEY_USER);
      const storedToken = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);

      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);

        // 验证token是否仍然有效
        try {
          const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
              setUser(data.user);
              await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
            }
          } else {
            // Token无效，清除存储
            await AsyncStorage.multiRemove([STORAGE_KEY_USER, STORAGE_KEY_TOKEN]);
            setUser(null);
            setToken(null);
          }
        } catch (error) {
          console.error("验证token失败:", error);
        }
      }
    } catch (error) {
      console.error("加载用户信息失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendVerificationCode = async (phone: string): Promise<{ success: boolean; error?: string; code?: string }> => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/send-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "发送验证码失败" };
      }

      return { success: true, code: data.code };
    } catch (error) {
      console.error("发送验证码失败:", error);
      return { success: false, error: "网络错误，请稍后重试" };
    }
  };

  const login = async (phone: string, code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "登录失败" };
      }

      if (data.success && data.user) {
        setUser(data.user);
        setToken(data.user.id);
        await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
        await AsyncStorage.setItem(STORAGE_KEY_TOKEN, data.user.id);
        return { success: true };
      }

      return { success: false, error: "登录失败" };
    } catch (error) {
      console.error("登录失败:", error);
      return { success: false, error: "网络错误，请稍后重试" };
    }
  };

  // 一键登录
  const oneClickLogin = async (verifyToken: string, operator: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/verify-one-click`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: verifyToken, operator }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "一键登录失败" };
      }

      if (data.success && data.user) {
        setUser(data.user);
        setToken(data.user.id);
        await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
        await AsyncStorage.setItem(STORAGE_KEY_TOKEN, data.user.id);
        return { success: true };
      }

      return { success: false, error: "一键登录失败" };
    } catch (error) {
      console.error("一键登录失败:", error);
      return { success: false, error: "网络错误，请稍后重试" };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEY_USER, STORAGE_KEY_TOKEN]);
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error("退出登录失败:", error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    login,
    oneClickLogin,
    logout,
    updateUser,
    sendVerificationCode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

