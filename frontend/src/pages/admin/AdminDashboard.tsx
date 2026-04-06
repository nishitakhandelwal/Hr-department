import React from "react";
import { ArrowRight, BriefcaseBusiness, Building2, CalendarDays, ClipboardCheck, ShieldCheck, UserCheck, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import CircularStatsWidget from "@/components/dashboard/CircularStatsWidget";
import PortalCalendarCard, { type PortalCalendarEvent } from "@/components/dashboard/PortalCalendarCard";
import PortalDashboardSkeleton from "@/components/dashboard/PortalDashboardSkeleton";
import { PortalDataTable, type PortalTableColumn } from "@/components/dashboard/PortalDataTable";
import PortalHeroPanel from "@/components/dashboard/PortalHeroPanel";
import PortalProfileCard from "@/components/dashboard/PortalProfileCard";
import TaskProgressList from "@/components/dashboard/TaskProgressList";
import { StatusBadge } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiService, type EmployeeRecord } from "@/services/api";

type AdminDashboardSummary = Awaited<ReturnType<typeof apiService.getAdminDashboardSummary>>;

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<AdminDashboardSummary>({
    activeEmployeesCount: 0,
    applicationsUnderReview: 0,
    pendingHrReviews: 0,
    pendingLeavesCount: 0,
    totalPayrollValue: 0,
    departmentsCovered: 0,
    totalCandidates: 0,
    totalEmployees: 0,
    events: [],
  });
  const [employees, setEmployees] = React.useState<EmployeeRecord[]>([]);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [dashboardSummary, employeeRows] = await Promise.all([
          apiService.getAdminDashboardSummary(),
          apiService.list<EmployeeRecord>("employees"),
        ]);

        React.startTransition(() => {
          setSummary(dashboardSummary);
          setEmployees(employeeRows);
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load dashboard data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const workforceHealth = summary.totalEmployees
    ? Math.round((summary.activeEmployeesCount / summary.totalEmployees) * 100)
    : 0;

  const calendarEvents = React.useMemo<PortalCalendarEvent[]>(
    () =>
      summary.events.map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        type: event.type,
        time: event.time,
        note: event.note,
      })),
    [summary.events]
  );

  const employeeColumns = React.useMemo<PortalTableColumn<EmployeeRecord>[]>(
    () => [
      {
        key: "employee",
        header: "Employee",
        render: (employee) => (
          <div>
            <p className="portal-heading font-semibold">{employee.fullName}</p>
            <p className="portal-muted mt-1 text-xs">{employee.email}</p>
          </div>
        ),
      },
      {
        key: "department",
        header: "Department",
        render: (employee) => (
          <div>
            <p className="portal-heading text-sm font-medium">{employee.department || "Unassigned"}</p>
            <p className="portal-muted mt-1 text-xs">{employee.designation}</p>
          </div>
        ),
      },
      {
        key: "salary",
        header: "Compensation",
        render: (employee) => (
          <div>
            <p className="portal-heading text-sm font-semibold">{currency.format(Number(employee.salary || 0))}</p>
            <p className="portal-muted mt-1 text-xs">Employee ID {employee.employeeId}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        className: "text-right",
        render: (employee) => <div className="flex justify-end"><StatusBadge status={employee.status || "inactive"} /></div>,
      },
    ],
    []
  );

  const employeeRows = React.useMemo(() => employees.slice(0, 12), [employees]);

  if (loading && summary.totalEmployees === 0 && employees.length === 0) {
    return <PortalDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] || "Admin"}`}
        subtitle="Here is your premium admin workspace for hiring, workforce health, payroll visibility, and people operations across the organization."
        action={(
          <Button onClick={() => navigate("/admin/users")} className="gap-2 rounded-[18px]">
            User Management
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <PortalHeroPanel
          eyebrow="Executive Command"
          title="See the full HR system in one calm, high-signal workspace."
          description="From hiring flow to active workforce coverage, the dashboard keeps the admin portal readable, responsive, and ready for daily decisions without drowning the team in noise."
          highlights={[
            {
              label: "Active workforce",
              value: String(summary.activeEmployeesCount),
              note: `${summary.totalEmployees} total employee records currently managed.`,
              icon: Users,
            },
            {
              label: "Hiring in motion",
              value: String(summary.applicationsUnderReview),
              note: `${summary.pendingHrReviews} profiles still waiting on HR review.`,
              icon: BriefcaseBusiness,
            },
            {
              label: "Payroll volume",
              value: currency.format(Math.round(summary.totalPayrollValue)),
              note: `${summary.pendingLeavesCount} leave approvals still need attention.`,
              icon: Wallet,
            },
          ]}
        />

        <PortalProfileCard
          name={user?.name || "Admin"}
          roleLabel="System Administrator"
          subtitle="You are looking at the highest-level people operations view, where workforce readiness, candidate momentum, and policy approvals all meet in one product-grade interface."
          imageUrl={user?.profileImage || user?.profilePhotoUrl || ""}
          meta={[
            { label: "Departments", value: `${summary.departmentsCovered} active teams`, icon: Building2 },
            { label: "Pending leaves", value: `${summary.pendingLeavesCount} approvals`, icon: CalendarDays },
            { label: "Review queue", value: `${summary.pendingHrReviews} candidate profiles`, icon: ClipboardCheck },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Candidates"
          value={summary.totalCandidates}
          change="Pipeline population"
          changeType="positive"
          icon={UserCheck}
          color="info"
          delay={0}
          onClick={() => navigate("/admin/candidates")}
        />
        <StatCard
          title="Active Employees"
          value={summary.activeEmployeesCount}
          change={`${summary.totalEmployees} total people records`}
          changeType="positive"
          icon={Users}
          color="primary"
          delay={1}
          onClick={() => navigate("/admin/employees")}
        />
        <StatCard
          title="Pending HR Reviews"
          value={summary.pendingHrReviews}
          change="Needs evaluation action"
          changeType="neutral"
          icon={ClipboardCheck}
          color="warning"
          delay={2}
          onClick={() => navigate("/admin/candidates")}
        />
        <StatCard
          title="People Ops Queue"
          value={summary.pendingLeavesCount}
          change="Leave approvals in motion"
          changeType="neutral"
          icon={ShieldCheck}
          color="success"
          delay={3}
          onClick={() => navigate("/admin/leave")}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CircularStatsWidget
          label="Workforce Health"
          value={workforceHealth}
          subtitle="A lightweight readiness score built from active employee coverage, department spread, and unresolved approval load."
          breakdown={[
            { label: "Active employees", value: `${summary.activeEmployeesCount}/${summary.totalEmployees || 0}` },
            { label: "Departments covered", value: `${summary.departmentsCovered}` },
            { label: "Pending approvals", value: `${summary.pendingLeavesCount}` },
          ]}
        />

        <TaskProgressList
          title="Admin Priority Stack"
          subtitle="The most important actions for this portal, expressed as clear progress blocks instead of noisy analytics."
          tasks={[
            {
              title: "Leave approvals",
              description: `${summary.pendingLeavesCount} requests are waiting for admin action.`,
              progress: Math.min(100, summary.pendingLeavesCount === 0 ? 100 : 100 - summary.pendingLeavesCount * 12),
              icon: CalendarDays,
            },
            {
              title: "HR evaluations",
              description: `${summary.pendingHrReviews} candidates still need a final review cycle.`,
              progress: Math.min(100, summary.pendingHrReviews === 0 ? 100 : 100 - summary.pendingHrReviews * 14),
              icon: ClipboardCheck,
            },
            {
              title: "Hiring throughput",
              description: `${summary.applicationsUnderReview} applicants are moving through the active recruitment stream.`,
              progress: Math.min(100, summary.applicationsUnderReview * 18),
              icon: BriefcaseBusiness,
            },
          ]}
        />
      </div>

      <PortalDataTable
        title="Employee Roster"
        subtitle="A dynamic employee table ready for pagination, quick scanning, and navigation into the full employee management module."
        columns={employeeColumns}
        rows={employeeRows}
        loading={loading}
        pageSize={6}
        emptyTitle="No employees available"
        emptyDescription="Employee records will appear here as soon as the admin workspace has active people data."
        getRowKey={(employee) => employee._id}
        onRowClick={() => navigate("/admin/employees")}
      />

      <PortalCalendarCard
        title="Executive Calendar"
        subtitle="Shared events, approvals, and workforce milestones are organized into a clean monthly calendar so the admin view stays actionable."
        events={calendarEvents}
      />
    </div>
  );
};

export default AdminDashboard;
