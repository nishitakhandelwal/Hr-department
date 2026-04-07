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
          <Card key={item.label} className="overflow-hidden border-white/10 bg-[linear-gradient(145deg,rgba(14,14,18,0.92),rgba(28,28,36,0.82))] text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold">{statsLoading ? "--" : item.value}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <item.icon className="h-6 w-6 text-[#d8b48a]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
        <Card className="border-white/10 bg-[linear-gradient(145deg,rgba(8,8,10,0.94),rgba(24,24,30,0.9))] text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-[#d8b48a]" />
              Feature Control Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FEATURE_TOGGLES.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="max-w-xl">
                  <p className="font-medium text-white">{getLabel(item.labelKey, item.key)}</p>
                  <p className="mt-1 text-sm text-white/55">{item.description}</p>
                </div>
                <Switch
                  checked={draftConfig.features?.[item.key] !== false}
                  onCheckedChange={(checked) => updateFeature(item.key, checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[linear-gradient(145deg,rgba(8,8,10,0.94),rgba(24,24,30,0.9))] text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Palette className="h-5 w-5 text-[#d8b48a]" />
              System Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">Primary Color</Label>
                <Input
                  value={draftConfig.theme.primaryColor}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      theme: { ...current.theme, primaryColor: event.target.value },
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Default Landing Page</Label>
                <Input
                  value={draftConfig.preferences.defaultDashboardPage}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      preferences: { ...current.preferences, defaultDashboardPage: event.target.value },
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div>
                <p className="font-medium text-white">Dark Theme Mode</p>
                <p className="mt-1 text-sm text-white/55">Set the renderer theme default for the full application.</p>
              </div>
              <Switch
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
              <p className="text-sm font-medium text-white/80">Portal Visibility</p>
              {[
                { key: "admin", label: "Admin Portal" },
                { key: "employee", label: "Employee Portal" },
                { key: "candidate", label: "Candidate Portal" },
              ].map((portal) => (
                <div key={portal.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-white">{portal.label}</span>
                  <Switch
                    checked={draftConfig.portalVisibility?.[portal.key] !== false}
                    onCheckedChange={(checked) => updatePortalVisibility(portal.key, checked)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-white/80">Runtime Labels</p>
              {EDITABLE_LABELS.map((item) => (
                <div key={item.key} className="space-y-2">
                  <Label className="text-white/70">{item.title}</Label>
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
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card className="border-white/10 bg-[linear-gradient(145deg,rgba(8,8,10,0.94),rgba(24,24,30,0.9))] text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Eye className="h-5 w-5 text-[#d8b48a]" />
              Role Visibility Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {roleVisibilityMatrix.map((module) => (
              <div key={module.routeKey} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{module.label}</p>
                    <p className="text-sm text-white/55">{module.routeKey}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {module.allowedAccessRoles.map((role) => (
                    <div key={`${module.routeKey}-${role}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <span className="text-sm text-white/80">{ROLE_LABELS[role]}</span>
                      <Switch
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

        <Card className="border-white/10 bg-[linear-gradient(145deg,rgba(8,8,10,0.94),rgba(24,24,30,0.9))] text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Activity className="h-5 w-5 text-[#d8b48a]" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/55">
                No recent activity logs available.
              </div>
            ) : (
              activityLogs.map((log) => (
                <div key={log._id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{log.action}</p>
                      <p className="mt-1 text-sm text-white/55">{log.userName} • {log.userRole}</p>
                      <p className="mt-2 text-xs text-white/45">{log.details || "No additional details."}</p>
                    </div>
                    <span className="text-xs text-white/45">{formatLogTime(log.createdAt)}</span>
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
