import type { AuthUser } from "@/context/AuthContext";

const DEFAULT_ADMIN_DASHBOARD_PATH = "/admin/dashboard";

export const DEFAULT_REDIRECT = {
  super_admin: "/super-admin",
  admin: DEFAULT_ADMIN_DASHBOARD_PATH,
  hr_manager: "/hr/dashboard",
  recruiter: "/recruiter/dashboard",
  employee: "/employee/dashboard",
  candidate: "/candidate/dashboard",
} as const;

export const PROFILE_REDIRECT = {
  super_admin: "/admin/profile",
  admin: "/admin/profile",
  hr_manager: "/hr/dashboard",
  recruiter: "/recruiter/dashboard",
  employee: "/employee/profile",
  pending_employee: "/joining-form",
  candidate: "/candidate/profile",
} as const;

export const resolveDefaultRedirect = (
  user?: Pick<AuthUser, "role" | "accessRole" | "status"> | null,
  configuredAdminDefault?: string
) => {
  if (!user) return "/login";
  if (user.role === "employee" && user.status !== "active_employee") {
    return PROFILE_REDIRECT.pending_employee;
  }
  const effectiveAccessRole = user.accessRole || user.role;
  if (effectiveAccessRole === "super_admin") return DEFAULT_REDIRECT.super_admin;
  if (effectiveAccessRole === "admin" || user.role === "admin") {
    return configuredAdminDefault || DEFAULT_REDIRECT.admin || DEFAULT_ADMIN_DASHBOARD_PATH;
  }
  if (effectiveAccessRole === "hr_manager") return DEFAULT_REDIRECT.hr_manager;
  if (effectiveAccessRole === "recruiter") return DEFAULT_REDIRECT.recruiter;
  if (user.role === "candidate" || effectiveAccessRole === "candidate") return DEFAULT_REDIRECT.candidate;
  return DEFAULT_REDIRECT.employee;
};

export const resolveProfileRedirect = (
  user?: Pick<AuthUser, "role" | "accessRole" | "status"> | null,
) => {
  if (!user) return "/login";
  const effectiveAccessRole = user.accessRole || user.role;
  if (user.role === "employee" && user.status !== "active_employee") return PROFILE_REDIRECT.pending_employee;
  if (effectiveAccessRole === "super_admin") return PROFILE_REDIRECT.super_admin;
  if (effectiveAccessRole === "admin" || user.role === "admin") return PROFILE_REDIRECT.admin;
  if (effectiveAccessRole === "hr_manager") return PROFILE_REDIRECT.hr_manager;
  if (effectiveAccessRole === "recruiter") return PROFILE_REDIRECT.recruiter;
  if (user.role === "candidate" || effectiveAccessRole === "candidate") return PROFILE_REDIRECT.candidate;
  return PROFILE_REDIRECT.employee;
};
