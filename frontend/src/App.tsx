import React, { Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SystemSettingsProvider, useSystemSettings } from "@/context/SystemSettingsContext";
import { CandidatePortalProvider } from "@/context/CandidatePortalContext";
import { AppLayout } from "@/layouts/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APP_ROUTES, FALLBACK_ROUTE_COMPONENT } from "@/config/routes.config";
import { resolveDefaultRedirect } from "@/config/navigation.config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const RouteSkeleton = () => (
  <div className="space-y-5">
    <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
      ))}
    </div>
    <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
  </div>
);

const CandidatePortalShell = () => (
  <ProtectedRoute roles={["candidate"]}>
    <CandidatePortalProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </CandidatePortalProvider>
  </ProtectedRoute>
);

const renderRouteElement = (
  config: (typeof APP_ROUTES)[number],
  isAuthenticated: boolean,
  homeRoute: string,
  resolvePortalRoot: (path: string) => string
) => {
  if (config.redirectTo) {
    return <Navigate to={resolvePortalRoot(config.redirectTo)} replace />;
  }

  if (!config.component) return null;
  const Component = config.component;
  let element = (
    <Suspense fallback={<RouteSkeleton />}>
      <Component />
    </Suspense>
  );

  if (config.useAppLayout) {
    element = <AppLayout>{element}</AppLayout>;
  }

  if (config.authMode === "auth") {
    element = (
      <ProtectedRoute
        roles={config.roles}
        accessRoles={config.accessRoles}
        requiredModule={config.requiredModule}
        routeKey={config.routeKey}
        featureKey={config.featureKey}
        permissionKey={config.permissionKey}
      >
        {element}
      </ProtectedRoute>
    );
  }

  if (config.authMode === "guest") {
    element = isAuthenticated ? <Navigate to={homeRoute} replace /> : element;
  }

  return element;
};

const AppRoutes = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const { error, loading: configLoading, publicSettings, refreshConfig, getDefaultRoute } = useSystemSettings();

  if (loading || configLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Runtime configuration unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The application loaded safe config defaults because the live runtime configuration could not be fetched.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void refreshConfig()}
            className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry config load
          </button>
        </div>
      </div>
    );
  }

  const adminDefaultPage = publicSettings?.preferences?.defaultDashboardPage;
  const homeRoute = isAuthenticated ? getDefaultRoute() : resolveDefaultRedirect(user, adminDefaultPage);
  const NotFound = FALLBACK_ROUTE_COMPONENT;
  const resolvePortalRoot = (path: string) => {
    if (path === "/admin" || path === "/super-admin") return getDefaultRoute(user?.accessRole || user?.role);
    if (path === "/employee") return getDefaultRoute("employee");
    if (path === "/hr") return getDefaultRoute("hr_manager");
    if (path === "/recruiter") return getDefaultRoute("recruiter");
    if (path === "/candidate") return getDefaultRoute("candidate");
    return path;
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? homeRoute : "/login"} replace />} />

      {APP_ROUTES.filter((route) => !route.useCandidatePortal).map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={renderRouteElement(route, isAuthenticated, homeRoute, resolvePortalRoot)}
        />
      ))}

      <Route element={<CandidatePortalShell />}>
        {APP_ROUTES.filter((route) => route.useCandidatePortal && route.authMode !== "public").map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={renderRouteElement(route, isAuthenticated, homeRoute, resolvePortalRoot)}
          />
        ))}
      </Route>

      {APP_ROUTES.filter((route) => route.useCandidatePortal && route.authMode === "public").map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={renderRouteElement(route, isAuthenticated, homeRoute, resolvePortalRoot)}
        />
      ))}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SystemSettingsProvider>
        <TooltipProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </SystemSettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
