import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileText,
  FolderOpen,
  Layers3,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserCheck,
  UserCircle,
  Users,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import ImageWithFallback from "@/components/common/ImageWithFallback";
import ProfileAvatar from "@/components/common/ProfileAvatar";
import { useAuth } from "@/context/AuthContext";
import { useSystemSettings } from "@/context/SystemSettingsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { resolveCompanyLogoUrl } from "@/lib/images";
import { apiService, isUnauthorizedError, type NotificationItem } from "@/services/api";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  moduleKey?: string;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { label: "Profile", path: "/admin/profile", icon: UserCircle },
  { label: "Candidates", path: "/admin/candidates", icon: UserCheck, moduleKey: "candidates" },
  { label: "Internships", path: "/admin/internships", icon: Briefcase, moduleKey: "candidates" },
  { label: "Joining Forms", path: "/admin/joining-forms", icon: ClipboardCheck, moduleKey: "candidates" },
  { label: "Employees", path: "/admin/employees", icon: Users, moduleKey: "employees" },
  { label: "Attendance", path: "/admin/attendance", icon: Clock, moduleKey: "attendance" },
  { label: "Leave", path: "/admin/leave", icon: CalendarDays, moduleKey: "candidates" },
  { label: "Payroll", path: "/admin/payroll", icon: DollarSign, moduleKey: "payroll" },
  { label: "Letters", path: "/admin/letters", icon: FileText, moduleKey: "letters" },
  { label: "Departments", path: "/admin/departments", icon: Building2, moduleKey: "departments" },
  { label: "Offboarding", path: "/admin/offboarding", icon: Briefcase },
  { label: "User Management", path: "/admin/users", icon: ShieldCheck, moduleKey: "userManagement" },
  { label: "Settings", path: "/admin/settings", icon: Settings, moduleKey: "settings" },
];

const employeeNav: NavItem[] = [
  { label: "Dashboard", path: "/employee/dashboard", icon: LayoutDashboard },
  { label: "Profile", path: "/employee/profile", icon: UserCircle },
  { label: "Attendance", path: "/employee/attendance", icon: Clock },
  { label: "Leave", path: "/employee/leave", icon: CalendarDays },
  { label: "Payroll", path: "/employee/payroll", icon: DollarSign },
  { label: "Letters", path: "/employee/letters", icon: FileText },
];

const pendingEmployeeNav: NavItem[] = [
  { label: "Joining Form", path: "/joining-form", icon: ClipboardCheck },
];

const hrNav: NavItem[] = [
  { label: "HR Dashboard", path: "/hr/dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { label: "Candidates", path: "/admin/candidates", icon: UserCheck, moduleKey: "candidates" },
  { label: "Letters", path: "/admin/letters", icon: FileText, moduleKey: "letters" },
];

const recruiterNav: NavItem[] = [
  { label: "Recruiter Dashboard", path: "/recruiter/dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { label: "Candidates", path: "/admin/candidates", icon: UserCheck, moduleKey: "candidates" },
];

const candidateNav: NavItem[] = [
  { label: "Dashboard", path: "/candidate/dashboard", icon: LayoutDashboard },
  { label: "My Profile", path: "/candidate/profile", icon: UserCircle },
  { label: "Job Applications", path: "/candidate/applications", icon: Briefcase },
  { label: "Application Status", path: "/candidate/status", icon: Layers3 },
  { label: "Documents", path: "/candidate/documents", icon: FolderOpen },
  { label: "Notifications", path: "/candidate/notifications", icon: Bell },
];

const getNotificationLink = (type: string, role?: string) => {
  if (role === "candidate") {
    if (type === "candidate") return "/candidate/status";
    return "/candidate/notifications";
  }
  if (type === "candidate") return "/admin/candidates";
  if (type === "leave") return "/admin/leave";
  if (type === "payroll") return "/admin/payroll";
  if (type === "attendance") return "/admin/attendance";
  return "/admin/dashboard";
};

const formatTimeAgo = (isoDate: string) => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { publicSettings, theme, toggleTheme } = useSystemSettings();
  const companyLogo = resolveCompanyLogoUrl(publicSettings?.company?.companyLogoUrl);
  const companyName = publicSettings?.company?.companyName || "Arihant Dream Infra Project Ltd.";
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const collapseTimeoutRef = useRef<number | null>(null);

  const isAdmin = user?.role === "admin";
  const isHr = user?.accessRole === "hr_manager";
  const isRecruiter = user?.accessRole === "recruiter";
  const isCandidate = user?.role === "candidate";
  const isPendingEmployee = user?.role === "employee" && user?.status !== "active_employee";
  const rawNavItems = isAdmin ? adminNav : isHr ? hrNav : isRecruiter ? recruiterNav : isCandidate ? candidateNav : isPendingEmployee ? pendingEmployeeNav : employeeNav;
  const navItems = rawNavItems.filter((item) => !item.moduleKey || user?.permissions?.modules?.[item.moduleKey] !== false);
  const isSidebarOpen = isMobile || isSidebarExpanded;
  const sidebarWidthClass = isSidebarOpen ? "w-64" : "w-16";
  const sidebarShellClass =
    "border-white/8 bg-[linear-gradient(180deg,rgba(18,21,31,0.98),rgba(28,32,44,0.98))] text-white shadow-[24px_0_90px_rgba(18,15,10,0.28)] backdrop-blur-2xl";
  const sidebarBorderClass = "border-white/8";
  const sidebarMutedTextClass = "text-slate-400";
  const sidebarItemClass = "text-slate-300 hover:bg-white/[0.05] hover:text-white";
  const sidebarIconBubbleClass = "bg-white/[0.04] group-hover:bg-white/[0.1]";
  const sidebarLogoutClass = "text-red-300 hover:bg-red-500/20 hover:text-red-100";

  const clearCollapseTimeout = () => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  };

  const handleSidebarMouseEnter = () => {
    if (isMobile) return;
    clearCollapseTimeout();
    setIsSidebarExpanded(true);
  };

  const handleSidebarMouseLeave = () => {
    if (isMobile) return;
    clearCollapseTimeout();
    collapseTimeoutRef.current = window.setTimeout(() => {
      setIsSidebarExpanded(false);
      collapseTimeoutRef.current = null;
    }, 180);
  };

  useEffect(() => () => clearCollapseTimeout(), []);

  useEffect(() => {
    if (!(isAdmin || isCandidate)) {
      setNotifications([]);
      return;
    }

    let mounted = true;

    const loadNotifications = async () => {
      try {
        setNotificationsLoading(true);
        const data = await apiService.listNotifications();
        if (mounted) setNotifications(data);
      } catch (error) {
        if (mounted) setNotifications([]);
        if (isUnauthorizedError(error)) {
          mounted = false;
          await logout();
          navigate("/login", { replace: true });
        }
      } finally {
        if (mounted) setNotificationsLoading(false);
      }
    };

    void loadNotifications();
    const id = window.setInterval(() => {
      void loadNotifications();
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [isAdmin, isCandidate, logout, navigate]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayName = user?.name || user?.email || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.read) {
      try {
        await apiService.markNotificationRead(notification._id);
      } catch {
        // no-op
      }
      setNotifications((prev) =>
        prev.map((item) => (item._id === notification._id ? { ...item, read: true } : item)),
      );
    }

    navigate(getNotificationLink(notification.type, user?.role));
  };

  const markAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch {
      // no-op
    }
  };

  return (
    <div className="premium-shell flex min-h-screen bg-background text-foreground transition-colors duration-300">
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen ${sidebarWidthClass} flex-col overflow-y-auto border-r transition-all duration-300 ease-in-out ${sidebarShellClass}`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <div className={`border-b px-4 py-5 ${sidebarBorderClass}`}>
          {!isSidebarOpen ? (
            <div className="flex justify-center">
              <ImageWithFallback src={companyLogo} alt="Company Logo" className="h-11 w-11 rounded-2xl border border-white/10 bg-white/95 p-1.5 object-cover shadow-[0_0_30px_rgba(129,140,248,0.2)]" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/95 p-2.5 shadow-[0_0_35px_rgba(129,140,248,0.18)]">
                <ImageWithFallback src={companyLogo} alt="Company Logo" className="h-10 w-10 rounded-xl object-cover" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{companyName}</p>
                <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${sidebarMutedTextClass}`}>Premium HR Suite</p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-2 px-3 py-5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={
                item.path === "/admin/dashboard" ||
                item.path === "/employee/dashboard" ||
                item.path === "/candidate/dashboard"
              }
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all duration-300 ease-in-out ${
                  isActive
                    ? "border border-white/12 bg-[linear-gradient(135deg,rgba(129,140,248,0.9),rgba(168,85,247,0.82),rgba(56,189,248,0.76))] text-[hsl(var(--sidebar-primary-foreground))] shadow-[0_18px_40px_rgba(99,102,241,0.34)]"
                    : sidebarItemClass
                } ${!isSidebarOpen ? "justify-center" : ""}`
              }
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ease-in-out ${
                  !isSidebarOpen ? "" : sidebarIconBubbleClass
                }`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
              </div>
              {isSidebarOpen ? <span className="truncate">{item.label}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className={`space-y-2 border-t p-3 ${sidebarBorderClass}`}>
          <button
            onClick={() => void handleLogout()}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-in-out ${sidebarLogoutClass} ${
              !isSidebarOpen ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-5 w-5" />
            {isSidebarOpen ? <span>Logout</span> : null}
          </button>
        </div>
      </aside>

      <div aria-hidden="true" className={`${sidebarWidthClass} shrink-0 transition-all duration-300 ease-in-out`} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-[1] px-4 py-4 lg:px-6 transition-colors duration-300">
          <div className="glass-panel flex items-center justify-end gap-4 rounded-[24px] px-4 py-3.5 transition-colors duration-300">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="rounded-2xl border border-[#deceb5] bg-white/70 p-3 text-[#7c6850] shadow-soft backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white hover:text-[#2f2215]"
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative rounded-2xl border border-[#deceb5] bg-white/70 p-3 shadow-soft backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white">
                    <Bell className="h-5 w-5 text-[#7c6850]" />
                    {unreadCount > 0 ? (
                      <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {unreadCount}
                      </span>
                    ) : null}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 rounded-[24px] border border-[#deceb5] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(247,240,228,0.96))] p-0 shadow-card backdrop-blur-xl transition-colors duration-300">
                  <div className="flex items-center justify-between border-b border-[#e7dac6] px-4 py-4">
                    <div>
                      <h4 className="text-sm font-semibold text-[#24190f]">Notifications</h4>
                      <p className="text-xs text-[#7c6850]">Recent alerts and updates</p>
                    </div>
                    {unreadCount > 0 ? <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button> : null}
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2">
                    {notificationsLoading ? (
                      <div className="px-3 py-4 text-sm text-[#7c6850]">Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#ddceb5] bg-white/60 px-4 py-8 text-center text-sm text-[#7c6850]">
                        No notifications yet.
                      </div>
                    ) : notifications.map((notification) => (
                      <div
                        key={notification._id}
                        onClick={() => void handleNotificationClick(notification)}
                        className={`cursor-pointer rounded-2xl border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white ${
                          !notification.read ? "border-[#deceb5] bg-white/70 shadow-soft" : "border-transparent"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${!notification.read ? "bg-primary" : "bg-[#cdb89a]"}`} />
                          <div>
                            <p className="text-sm font-semibold text-[#24190f]">{notification.title}</p>
                            <p className="mt-1 text-xs leading-5 text-[#6f5a43]">{notification.message}</p>
                            <p className="mt-2 text-xs font-medium text-[#8d785f]">{formatTimeAgo(notification.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 rounded-2xl border border-[#deceb5] bg-white/70 px-2 py-2 shadow-soft backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white">
                  <ProfileAvatar name={displayName} imageUrl={user?.profileImage || user?.profilePhotoUrl || ""} className="h-10 w-10" fallbackClassName="text-xs" />
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-semibold leading-none text-[#24190f]">{displayName}</p>
                    <p className="mt-1 text-xs capitalize text-[#7c6850]">{user?.role}</p>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl border border-[#deceb5] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(247,240,228,0.96))] shadow-card backdrop-blur-xl transition-colors duration-300">
                  <DropdownMenuItem
                    onClick={() =>
                      navigate(
                        isAdmin
                          ? "/admin/profile"
                          : isHr
                            ? "/hr/dashboard"
                            : isRecruiter
                              ? "/recruiter/dashboard"
                              : isCandidate
                                ? "/candidate/profile"
                                : isPendingEmployee
                                  ? "/joining-form"
                                  : "/employee/profile",
                      )
                    }
                  >
                    {isPendingEmployee ? "Joining Form" : "Profile"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="relative z-[1] flex-1 overflow-y-auto p-4 lg:p-6">
          {isPendingEmployee ? (
            <div className="mx-auto mb-4 max-w-[1600px] rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 backdrop-blur-xl">
              Please complete your Joining Form to activate your account.
            </div>
          ) : null}
          <div className="page-enter mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
};
