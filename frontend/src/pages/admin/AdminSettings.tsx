import React, { useMemo, useState } from "react";
import { Building2, Bell, LockKeyhole, Palette, Save, ShieldCheck, UserCircle, FileArchive, ClipboardList, RotateCcw, Download } from "lucide-react";
import ImageWithFallback from "@/components/common/ImageWithFallback";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiService, type SettingsPayload } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useSystemSettings } from "@/context/SystemSettingsContext";
import ProfileImageManager from "@/components/profile/ProfileImageManager";
import { resolveCompanyLogoUrl } from "@/lib/images";

type SettingsSection = "profile" | "company" | "roles" | "security" | "notifications" | "preferences" | "documents" | "audit";

const sectionItems: Array<{ key: SettingsSection; label: string; icon: React.ElementType }> = [
  { key: "profile", label: "Profile Settings", icon: UserCircle },
  { key: "company", label: "Company Settings", icon: Building2 },
  { key: "roles", label: "Role & Permissions", icon: ShieldCheck },
  { key: "security", label: "Security", icon: LockKeyhole },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "preferences", label: "System Preferences", icon: Palette },
  { key: "documents", label: "Document Settings", icon: FileArchive },
  { key: "audit", label: "Audit & Activity", icon: ClipboardList },
];

const allModuleKeys = ["dashboard", "candidates", "employees", "attendance", "payroll", "letters", "departments", "userManagement", "settings"] as const;
const MAX_COMPANY_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_COMPANY_LOGO_TYPES = ["image/jpeg", "image/png"];

const AdminSettings: React.FC = () => {
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const { refreshPublicSettings } = useSystemSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<File | null>(null);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", profilePhotoUrl: "", profileImage: "" });
  const [originalProfile, setOriginalProfile] = useState({ name: "", email: "", phone: "", profilePhotoUrl: "", profileImage: "" });
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [defaults, setDefaults] = useState<SettingsPayload | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SettingsPayload | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await apiService.getSettings();
        setSettings(data.settings);
        setDefaults(data.defaults);
        setOriginalSettings(JSON.parse(JSON.stringify(data.settings)));
        const initialProfile = {
          name: data.profile.name || "",
          email: data.profile.email || "",
          phone: data.profile.phone || "",
          profilePhotoUrl: data.profile.profilePhotoUrl || "",
          profileImage: data.profile.profileImage || data.profile.profilePhotoUrl || "",
        };
        setProfile(initialProfile);
        setOriginalProfile(initialProfile);
      } catch (error) {
        toast({ title: "Failed to load settings", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const roleKeys = useMemo(() => (settings ? (Object.keys(settings.rolePermissions) as Array<keyof SettingsPayload["rolePermissions"]>) : []), [settings]);
  const companyLogoPreview = useMemo(() => (companyLogo ? URL.createObjectURL(companyLogo) : ""), [companyLogo]);
  const currentCompanyLogo = companyLogoPreview || resolveCompanyLogoUrl(settings?.company.companyLogoUrl);

  React.useEffect(() => {
    return () => {
      if (companyLogoPreview) URL.revokeObjectURL(companyLogoPreview);
    };
  }, [companyLogoPreview]);

  const resetSection = () => {
    if (!originalSettings || !settings) return;
    if (activeSection === "profile") {
      setProfile(originalProfile);
      return;
    }
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
    setCompanyLogo(null);
  };

  const validateCompanyLogoFile = (file: File) => {
    if (!ALLOWED_COMPANY_LOGO_TYPES.includes(file.type)) return "Upload a JPG or PNG logo.";
    if (file.size > MAX_COMPANY_LOGO_SIZE_BYTES) return "Company logo must be 5MB or smaller.";
    return "";
  };

  const runSectionValidation = (): string => {
    if (!settings) return "Settings not loaded.";
    if (activeSection === "company" && !settings.company.companyName.trim()) return "Company name is required.";
    if (activeSection === "security") {
      if (settings.security.passwordPolicy.minLength < 6) return "Password minimum length must be at least 6.";
      if (settings.security.sessionTimeoutMinutes < 5) return "Session timeout must be at least 5 minutes.";
      if (settings.security.maxLoginAttempts < 1) return "Max login attempts must be at least 1.";
    }
    if (activeSection === "documents") {
      if (settings.documents.allowedFileTypes.length === 0) return "At least one file type is required.";
      if (settings.documents.maxUploadSizeMb < 1) return "Max upload size must be at least 1 MB.";
      if (!settings.documents.storageLocation.trim()) return "Storage location is required.";
    }
    if (activeSection === "audit" && settings.audit.retentionDays < 1) return "Retention days must be at least 1.";
    return "";
  };

  const saveSection = async () => {
    if (!settings) return;
    const validationError = runSectionValidation();
    if (validationError) {
      toast({ title: "Validation error", description: validationError, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (activeSection === "profile") {
        const updatedProfile = await apiService.updateProfile(
          { name: profile.name, email: profile.email, phone: profile.phone }
        );
        const freshProfile = {
          name: updatedProfile.name || "",
          email: updatedProfile.email || "",
          phone: updatedProfile.phone || "",
          profilePhotoUrl: updatedProfile.profilePhotoUrl || "",
          profileImage: updatedProfile.profileImage || updatedProfile.profilePhotoUrl || "",
        };
        setProfile(freshProfile);
        setOriginalProfile(freshProfile);
        toast({ title: "Profile updated" });
        await refreshProfile();
        return;
      }

      let updated: SettingsPayload = settings;
      if (activeSection === "company") {
        const company = await apiService.updateCompanySettings(settings.company, companyLogo || undefined);
        updated = { ...settings, company };
      }
      if (activeSection === "roles") {
        const rolePermissions = await apiService.updateRbacSettings(settings.rolePermissions);
        updated = { ...settings, rolePermissions };
      }
      if (activeSection === "security") {
        const security = await apiService.updateSecuritySettings(settings.security);
        updated = { ...settings, security };
      }
      if (activeSection === "notifications") {
        const notifications = await apiService.updateNotificationSettings(settings.notifications);
        updated = { ...settings, notifications };
      }
      if (activeSection === "preferences") {
        const preferences = await apiService.updatePreferenceSettings(settings.preferences);
        updated = { ...settings, preferences };
      }
      if (activeSection === "documents") {
        const documents = await apiService.updateDocumentSettings(settings.documents);
        updated = { ...settings, documents };
      }
      if (activeSection === "audit") {
        const audit = await apiService.updateAuditSettings(settings.audit);
        updated = { ...settings, audit };
      }

      setSettings(updated);
      setOriginalSettings(JSON.parse(JSON.stringify(updated)));
      setCompanyLogo(null);
      toast({ title: "Settings saved successfully" });
      await refreshProfile();
      await refreshPublicSettings();
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Validation error", description: "New password and confirm password must match.", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      const response = await apiService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast({ title: "Password updated", description: response.message });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast({ title: "Password change failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!window.confirm("Reset all settings to defaults? This action cannot be undone.")) return;
    setSaving(true);
    try {
      const data = await apiService.resetSettingsToDefaults();
      setSettings(data);
      setOriginalSettings(JSON.parse(JSON.stringify(data)));
      setDefaults(data);
      toast({ title: "Settings reset to default values" });
      await refreshProfile();
      await refreshPublicSettings();
    } catch (error) {
      toast({ title: "Reset failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const exportAuditLogs = async () => {
    try {
      const blob = await apiService.exportAuditLogs();
      const url = URL.createObjectURL(new Blob([blob], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-logs.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Audit logs export started" });
    } catch (error) {
      toast({ title: "Export failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    }
  };

  if (loading || !settings) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Centralized runtime configuration for profile, company, security, notifications, uploads, and audit behavior." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Settings Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {sectionItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeSection === item.key ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{sectionItems.find((item) => item.key === activeSection)?.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {activeSection === "profile" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Full Name *</Label>
                    <Input value={profile.name} onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input type="email" value={profile.email} onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone Number</Label>
                    <Input value={profile.phone} onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))} />
                  </div>
                </div>
                <ProfileImageManager
                  name={profile.name || "Admin"}
                  imageUrl={profile.profileImage || profile.profilePhotoUrl}
                  onUpload={async (file) => {
                    const updated = await apiService.updateMyProfilePhoto(file);
                    console.log("Uploaded URL:", updated.profileImage || updated.profilePhotoUrl || "");
                    console.log("Saved user:", updated);
                    const nextProfile = {
                      name: updated.name || profile.name,
                      email: updated.email || profile.email,
                      phone: updated.phone || profile.phone,
                      profilePhotoUrl: updated.profilePhotoUrl || "",
                      profileImage: updated.profileImage || updated.profilePhotoUrl || "",
                    };
                    setProfile(nextProfile);
                    setOriginalProfile(nextProfile);
                    await refreshProfile();
                  }}
                  onRemove={async () => {
                    const updated = await apiService.removeMyProfilePhoto();
                    console.log("Saved user:", updated);
                    const nextProfile = {
                      name: updated.name || profile.name,
                      email: updated.email || profile.email,
                      phone: updated.phone || profile.phone,
                      profilePhotoUrl: updated.profilePhotoUrl || "",
                      profileImage: updated.profileImage || updated.profilePhotoUrl || "",
                    };
                    setProfile(nextProfile);
                    setOriginalProfile(nextProfile);
                    await refreshProfile();
                  }}
                />

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">Change Password</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Input type="password" placeholder="Current Password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))} />
                    <Input type="password" placeholder="New Password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} />
                    <Input type="password" placeholder="Confirm Password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
                  </div>
                  <Button type="button" variant="outline" disabled={passwordSaving} onClick={() => void changePassword()}>
                    {passwordSaving ? "Updating..." : "Change Password"}
                  </Button>
                </div>
              </div>
            ) : null}

            {activeSection === "company" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5"><Label>Company Name *</Label><Input value={settings.company.companyName} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, companyName: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Contact Email</Label><Input value={settings.company.contactEmail} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, contactEmail: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={settings.company.contactPhone} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, contactPhone: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Website</Label><Input value={settings.company.website} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, website: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label>Address</Label><Textarea value={settings.company.address} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, address: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label>Description</Label><Textarea value={settings.company.description} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, description: e.target.value } } : prev))} /></div>
                <div className="space-y-3 md:col-span-2">
                  <Label>Company Logo Upload</Label>
                  <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                      <ImageWithFallback src={currentCompanyLogo} alt="Company logo preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        type="file"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (!file) {
                            setCompanyLogo(null);
                            return;
                          }
                          const error = validateCompanyLogoFile(file);
                          if (error) {
                            toast({ title: "Upload failed", description: error, variant: "destructive" });
                            e.target.value = "";
                            setCompanyLogo(null);
                            return;
                          }
                          setCompanyLogo(file);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Use a square JPG or PNG up to 5MB for the cleanest result.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "roles" ? (
              <div className="space-y-4">
                {roleKeys.map((role) => (
                  <div key={role} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-sm font-semibold capitalize">{String(role).replace("_", " ")}</p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {allModuleKeys.map((moduleKey) => (
                        <div key={`${role}-${moduleKey}`} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                          <span className="text-sm capitalize">{moduleKey}</span>
                          <Switch
                            checked={Boolean(settings.rolePermissions[role][moduleKey])}
                            onCheckedChange={(checked) =>
                              setSettings((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      rolePermissions: {
                                        ...prev.rolePermissions,
                                        [role]: { ...prev.rolePermissions[role], [moduleKey]: checked },
                                      },
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeSection === "security" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span className="text-sm">Enable OTP Login</span><Switch checked={settings.security.otpLoginEnabled} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, otpLoginEnabled: checked } } : prev))} /></div>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span className="text-sm">Enforce 2FA for Admin</span><Switch checked={settings.security.twoFactorEnforced} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, twoFactorEnforced: checked } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Password Minimum Length</Label><Input type="number" value={settings.security.passwordPolicy.minLength} onChange={(e) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, passwordPolicy: { ...prev.security.passwordPolicy, minLength: Number(e.target.value || 8) } } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Session Timeout (minutes)</Label><Input type="number" value={settings.security.sessionTimeoutMinutes} onChange={(e) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, sessionTimeoutMinutes: Number(e.target.value || 60) } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Maximum Login Attempts</Label><Input type="number" value={settings.security.maxLoginAttempts} onChange={(e) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, maxLoginAttempts: Number(e.target.value || 5) } } : prev))} /></div>
                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-medium">Password Policy</p>
                  <div className="flex items-center justify-between"><span className="text-sm">Require Uppercase</span><Switch checked={settings.security.passwordPolicy.requireUppercase} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, passwordPolicy: { ...prev.security.passwordPolicy, requireUppercase: checked } } } : prev))} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">Require Number</span><Switch checked={settings.security.passwordPolicy.requireNumber} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, passwordPolicy: { ...prev.security.passwordPolicy, requireNumber: checked } } } : prev))} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">Require Special Character</span><Switch checked={settings.security.passwordPolicy.requireSpecial} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, passwordPolicy: { ...prev.security.passwordPolicy, requireSpecial: checked } } } : prev))} /></div>
                </div>
              </div>
            ) : null}

            {activeSection === "notifications" ? (
              <div className="space-y-2">
                {Object.entries(settings.notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm">{key}</span>
                    <Switch checked={Boolean(value)} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, notifications: { ...prev.notifications, [key]: checked } } : prev))} />
                  </div>
                ))}
              </div>
            ) : null}

            {activeSection === "preferences" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5"><Label>Theme</Label><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={settings.preferences.theme} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, theme: e.target.value as "light" | "dark" } } : prev))}><option value="light">Light</option><option value="dark">Dark</option></select></div>
                <div className="space-y-1.5"><Label>Default Dashboard Page</Label><Input value={settings.preferences.defaultDashboardPage} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, defaultDashboardPage: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Language</Label><Input value={settings.preferences.language} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, language: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Timezone</Label><Input value={settings.preferences.timezone} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, timezone: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Date Format</Label><Input value={settings.preferences.dateFormat} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, dateFormat: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Currency Format</Label><Input value={settings.preferences.currencyFormat} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, currencyFormat: e.target.value.toUpperCase() } } : prev))} /></div>
              </div>
            ) : null}

            {activeSection === "documents" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2"><Label>Allowed File Types (comma separated MIME types)</Label><Input value={settings.documents.allowedFileTypes.join(",")} onChange={(e) => setSettings((prev) => (prev ? { ...prev, documents: { ...prev.documents, allowedFileTypes: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Maximum Upload Size (MB)</Label><Input type="number" value={settings.documents.maxUploadSizeMb} onChange={(e) => setSettings((prev) => (prev ? { ...prev, documents: { ...prev.documents, maxUploadSizeMb: Number(e.target.value || 10) } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Storage Location</Label><Input value={settings.documents.storageLocation} onChange={(e) => setSettings((prev) => (prev ? { ...prev, documents: { ...prev.documents, storageLocation: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label>Naming Format</Label><Input value={settings.documents.namingFormat} onChange={(e) => setSettings((prev) => (prev ? { ...prev, documents: { ...prev.documents, namingFormat: e.target.value } } : prev))} /></div>
              </div>
            ) : null}

            {activeSection === "audit" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span className="text-sm">Enable Logging</span><Switch checked={settings.audit.loggingEnabled} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, audit: { ...prev.audit, loggingEnabled: checked } } : prev))} /></div>
                <div className="space-y-1.5"><Label>Log Retention Duration (days)</Label><Input type="number" value={settings.audit.retentionDays} onChange={(e) => setSettings((prev) => (prev ? { ...prev, audit: { ...prev.audit, retentionDays: Number(e.target.value || 180) } } : prev))} /></div>
                <div className="md:col-span-2">
                  <Button variant="outline" onClick={() => void exportAuditLogs()}>
                    <Download className="mr-2 h-4 w-4" /> Export Logs
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveSection()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
