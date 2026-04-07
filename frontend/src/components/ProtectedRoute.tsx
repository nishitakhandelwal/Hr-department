import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "@/context/AuthContext";
import { useFeature, usePermission, useRouteAccess, useSystemSettings } from "@/context/SystemSettingsContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
  accessRoles?: Array<"super_admin" | "admin" | "hr_manager" | "recruiter" | "employee" | "candidate">;
  requiredModule?: string;
  routeKey?: string;
  featureKey?: string;
  permissionKey?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles, accessRoles, requiredModule, routeKey, featureKey, permissionKey }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const { getDefaultRoute, loading: configLoading } = useSystemSettings();
  const hasRouteAccess = useRouteAccess(routeKey || "");
  const featureEnabled = useFeature(featureKey || "");
  const hasPermission = usePermission(permissionKey || "");
  const location = useLocation();
  const isSuperAdmin = user?.accessRole === "super_admin" || user?.role === "super_admin";
  const fallbackRoute = getDefaultRoute();

  if (loading || configLoading) {
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
  if (isSuperAdmin) return <>{children}</>;
  if (roles && user && !roles.includes(user.role)) return <Navigate to={fallbackRoute} replace />;
  if (accessRoles && user) {
    const effectiveAccessRole = user.accessRole || user.role;
    if (!effectiveAccessRole || !accessRoles.includes(effectiveAccessRole)) {
      return <Navigate to={fallbackRoute} replace />;
    }
  }
  if (requiredModule && user?.permissions?.modules && user.permissions.modules[requiredModule] === false) {
    return <Navigate to={fallbackRoute} replace />;
  }
  if (routeKey && !hasRouteAccess) return <Navigate to={fallbackRoute} replace />;
  if (featureKey && !featureEnabled) return <Navigate to={fallbackRoute} replace />;
  if (permissionKey && !hasPermission) return <Navigate to={fallbackRoute} replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
