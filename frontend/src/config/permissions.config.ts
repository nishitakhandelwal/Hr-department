export const PERMISSIONS = {
  "/super-admin": ["super_admin"],
  "/admin/dashboard": ["admin", "super_admin"],
  "/admin/candidates": ["admin", "super_admin", "hr_manager", "recruiter"],
  "/admin/payroll": ["admin", "super_admin"],
  "/admin/users": ["admin", "super_admin"],
  "/employee/dashboard": ["employee"],
  "/hr/dashboard": ["hr_manager"],
  "/recruiter/dashboard": ["recruiter"],
  "/candidate/dashboard": ["candidate"],
} as const;
