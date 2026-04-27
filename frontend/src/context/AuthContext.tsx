/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiService, authStorage, type OtpChannel } from "@/services/api";

export type Role = "super_admin" | "admin" | "employee" | "candidate";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  profilePhotoUrl?: string;
  profileImage?: string;
  role: Role;
  accessRole?: "super_admin" | "admin" | "hr_manager" | "recruiter" | "employee" | "candidate";
  accountStatus?: "active" | "disabled" | "pending";
  joiningFormCompleted?: boolean;
  status?: "pending_form" | "active_employee";
  department?: string;
  isActive?: boolean;
  isVerified?: boolean;
  permissions?: {
    modules?: Record<string, boolean>;
    actions?: Record<string, boolean>;
    pageAccess?: string[];
  };
  twoFactorEnabled?: boolean;
  forcePasswordReset?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string, options?: { rememberMe?: boolean; otp?: string }) => Promise<{
    user?: AuthUser;
    requiresTwoFactor?: boolean;
    mustResetPassword?: boolean;
  }>;
  register: (payload: { name: string; email: string; password: string; role: Role }) => Promise<AuthUser>;
  registerCandidate: (payload: { name: string; email: string; password: string }) => Promise<{
    email: string;
    expiresInSeconds: number;
    resendCooldownSeconds: number;
  }>;
  sendOtp: (payload: { phoneNumber?: string; email?: string; channel?: OtpChannel; resend?: boolean }) => Promise<{
    message?: string;
    resendAvailableIn?: number;
    expiresIn?: number;
    channel?: OtpChannel;
  }>;
  verifyOtp: (payload: { phoneNumber?: string; email?: string; otp: string; channel?: OtpChannel; rememberMe?: boolean }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeAuthUser = (user: AuthUser): AuthUser => {
  if (!user) return user;

  const profileImage = user.profileImage || user.profilePhotoUrl || "";
  return {
    ...user,
    profileImage,
    profilePhotoUrl: user.profilePhotoUrl || profileImage,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(normalizeAuthUser(authStorage.getUser<AuthUser>()));
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!authStorage.getToken()) {
      setLoading(false);
      return;
    }
    try {
      const profile = normalizeAuthUser(await apiService.me());
      setUser(profile);
      authStorage.set(authStorage.getToken() || "", profile, authStorage.getRememberMe());
    } catch {
      authStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string, options?: { rememberMe?: boolean; otp?: string }) => {
    const response = await apiService.login(email, password, options?.otp);
    if (response.requiresTwoFactor) {
      return { requiresTwoFactor: true };
    }
    if (!response.token || !response.user) {
      throw new Error(response.message || "Invalid login response");
    }
    const nextUser = normalizeAuthUser(response.user);
    authStorage.set(response.token, nextUser, options?.rememberMe ?? true);
    setUser(nextUser);
    return { user: nextUser, mustResetPassword: Boolean(response.mustResetPassword) };
  }, []);

  const register = useCallback(async (payload: { name: string; email: string; password: string; role: Role }) => {
    const createdUser = normalizeAuthUser(await apiService.register(payload));
    return createdUser;
  }, []);

  const registerCandidate = useCallback(async (payload: { name: string; email: string; password: string }) => {
    return apiService.registerCandidate(payload);
  }, []);

  const sendOtp = useCallback(async (payload: { phoneNumber?: string; email?: string; channel?: OtpChannel; resend?: boolean }) => {
    const response = await apiService.sendOtp(payload);
    return {
      message: response.message,
      resendAvailableIn: response.resendCooldownSeconds,
      expiresIn: response.expiresInSeconds,
      channel: response.channel,
    };
  }, []);

  const verifyOtp = useCallback(async (payload: { phoneNumber?: string; email?: string; otp: string; channel?: OtpChannel; rememberMe?: boolean }) => {
    const response = await apiService.verifyOtp(payload);
    if (!response.token || !response.user) {
      throw new Error(response.message || "Invalid OTP login response");
    }
    const nextUser = normalizeAuthUser(response.user);
    authStorage.set(response.token, nextUser, payload.rememberMe ?? true);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiService.logout();
    } catch {
      // Clear local session even if the server logout request fails.
    }
    authStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loading,
      login,
      register,
      registerCandidate,
      sendOtp,
      verifyOtp,
      logout,
      refreshProfile,
    }),
    [loading, login, logout, refreshProfile, register, registerCandidate, sendOtp, user, verifyOtp]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
