import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
  accessRoles?: Array<"super_admin" | "admin" | "hr_manager" | "recruiter" | "employee" | "candidate">;
  requiredModule?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles, accessRoles, requiredModule }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  const fallbackRoute =
    user?.accessRole === "hr_manager"
      ? "/hr/dashboard"
      : user?.accessRole === "recruiter"
      ? "/recruiter/dashboard"
      : user?.role === "employee"
        ? "/employee/dashboard"
        : user?.role === "candidate"
          ? "/candidate/dashboard"
          : "/admin/dashboard";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === "employee" && user.status !== "active_employee") {
    if (location.pathname !== "/joining-form") {
      return <Navigate to="/joining-form" replace />;
    }
  }
  if (location.pathname === "/joining-form" && user?.role === "employee" && user.status === "active_employee") {
    return <Navigate to={fallbackRoute} replace />;
  }
  if (roles && user && !roles.includes(user.role)) return <Navigate to={fallbackRoute} replace />;
  if (accessRoles && user && (!user.accessRole || !accessRoles.includes(user.accessRole))) return <Navigate to={fallbackRoute} replace />;
  if (requiredModule && user?.permissions?.modules && user.permissions.modules[requiredModule] === false) {
    return <Navigate to={fallbackRoute} replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
