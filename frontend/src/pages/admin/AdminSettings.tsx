import React, { useMemo, useState } from "react";
import { Building2, Bell, LockKeyhole, Palette, Save, ShieldCheck, UserCircle, FileArchive, ClipboardList, RotateCcw, Download, SlidersHorizontal, Plus, Trash2 } from "lucide-react";
import ImageWithFallback from "@/components/common/ImageWithFallback";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiService, type RuntimeConfigPayload, type SettingsPayload } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useLabel, useSystemSettings } from "@/context/SystemSettingsContext";
import { destructiveIconButtonClass } from "@/lib/destructive";
import ProfileImageManager from "@/components/profile/ProfileImageManager";
import { resolveCompanyLogoUrl } from "@/lib/images";

type SettingsSection = "profile" | "company" | "roles" | "security" | "notifications" | "preferences" | "documents" | "audit" | "runtime";

const allModuleKeys = ["dashboard", "candidates", "employees", "attendance", "payroll", "letters", "departments", "userManagement", "settings"] as const;
const MAX_COMPANY_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_COMPANY_LOGO_TYPES = ["image/jpeg", "image/png"];
const DOCUMENT_FIELD_STATUS_OPTIONS = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "disabled", label: "Disabled" },
] as const;

const AdminSettings: React.FC = () => {
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const { refreshPublicSettings } = useSystemSettings();
  const pageTitle = useLabel("admin.settings.title");
  const pageSubtitle = useLabel("admin.settings.subtitle");
  const settingsCategoriesTitle = useLabel("admin.settings.categories");
  const profileNameLabel = useLabel("admin.settings.profile.name");
  const profileEmailLabel = useLabel("admin.settings.profile.email");
  const profilePhoneLabel = useLabel("admin.settings.profile.phone");
  const changePasswordSectionLabel = useLabel("admin.settings.profile.changePassword");
  const currentPasswordLabel = useLabel("admin.settings.profile.currentPassword");
  const newPasswordLabel = useLabel("admin.settings.profile.newPassword");
  const confirmPasswordLabel = useLabel("admin.settings.profile.confirmPassword");
  const profileSectionLabel = useLabel("admin.settings.section.profile");
  const companySectionLabel = useLabel("admin.settings.section.company");
  const rolesSectionLabel = useLabel("admin.settings.section.roles");
  const securitySectionLabel = useLabel("admin.settings.section.security");
  const notificationsSectionLabel = useLabel("admin.settings.section.notifications");
  const preferencesSectionLabel = useLabel("admin.settings.section.preferences");
  const documentsSectionLabel = useLabel("admin.settings.section.documents");
  const auditSectionLabel = useLabel("admin.settings.section.audit");
  const runtimeSectionLabel = useLabel("admin.settings.section.runtime");
  const companyNameLabel = useLabel("admin.settings.company.name");
  const companyContactEmailLabel = useLabel("admin.settings.company.contactEmail");
  const companyContactPhoneLabel = useLabel("admin.settings.company.contactPhone");
  const companyWebsiteLabel = useLabel("admin.settings.company.website");
  const companyAddressLabel = useLabel("admin.settings.company.address");
  const companyDescriptionLabel = useLabel("admin.settings.company.description");
  const companyLogoLabel = useLabel("admin.settings.company.logo");
  const companyLogoHelpLabel = useLabel("admin.settings.company.logo.help");
  const securityOtpLabel = useLabel("admin.settings.security.otp");
  const security2faLabel = useLabel("admin.settings.security.2fa");
  const securityMinLengthLabel = useLabel("admin.settings.security.minLength");
  const securitySessionTimeoutLabel = useLabel("admin.settings.security.sessionTimeout");
  const securityMaxAttemptsLabel = useLabel("admin.settings.security.maxAttempts");
  const securityPasswordPolicyLabel = useLabel("admin.settings.security.passwordPolicy");
  const securityUppercaseLabel = useLabel("admin.settings.security.uppercase");
  const securityNumberLabel = useLabel("admin.settings.security.number");
  const securitySpecialLabel = useLabel("admin.settings.security.special");
  const preferencesThemeLabel = useLabel("admin.settings.preferences.theme");
  const preferencesThemeLightLabel = useLabel("admin.settings.preferences.theme.light");
  const preferencesThemeDarkLabel = useLabel("admin.settings.preferences.theme.dark");
  const preferencesDefaultPageLabel = useLabel("admin.settings.preferences.defaultPage");
  const preferencesLanguageLabel = useLabel("admin.settings.preferences.language");
  const preferencesTimezoneLabel = useLabel("admin.settings.preferences.timezone");
  const preferencesDateFormatLabel = useLabel("admin.settings.preferences.dateFormat");
  const preferencesCurrencyFormatLabel = useLabel("admin.settings.preferences.currencyFormat");
  const documentsAllowedTypesLabel = useLabel("admin.settings.documents.allowedTypes");
  const documentsMaxUploadLabel = useLabel("admin.settings.documents.maxUpload");
  const documentsStorageLabel = useLabel("admin.settings.documents.storage");
  const documentsNamingLabel = useLabel("admin.settings.documents.naming");
  const auditLoggingLabel = useLabel("admin.settings.audit.logging");
  const auditRetentionLabel = useLabel("admin.settings.audit.retention");
  const auditExportLabel = useLabel("admin.settings.audit.export");
  const runtimeInfoLabel = useLabel("admin.settings.runtime.info");
  const runtimeJsonLabel = useLabel("admin.settings.runtime.json");
  const commonLoadingSettings = useLabel("common.loading.settings");
  const saveChangesLabel = useLabel("common.saveChanges");
  const resetSectionLabel = useLabel("common.resetSection");
  const cancelLabel = useLabel("common.cancel");
  const updatingPasswordLabel = useLabel("admin.settings.profile.updatingPassword");
  const changePasswordLabel = useLabel("admin.settings.profile.changePasswordButton");
  const savingLabel = useLabel("admin.settings.saving");
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
  const [runtimeConfigJson, setRuntimeConfigJson] = useState("");
  const [originalRuntimeConfigJson, setOriginalRuntimeConfigJson] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await apiService.getSettings();
        const runtimeConfig = await apiService.getConfig();
        setSettings(data.settings);
        setDefaults(data.defaults);
        setOriginalSettings(JSON.parse(JSON.stringify(data.settings)));
        const runtimeConfigText = JSON.stringify(runtimeConfig, null, 2);
        setRuntimeConfigJson(runtimeConfigText);
        setOriginalRuntimeConfigJson(runtimeConfigText);
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

  const sectionItems = useMemo<Array<{ key: SettingsSection; label: string; icon: React.ElementType }>>(
    () => [
      { key: "profile", label: profileSectionLabel, icon: UserCircle },
      { key: "company", label: companySectionLabel, icon: Building2 },
      { key: "roles", label: rolesSectionLabel, icon: ShieldCheck },
      { key: "security", label: securitySectionLabel, icon: LockKeyhole },
      { key: "notifications", label: notificationsSectionLabel, icon: Bell },
      { key: "preferences", label: preferencesSectionLabel, icon: Palette },
      { key: "documents", label: documentsSectionLabel, icon: FileArchive },
      { key: "audit", label: auditSectionLabel, icon: ClipboardList },
      { key: "runtime", label: runtimeSectionLabel, icon: SlidersHorizontal },
    ],
    [
      profileSectionLabel,
      companySectionLabel,
      rolesSectionLabel,
      securitySectionLabel,
      notificationsSectionLabel,
      preferencesSectionLabel,
      documentsSectionLabel,
      auditSectionLabel,
      runtimeSectionLabel,
    ],
  );

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
    if (activeSection === "runtime") {
      setRuntimeConfigJson(originalRuntimeConfigJson);
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
    if (activeSection === "runtime") {
      try {
        JSON.parse(runtimeConfigJson);
      } catch {
        return "Runtime config JSON is invalid.";
      }
      return "";
    }
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
      if (!settings.documents.candidateFields.length) return "At least one candidate document field is required.";
      if (!settings.documents.certificateTypes.length) return "At least one certificate type is required.";
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
      if (activeSection === "runtime") {
        const parsed = JSON.parse(runtimeConfigJson) as Partial<RuntimeConfigPayload>;
        const runtimeConfig = await apiService.updateConfig(parsed);
        const runtimeConfigText = JSON.stringify(runtimeConfig, null, 2);
        setRuntimeConfigJson(runtimeConfigText);
        setOriginalRuntimeConfigJson(runtimeConfigText);
        toast({ title: "Runtime config saved successfully" });
        await refreshProfile();
        await refreshPublicSettings();
        return;
      }
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
    return <div className="text-sm text-muted-foreground">{commonLoadingSettings}</div>;
  }

  const addCandidateDocumentField = () => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            documents: {
              ...prev.documents,
              candidateFields: [
                ...prev.documents.candidateFields,
                {
                  fieldId: `document-${prev.documents.candidateFields.length + 1}`,
                  label: `Document ${prev.documents.candidateFields.length + 1}`,
                  status: "optional",
                },
              ],
            },
          }
        : prev
    );
  };

  const updateCandidateDocumentField = (
    index: number,
    patch: Partial<SettingsPayload["documents"]["candidateFields"][number]>
  ) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            documents: {
              ...prev.documents,
              candidateFields: prev.documents.candidateFields.map((field, fieldIndex) =>
                fieldIndex === index ? { ...field, ...patch } : field
              ),
            },
          }
        : prev
    );
  };

  const removeCandidateDocumentField = (index: number) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            documents: {
              ...prev.documents,
              candidateFields: prev.documents.candidateFields.filter((_, fieldIndex) => fieldIndex !== index),
            },
          }
        : prev
    );
  };

  const addCertificateType = () => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            documents: {
              ...prev.documents,
              certificateTypes: [
                ...prev.documents.certificateTypes,
                {
                  typeId: `certificate-type-${prev.documents.certificateTypes.length + 1}`,
                  label: `Certificate Type ${prev.documents.certificateTypes.length + 1}`,
                },
              ],
            },
          }
        : prev
    );
  };

  const updateCertificateType = (
    index: number,
    patch: Partial<SettingsPayload["documents"]["certificateTypes"][number]>
  ) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            documents: {
              ...prev.documents,
              certificateTypes: prev.documents.certificateTypes.map((entry, entryIndex) =>
                entryIndex === index ? { ...entry, ...patch } : entry
              ),
            },
          }
        : prev
    );
  };

  const removeCertificateType = (index: number) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            documents: {
              ...prev.documents,
              certificateTypes: prev.documents.certificateTypes.filter((_, entryIndex) => entryIndex !== index),
            },
          }
        : prev
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{settingsCategoriesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {sectionItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                  activeSection === item.key
                    ? "border-[rgba(166,124,82,0.22)] bg-[linear-gradient(135deg,rgba(230,199,163,0.24),rgba(166,124,82,0.12))] text-[#A67C52] shadow-[0_10px_24px_rgba(166,124,82,0.12)]"
                    : "border-transparent text-foreground hover:border-[rgba(166,124,82,0.14)] hover:bg-[rgba(230,199,163,0.12)]"
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
                    <Label>{profileNameLabel}</Label>
                    <Input value={profile.name} onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{profileEmailLabel}</Label>
                    <Input type="email" value={profile.email} onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{profilePhoneLabel}</Label>
                    <Input value={profile.phone} onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))} />
                  </div>
                </div>
                <ProfileImageManager
                  name={profile.name || "Admin"}
                  imageUrl={profile.profileImage || profile.profilePhotoUrl}
                  onUpload={async (file) => {
                    try {
                      const updated = await apiService.updateMyProfilePhoto(file);
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
                      toast({ title: "Profile image updated" });
                    } catch (error) {
                      toast({
                        title: "Profile image upload failed",
                        description: error instanceof Error ? error.message : "Unable to update profile image.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onRemove={async () => {
                    try {
                      const updated = await apiService.removeMyProfilePhoto();
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
                      toast({ title: "Profile image removed" });
                    } catch (error) {
                      toast({
                        title: "Profile image removal failed",
                        description: error instanceof Error ? error.message : "Unable to remove profile image.",
                        variant: "destructive",
                      });
                    }
                  }}
                />

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">{changePasswordSectionLabel}</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Input type="password" placeholder={currentPasswordLabel} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))} />
                    <Input type="password" placeholder={newPasswordLabel} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} />
                    <Input type="password" placeholder={confirmPasswordLabel} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
                  </div>
                  <Button type="button" variant="outline" disabled={passwordSaving} onClick={() => void changePassword()}>
                    {passwordSaving ? updatingPasswordLabel : changePasswordLabel}
                  </Button>
                </div>
              </div>
            ) : null}

            {activeSection === "company" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5"><Label>{companyNameLabel}</Label><Input value={settings.company.companyName} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, companyName: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{companyContactEmailLabel}</Label><Input value={settings.company.contactEmail} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, contactEmail: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{companyContactPhoneLabel}</Label><Input value={settings.company.contactPhone} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, contactPhone: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{companyWebsiteLabel}</Label><Input value={settings.company.website} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, website: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label>{companyAddressLabel}</Label><Textarea value={settings.company.address} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, address: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label>{companyDescriptionLabel}</Label><Textarea value={settings.company.description} onChange={(e) => setSettings((prev) => (prev ? { ...prev, company: { ...prev.company, description: e.target.value } } : prev))} /></div>
                <div className="space-y-3 md:col-span-2">
                  <Label>{companyLogoLabel}</Label>
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
                      <p className="text-xs text-muted-foreground">{companyLogoHelpLabel}</p>
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
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span className="text-sm">{securityOtpLabel}</span><Switch checked={settings.security.otpLoginEnabled} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, otpLoginEnabled: checked } } : prev))} /></div>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span className="text-sm">{security2faLabel}</span><Switch checked={settings.security.twoFactorEnforced} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, twoFactorEnforced: checked } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{securityMinLengthLabel}</Label><Input type="number" value={settings.security.passwordPolicy.minLength} onChange={(e) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, passwordPolicy: { ...prev.security.passwordPolicy, minLength: Number(e.target.value || 8) } } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{securitySessionTimeoutLabel}</Label><Input type="number" value={settings.security.sessionTimeoutMinutes} onChange={(e) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, sessionTimeoutMinutes: Number(e.target.value || 60) } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{securityMaxAttemptsLabel}</Label><Input type="number" value={settings.security.maxLoginAttempts} onChange={(e) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, maxLoginAttempts: Number(e.target.value || 5) } } : prev))} /></div>
                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{securityPasswordPolicyLabel}</p>
                  <div className="flex items-center justify-between"><span className="text-sm">{securityUppercaseLabel}</span><Switch checked={settings.security.passwordPolicy.requireUppercase} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, passwordPolicy: { ...prev.security.passwordPolicy, requireUppercase: checked } } } : prev))} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">{securityNumberLabel}</span><Switch checked={settings.security.passwordPolicy.requireNumber} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, passwordPolicy: { ...prev.security.passwordPolicy, requireNumber: checked } } } : prev))} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">{securitySpecialLabel}</span><Switch checked={settings.security.passwordPolicy.requireSpecial} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, security: { ...prev.security, passwordPolicy: { ...prev.security.passwordPolicy, requireSpecial: checked } } } : prev))} /></div>
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
                <div className="space-y-1.5"><Label>{preferencesThemeLabel}</Label><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={settings.preferences.theme} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, theme: e.target.value as "light" | "dark" } } : prev))}><option value="light">{preferencesThemeLightLabel}</option><option value="dark">{preferencesThemeDarkLabel}</option></select></div>
                <div className="space-y-1.5"><Label>{preferencesDefaultPageLabel}</Label><Input value={settings.preferences.defaultDashboardPage} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, defaultDashboardPage: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{preferencesLanguageLabel}</Label><Input value={settings.preferences.language} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, language: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{preferencesTimezoneLabel}</Label><Input value={settings.preferences.timezone} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, timezone: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{preferencesDateFormatLabel}</Label><Input value={settings.preferences.dateFormat} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, dateFormat: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{preferencesCurrencyFormatLabel}</Label><Input value={settings.preferences.currencyFormat} onChange={(e) => setSettings((prev) => (prev ? { ...prev, preferences: { ...prev.preferences, currencyFormat: e.target.value.toUpperCase() } } : prev))} /></div>
              </div>
            ) : null}

            {activeSection === "documents" ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2"><Label>{documentsAllowedTypesLabel}</Label><Input value={settings.documents.allowedFileTypes.join(",")} onChange={(e) => setSettings((prev) => (prev ? { ...prev, documents: { ...prev.documents, allowedFileTypes: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{documentsMaxUploadLabel}</Label><Input type="number" value={settings.documents.maxUploadSizeMb} onChange={(e) => setSettings((prev) => (prev ? { ...prev, documents: { ...prev.documents, maxUploadSizeMb: Number(e.target.value || 10) } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{documentsStorageLabel}</Label><Input value={settings.documents.storageLocation} onChange={(e) => setSettings((prev) => (prev ? { ...prev, documents: { ...prev.documents, storageLocation: e.target.value } } : prev))} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label>{documentsNamingLabel}</Label><Input value={settings.documents.namingFormat} onChange={(e) => setSettings((prev) => (prev ? { ...prev, documents: { ...prev.documents, namingFormat: e.target.value } } : prev))} /></div>
                </div>

                <div className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Candidate document fields</p>
                      <p className="text-xs text-muted-foreground">Only enabled fields appear in the candidate documents page.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={addCandidateDocumentField}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {settings.documents.candidateFields.map((field, index) => {
                      const isCoreField = field.fieldId === "resume" || field.fieldId === "certificates";
                      return (
                        <div key={`${field.fieldId}-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_1.2fr_180px_auto] md:items-end">
                          <div className="space-y-1.5">
                            <Label>Field ID</Label>
                            <Input
                              value={field.fieldId}
                              disabled={isCoreField}
                              onChange={(e) =>
                                updateCandidateDocumentField(index, {
                                  fieldId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Label</Label>
                            <Input
                              value={field.label}
                              onChange={(e) => updateCandidateDocumentField(index, { label: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Status</Label>
                            <select
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              value={field.status}
                              onChange={(e) =>
                                updateCandidateDocumentField(index, {
                                  status: e.target.value as SettingsPayload["documents"]["candidateFields"][number]["status"],
                                })
                              }
                            >
                              {DOCUMENT_FIELD_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className={destructiveIconButtonClass}
                              onClick={() => removeCandidateDocumentField(index)}
                              disabled={isCoreField}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Certificate types</p>
                      <p className="text-xs text-muted-foreground">Candidates must choose one of these types before uploading a certificate file.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={addCertificateType}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Type
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {settings.documents.certificateTypes.map((entry, index) => (
                      <div key={`${entry.typeId}-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
                        <div className="space-y-1.5">
                          <Label>Type ID</Label>
                          <Input
                            value={entry.typeId}
                            onChange={(e) =>
                              updateCertificateType(index, {
                                typeId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Label</Label>
                          <Input
                            value={entry.label}
                            onChange={(e) => updateCertificateType(index, { label: e.target.value })}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            className={destructiveIconButtonClass}
                            onClick={() => removeCertificateType(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "audit" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span className="text-sm">{auditLoggingLabel}</span><Switch checked={settings.audit.loggingEnabled} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, audit: { ...prev.audit, loggingEnabled: checked } } : prev))} /></div>
                <div className="space-y-1.5"><Label>{auditRetentionLabel}</Label><Input type="number" value={settings.audit.retentionDays} onChange={(e) => setSettings((prev) => (prev ? { ...prev, audit: { ...prev.audit, retentionDays: Number(e.target.value || 180) } } : prev))} /></div>
                <div className="md:col-span-2">
                  <Button variant="outline" onClick={() => void exportAuditLogs()}>
                    <Download className="mr-2 h-4 w-4" /> {auditExportLabel}
                  </Button>
                </div>
              </div>
            ) : null}

            {activeSection === "runtime" ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {runtimeInfoLabel}
                </div>
                <div className="space-y-1.5">
                  <Label>{runtimeJsonLabel}</Label>
                  <Textarea value={runtimeConfigJson} onChange={(e) => setRuntimeConfigJson(e.target.value)} className="min-h-[520px] font-mono text-xs" />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveSection()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? savingLabel : saveChangesLabel}
              </Button>
              <Button type="button" variant="outline" onClick={resetSection}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {resetSectionLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
