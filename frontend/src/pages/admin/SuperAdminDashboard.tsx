import React, { useEffect, useMemo, useState } from "react";
import { Activity, Crown, Eye, Palette, RefreshCw, Save, ShieldCheck, Sparkles, Users } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useConfig, useLabel, useSystemSettings } from "@/context/SystemSettingsContext";
import { apiService, type RuntimeConfigPayload, type RuntimeRouteGuard, type UserAccessRole, type UserActivityLog } from "@/services/api";

const FEATURE_TOGGLES = [
  { key: "candidates", labelKey: "nav.admin.candidates", description: "Applications, review, internship, and joining workflows." },
  { key: "payroll", labelKey: "nav.admin.payroll", description: "Payroll processing, salary rules, and payslips." },
  { key: "attendance", labelKey: "nav.admin.attendance", description: "Attendance dashboards, corrections, and summaries." },
  { key: "leave", labelKey: "nav.admin.leave", description: "Leave requests, approvals, and balances." },
  { key: "notifications", labelKey: "nav.candidate.notifications", description: "Notification center across candidate and admin flows." },
];

const ROLE_LABELS: Record<UserAccessRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr_manager: "HR",
  recruiter: "Recruiter",
  employee: "Employee",
  candidate: "Candidate",
};

const VISIBILITY_MODULES = [
  { key: "admin.candidates", label: "Candidates", routeKey: "admin.candidates", allowedAccessRoles: ["super_admin", "admin", "hr_manager", "recruiter"] as UserAccessRole[] },
  { key: "admin.payroll", label: "Payroll", routeKey: "admin.payroll", allowedAccessRoles: ["super_admin", "admin"] as UserAccessRole[] },
  { key: "admin.attendance", label: "Attendance", routeKey: "admin.attendance", allowedAccessRoles: ["super_admin", "admin"] as UserAccessRole[] },
  { key: "admin.leave", label: "Leave", routeKey: "admin.leave", allowedAccessRoles: ["super_admin", "admin"] as UserAccessRole[] },
  { key: "admin.users", label: "User Management", routeKey: "admin.users", allowedAccessRoles: ["super_admin", "admin"] as UserAccessRole[] },
];

const EDITABLE_LABELS = [
  { key: "nav.admin.dashboard", title: "Admin Dashboard Label" },
  { key: "nav.admin.candidates", title: "Candidates Label" },
  { key: "nav.admin.payroll", title: "Payroll Label" },
  { key: "nav.admin.users", title: "Users Label" },
  { key: "nav.superAdmin.dashboard", title: "Super Admin Label" },
];

const cloneConfig = (value: RuntimeConfigPayload): RuntimeConfigPayload => JSON.parse(JSON.stringify(value)) as RuntimeConfigPayload;

const statCardClassName =
  "overflow-hidden border border-[var(--portal-surface-border)] bg-[linear-gradient(145deg,var(--portal-surface-bg-strong),var(--portal-subtle-surface))] text-[var(--portal-heading-color)] shadow-[var(--shadow-card)]";
const panelCardClassName =
  "border border-[var(--portal-surface-border)] bg-[linear-gradient(145deg,var(--portal-surface-bg-strong),var(--portal-surface-bg))] text-[var(--portal-heading-color)] shadow-[var(--shadow-card)]";
const rowCardClassName =
  "flex items-center justify-between rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] px-4 py-4";
const subRowCardClassName =
  "flex items-center justify-between rounded-xl border border-[var(--portal-surface-border)] bg-[var(--portal-surface-bg)] px-3 py-2";
const fieldInputClassName =
  "border-[var(--portal-surface-border)] bg-[var(--portal-surface-bg)] text-[var(--portal-heading-color)] placeholder:text-[var(--portal-muted-color)]";
const switchClassName =
  "data-[state=checked]:bg-[var(--portal-primary-solid)] data-[state=unchecked]:bg-[var(--portal-primary-faint)]";

const formatLogTime = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const ensureRoute = (config: RuntimeConfigPayload, routeKey: string): RuntimeRouteGuard => {
  const existing = config.routes?.[routeKey];
  if (existing) return existing;
  const created: RuntimeRouteGuard = { enabled: true, accessRoles: [] };
  config.routes = { ...(config.routes || {}), [routeKey]: created };
  return created;
};

const SuperAdminDashboard: React.FC = () => {
  const runtimeConfig = useConfig();
  const { refreshConfig, refreshPublicSettings, updateConfigSnapshot, getLabel } = useSystemSettings();
  const { toast } = useToast();
  const pageTitle = useLabel("superAdmin.dashboard.title", "Super Admin Command Center");
  const pageSubtitle = useLabel(
    "superAdmin.dashboard.subtitle",
    "Live control over features, visibility, access, and system experience."
  );

  const [draftConfig, setDraftConfig] = useState<RuntimeConfigPayload>(() => cloneConfig(runtimeConfig));
  const [saving, setSaving] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [overview, setOverview] = useState({
    totalUsers: 0,
    activeUsers: 0,
    visiblePortals: 0,
    enabledFeatures: 0,
  });
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);

  useEffect(() => {
    setDraftConfig(cloneConfig(runtimeConfig));
  }, [runtimeConfig]);

  const loadDashboardData = async () => {
    try {
      setStatsLoading(true);
      const [allUsers, activeUsers, activities] = await Promise.all([
        apiService.getManagedUsers({ page: 1, limit: 1 }),
        apiService.getManagedUsers({ page: 1, limit: 1, status: "active" }),
        apiService.getUserActivities({ page: 1, limit: 6 }),
      ]);

      setOverview({
        totalUsers: allUsers.pagination.total,
        activeUsers: activeUsers.pagination.total,
        visiblePortals: Object.values(draftConfig.portalVisibility || {}).filter(Boolean).length,
        enabledFeatures: Object.values(draftConfig.features || {}).filter((value) => value !== false).length,
      });
      setActivityLogs(activities.items);
    } catch (error) {
      toast({
        title: "Dashboard data unavailable",
        description: error instanceof Error ? error.message : "Unable to load super admin metrics.",
        variant: "destructive",
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboardData();
  }, []);

  useEffect(() => {
    setOverview((current) => ({
      ...current,
      visiblePortals: Object.values(draftConfig.portalVisibility || {}).filter(Boolean).length,
      enabledFeatures: Object.values(draftConfig.features || {}).filter((value) => value !== false).length,
    }));
  }, [draftConfig.features, draftConfig.portalVisibility]);

  const persistConfig = async (nextConfig?: RuntimeConfigPayload) => {
    const payload = nextConfig || draftConfig;
    setSaving(true);
    try {
      const saved = await apiService.updateConfig(payload);
      setDraftConfig(cloneConfig(saved));
      updateConfigSnapshot(saved);
      await refreshPublicSettings();
      await refreshConfig();
      toast({ title: "Super admin settings saved" });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save super admin settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = (key: string, value: boolean) => {
    setDraftConfig((current) => ({
      ...current,
      features: {
        ...(current.features || {}),
        [key]: value,
      },
    }));
  };

  const updatePortalVisibility = (portalKey: string, value: boolean) => {
    setDraftConfig((current) => ({
      ...current,
      portalVisibility: {
        ...(current.portalVisibility || {}),
        [portalKey]: value,
      },
    }));
  };

  const updateRoleVisibility = (routeKey: string, accessRole: UserAccessRole, enabled: boolean) => {
    setDraftConfig((current) => {
      const next = cloneConfig(current);
      const route = ensureRoute(next, routeKey);
      const currentRoles = Array.isArray(route.accessRoles) ? route.accessRoles : [];
      route.accessRoles = enabled
        ? Array.from(new Set([...currentRoles, accessRole]))
        : currentRoles.filter((item) => item !== accessRole);
      next.routes[routeKey] = route;
      return next;
    });
  };

  const roleVisibilityMatrix = useMemo(
    () =>
      VISIBILITY_MODULES.map((module) => ({
        ...module,
        activeRoles: draftConfig.routes?.[module.routeKey]?.accessRoles || [],
      })),
    [draftConfig.routes]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => void loadDashboardData()} disabled={statsLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
            <Button className="rounded-2xl" onClick={() => void persistConfig()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Runtime Changes"}
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Users", value: overview.totalUsers, icon: Users },
          { label: "Active Users", value: overview.activeUsers, icon: Crown },
          { label: "Visible Portals", value: overview.visiblePortals, icon: Eye },
          { label: "Enabled Features", value: overview.enabledFeatures, icon: Sparkles },
        ].map((item) => (
          <Card key={item.label} className={statCardClassName}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--portal-muted-color)]">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold">{statsLoading ? "--" : item.value}</p>
              </div>
              <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-primary-faint)] p-3">
                <item.icon className="h-6 w-6 text-[var(--portal-primary-solid)]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
        <Card className={panelCardClassName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--portal-primary-solid)]" />
              Feature Control Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FEATURE_TOGGLES.map((item) => (
              <div key={item.key} className={rowCardClassName}>
                <div className="max-w-xl">
                  <p className="font-medium text-[var(--portal-heading-color)]">{getLabel(item.labelKey, item.key)}</p>
                  <p className="mt-1 text-sm text-[var(--portal-copy-color)]">{item.description}</p>
                </div>
                <Switch
                  className={switchClassName}
                  checked={draftConfig.features?.[item.key] !== false}
                  onCheckedChange={(checked) => updateFeature(item.key, checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={panelCardClassName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-[var(--portal-primary-solid)]" />
              System Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[var(--portal-copy-color)]">Primary Color</Label>
                <Input
                  value={draftConfig.theme.primaryColor}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      theme: { ...current.theme, primaryColor: event.target.value },
                    }))
                  }
                  className={fieldInputClassName}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--portal-copy-color)]">Default Landing Page</Label>
                <Input
                  value={draftConfig.preferences.defaultDashboardPage}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      preferences: { ...current.preferences, defaultDashboardPage: event.target.value },
                    }))
                  }
                  className={fieldInputClassName}
                />
              </div>
            </div>

            <div className={rowCardClassName}>
              <div>
                <p className="font-medium text-[var(--portal-heading-color)]">Dark Theme Mode</p>
                <p className="mt-1 text-sm text-[var(--portal-copy-color)]">Set the renderer theme default for the full application.</p>
              </div>
              <Switch
                className={switchClassName}
                checked={draftConfig.theme.mode === "dark"}
                onCheckedChange={(checked) =>
                  setDraftConfig((current) => ({
                    ...current,
                    theme: { ...current.theme, mode: checked ? "dark" : "light" },
                    preferences: { ...current.preferences, theme: checked ? "dark" : "light" },
                  }))
                }
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--portal-heading-color)]">Portal Visibility</p>
              {[
                { key: "admin", label: "Admin Portal" },
                { key: "employee", label: "Employee Portal" },
                { key: "candidate", label: "Candidate Portal" },
              ].map((portal) => (
                <div key={portal.key} className="flex items-center justify-between rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] px-4 py-3">
                  <span className="text-sm text-[var(--portal-heading-color)]">{portal.label}</span>
                  <Switch
                    className={switchClassName}
                    checked={draftConfig.portalVisibility?.[portal.key] !== false}
                    onCheckedChange={(checked) => updatePortalVisibility(portal.key, checked)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--portal-heading-color)]">Runtime Labels</p>
              {EDITABLE_LABELS.map((item) => (
                <div key={item.key} className="space-y-2">
                  <Label className="text-[var(--portal-copy-color)]">{item.title}</Label>
                  <Input
                    value={draftConfig.labels?.[item.key] || ""}
                    onChange={(event) =>
                      setDraftConfig((current) => ({
                        ...current,
                        labels: {
                          ...(current.labels || {}),
                          [item.key]: event.target.value,
                        },
                      }))
                    }
                    className={fieldInputClassName}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card className={panelCardClassName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-[var(--portal-primary-solid)]" />
              Role Visibility Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {roleVisibilityMatrix.map((module) => (
              <div key={module.routeKey} className="rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[var(--portal-heading-color)]">{module.label}</p>
                    <p className="text-sm text-[var(--portal-copy-color)]">{module.routeKey}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {module.allowedAccessRoles.map((role) => (
                    <div key={`${module.routeKey}-${role}`} className={subRowCardClassName}>
                      <span className="text-sm text-[var(--portal-heading-color)]">{ROLE_LABELS[role]}</span>
                      <Switch
                        className={switchClassName}
                        checked={module.activeRoles.includes(role)}
                        onCheckedChange={(checked) => updateRoleVisibility(module.routeKey, role, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={panelCardClassName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[var(--portal-primary-solid)]" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--portal-surface-border)] px-4 py-8 text-center text-sm text-[var(--portal-copy-color)]">
                No recent activity logs available.
              </div>
            ) : (
              activityLogs.map((log) => (
                <div key={log._id} className="rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--portal-heading-color)]">{log.action}</p>
                      <p className="mt-1 text-sm text-[var(--portal-copy-color)]">{log.userName} • {log.userRole}</p>
                      <p className="mt-2 text-xs text-[var(--portal-muted-color)]">{log.details || "No additional details."}</p>
                    </div>
                    <span className="text-xs text-[var(--portal-muted-color)]">{formatLogTime(log.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
