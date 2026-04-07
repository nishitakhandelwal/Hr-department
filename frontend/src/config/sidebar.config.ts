export const SIDEBAR = {
  super_admin: [
    { id: "superAdmin.dashboard", labelKey: "nav.superAdmin.dashboard", path: "/super-admin", icon: "ShieldCheck", featureKey: "settings", moduleKey: "settings" },
    { id: "admin.dashboard", labelKey: "nav.admin.dashboard", path: "/admin/dashboard", icon: "LayoutDashboard", featureKey: "dashboard", moduleKey: "dashboard" },
    { id: "admin.candidates", labelKey: "nav.admin.candidates", path: "/admin/candidates", icon: "UserCheck", featureKey: "candidates", moduleKey: "candidates" },
    { id: "admin.payroll", labelKey: "nav.admin.payroll", path: "/admin/payroll", icon: "IndianRupee", featureKey: "payroll", moduleKey: "payroll" },
    { id: "admin.users", labelKey: "nav.admin.users", path: "/admin/users", icon: "ShieldCheck", featureKey: "userManagement", moduleKey: "userManagement" },
    { id: "admin.settings", labelKey: "nav.admin.settings", path: "/admin/settings", icon: "Settings", featureKey: "settings", moduleKey: "settings" },
  ],
  employee: [
    { id: "joining.form", labelKey: "nav.employee.joiningForm", path: "/joining-form", icon: "ClipboardCheck", featureKey: "joiningForms" },
  ],
} as const;
