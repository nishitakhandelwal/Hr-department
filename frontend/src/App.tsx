import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SystemSettingsProvider, useSystemSettings } from "@/context/SystemSettingsContext";
import { CandidatePortalProvider } from "@/context/CandidatePortalContext";
import { AppLayout } from "@/layouts/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyOtp from "./pages/VerifyOtp";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCandidates from "./pages/admin/AdminCandidates";
import AdminEmployees from "./pages/admin/AdminEmployees";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminLeave from "./pages/admin/AdminLeave";
import AdminPayroll from "./pages/admin/AdminPayroll";
import AdminLetters from "./pages/admin/AdminLetters";
import AdminDepartments from "./pages/admin/AdminDepartments";
import AdminOffboarding from "./pages/admin/AdminOffboarding";
import AdminUserManagement from "./pages/admin/AdminUserManagement";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminInternships from "./pages/admin/AdminInternships";
import AdminJoiningForms from "./pages/admin/AdminJoiningForms";
import SmartCalendar from "./pages/admin/SmartCalendar";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeProfile from "./pages/employee/EmployeeProfile";
import EmployeeAttendance from "./pages/employee/EmployeeAttendance";
import EmployeeLeave from "./pages/employee/EmployeeLeave";
import EmployeePayroll from "./pages/employee/EmployeePayroll";
import EmployeeLetters from "./pages/employee/EmployeeLetters";
import HrDashboard from "./pages/employee/HrDashboard";
import RecruiterDashboard from "./pages/employee/RecruiterDashboard";
import CandidateApply from "./pages/public/CandidateApply";
import CandidateDashboard from "./pages/candidate/CandidateDashboard";
import CandidateProfile from "./pages/candidate/CandidateProfile";
import CandidateApplications from "./pages/candidate/CandidateApplications";
import CandidateStatusPage from "./pages/candidate/CandidateStatusPage";
import CandidateDocuments from "./pages/candidate/CandidateDocuments";
import CandidateNotifications from "./pages/candidate/CandidateNotifications";
import CandidateStage2 from "./pages/candidate/CandidateStage2";
import CandidateJoiningForm from "./pages/candidate/CandidateJoiningForm";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const { publicSettings } = useSystemSettings();
  if (loading) return null;
  const adminDefaultPage = publicSettings?.preferences?.defaultDashboardPage || "/admin/dashboard";
  const homeRoute =
    user?.accessRole === "hr_manager"
      ? "/hr/dashboard"
      : user?.accessRole === "recruiter"
      ? "/recruiter/dashboard"
      : user?.role === "employee"
      ? "/employee/dashboard"
      : user?.role === "candidate"
      ? "/candidate/dashboard"
      : adminDefaultPage;

  const candidatePortal = (element: React.ReactNode) => (
    <ProtectedRoute roles={["candidate"]}>
      <CandidatePortalProvider>
        <AppLayout>{element}</AppLayout>
      </CandidatePortalProvider>
    </ProtectedRoute>
  );

  return (
    <Routes>
      <Route path="/apply" element={candidatePortal(<CandidateApply />)} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={homeRoute} replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/joining-form" element={<ProtectedRoute roles={["employee"]}><AppLayout><CandidateJoiningForm /></AppLayout></ProtectedRoute>} />
      <Route path="/register" element={isAuthenticated ? <Navigate to={homeRoute} replace /> : <Register />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? homeRoute : "/login"} replace />} />

      {/* Admin routes */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/calendar" element={<ProtectedRoute roles={["admin"]}><AppLayout><SmartCalendar /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/profile" element={<ProtectedRoute roles={["admin"]}><AppLayout><EmployeeProfile /></AppLayout></ProtectedRoute>} />
      <Route
        path="/admin/candidates"
        element={
          <ProtectedRoute roles={["admin", "employee"]} accessRoles={["super_admin", "admin", "hr_manager", "recruiter"]} requiredModule="candidates">
            <AppLayout><AdminCandidates /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/admin/employees" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminEmployees /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/attendance" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminAttendance /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/leave" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminLeave /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/payroll" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminPayroll /></AppLayout></ProtectedRoute>} />
      <Route
        path="/admin/letters"
        element={
          <ProtectedRoute roles={["admin", "employee"]} accessRoles={["super_admin", "admin", "hr_manager"]} requiredModule="letters">
            <AppLayout><AdminLetters /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/admin/departments" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminDepartments /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/offboarding" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminOffboarding /></AppLayout></ProtectedRoute>} />
      <Route
        path="/admin/internships"
        element={
          <ProtectedRoute roles={["admin", "employee"]} accessRoles={["super_admin", "admin", "hr_manager", "recruiter"]} requiredModule="candidates">
            <AppLayout><AdminInternships /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/joining-forms"
        element={
          <ProtectedRoute roles={["admin", "employee"]} accessRoles={["super_admin", "admin", "hr_manager", "recruiter"]} requiredModule="candidates">
            <AppLayout><AdminJoiningForms /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]} accessRoles={["super_admin", "admin"]} requiredModule="userManagement"><AppLayout><AdminUserManagement /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={["admin"]} requiredModule="settings"><AppLayout><AdminSettings /></AppLayout></ProtectedRoute>} />

      {/* Employee routes */}
      <Route path="/employee" element={<Navigate to="/employee/dashboard" replace />} />
      <Route path="/hr" element={<Navigate to="/hr/dashboard" replace />} />
      <Route path="/recruiter" element={<Navigate to="/recruiter/dashboard" replace />} />
      <Route path="/employee/dashboard" element={<ProtectedRoute roles={["employee"]}><AppLayout><EmployeeDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/hr/dashboard" element={<ProtectedRoute roles={["employee"]} accessRoles={["hr_manager"]}><AppLayout><HrDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/recruiter/dashboard" element={<ProtectedRoute roles={["employee"]} accessRoles={["recruiter"]}><AppLayout><RecruiterDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/employee/profile" element={<ProtectedRoute roles={["employee"]}><AppLayout><EmployeeProfile /></AppLayout></ProtectedRoute>} />
      <Route path="/employee/attendance" element={<ProtectedRoute roles={["employee"]}><AppLayout><EmployeeAttendance /></AppLayout></ProtectedRoute>} />
      <Route path="/employee/leave" element={<ProtectedRoute roles={["employee"]}><AppLayout><EmployeeLeave /></AppLayout></ProtectedRoute>} />
      <Route path="/employee/payroll" element={<ProtectedRoute roles={["employee"]}><AppLayout><EmployeePayroll /></AppLayout></ProtectedRoute>} />
      <Route path="/employee/letters" element={<ProtectedRoute roles={["employee"]}><AppLayout><EmployeeLetters /></AppLayout></ProtectedRoute>} />

      {/* Candidate routes */}
      <Route path="/candidate" element={<Navigate to="/candidate/dashboard" replace />} />
      <Route path="/candidate/dashboard" element={candidatePortal(<CandidateDashboard />)} />
      <Route path="/candidate/profile" element={candidatePortal(<CandidateProfile />)} />
      <Route path="/candidate/applications" element={candidatePortal(<CandidateApplications />)} />
      <Route path="/candidate/status" element={candidatePortal(<CandidateStatusPage />)} />
      <Route path="/candidate/documents" element={candidatePortal(<CandidateDocuments />)} />
      <Route path="/candidate/notifications" element={candidatePortal(<CandidateNotifications />)} />
      <Route path="/candidate/stage2" element={candidatePortal(<CandidateStage2 />)} />
      <Route path="/candidate/joining-form" element={candidatePortal(<CandidateJoiningForm />)} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SystemSettingsProvider>
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </SystemSettingsProvider>
  </QueryClientProvider>
);

export default App;
