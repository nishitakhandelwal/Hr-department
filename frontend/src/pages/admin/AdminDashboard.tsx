import React from "react";
import { ArrowRight, BriefcaseBusiness, Building2, CalendarDays, ClipboardCheck, ShieldCheck, UserCheck, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import CircularStatsWidget from "@/components/dashboard/CircularStatsWidget";
import PortalDashboardSkeleton from "@/components/dashboard/PortalDashboardSkeleton";
import { PortalDataTable, type PortalTableColumn } from "@/components/dashboard/PortalDataTable";
import PortalHeroPanel from "@/components/dashboard/PortalHeroPanel";
import PortalProfileCard from "@/components/dashboard/PortalProfileCard";
import TaskProgressList from "@/components/dashboard/TaskProgressList";
import { StatusBadge } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useLabel } from "@/context/SystemSettingsContext";
import { useToast } from "@/hooks/use-toast";
import SmartCalendar from "@/pages/admin/SmartCalendar";
import { apiService, type EmployeeRecord } from "@/services/api";

type AdminDashboardSummary = Awaited<ReturnType<typeof apiService.getAdminDashboardSummary>>;

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const dashboardSubtitle = useLabel("admin.dashboard.subtitle");
  const userManagementLabel = useLabel("admin.dashboard.action.users");
  const heroEyebrow = useLabel("admin.dashboard.hero.eyebrow");
  const heroTitle = useLabel("admin.dashboard.hero.title");
  const heroDescription = useLabel("admin.dashboard.hero.description");
  const profileRoleLabel = useLabel("admin.dashboard.profile.role");
  const profileSubtitle = useLabel("admin.dashboard.profile.subtitle");
  const candidatesTitle = useLabel("admin.dashboard.stats.candidates");
  const employeesTitle = useLabel("admin.dashboard.stats.employees");
  const reviewsTitle = useLabel("admin.dashboard.stats.reviews");
  const queueTitle = useLabel("admin.dashboard.stats.queue");
  const errorTitle = useLabel("common.error", "Error");
  const workforceTitle = useLabel("admin.dashboard.widget.workforce");
  const workforceSubtitle = useLabel("admin.dashboard.widget.workforce.subtitle");
  const priorityTitle = useLabel("admin.dashboard.widget.priority");
  const prioritySubtitle = useLabel("admin.dashboard.widget.priority.subtitle");
  const rosterTitle = useLabel("admin.dashboard.table.title");
  const rosterSubtitle = useLabel("admin.dashboard.table.subtitle");
  const employeeHeaderLabel = useLabel("admin.dashboard.table.employee");
  const departmentHeaderLabel = useLabel("admin.dashboard.table.department");
  const compensationHeaderLabel = useLabel("admin.dashboard.table.compensation");
  const statusHeaderLabel = useLabel("admin.dashboard.table.status");
  const unassignedLabel = useLabel("admin.dashboard.table.unassigned");
  const employeeIdLabel = useLabel("admin.dashboard.table.employeeId");
  const welcomeLabel = useLabel("admin.dashboard.welcome");
  const highlightWorkforceLabel = useLabel("admin.dashboard.highlight.workforce.label");
  const highlightHiringLabel = useLabel("admin.dashboard.highlight.hiring.label");
  const highlightPayrollLabel = useLabel("admin.dashboard.highlight.payroll.label");
  const defaultAdminName = useLabel("admin.dashboard.profile.defaultName");
  const departmentsMetaLabel = useLabel("admin.dashboard.profile.meta.departments");
  const leavesMetaLabel = useLabel("admin.dashboard.profile.meta.leaves");
  const queueMetaLabel = useLabel("admin.dashboard.profile.meta.queue");
  const reviewsChangeLabel = useLabel("admin.dashboard.stats.reviews.change");
  const queueChangeLabel = useLabel("admin.dashboard.stats.queue.change");
  const candidatesChangeLabel = useLabel("admin.dashboard.stats.candidates.change");
  const employeesChangeSuffix = useLabel("admin.dashboard.stats.employees.change.suffix");
  const workforceEmployeesLabel = useLabel("admin.dashboard.widget.workforce.metric.employees");
  const workforceDepartmentsLabel = useLabel("admin.dashboard.widget.workforce.metric.departments");
  const workforceApprovalsLabel = useLabel("admin.dashboard.widget.workforce.metric.approvals");
  const priorityLeaveLabel = useLabel("admin.dashboard.widget.priority.leave");
  const priorityReviewsLabel = useLabel("admin.dashboard.widget.priority.reviews");
  const priorityHiringLabel = useLabel("admin.dashboard.widget.priority.hiring");
  const emptyEmployeesTitle = useLabel("admin.dashboard.empty.title");
  const emptyEmployeesDescription = useLabel("admin.dashboard.empty.description");
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [summary, setSummary] = React.useState<AdminDashboardSummary>({
    activeEmployeesCount: 0,
    applicationsUnderReview: 0,
    pendingHrReviews: 0,
    pendingLeavesCount: 0,
    totalPayrollValue: 0,
    departmentsCovered: 0,
    totalCandidates: 0,
    totalEmployees: 0,
    recentEmployees: [],
    events: [],
  });
  const hasLoadedOnceRef = React.useRef(false);
  const refreshInFlightRef = React.useRef(false);
  const lastRefreshAtRef = React.useRef(0);
  const refreshDashboard = React.useCallback(
    async (options?: { showErrorToast?: boolean; silent?: boolean }) => {
      const showErrorToast = options?.showErrorToast ?? true;
      const silent = options?.silent ?? hasLoadedOnceRef.current;

      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;

      if (silent) {
        setRefreshing(true);
      } else {
        setInitialLoading(true);
      }

      try {
        const dashboardSummary = await apiService.getAdminDashboardSummary();

        React.startTransition(() => {
          setSummary(dashboardSummary);
        });
        hasLoadedOnceRef.current = true;
        lastRefreshAtRef.current = Date.now();
      } catch (error) {
        if (showErrorToast) {
          toast({
            title: errorTitle,
            description: error instanceof Error ? error.message : `${errorTitle}: dashboard data unavailable`,
            variant: "destructive",
          });
        }
      } finally {
        refreshInFlightRef.current = false;
        setRefreshing(false);
        setInitialLoading(false);
      }
    },
    [errorTitle, toast]
  );

  React.useEffect(() => {
    void refreshDashboard();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshDashboard({ showErrorToast: false, silent: true });
      }
    }, 120000);

    const handleWindowFocus = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAtRef.current > 60000) {
        void refreshDashboard({ showErrorToast: false, silent: true });
      }
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [refreshDashboard]);

  const workforceHealth = summary.totalEmployees
    ? Math.round((summary.activeEmployeesCount / summary.totalEmployees) * 100)
    : 0;

  const employeeColumns = React.useMemo<PortalTableColumn<EmployeeRecord>[]>(
    () => [
      {
        key: "employee",
        header: employeeHeaderLabel,
        render: (employee) => (
          <div>
            <p className="portal-heading font-semibold">{employee.fullName}</p>
            <p className="portal-muted mt-1 text-xs">{employee.email}</p>
          </div>
        ),
      },
      {
        key: "department",
        header: departmentHeaderLabel,
        render: (employee) => (
          <div>
            <p className="portal-heading text-sm font-medium">{employee.department || unassignedLabel}</p>
            <p className="portal-muted mt-1 text-xs">{employee.designation}</p>
          </div>
        ),
      },
      {
        key: "salary",
        header: compensationHeaderLabel,
        render: (employee) => (
          <div>
            <p className="portal-heading text-sm font-semibold">{currency.format(Number(employee.salary || 0))}</p>
            <p className="portal-muted mt-1 text-xs">{employeeIdLabel} {employee.employeeId}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: statusHeaderLabel,
        className: "text-right",
        render: (employee) => <div className="flex justify-end"><StatusBadge status={employee.status || "inactive"} /></div>,
      },
    ],
    [
      compensationHeaderLabel,
      departmentHeaderLabel,
      employeeHeaderLabel,
      employeeIdLabel,
      statusHeaderLabel,
      unassignedLabel,
    ]
  );

  const employeeRows = React.useMemo(() => summary.recentEmployees || [], [summary.recentEmployees]);

  if (initialLoading && summary.totalEmployees === 0 && employeeRows.length === 0) {
    return <PortalDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${welcomeLabel}, ${user?.name?.split(" ")[0] || defaultAdminName}`}
        subtitle={dashboardSubtitle}
        action={(
          <Button onClick={() => navigate("/admin/users")} className="gap-2 rounded-[18px]">
            {userManagementLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <PortalHeroPanel
          eyebrow={heroEyebrow}
          title={heroTitle}
          description={heroDescription}
          highlights={[
            {
              label: highlightWorkforceLabel,
              value: String(summary.activeEmployeesCount),
              note: `${summary.totalEmployees} total employee records currently managed.`,
              icon: Users,
            },
            {
              label: highlightHiringLabel,
              value: String(summary.applicationsUnderReview),
              note: `${summary.pendingHrReviews} profiles still waiting on HR review.`,
              icon: BriefcaseBusiness,
            },
            {
              label: highlightPayrollLabel,
              value: currency.format(Math.round(summary.totalPayrollValue)),
              note: `${summary.pendingLeavesCount} leave approvals still need attention.`,
              icon: Wallet,
            },
          ]}
        />

        <PortalProfileCard
          name={user?.name || defaultAdminName}
          roleLabel={profileRoleLabel}
          subtitle={profileSubtitle}
          imageUrl={user?.profileImage || user?.profilePhotoUrl || ""}
          meta={[
            { label: departmentsMetaLabel, value: `${summary.departmentsCovered} active teams`, icon: Building2 },
            { label: leavesMetaLabel, value: `${summary.pendingLeavesCount} approvals`, icon: CalendarDays },
            { label: queueMetaLabel, value: `${summary.pendingHrReviews} candidate profiles`, icon: ClipboardCheck },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={candidatesTitle}
          value={summary.totalCandidates}
          change={candidatesChangeLabel}
          changeType="positive"
          icon={UserCheck}
          color="info"
          delay={0}
          onClick={() => navigate("/admin/candidates")}
        />
        <StatCard
          title={employeesTitle}
          value={summary.activeEmployeesCount}
          change={`${summary.totalEmployees} ${employeesChangeSuffix}`}
          changeType="positive"
          icon={Users}
          color="primary"
          delay={1}
          onClick={() => navigate("/admin/employees")}
        />
        <StatCard
          title={reviewsTitle}
          value={summary.pendingHrReviews}
          change={reviewsChangeLabel}
          changeType="neutral"
          icon={ClipboardCheck}
          color="warning"
          delay={2}
          onClick={() => navigate("/admin/candidates")}
        />
        <StatCard
          title={queueTitle}
          value={summary.pendingLeavesCount}
          change={queueChangeLabel}
          changeType="neutral"
          icon={ShieldCheck}
          color="success"
          delay={3}
          onClick={() => navigate("/admin/leave")}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CircularStatsWidget
          label={workforceTitle}
          value={workforceHealth}
          subtitle={workforceSubtitle}
          breakdown={[
            { label: workforceEmployeesLabel, value: `${summary.activeEmployeesCount}/${summary.totalEmployees || 0}` },
            { label: workforceDepartmentsLabel, value: `${summary.departmentsCovered}` },
            { label: workforceApprovalsLabel, value: `${summary.pendingLeavesCount}` },
          ]}
        />

        <TaskProgressList
          title={priorityTitle}
          subtitle={prioritySubtitle}
          tasks={[
            {
              title: priorityLeaveLabel,
              description: `${summary.pendingLeavesCount} requests are waiting for admin action.`,
              progress: Math.min(100, summary.pendingLeavesCount === 0 ? 100 : 100 - summary.pendingLeavesCount * 12),
              icon: CalendarDays,
            },
            {
              title: priorityReviewsLabel,
              description: `${summary.pendingHrReviews} candidates still need a final review cycle.`,
              progress: Math.min(100, summary.pendingHrReviews === 0 ? 100 : 100 - summary.pendingHrReviews * 14),
              icon: ClipboardCheck,
            },
            {
              title: priorityHiringLabel,
              description: `${summary.applicationsUnderReview} applicants are moving through the active recruitment stream.`,
              progress: Math.min(100, summary.applicationsUnderReview * 18),
              icon: BriefcaseBusiness,
            },
          ]}
        />
      </div>

      <PortalDataTable
        title={rosterTitle}
        subtitle={rosterSubtitle}
        columns={employeeColumns}
        rows={employeeRows}
        loading={initialLoading || refreshing}
        pageSize={6}
        emptyTitle={emptyEmployeesTitle}
        emptyDescription={emptyEmployeesDescription}
        getRowKey={(employee) => employee._id}
        onRowClick={() => navigate("/admin/employees")}
      />

      <SmartCalendar embedded />
    </div>
  );
};

export default AdminDashboard;
