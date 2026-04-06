import React from "react";
import { ShieldCheck, UserPlus, Users, UserRoundCheck, Briefcase, Trash2, Edit, Save, Filter } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/DataTable";
import FilterDrawer from "@/components/common/FilterDrawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import { destructiveIconButtonClass } from "@/lib/destructive";
import {
  apiService,
  type AuditLogItem,
  type ManagedUser,
  type PaginationMeta,
  type UserAccessRole,
  type UserActivityLog,
} from "@/services/api";

const ROLE_LABELS: Record<UserAccessRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr_manager: "HR Manager",
  recruiter: "Recruiter",
  employee: "Employee",
  candidate: "Candidate",
};

const ROLE_OPTIONS: UserAccessRole[] = ["super_admin", "admin", "hr_manager", "recruiter", "employee", "candidate"];

type EditUserFormState = {
  _id: string;
  name: string;
  email: string;
  accessRole: UserAccessRole;
  department: string;
  accountStatus: "active" | "disabled" | "pending";
};

type CandidateDashboardRow = {
  status?: string;
};

const emptyPermissions = {
  modules: {
    dashboard: true,
    candidateManagement: true,
    jobApplications: true,
    interviews: true,
    offerLetters: true,
    reportsAnalytics: true,
    payroll: false,
    userManagement: false,
  },
  actions: {
    viewCandidates: true,
    editCandidateStatus: false,
    sendInterviewEmails: false,
    uploadOfferLetters: false,
    manageUsers: false,
  },
  pageAccess: [] as string[],
};

const toInputDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "-");

const AdminUserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = React.useState<ManagedUser[]>([]);
  const [usersPagination, setUsersPagination] = React.useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [userSearch, setUserSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [departmentFilter, setDepartmentFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [activityFilter, setActivityFilter] = React.useState("");
  const [sortBy, setSortBy] = React.useState("createdAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [userFiltersOpen, setUserFiltersOpen] = React.useState(false);
  const [draftUserFilters, setDraftUserFilters] = React.useState({
    search: "",
    role: "",
    department: "",
    status: "",
    activity: "",
  });
  const [activities, setActivities] = React.useState<UserActivityLog[]>([]);
  const [activitiesPagination, setActivitiesPagination] = React.useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [activitySearch, setActivitySearch] = React.useState("");
  const [auditLogs, setAuditLogs] = React.useState<AuditLogItem[]>([]);
  const [auditPagination, setAuditPagination] = React.useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [auditSearch, setAuditSearch] = React.useState("");
  const [auditError, setAuditError] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState<EditUserFormState | null>(null);
  const [savingEditUser, setSavingEditUser] = React.useState(false);
  const [updatingUserImage, setUpdatingUserImage] = React.useState(false);
  const [inviteForm, setInviteForm] = React.useState({
    name: "",
    email: "",
    role: "hr_manager" as UserAccessRole,
    department: "",
    temporaryPassword: "",
  });
  const [candidatesCount, setCandidatesCount] = React.useState(0);
  const [pendingApplicationsCount, setPendingApplicationsCount] = React.useState(0);
  const [pageAccessInput, setPageAccessInput] = React.useState("");
  const [userToDelete, setUserToDelete] = React.useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = React.useState(false);

  const selectedUser = React.useMemo(
    () => users.find((u) => u._id === selectedUserId) || users[0] || null,
    [selectedUserId, users]
  );
  const selectedPermissions = selectedUser?.permissions || emptyPermissions;

  React.useEffect(() => {
    const value = (selectedPermissions.pageAccess || []).join(", ");
    setPageAccessInput(value);
  }, [selectedPermissions.pageAccess]);

  const fetchUsers = React.useCallback(async (page = usersPagination.page) => {
    setLoadingUsers(true);
    try {
      const data = await apiService.getManagedUsers({
        page,
        limit: usersPagination.limit,
        search: userSearch || undefined,
        role: roleFilter || undefined,
        department: departmentFilter || undefined,
        status: statusFilter || undefined,
        activity: activityFilter || undefined,
        sortBy,
        sortOrder,
      });
      setUsers(data.items);
      setUsersPagination(data.pagination);
      if (!selectedUserId && data.items.length > 0) {
        setSelectedUserId(data.items[0]._id);
      }
    } catch (error) {
      toast({ title: "Failed to load users", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoadingUsers(false);
    }
  }, [usersPagination.page, usersPagination.limit, userSearch, roleFilter, departmentFilter, statusFilter, activityFilter, sortBy, sortOrder, selectedUserId, toast]);

  const fetchActivities = React.useCallback(async (page = activitiesPagination.page) => {
    try {
      const data = await apiService.getUserActivities({
        page,
        limit: activitiesPagination.limit,
        search: activitySearch || undefined,
      });
      setActivities(data.items);
      setActivitiesPagination(data.pagination);
    } catch (error) {
      toast({ title: "Failed to load activity", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }, [activitiesPagination.page, activitiesPagination.limit, activitySearch, toast]);

  const fetchAuditLogs = React.useCallback(async (page = auditPagination.page) => {
    setAuditError("");
    try {
      const data = await apiService.getAuditLogs({
        page,
        limit: auditPagination.limit,
        search: auditSearch || undefined,
      });
      setAuditLogs(data.items);
      setAuditPagination(data.pagination);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      setAuditLogs([]);
      setAuditError(message);
      toast({ title: "Failed to load audit logs", description: message, variant: "destructive" });
    }
  }, [auditPagination.page, auditPagination.limit, auditSearch, toast]);

  const fetchDashboardCounts = React.useCallback(async () => {
    try {
      const candidates = await apiService.list<CandidateDashboardRow>("candidates");
      setCandidatesCount(candidates.length);
      setPendingApplicationsCount(
        candidates.filter((c) => c.status === "Applied" || c.status === "Under Review" || c.status === "Interview Scheduled").length
      );
    } catch {
      setCandidatesCount(0);
      setPendingApplicationsCount(0);
    }
  }, []);

  React.useEffect(() => {
    void fetchUsers(1);
  }, [fetchUsers, userSearch, roleFilter, departmentFilter, statusFilter, activityFilter, sortBy, sortOrder]);

  React.useEffect(() => {
    void fetchActivities(1);
  }, [activitySearch, fetchActivities]);

  React.useEffect(() => {
    void fetchAuditLogs(1);
  }, [auditSearch, fetchAuditLogs]);

  React.useEffect(() => {
    void fetchDashboardCounts();
  }, [fetchDashboardCounts]);

  const summaryStats = React.useMemo(() => {
    const totalUsers = usersPagination.total;
    const activeHr = users.filter((u) => u.accessRole === "hr_manager" && u.accountStatus === "active").length;
    const activeRecruiters = users.filter((u) => u.accessRole === "recruiter" && u.accountStatus === "active").length;
    return { totalUsers, activeHr, activeRecruiters };
  }, [users, usersPagination.total]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUser(true);
    try {
      await apiService.remove("users", userId);
      toast({ title: "User deleted" });
      await Promise.all([fetchUsers(usersPagination.page), fetchAuditLogs(1)]);
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setDeletingUser(false);
    }
  };

  const handleSecurityToggle = async (user: ManagedUser, key: "forcePasswordReset" | "twoFactorEnabled", value: boolean) => {
    try {
      await apiService.updateUserSecurity(user._id, {
        forcePasswordReset: key === "forcePasswordReset" ? value : Boolean(user.forcePasswordReset),
        twoFactorEnabled: key === "twoFactorEnabled" ? value : Boolean(user.twoFactorEnabled),
      });
      toast({ title: "Security settings updated" });
      await Promise.all([fetchUsers(usersPagination.page), fetchAuditLogs(1)]);
    } catch (error) {
      toast({ title: "Security update failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiService.inviteUser(inviteForm);
      toast({ title: "Invitation created", description: "User invitation saved. Send credentials via your configured mail service." });
      setInviteForm({ name: "", email: "", role: "hr_manager", department: "", temporaryPassword: "" });
      await Promise.all([fetchUsers(1), fetchAuditLogs(1)]);
    } catch (error) {
      toast({ title: "Invite failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    }
  };

  const handleEditClick = (user: ManagedUser) => {
    setEditForm({
      _id: user._id,
      name: user.name || "",
      email: user.email || "",
      accessRole: user.accessRole,
      department: user.department || "",
      accountStatus: user.accountStatus,
    });
    setEditDialogOpen(true);
  };

  const handleEditFormChange = <K extends keyof EditUserFormState>(key: K, value: EditUserFormState[K]) => {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditForm(null);
  };

  const handleUserImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editForm) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only JPG and PNG images are allowed.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Upload failed", description: "Image must be 2MB or smaller.", variant: "destructive" });
      event.target.value = "";
      return;
    }

    setUpdatingUserImage(true);
    try {
      await apiService.updateUserProfileImage(editForm._id, file);
      toast({ title: "Image updated successfully" });
      await fetchUsers(usersPagination.page);
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setUpdatingUserImage(false);
      event.target.value = "";
    }
  };

  const handleRemoveUserImage = async () => {
    if (!editForm) return;
    setUpdatingUserImage(true);
    try {
      await apiService.removeUserProfileImage(editForm._id);
      toast({ title: "Image removed successfully" });
      await fetchUsers(usersPagination.page);
    } catch (error) {
      toast({ title: "Remove failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setUpdatingUserImage(false);
    }
  };

  const handleEditSave = async () => {
    if (!editForm) return;
    const existingUser = users.find((user) => user._id === editForm._id);
    if (currentUser?.id === editForm._id && editForm.accessRole !== existingUser?.accessRole) {
      toast({ title: "Role update blocked", description: "You cannot change your own role from User Management.", variant: "destructive" });
      return;
    }
    if (currentUser?.id === editForm._id && editForm.accountStatus !== "active") {
      toast({ title: "Status update blocked", description: "You cannot disable your own account from User Management.", variant: "destructive" });
      return;
    }
    setSavingEditUser(true);
    try {
      await apiService.update("users", editForm._id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        accessRole: editForm.accessRole,
        department: editForm.department.trim(),
        accountStatus: editForm.accountStatus,
      });
      toast({ title: "User updated", description: "User details were saved successfully." });
      closeEditDialog();
      await Promise.all([fetchUsers(usersPagination.page), fetchAuditLogs(1)]);
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setSavingEditUser(false);
    }
  };

  const handlePermissionToggle = async (scope: "modules" | "actions", key: string, value: boolean) => {
    if (!selectedUser) return;
    const nextPermissions = {
      modules: { ...(selectedPermissions.modules || {}), ...(scope === "modules" ? { [key]: value } : {}) },
      actions: { ...(selectedPermissions.actions || {}), ...(scope === "actions" ? { [key]: value } : {}) },
      pageAccess: selectedPermissions.pageAccess || [],
    };
    try {
      await apiService.updateUserPermissions(selectedUser._id, nextPermissions);
      toast({ title: "Permissions updated" });
      await Promise.all([fetchUsers(usersPagination.page), fetchAuditLogs(1)]);
    } catch (error) {
      toast({ title: "Permission update failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    }
  };

  const activePageStart = (usersPagination.page - 1) * usersPagination.limit + 1;
  const activePageEnd = Math.min(usersPagination.page * usersPagination.limit, usersPagination.total);
  const activeFilterCount = [userSearch, roleFilter, departmentFilter, statusFilter, activityFilter].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle="Manage users, permissions, security, and audit visibility across Arihant Dream Infra Project Limited." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Users" value={summaryStats.totalUsers} change="All registered accounts" changeType="positive" icon={Users} color="primary" />
        <StatCard title="Active HR Staff" value={summaryStats.activeHr} change="HR Managers currently active" changeType="positive" icon={UserRoundCheck} color="success" />
        <StatCard title="Candidates Registered" value={candidatesCount} change="Candidate accounts" changeType="neutral" icon={UserPlus} color="info" />
        <StatCard title="Pending Applications" value={pendingApplicationsCount} change="Candidates under process" changeType="neutral" icon={Briefcase} color="warning" />
        <StatCard title="Active Recruiters" value={summaryStats.activeRecruiters} change="Recruiter accounts active" changeType="positive" icon={ShieldCheck} color="primary" />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="rbac">RBAC</TabsTrigger>
          <TabsTrigger value="invite">Add / Invite</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>User Directory</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">A cleaner directory with edit controls moved into the user profile modal.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" className="gap-2 rounded-xl border-slate-200 bg-white/90" onClick={() => setUserFiltersOpen(true)}>
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied` : "No filters applied"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto rounded-3xl border border-white/80 bg-white/90 shadow-card">
                <table className="w-full border-separate border-spacing-y-2">
                  <thead className="bg-muted/30">
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">User Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">
                        <button onClick={() => handleSort("accessRole")}>Role</button>
                      </th>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2">
                        <button onClick={() => handleSort("accountStatus")}>Account Status</button>
                      </th>
                      <th className="px-3 py-2">
                        <button onClick={() => handleSort("lastLoginAt")}>Last Login</button>
                      </th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id} className="text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50/80">
                        <td className="px-3 py-3 font-medium">{user.name}</td>
                        <td className="px-3 py-2">{user.email}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={ROLE_LABELS[user.accessRole]} />
                        </td>
                        <td className="px-3 py-2">{user.department || "-"}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={user.accountStatus === "disabled" ? "Inactive" : user.accountStatus} />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{toInputDate(user.lastLoginAt)}</td>
                        <td className="px-3 py-2">
                          <TooltipProvider delayDuration={100}>
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full bg-slate-100/70 hover:bg-slate-200/80" onClick={() => handleEditClick(user)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit User</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    className={`h-9 w-9 rounded-full ${destructiveIconButtonClass}`}
                                    onClick={() => setUserToDelete(user)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete User</TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  {usersPagination.total === 0 ? "No users found" : `Showing ${activePageStart}-${activePageEnd} of ${usersPagination.total}`}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={usersPagination.page <= 1} onClick={() => fetchUsers(usersPagination.page - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={usersPagination.page >= usersPagination.totalPages} onClick={() => fetchUsers(usersPagination.page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
              {loadingUsers && <p className="text-xs text-muted-foreground">Loading users...</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>User Activity Monitoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Search by user/action" value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} />
              <div className="space-y-2">
                {activities.map((item) => (
                  <div key={item._id} className="rounded-lg border border-border p-3 text-sm">
                    <p><span className="font-semibold">User:</span> {item.userName || item.userEmail}</p>
                    <p><span className="font-semibold">Action:</span> {item.action}</p>
                    <p><span className="font-semibold">Time:</span> {toInputDate(item.createdAt)}</p>
                    <p><span className="font-semibold">IP:</span> {item.ipAddress || "N/A"}</p>
                    {item.details ? <p className="text-muted-foreground">{item.details}</p> : null}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={activitiesPagination.page <= 1} onClick={() => fetchActivities(activitiesPagination.page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={activitiesPagination.page >= activitiesPagination.totalPages} onClick={() => fetchActivities(activitiesPagination.page + 1)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rbac">
          <Card>
            <CardHeader>
              <CardTitle>Role Based Access Control & Access Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>{u.name} ({ROLE_LABELS[u.accessRole]})</option>
                  ))}
                </select>
                {selectedUser ? <Input value={selectedUser.email} readOnly /> : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Module Access</p>
                {Object.entries(selectedPermissions.modules || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span>{key}</span>
                    <Switch checked={Boolean(value)} onCheckedChange={(checked) => handlePermissionToggle("modules", key, checked)} />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Feature Permissions</p>
                {Object.entries(selectedPermissions.actions || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span>{key}</span>
                    <Switch checked={Boolean(value)} onCheckedChange={(checked) => handlePermissionToggle("actions", key, checked)} />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Page Access (comma separated routes)</p>
                <Input value={pageAccessInput} onChange={(e) => setPageAccessInput(e.target.value)} placeholder="/admin/dashboard, /admin/candidates" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!selectedUser) return;
                    const nextPermissions = {
                      modules: { ...(selectedPermissions.modules || {}) },
                      actions: { ...(selectedPermissions.actions || {}) },
                      pageAccess: pageAccessInput
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    };
                    try {
                      await apiService.updateUserPermissions(selectedUser._id, nextPermissions);
                      toast({ title: "Page access updated" });
                      await Promise.all([fetchUsers(usersPagination.page), fetchAuditLogs(1)]);
                    } catch (error) {
                      toast({
                        title: "Page access update failed",
                        description: error instanceof Error ? error.message : "Try again",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Save Page Access
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <Card>
            <CardHeader>
              <CardTitle>Add / Invite User</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleInviteSubmit}>
                <Input placeholder="Name" value={inviteForm.name} onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))} required />
                <Input placeholder="Email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))} required />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={inviteForm.role} onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value as UserAccessRole }))}>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
                <Input placeholder="Department" value={inviteForm.department} onChange={(e) => setInviteForm((prev) => ({ ...prev, department: e.target.value }))} />
                <Input
                  placeholder="Temporary Password"
                  type="password"
                  value={inviteForm.temporaryPassword}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, temporaryPassword: e.target.value }))}
                  required
                />
                <div className="md:col-span-2">
                  <Button type="submit">
                    <UserPlus className="mr-1 h-4 w-4" />
                    Send Invitation
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Search audit action/actor/target" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />

              {auditError ? <p className="text-sm text-destructive">{auditError}</p> : null}

              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Actor</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Target</th>
                      <th className="px-3 py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length > 0 ? (
                      auditLogs.map((item) => (
                        <tr key={item._id} className="border-b border-border/80 text-sm">
                          <td className="px-3 py-2">{item.actorName || item.actorEmail || "System"}</td>
                          <td className="px-3 py-2 font-medium">{item.action || "-"}</td>
                          <td className="px-3 py-2">{item.targetType || item.targetId || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{toInputDate(item.createdAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                          {auditError ? "Unable to load audit logs." : "No audit logs found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={auditPagination.page <= 1} onClick={() => fetchAuditLogs(auditPagination.page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={auditPagination.page >= auditPagination.totalPages} onClick={() => fetchAuditLogs(auditPagination.page + 1)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={(open) => (!open ? closeEditDialog() : setEditDialogOpen(true))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editForm ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={(e) => handleEditFormChange("name", e.target.value)} placeholder="Name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={editForm.email} onChange={(e) => handleEditFormChange("email", e.target.value)} placeholder="Email" type="email" />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={editForm.accessRole}
                    onChange={(e) => handleEditFormChange("accessRole", e.target.value as UserAccessRole)}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input
                    value={editForm.department}
                    onChange={(e) => handleEditFormChange("department", e.target.value)}
                    placeholder="Department"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Account Access</p>
                    <p className="text-sm text-muted-foreground">Toggle user access here instead of cluttering the table row.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={editForm.accountStatus === "disabled" ? "disabled" : editForm.accountStatus} />
                    <Switch
                      checked={editForm.accountStatus === "active"}
                      onCheckedChange={(checked) => handleEditFormChange("accountStatus", checked ? "active" : "disabled")}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-foreground">Profile Image</p>
                <p className="mb-3 text-sm text-muted-foreground">Admin can update or remove this user's image.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={(event) => void handleUserImageChange(event)}
                    disabled={updatingUserImage}
                  />
                  <Button variant="destructive" type="button" onClick={() => void handleRemoveUserImage()} disabled={updatingUserImage}>
                    {updatingUserImage ? "Updating..." : "Remove Image"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={savingEditUser}>
              Cancel
            </Button>
            <Button onClick={() => void handleEditSave()} disabled={!editForm || savingEditUser}>
              <Save className="mr-1 h-4 w-4" />
              {savingEditUser ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilterDrawer
        isOpen={userFiltersOpen}
        onClose={() => setUserFiltersOpen(false)}
        values={draftUserFilters}
        onChange={(key, value) => setDraftUserFilters((prev) => ({ ...prev, [key]: value }))}
        onApply={(values) => {
          setUserSearch(values.search || "");
          setRoleFilter(values.role || "");
          setDepartmentFilter(values.department || "");
          setStatusFilter(values.status || "");
          setActivityFilter(values.activity || "");
        }}
        onReset={() => {
          const cleared = { search: "", role: "", department: "", status: "", activity: "" };
          setDraftUserFilters(cleared);
          setUserSearch("");
          setRoleFilter("");
          setDepartmentFilter("");
          setStatusFilter("");
          setActivityFilter("");
        }}
        filters={[
          { key: "search", label: "Search", type: "text", placeholder: "Search by user name or email" },
          {
            key: "role",
            label: "Role",
            type: "select",
            placeholder: "All roles",
            options: ROLE_OPTIONS.map((role) => ({ label: ROLE_LABELS[role], value: role })),
          },
          { key: "department", label: "Department", type: "text", placeholder: "Filter by department" },
          {
            key: "status",
            label: "Status",
            type: "select",
            placeholder: "All statuses",
            options: [
              { label: "Active", value: "active" },
              { label: "Pending", value: "pending" },
              { label: "Disabled", value: "disabled" },
            ],
          },
          { key: "activity", label: "Activity", type: "text", placeholder: "Filter by recent activity" },
        ]}
      />
      <DeleteConfirmDialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
        title="Delete User"
        description={`Are you sure you want to delete ${userToDelete?.name || "this user"}? This action cannot be undone.`}
        loading={deletingUser}
        onConfirm={() => {
          if (!userToDelete?._id) return;
          void handleDeleteUser(userToDelete._id).finally(() => setUserToDelete(null));
        }}
      />
    </div>
  );
};

export default AdminUserManagement;
