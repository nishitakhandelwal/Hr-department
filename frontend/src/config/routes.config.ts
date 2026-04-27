import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const VerifyOtp = lazy(() => import("@/pages/VerifyOtp"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminCandidates = lazy(() => import("@/pages/admin/AdminCandidates"));
const AdminEmployees = lazy(() => import("@/pages/admin/AdminEmployees"));
const AdminAttendance = lazy(() => import("@/pages/admin/AdminAttendance"));
const AdminLeave = lazy(() => import("@/pages/admin/AdminLeave"));
const AdminPayroll = lazy(() => import("@/pages/admin/AdminPayroll"));
const AdminLetters = lazy(() => import("@/pages/admin/AdminLetters"));
const AdminDepartments = lazy(() => import("@/pages/admin/AdminDepartments"));
const AdminOffboarding = lazy(() => import("@/pages/admin/AdminOffboarding"));
const AdminUserManagement = lazy(() => import("@/pages/admin/AdminUserManagement"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const SuperAdminDashboard = lazy(() => import("@/pages/admin/SuperAdminDashboard"));
const AdminInternships = lazy(() => import("@/pages/admin/AdminInternships"));
const AdminJoiningForms = lazy(() => import("@/pages/admin/AdminJoiningForms"));
const SmartCalendar = lazy(() => import("@/pages/admin/SmartCalendar"));
const EmployeeDashboard = lazy(() => import("@/pages/employee/EmployeeDashboard"));
const EmployeeProfile = lazy(() => import("@/pages/employee/EmployeeProfile"));
const EmployeeAttendance = lazy(() => import("@/pages/employee/EmployeeAttendance"));
const EmployeeLeave = lazy(() => import("@/pages/employee/EmployeeLeave"));
const EmployeePayroll = lazy(() => import("@/pages/employee/EmployeePayroll"));
const EmployeeLetters = lazy(() => import("@/pages/employee/EmployeeLetters"));
const HrDashboard = lazy(() => import("@/pages/employee/HrDashboard"));
const RecruiterDashboard = lazy(() => import("@/pages/employee/RecruiterDashboard"));
const CandidateApply = lazy(() => import("@/pages/public/CandidateApply"));
const CandidateDashboard = lazy(() => import("@/pages/candidate/CandidateDashboard"));
const CandidateProfile = lazy(() => import("@/pages/candidate/CandidateProfile"));
const CandidateApplications = lazy(() => import("@/pages/candidate/CandidateApplications"));
const CandidateStatusPage = lazy(() => import("@/pages/candidate/CandidateStatusPage"));
const CandidateDocuments = lazy(() => import("@/pages/candidate/CandidateDocuments"));
const CandidateNotifications = lazy(() => import("@/pages/candidate/CandidateNotifications"));
const CandidateStage2 = lazy(() => import("@/pages/candidate/CandidateStage2"));
const CandidateJoiningForm = lazy(() => import("@/pages/candidate/CandidateJoiningForm"));

type AppRouteConfig = {
  path: string;
  component?: ComponentType | LazyExoticComponent<ComponentType>;
  redirectTo?: string;
  roles?: Array<"super_admin" | "admin" | "employee" | "candidate">;
  accessRoles?: Array<"super_admin" | "admin" | "hr_manager" | "recruiter" | "employee" | "candidate">;
  requiredModule?: string;
  routeKey?: string;
  featureKey?: string;
  permissionKey?: string;
  useAppLayout?: boolean;
  useCandidatePortal?: boolean;
  authMode?: "public" | "auth" | "guest";
};

export const APP_ROUTES: AppRouteConfig[] = [
  { path: "/login", component: Login, authMode: "guest" },
  { path: "/forgot-password", component: ForgotPassword, authMode: "public" },
  { path: "/reset-password", component: ResetPassword, authMode: "public" },
  { path: "/reset-password/:token", component: ResetPassword, authMode: "public" },
  { path: "/verify-otp", component: VerifyOtp, authMode: "public" },
  { path: "/register", component: Register, authMode: "guest" },
  { path: "/joining-form", component: CandidateJoiningForm, authMode: "auth", roles: ["employee"], routeKey: "joining.form", useAppLayout: true },
  { path: "/super-admin", component: SuperAdminDashboard, authMode: "auth", accessRoles: ["super_admin"], routeKey: "superAdmin.dashboard", permissionKey: "manage_runtime_config", useAppLayout: true },
  { path: "/admin", redirectTo: "/admin/dashboard", authMode: "auth" },
  { path: "/admin/dashboard", component: AdminDashboard, authMode: "auth", roles: ["admin"], routeKey: "admin.dashboard", useAppLayout: true },
  { path: "/admin/calendar", component: SmartCalendar, authMode: "auth", roles: ["admin"], routeKey: "admin.calendar", useAppLayout: true },
  { path: "/admin/profile", component: EmployeeProfile, authMode: "auth", roles: ["admin"], routeKey: "admin.profile", useAppLayout: true },
  { path: "/admin/candidates", component: AdminCandidates, authMode: "auth", roles: ["admin", "employee"], accessRoles: ["super_admin", "admin", "hr_manager", "recruiter"], requiredModule: "candidates", routeKey: "admin.candidates", useAppLayout: true },
  { path: "/admin/employees", component: AdminEmployees, authMode: "auth", roles: ["admin"], routeKey: "admin.employees", useAppLayout: true },
  { path: "/admin/attendance", component: AdminAttendance, authMode: "auth", roles: ["admin"], accessRoles: ["super_admin", "admin"], routeKey: "admin.attendance", useAppLayout: true },
  { path: "/admin/leave", component: AdminLeave, authMode: "auth", roles: ["admin"], routeKey: "admin.leave", useAppLayout: true },
  { path: "/admin/payroll", component: AdminPayroll, authMode: "auth", roles: ["admin"], routeKey: "admin.payroll", useAppLayout: true },
  { path: "/admin/letters", component: AdminLetters, authMode: "auth", roles: ["admin", "employee"], accessRoles: ["super_admin", "admin", "hr_manager"], requiredModule: "letters", routeKey: "admin.letters", useAppLayout: true },
  { path: "/admin/departments", component: AdminDepartments, authMode: "auth", roles: ["admin"], routeKey: "admin.departments", useAppLayout: true },
  { path: "/admin/offboarding", component: AdminOffboarding, authMode: "auth", roles: ["admin"], routeKey: "admin.offboarding", useAppLayout: true },
  { path: "/admin/internships", component: AdminInternships, authMode: "auth", roles: ["admin", "employee"], accessRoles: ["super_admin", "admin", "hr_manager", "recruiter"], requiredModule: "candidates", routeKey: "admin.internships", useAppLayout: true },
  { path: "/admin/joining-forms", component: AdminJoiningForms, authMode: "auth", roles: ["admin", "employee"], accessRoles: ["super_admin", "admin", "hr_manager", "recruiter"], requiredModule: "candidates", routeKey: "admin.joiningForms", useAppLayout: true },
  { path: "/admin/users", component: AdminUserManagement, authMode: "auth", roles: ["admin"], accessRoles: ["super_admin", "admin"], requiredModule: "userManagement", routeKey: "admin.users", useAppLayout: true },
  { path: "/admin/settings", component: AdminSettings, authMode: "auth", roles: ["admin"], requiredModule: "settings", routeKey: "admin.settings", permissionKey: "manage_runtime_config", useAppLayout: true },
  { path: "/employee", redirectTo: "/employee/dashboard", authMode: "auth" },
  { path: "/hr", redirectTo: "/hr/dashboard", authMode: "auth" },
  { path: "/recruiter", redirectTo: "/recruiter/dashboard", authMode: "auth" },
  { path: "/employee/dashboard", component: EmployeeDashboard, authMode: "auth", roles: ["employee"], routeKey: "employee.dashboard", useAppLayout: true },
  { path: "/hr/dashboard", component: HrDashboard, authMode: "auth", roles: ["employee"], accessRoles: ["hr_manager"], routeKey: "hr.dashboard", useAppLayout: true },
  { path: "/recruiter/dashboard", component: RecruiterDashboard, authMode: "auth", roles: ["employee"], accessRoles: ["recruiter"], routeKey: "recruiter.dashboard", useAppLayout: true },
  { path: "/employee/profile", component: EmployeeProfile, authMode: "auth", roles: ["employee"], routeKey: "employee.profile", useAppLayout: true },
  { path: "/employee/attendance", component: EmployeeAttendance, authMode: "auth", roles: ["employee"], routeKey: "employee.attendance", useAppLayout: true },
  { path: "/employee/leave", component: EmployeeLeave, authMode: "auth", roles: ["employee"], routeKey: "employee.leave", useAppLayout: true },
  { path: "/employee/payroll", component: EmployeePayroll, authMode: "auth", roles: ["employee"], routeKey: "employee.payroll", useAppLayout: true },
  { path: "/employee/letters", component: EmployeeLetters, authMode: "auth", roles: ["employee"], routeKey: "employee.letters", useAppLayout: true },
  { path: "/apply", component: CandidateApply, authMode: "auth", roles: ["candidate"], useCandidatePortal: true },
  { path: "/candidate", redirectTo: "/candidate/dashboard", authMode: "auth" },
  { path: "/candidate/dashboard", component: CandidateDashboard, authMode: "auth", roles: ["candidate"], routeKey: "candidate.dashboard", useCandidatePortal: true },
  { path: "/candidate/profile", component: CandidateProfile, authMode: "auth", roles: ["candidate"], routeKey: "candidate.profile", useCandidatePortal: true },
  { path: "/candidate/applications", component: CandidateApplications, authMode: "auth", roles: ["candidate"], routeKey: "candidate.applications", useCandidatePortal: true },
  { path: "/candidate/status", component: CandidateStatusPage, authMode: "auth", roles: ["candidate"], routeKey: "candidate.status", useCandidatePortal: true },
  { path: "/candidate/documents", component: CandidateDocuments, authMode: "auth", roles: ["candidate"], routeKey: "candidate.documents", useCandidatePortal: true },
  { path: "/candidate/notifications", component: CandidateNotifications, authMode: "auth", roles: ["candidate"], routeKey: "candidate.notifications", useCandidatePortal: true },
  { path: "/candidate/stage2", component: CandidateStage2, authMode: "auth", roles: ["candidate"], routeKey: "candidate.stage2", useCandidatePortal: true },
  { path: "/candidate/joining-form", component: CandidateJoiningForm, authMode: "auth", roles: ["candidate"], routeKey: "candidate.joiningForm", useCandidatePortal: true },
];

export const FALLBACK_ROUTE_COMPONENT = NotFound;
