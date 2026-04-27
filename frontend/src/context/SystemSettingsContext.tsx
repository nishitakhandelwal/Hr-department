/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiService, type PublicSettingsPayload, type RuntimeConfigPayload, type RuntimeNavigationItem } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { LABELS } from "@/config/labels.config";
import { SIDEBAR } from "@/config/sidebar.config";

export type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "hr_theme";
const missingLabelKeys = new Set<string>();
const DEFAULT_ADMIN_DASHBOARD_PATH = "/admin/dashboard";
const DEFAULT_COMPANY_NAME = "Arihant Dream Infra Project Ltd.";
const HIDDEN_NAVIGATION_IDS = new Set(["admin.calendar"]);

const normalizeCompanyName = (value?: string | null) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue || trimmedValue.toLowerCase() === "hr harmony hub") {
    return DEFAULT_COMPANY_NAME;
  }
  return trimmedValue;
};

const safeDefaultConfig: RuntimeConfigPayload = {
  company: {
    companyName: DEFAULT_COMPANY_NAME,
    companyLogoUrl: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    description: "",
  },
  preferences: {
    theme: "light",
    defaultDashboardPage: DEFAULT_ADMIN_DASHBOARD_PATH,
    language: "en",
    timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    currencyFormat: "INR",
  },
  security: {
    otpLoginEnabled: true,
  },
  features: {},
  labels: { ...LABELS },
  permissions: {},
  theme: {
    primaryColor: "#C89B6D",
    mode: "light",
  },
  portalVisibility: {
    admin: true,
    employee: true,
    candidate: true,
  },
  navigation: { ...SIDEBAR },
  routes: {},
};

const safePublicSettings: PublicSettingsPayload = {
  company: safeDefaultConfig.company,
  preferences: safeDefaultConfig.preferences,
  security: safeDefaultConfig.security,
  documents: {
    allowedFileTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxUploadSizeMb: 10,
    candidateFields: [
      { fieldId: "resume", label: "Resume", status: "required" },
      { fieldId: "pan-card", label: "PAN Card", status: "optional" },
      { fieldId: "aadhaar-card", label: "Aadhaar Card", status: "optional" },
      { fieldId: "passport-size-photo", label: "Passport Size Photo", status: "optional" },
      { fieldId: "certificates", label: "Certificates", status: "optional" },
    ],
    certificateTypes: [
      { typeId: "education", label: "Educational Certificate" },
      { typeId: "experience", label: "Experience Certificate" },
    ],
  },
};

type SystemSettingsContextType = {
  config: RuntimeConfigPayload;
  publicSettings: PublicSettingsPayload;
  loading: boolean;
  error: string | null;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  refreshConfig: () => Promise<void>;
  updateConfigSnapshot: (nextConfig: RuntimeConfigPayload) => void;
  refreshPublicSettings: () => Promise<void>;
  getLabel: (key: string, fallback?: string) => string;
  isFeatureEnabled: (key: string) => boolean;
  checkPermission: (action: string, role?: string) => boolean;
  getNavigation: (scope?: string) => RuntimeNavigationItem[];
  canAccessRoute: (routeKey: string) => boolean;
  getDefaultRoute: (scope?: string) => string;
};

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

const getStoredTheme = (): AppTheme | null => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "dark" || value === "light" ? value : null;
};

const getSystemTheme = (): AppTheme => {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

const applyTheme = (theme: AppTheme | undefined, primaryColor?: string) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const nextTheme = theme === "dark" ? "dark" : "light";
  root.setAttribute("data-theme", nextTheme);
  root.style.colorScheme = nextTheme;
  root.style.setProperty("--color-primary-runtime", primaryColor || "#C89B6D");
  if (nextTheme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
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

const normalizeConfig = (value: RuntimeConfigPayload | null | undefined): RuntimeConfigPayload => {
  if (!value || typeof value !== "object") return safeDefaultConfig;
  const mergedNavigation = { ...SIDEBAR, ...(typeof value.navigation === "object" && value.navigation ? value.navigation : {}) };
  const filteredNavigation = Object.fromEntries(
    Object.entries(mergedNavigation).map(([scope, items]) => [
      scope,
      Array.isArray(items) ? items.filter((item) => !HIDDEN_NAVIGATION_IDS.has(item.id)) : [],
    ])
  );
  return {
    ...safeDefaultConfig,
    ...value,
    company: {
      ...safeDefaultConfig.company,
      ...(value.company || {}),
      companyName: normalizeCompanyName(value.company?.companyName),
    },
    preferences: { ...safeDefaultConfig.preferences, ...(value.preferences || {}) },
    security: { ...safeDefaultConfig.security, ...(value.security || {}) },
    features: typeof value.features === "object" && value.features ? value.features : {},
    labels: { ...LABELS, ...(typeof value.labels === "object" && value.labels ? value.labels : {}) },
    permissions: typeof value.permissions === "object" && value.permissions ? value.permissions : {},
    theme: { ...safeDefaultConfig.theme, ...(value.theme || {}) },
    portalVisibility: { ...safeDefaultConfig.portalVisibility, ...(value.portalVisibility || {}) },
    navigation: filteredNavigation,
    routes: typeof value.routes === "object" && value.routes ? value.routes : {},
  };
};

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState<RuntimeConfigPayload>(safeDefaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<AppTheme>(resolveInitialTheme);

  const applyConfigSnapshot = useCallback((value: RuntimeConfigPayload | null | undefined) => {
    const data = normalizeConfig(value);
    setConfig(data);
    setError(null);
    const persistedTheme = getStoredTheme();
    const nextTheme = persistedTheme || data.theme.mode || resolveInitialTheme();
    setThemeState(nextTheme);
    applyTheme(nextTheme, data.theme.primaryColor);
    if (data.preferences?.timezone) localStorage.setItem("hr_timezone", data.preferences.timezone);
    if (data.preferences?.dateFormat) localStorage.setItem("hr_date_format", data.preferences.dateFormat);
    if (data.preferences?.currencyFormat) localStorage.setItem("hr_currency", data.preferences.currencyFormat);
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme, config.theme.primaryColor);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
  }, [config.theme.primaryColor]);

  const refreshConfig = useCallback(async () => {
    try {
      setError(null);
      applyConfigSnapshot(await apiService.getConfig());
    } catch (error) {
      console.warn("[config] Falling back to safe defaults", error);
      setConfig(safeDefaultConfig);
      setError(error instanceof Error ? error.message : "Runtime configuration could not be loaded.");
      applyTheme(getStoredTheme() || safeDefaultConfig.theme.mode, safeDefaultConfig.theme.primaryColor);
    } finally {
      setLoading(false);
    }
  }, [applyConfigSnapshot]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    applyTheme(theme, config.theme.primaryColor);
  }, [config.theme.primaryColor, theme]);

  const getLabel = useCallback(
    (key: string, fallback?: string) => {
      const value = config.labels?.[key];
      if (typeof value === "string" && value.trim()) return value;
      if (!missingLabelKeys.has(key)) {
        missingLabelKeys.add(key);
        console.warn(`[config] Missing label key: ${key}`);
      }
      return fallback || key;
    },
    [config.labels]
  );

  const isFeatureEnabled = useCallback((key: string) => config.features?.[key] !== false, [config.features]);

  const checkPermission = useCallback(
    (action: string, role?: string) => {
      const roleKey = role || user?.accessRole || user?.role || "candidate";
      if (roleKey === "super_admin") return true;
      return config.permissions?.[roleKey]?.[action] === true;
    },
    [config.permissions, user?.accessRole, user?.role]
  );

  const getNavigation = useCallback(
    (scope?: string) => {
      const rawScope = scope || user?.accessRole || user?.role || "candidate";
      const resolvedScope =
        rawScope === "super_admin" && !Array.isArray(config.navigation?.super_admin)
          ? "admin"
          : rawScope;
      const portalKey = resolvedScope === "admin" || resolvedScope === "hr_manager" || resolvedScope === "recruiter"
        ? "admin"
        : resolvedScope === "super_admin"
        ? "admin"
        : resolvedScope === "candidate"
          ? "candidate"
          : "employee";
      if (config.portalVisibility?.[portalKey] === false) return [];
      return Array.isArray(config.navigation?.[resolvedScope]) ? config.navigation[resolvedScope] : [];
    },
    [config.navigation, config.portalVisibility, user?.accessRole, user?.role]
  );

  const canAccessRoute = useCallback(
    (routeKey: string) => {
      if (user?.accessRole === "super_admin") return true;
      const route = config.routes?.[routeKey];
      if (!route) return true;
      if (route.enabled === false) return false;
      if (route.featureKey && !isFeatureEnabled(route.featureKey)) return false;
      if (route.permissionKey && !checkPermission(route.permissionKey)) return false;
      if (route.roles?.length && user?.role && !route.roles.includes(user.role)) return false;
      if (route.accessRoles?.length) {
        const accessRole = user?.accessRole || user?.role || "";
        if (!route.accessRoles.includes(accessRole)) return false;
      }
      if (route.moduleKey && user?.permissions?.modules?.[route.moduleKey] === false) return false;
      return true;
    },
    [checkPermission, config.routes, isFeatureEnabled, user?.accessRole, user?.permissions?.modules, user?.role]
  );

  const getDefaultRoute = useCallback(
    (scope?: string) => {
      const effectiveScope = scope || user?.accessRole || user?.role || "candidate";
      const preferredRoute =
        (effectiveScope === "super_admin" || effectiveScope === "admin") && config.preferences?.defaultDashboardPage
          ? config.preferences.defaultDashboardPage
          : "";
      const navigationItems = getNavigation(effectiveScope).filter((item) => {
        if (!item.id) return false;
        if (!canAccessRoute(item.id)) return false;
        if (item.moduleKey && user?.permissions?.modules?.[item.moduleKey] === false) return false;
        if (item.featureKey && !isFeatureEnabled(item.featureKey)) return false;
        return typeof item.path === "string" && item.path.trim().length > 0;
      });
      const matchingPreferred = preferredRoute
        ? navigationItems.find((item) => item.path === preferredRoute)
        : undefined;
      return matchingPreferred?.path || navigationItems[0]?.path || preferredRoute || DEFAULT_ADMIN_DASHBOARD_PATH;
    },
    [canAccessRoute, config.preferences?.defaultDashboardPage, getNavigation, isFeatureEnabled, user?.accessRole, user?.permissions?.modules, user?.role]
  );

  const publicSettings = useMemo(
    () => ({
      company: config.company,
      preferences: config.preferences,
      security: config.security,
      documents: safePublicSettings.documents,
    }),
    [config.company, config.preferences, config.security]
  );

  const value = useMemo(
    () => ({
      config,
      publicSettings,
      loading,
      error,
      theme,
      setTheme,
      toggleTheme,
      refreshConfig,
      updateConfigSnapshot: applyConfigSnapshot,
      refreshPublicSettings: refreshConfig,
      getLabel,
      isFeatureEnabled,
      checkPermission,
      getNavigation,
      canAccessRoute,
      getDefaultRoute,
    }),
    [applyConfigSnapshot, canAccessRoute, checkPermission, config, error, getDefaultRoute, getLabel, getNavigation, isFeatureEnabled, loading, publicSettings, refreshConfig, setTheme, theme, toggleTheme]
  );

  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
};

export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext);
  if (!context) throw new Error("useSystemSettings must be used within SystemSettingsProvider");
  return context;
};

export const useConfig = () => useSystemSettings().config;
export const useFeature = (key: string) => useSystemSettings().isFeatureEnabled(key);
export const useLabel = (key: string, fallback?: string) => useSystemSettings().getLabel(key, fallback);
export const usePermission = (action: string, role?: string) => useSystemSettings().checkPermission(action, role);
export const useNavigation = (scope?: string) => useSystemSettings().getNavigation(scope);
export const useRouteAccess = (routeKey: string) => useSystemSettings().canAccessRoute(routeKey);
