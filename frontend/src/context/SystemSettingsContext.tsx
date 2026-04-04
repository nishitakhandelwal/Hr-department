import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiService, type PublicSettingsPayload } from "@/services/api";

export type AppTheme = "light" | "dark";
const THEME_STORAGE_KEY = "hr_theme";

type SystemSettingsContextType = {
  publicSettings: PublicSettingsPayload | null;
  loading: boolean;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  refreshPublicSettings: () => Promise<void>;
};

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

const getStoredTheme = (): AppTheme | null => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "dark" || value === "light" ? value : null;
};

const getSystemTheme = (): AppTheme => {
  return "light";
};

const applyTheme = (theme: AppTheme | undefined) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const nextTheme = theme === "dark" ? "dark" : "light";
  root.setAttribute("data-theme", nextTheme);
  if (nextTheme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
};

const resolveInitialTheme = (): AppTheme => {
  const storedTheme = getStoredTheme();
  if (storedTheme) return storedTheme;
  if (typeof document !== "undefined") {
    const attrTheme = document.documentElement.getAttribute("data-theme");
    if (attrTheme === "dark" || attrTheme === "light") return attrTheme;
    if (document.documentElement.classList.contains("dark")) return "dark";
  }
  return getSystemTheme();
};

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [publicSettings, setPublicSettings] = useState<PublicSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<AppTheme>(resolveInitialTheme);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const refreshPublicSettings = useCallback(async () => {
    try {
      const data = await apiService.getPublicSettings();
      setPublicSettings(data);
      const persistedTheme = getStoredTheme();
      const nextTheme = persistedTheme || getSystemTheme();
      setThemeState(nextTheme);
      applyTheme(nextTheme);
      if (!persistedTheme && typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      }
      if (data.preferences?.timezone) localStorage.setItem("hr_timezone", data.preferences.timezone);
      if (data.preferences?.dateFormat) localStorage.setItem("hr_date_format", data.preferences.dateFormat);
      if (data.preferences?.currencyFormat) localStorage.setItem("hr_currency", data.preferences.currencyFormat);
    } catch {
      setPublicSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void refreshPublicSettings();
  }, []);

  const value = useMemo(
    () => ({
      publicSettings,
      loading,
      theme,
      setTheme,
      toggleTheme,
      refreshPublicSettings,
    }),
    [publicSettings, loading, theme, setTheme, toggleTheme, refreshPublicSettings]
  );

  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
};

export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext);
  if (!context) throw new Error("useSystemSettings must be used within SystemSettingsProvider");
  return context;
};
