export const ROLE_HIERARCHY = {
  candidate: 1,
  user: 1,
  employee: 1,
  recruiter: 2,
  hr_manager: 2,
  manager: 2,
  admin: 3,
  super_admin: 4,
} as const;

export type DynamicRole = keyof typeof ROLE_HIERARCHY;

export const normalizeRoleForHierarchy = (role?: string | null, accessRole?: string | null): DynamicRole => {
  const rawAccessRole = String(accessRole || "").trim().toLowerCase();
  const rawRole = String(role || "").trim().toLowerCase();

  if (rawAccessRole === "super_admin" || rawRole === "super_admin") return "super_admin";
  if (rawAccessRole === "admin" || rawRole === "admin") return "admin";
  if (rawAccessRole === "hr_manager" || rawAccessRole === "recruiter" || rawRole === "manager") return "manager";
  if (rawAccessRole === "candidate" || rawRole === "candidate") return "candidate";
  return "employee";
};
