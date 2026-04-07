import { SystemSettings } from "../models/SystemSettings.js";
import { RuntimePermission } from "../models/RuntimePermission.js";
import {
  DEFAULT_PORTAL_VISIBILITY,
  DEFAULT_RUNTIME_FEATURES,
  DEFAULT_RUNTIME_LABELS,
  DEFAULT_RUNTIME_NAVIGATION,
  DEFAULT_RUNTIME_ROUTES,
  DEFAULT_RUNTIME_THEME,
} from "../config/runtimeConfigDefaults.js";
import { DEFAULT_RUNTIME_PERMISSION_ENTRIES } from "../config/runtimePermissionDefaults.js";

const deepClone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toBooleanRecord = (value, fallback, context) => {
  if (!isObject(value)) return deepClone(fallback);
  const next = { ...deepClone(fallback) };
  Object.entries(value).forEach(([key, current]) => {
    if (typeof current === "boolean") {
      next[key] = current;
      return;
    }
    console.warn(`[config] Invalid boolean for ${context}.${key}`);
  });
  return next;
};

const toLabelRecord = (value) => {
  const next = { ...deepClone(DEFAULT_RUNTIME_LABELS) };
  if (!isObject(value)) return next;
  Object.entries(value).forEach(([key, current]) => {
    if (typeof current === "string") next[key] = current;
    else console.warn(`[config] Invalid label value for ${key}`);
  });
  return next;
};

const toTheme = (value) => {
  const next = { ...deepClone(DEFAULT_RUNTIME_THEME) };
  if (!isObject(value)) return next;
  if (typeof value.primaryColor === "string" && value.primaryColor.trim()) next.primaryColor = value.primaryColor.trim();
  if (value.mode === "light" || value.mode === "dark") next.mode = value.mode;
  return next;
};

const toNavigation = (value) => {
  const next = deepClone(DEFAULT_RUNTIME_NAVIGATION);
  if (!isObject(value)) return next;
  Object.entries(value).forEach(([scope, items]) => {
    if (!Array.isArray(items)) {
      console.warn(`[config] Invalid navigation bucket for ${scope}`);
      return;
    }
    next[scope] = items
      .filter((item) => isObject(item) && typeof item.path === "string" && typeof item.labelKey === "string")
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : item.path,
        path: item.path,
        labelKey: item.labelKey,
        icon: typeof item.icon === "string" ? item.icon : "LayoutDashboard",
        featureKey: typeof item.featureKey === "string" ? item.featureKey : "",
        moduleKey: typeof item.moduleKey === "string" ? item.moduleKey : "",
      }));
  });
  return next;
};

const toRoutes = (value) => {
  const next = deepClone(DEFAULT_RUNTIME_ROUTES);
  if (!isObject(value)) return next;
  Object.entries(value).forEach(([key, route]) => {
    if (!isObject(route)) {
      console.warn(`[config] Invalid route config for ${key}`);
      return;
    }
    next[key] = {
      enabled: route.enabled !== false,
      featureKey: typeof route.featureKey === "string" ? route.featureKey : "",
      moduleKey: typeof route.moduleKey === "string" ? route.moduleKey : "",
      permissionKey: typeof route.permissionKey === "string" ? route.permissionKey : "",
      roles: Array.isArray(route.roles) ? route.roles.map((item) => String(item)) : [],
      accessRoles: Array.isArray(route.accessRoles) ? route.accessRoles.map((item) => String(item)) : [],
    };
  });
  return next;
};

export const getDefaultRuntimeConfig = () => ({
  company: {
    companyName: "",
    companyLogoUrl: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    description: "",
  },
  preferences: {
    theme: DEFAULT_RUNTIME_THEME.mode,
    defaultDashboardPage: "/admin/dashboard",
    language: "en",
    timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    currencyFormat: "INR",
  },
  security: {
    otpLoginEnabled: true,
  },
  features: deepClone(DEFAULT_RUNTIME_FEATURES),
  labels: deepClone(DEFAULT_RUNTIME_LABELS),
  theme: deepClone(DEFAULT_RUNTIME_THEME),
  navigation: deepClone(DEFAULT_RUNTIME_NAVIGATION),
  portalVisibility: deepClone(DEFAULT_PORTAL_VISIBILITY),
  routes: deepClone(DEFAULT_RUNTIME_ROUTES),
});

export const ensureRuntimePermissionsSeeded = async () => {
  const count = await RuntimePermission.countDocuments({}, { limit: 1 });
  if (count > 0) return;
  await RuntimePermission.insertMany(DEFAULT_RUNTIME_PERMISSION_ENTRIES);
};

export const getRuntimePermissionMap = async () => {
  await ensureRuntimePermissionsSeeded();
  const rows = await RuntimePermission.find().lean();
  return rows.reduce((acc, row) => {
    if (!acc[row.role]) acc[row.role] = {};
    acc[row.role][row.action] = row.allowed !== false;
    return acc;
  }, {});
};

export const sanitizeRuntimeConfig = (value, fallbackThemeMode = "light") => {
  const defaults = getDefaultRuntimeConfig();
  const incoming = isObject(value) ? value : {};
  const theme = toTheme(incoming.theme);
  return {
    features: toBooleanRecord(incoming.features, defaults.features, "features"),
    labels: toLabelRecord(incoming.labels),
    theme: {
      ...theme,
      mode: theme.mode || fallbackThemeMode,
    },
    navigation: toNavigation(incoming.navigation),
    portalVisibility: toBooleanRecord(incoming.portalVisibility, defaults.portalVisibility, "portalVisibility"),
    routes: toRoutes(incoming.routes),
  };
};

export const getRuntimeConfig = async () => {
  let settings = await SystemSettings.findOne({ key: "global" }).lean();
  if (!settings) {
    const created = await SystemSettings.create({ key: "global" });
    settings = created.toObject();
  }
  const themeMode = settings?.preferences?.theme || DEFAULT_RUNTIME_THEME.mode;
  const sanitized = sanitizeRuntimeConfig(settings?.runtimeConfig, themeMode);
  const permissions = await getRuntimePermissionMap();

  return {
    company: settings.company || {},
    preferences: settings.preferences || {},
    security: {
      otpLoginEnabled: settings.security?.otpLoginEnabled !== false,
    },
    ...sanitized,
    permissions,
  };
};

export const updateRuntimeConfig = async (payload) => {
  let settings = await SystemSettings.findOne({ key: "global" });
  if (!settings) {
    settings = await SystemSettings.create({ key: "global" });
  }
  const defaults = getDefaultRuntimeConfig();
  const currentRuntimeConfig =
    settings.runtimeConfig && typeof settings.runtimeConfig.toObject === "function"
      ? settings.runtimeConfig.toObject()
      : settings.runtimeConfig || {};
  const nextRuntimeConfig = sanitizeRuntimeConfig(
    {
      ...currentRuntimeConfig,
      ...(payload || {}),
    },
    settings?.preferences?.theme || DEFAULT_RUNTIME_THEME.mode
  );
  settings.runtimeConfig = nextRuntimeConfig;

  const incomingCompany = isObject(payload?.company) ? payload.company : {};
  settings.company = {
    ...defaults.company,
    ...(settings.company?.toObject ? settings.company.toObject() : settings.company || {}),
    ...incomingCompany,
  };

  const incomingPreferences = isObject(payload?.preferences) ? payload.preferences : {};
  settings.preferences = {
    ...defaults.preferences,
    ...(settings.preferences?.toObject ? settings.preferences.toObject() : settings.preferences || {}),
    ...incomingPreferences,
    theme: nextRuntimeConfig.theme?.mode || incomingPreferences.theme || settings.preferences?.theme || DEFAULT_RUNTIME_THEME.mode,
  };

  const incomingSecurity = isObject(payload?.security) ? payload.security : {};
  settings.security = {
    ...(settings.security?.toObject ? settings.security.toObject() : settings.security || {}),
    otpLoginEnabled:
      typeof incomingSecurity.otpLoginEnabled === "boolean"
        ? incomingSecurity.otpLoginEnabled
        : settings.security?.otpLoginEnabled !== false,
  };

  await settings.save();

  if (isObject(payload?.permissions)) {
    const operations = [];
    Object.entries(payload.permissions).forEach(([role, actionMap]) => {
      if (!isObject(actionMap)) return;
      Object.entries(actionMap).forEach(([action, allowed]) => {
        if (typeof allowed !== "boolean") return;
        operations.push({
          updateOne: {
            filter: { role, action },
            update: { $set: { role, action, allowed } },
            upsert: true,
          },
        });
      });
    });
    if (operations.length > 0) {
      await RuntimePermission.bulkWrite(operations);
    }
  }

  return getRuntimeConfig();
};

export const userHasPermission = async (user, action) => {
  if (!user || !action) return false;
  const roleKey = user.accessRole || user.role || "candidate";
  const config = await getRuntimeConfig();
  return config.permissions?.[roleKey]?.[action] === true;
};
