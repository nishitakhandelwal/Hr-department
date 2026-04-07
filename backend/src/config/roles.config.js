export const ROLE_HIERARCHY = {
  user: 1,
  manager: 2,
  admin: 3,
  super_admin: 4,
};

const HIERARCHY_KEYS = new Set(Object.keys(ROLE_HIERARCHY));

export const normalizeHierarchyRole = (role, accessRole) => {
  const resolvedAccessRole = String(accessRole || "").trim().toLowerCase();
  const resolvedRole = String(role || "").trim().toLowerCase();

  if (resolvedAccessRole === "super_admin" || resolvedRole === "super_admin") return "super_admin";
  if (resolvedAccessRole === "admin" || resolvedRole === "admin") return "admin";
  if (
    resolvedAccessRole === "hr_manager" ||
    resolvedAccessRole === "recruiter" ||
    resolvedAccessRole === "manager" ||
    resolvedRole === "manager"
  ) {
    return "manager";
  }
  return "user";
};

export const matchesRequiredRole = (user, requiredRole) => {
  const normalizedRequiredRole = String(requiredRole || "").trim().toLowerCase();
  const userRole = String(user?.role || "").trim().toLowerCase();
  const userAccessRole = String(user?.accessRole || "").trim().toLowerCase();

  if (HIERARCHY_KEYS.has(normalizedRequiredRole)) {
    const effectiveUserRole = normalizeHierarchyRole(userRole, userAccessRole);
    return ROLE_HIERARCHY[effectiveUserRole] >= ROLE_HIERARCHY[normalizedRequiredRole];
  }

  return userRole === normalizedRequiredRole || userAccessRole === normalizedRequiredRole;
};
