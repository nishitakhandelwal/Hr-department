import React from "react";
import { ArrowRight, CalendarDays, CheckCircle, Clock, FileText, IndianRupee, Sparkles, UserCircle } from "lucide-react";
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
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

type EmployeeDashboardSummary = Awaited<ReturnType<typeof apiService.getEmployeeDashboardSummary>>;
type EmployeeProfile = Awaited<ReturnType<typeof apiService.getMyEmployeeProfile>>;

type EmployeeWorkspaceRow = {
  id: string;
  type: "attendance" | "leave" | "payroll";
  title: string;
  detail: string;
  meta: string;
  status: string;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<EmployeeDashboardSummary>({
    attendanceRows: [],
    leaveRows: [],
    payrollRows: [],
    approvedLeaveDays: 0,
  });
  const [profile, setProfile] = React.useState<EmployeeProfile | null>(null);

  React.useEffect(() => {
    void (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [dashboardSummary, employeeProfile] = await Promise.all([
          apiService.getEmployeeDashboardSummary(),
          apiService.getMyEmployeeProfile(),
        ]);

        React.startTransition(() => {
          setSummary(dashboardSummary);
          setProfile(employeeProfile);
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load dashboard",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, toast]);

  const latestPayroll = summary.payrollRows[0];
  const pendingLeaveRequests = summary.leaveRows.filter((row) => String(row.status || "").toLowerCase() === "pending").length;
  const attendanceScore = summary.attendanceRows.length ? Math.min(100, 62 + summary.attendanceRows.length * 6) : 48;
  const todayStatus = summary.attendanceRows[0] ? (summary.attendanceRows[0]?.checkOut ? "Checked Out" : "Checked In") : "No record";

  const calendarEvents = React.useMemo<PortalCalendarEvent[]>(
    () =>
      summary.leaveRows
        .filter((leave) => leave.fromDate)
        .slice(0, 6)
        .map((leave, index) => ({
          id: `leave-${index}`,
          title: `Leave ${String(leave.status || "scheduled")}`,
          date: leave.fromDate || "",
          type: String(leave.status || "").toLowerCase() === "approved" ? "holiday" : "reminder",
          note: leave.toDate ? `Scheduled through ${leave.toDate}.` : "Leave request recorded in the system.",
        })),
    [summary.leaveRows]
  );

  const workspaceFeed = React.useMemo<EmployeeWorkspaceRow[]>(
    () => [
      ...summary.leaveRows.map((leave, index) => ({
        id: `leave-${index}`,
        type: "leave" as const,
        title: leave.fromDate ? `Leave from ${leave.fromDate}` : "Leave request",
        detail: leave.toDate ? `Through ${leave.toDate}` : "Single-day request",
        meta: "Leave workflow",
        status: String(leave.status || "pending"),
      })),
      ...summary.payrollRows.map((payroll, index) => ({
        id: `payroll-${index}`,
        type: "payroll" as const,
        title: payroll.month || "Payroll cycle",
        detail: currency.format(Number(payroll.netSalary || 0)),
        meta: "Payroll update",
        status: payroll.netSalary ? "paid" : "processing",
      })),
      ...summary.attendanceRows.slice(0, 4).map((attendance, index) => ({
        id: `attendance-${index}`,
        type: "attendance" as const,
        title: attendance.date,
        detail: attendance.hoursWorked ? `${attendance.hoursWorked} hours worked` : "Attendance recorded",
        meta: attendance.checkOut ? "Closed attendance" : "Open attendance",
        status: attendance.checkOut ? "present" : "pending",
      })),
    ],
    [summary.attendanceRows, summary.leaveRows, summary.payrollRows]
  );

  const workspaceColumns = React.useMemo<PortalTableColumn<EmployeeWorkspaceRow>[]>(
    () => [
      {
        key: "item",
        header: "Item",
        render: (row) => (
          <div>
            <p className="portal-heading font-semibold">{row.title}</p>
            <p className="portal-muted mt-1 text-xs">{row.meta}</p>
          </div>
        ),
      },
      {
        key: "type",
        header: "Category",
        render: (row) => (
          <div>
            <p className="portal-heading text-sm font-medium capitalize">{row.type}</p>
            <p className="portal-muted mt-1 text-xs">{row.detail}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        className: "text-right",
        render: (row) => <div className="flex justify-end"><StatusBadge status={row.status} /></div>,
      },
    ],
    []
  );

  if (loading && !profile && summary.attendanceRows.length === 0 && summary.leaveRows.length === 0 && summary.payrollRows.length === 0) {
    return <PortalDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] || "User"}`}
        subtitle="A premium personal HR workspace for attendance, leave, payroll, and day-to-day employee coordination."
        action={(
          <Button variant="outline" className="gap-2 rounded-[18px]" onClick={() => navigate("/employee/profile")}>
            Open Profile
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <PortalHeroPanel
          eyebrow="Employee Pulse"
          title="Keep daily work, leave, and payroll visible without turning the employee experience into clutter."
          description="This dashboard is designed to feel calm and premium while still surfacing the exact HR information people actually need during the week."
          highlights={[
            {
              label: "Attendance entries",
              value: String(summary.attendanceRows.length),
              note: "Recent check-ins and check-outs recorded in your account.",
              icon: Clock,
            },
            {
              label: "Approved leave",
              value: `${summary.approvedLeaveDays} days`,
              note: `${pendingLeaveRequests} request(s) are still pending review.`,
              icon: CalendarDays,
            },
            {
              label: "Latest payroll",
              value: currency.format(Number(latestPayroll?.netSalary || 0)),
              note: latestPayroll?.month || "Payroll data becomes visible here after processing.",
              icon: IndianRupee,
            },
          ]}
        />

        <PortalProfileCard
          name={profile?.fullName || user?.name || "Employee"}
          roleLabel={profile?.designation || "Employee Portal"}
          subtitle="Your personal dashboard keeps work essentials together: attendance rhythm, leave planning, payroll visibility, and quick access to profile information."
          imageUrl={user?.profileImage || user?.profilePhotoUrl || ""}
          meta={[
            { label: "Current status", value: todayStatus, icon: CheckCircle },
            { label: "Pending leaves", value: `${pendingLeaveRequests} request(s)`, icon: CalendarDays },
            { label: "Department", value: profile?.department || "Not assigned", icon: Sparkles },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's Status" value={todayStatus} change="Live attendance flow" changeType="positive" icon={Clock} color="success" delay={0} onClick={() => navigate("/employee/attendance")} />
        <StatCard title="Approved Leave" value={`${summary.approvedLeaveDays} days`} change={`${pendingLeaveRequests} pending`} changeType="neutral" icon={CalendarDays} color="info" delay={1} onClick={() => navigate("/employee/leave")} />
        <StatCard title="This Month's Pay" value={currency.format(Number(latestPayroll?.netSalary || 0))} change={latestPayroll?.month || "No payroll record yet"} changeType="positive" icon={IndianRupee} color="primary" delay={2} onClick={() => navigate("/employee/payroll")} />
        <StatCard title="Letters" value="Open module" change="Documents and downloads" changeType="neutral" icon={FileText} color="warning" delay={3} onClick={() => navigate("/employee/letters")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CircularStatsWidget
          label="Attendance Consistency"
          value={attendanceScore}
          subtitle="A quick confidence score blending attendance activity, leave usage, and payroll visibility."
          breakdown={[
            { label: "Attendance records", value: `${summary.attendanceRows.length}` },
            { label: "Approved leave", value: `${summary.approvedLeaveDays} days` },
            { label: "Payroll visibility", value: latestPayroll?.month || "Awaiting cycle" },
          ]}
        />

        <TaskProgressList
          title="Employee Task Stack"
          subtitle="The next actions that keep your profile and day-to-day HR flow healthy."
          tasks={[
            {
              title: "Attendance rhythm",
              description: "Keep daily records clean and complete for a smooth workweek.",
              progress: Math.min(100, 40 + summary.attendanceRows.length * 10),
              icon: Clock,
            },
            {
              title: "Leave planning",
              description: `${pendingLeaveRequests} leave request(s) are still in the queue.`,
              progress: Math.max(20, 100 - pendingLeaveRequests * 20),
              icon: CalendarDays,
            },
            {
              title: "Payroll awareness",
              description: "Review the latest cycle and keep compensation details visible.",
              progress: latestPayroll ? 88 : 34,
              icon: IndianRupee,
            },
          ]}
        />
      </div>

      <PortalDataTable
        title="Personal HR Activity"
        subtitle="A dynamic timeline of your recent leave, payroll, and attendance items with pagination-ready structure."
        columns={workspaceColumns}
        rows={workspaceFeed}
        loading={loading}
        pageSize={6}
        emptyTitle="No HR activity yet"
        emptyDescription="Attendance, leave, and payroll activity will appear here as soon as your account starts receiving updates."
        getRowKey={(row) => row.id}
      />

      <PortalCalendarCard
        title="Employee Calendar"
        subtitle="Recorded leave windows appear here so your upcoming HR timeline stays visible without placeholder content."
        events={calendarEvents}
      />
    </div>
  );
};

export default EmployeeDashboard;
