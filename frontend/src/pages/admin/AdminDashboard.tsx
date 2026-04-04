import React from "react";
import { addDays, format, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Building2, CalendarDays, ClipboardCheck, ShieldCheck, UserCheck, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import PortalProfileCard from "@/components/dashboard/PortalProfileCard";
import CircularStatsWidget from "@/components/dashboard/CircularStatsWidget";
import TaskProgressList from "@/components/dashboard/TaskProgressList";
import PortalCalendarCard, { type PortalCalendarEvent } from "@/components/dashboard/PortalCalendarCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

type DashboardEmployee = {
  status?: string;
  designation?: string;
  userId?: {
    name?: string;
    department?: string;
  };
};

type DashboardCandidate = {
  status?: string;
  stageCompleted?: number;
  adminReview?: {
    reviewedAt?: string;
  };
};

type DashboardLeave = {
  status?: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  employeeId?: {
    userId?: {
      name?: string;
    };
  };
};

type DashboardPayroll = {
  month?: string;
  netSalary?: number;
};

const cardMotion = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [employees, setEmployees] = React.useState<DashboardEmployee[]>([]);
  const [candidates, setCandidates] = React.useState<DashboardCandidate[]>([]);
  const [leaves, setLeaves] = React.useState<DashboardLeave[]>([]);
  const [payroll, setPayroll] = React.useState<DashboardPayroll[]>([]);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [employeeRows, candidateRows, leaveRows, payrollRows] = await Promise.all([
          apiService.list<DashboardEmployee>("employees"),
          apiService.list<DashboardCandidate>("candidates"),
          apiService.list<DashboardLeave>("leave"),
          apiService.list<DashboardPayroll>("payroll"),
        ]);
        setEmployees(employeeRows);
        setCandidates(candidateRows);
        setLeaves(leaveRows);
        setPayroll(payrollRows);
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

  const today = React.useMemo(() => startOfDay(new Date()), []);
  const activeEmployeesCount = React.useMemo(() => employees.filter((employee) => employee.status === "active").length, [employees]);
  const applicationsUnderReview = React.useMemo(
    () => candidates.filter((candidate) => candidate.status === "Under Review" || candidate.status === "Interview Scheduled").length,
    [candidates]
  );
  const pendingHrReviews = React.useMemo(
    () => candidates.filter((candidate) => (candidate.stageCompleted || 0) >= 2 && !candidate.adminReview?.reviewedAt).length,
    [candidates]
  );
  const pendingLeaves = React.useMemo(() => leaves.filter((row) => row.status === "pending"), [leaves]);
  const totalPayrollValue = React.useMemo(() => payroll.reduce((sum, item) => sum + Number(item.netSalary || 0), 0), [payroll]);
  const departmentsCovered = React.useMemo(
    () => new Set(employees.map((employee) => employee.userId?.department).filter(Boolean)).size,
    [employees]
  );

  const workforceHealth = employees.length ? Math.round((activeEmployeesCount / employees.length) * 100) : 0;

  const calendarEvents = React.useMemo<PortalCalendarEvent[]>(() => {
    const items: PortalCalendarEvent[] = pendingLeaves.slice(0, 4).map((leave, index) => ({
      id: `leave-${index}`,
      title: `${leave.employeeId?.userId?.name || "Employee"} leave starts`,
      date: leave.fromDate || format(addDays(today, index + 1), "yyyy-MM-dd"),
      type: "holiday",
      note: leave.leaveType ? `${leave.leaveType} request awaiting approval.` : "Pending leave request.",
    }));

    if (applicationsUnderReview > 0) {
      items.push({
        id: "review-queue",
        title: "Recruitment review block",
        date: format(addDays(today, 1), "yyyy-MM-dd"),
        type: "meeting",
        time: "10:30 AM",
        note: `${applicationsUnderReview} applications need recruiter/admin action.`,
      });
    }

    if (pendingHrReviews > 0) {
      items.push({
        id: "hr-review",
        title: "HR evaluation follow-up",
        date: format(addDays(today, 3), "yyyy-MM-dd"),
        type: "reminder",
        note: `${pendingHrReviews} candidate profiles are still pending HR review.`,
      });
    }

    items.push({
      id: "payroll-close",
      title: "Payroll closure checkpoint",
      date: format(addDays(today, 5), "yyyy-MM-dd"),
      type: "meeting",
      time: "04:00 PM",
      note: "Validate salary processing, approvals, and department escalations.",
    });

    return items;
  }, [applicationsUnderReview, pendingHrReviews, pendingLeaves, today]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="An elegant control surface for hiring, people operations, and workforce planning across the full HR ecosystem."
        action={
          <Button onClick={() => navigate("/admin/users")} className="gap-2 rounded-[18px]">
            User Management
            <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <motion.section
          {...cardMotion}
          transition={{ duration: 0.45 }}
          className="dashboard-panel relative overflow-hidden p-7"
        >
          <div className="pointer-events-none absolute -right-16 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(205,178,123,0.26),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(255,248,235,0.95),transparent_70%)] blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e0cfb3] bg-white/75 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9a7747]">
              Executive Command
            </div>
            <h2 className="mt-4 max-w-3xl text-[34px] font-semibold leading-tight tracking-[-0.04em] text-[#24190f]">
              Premium workforce oversight with the right level of clarity, warmth, and focus.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f5a43]">
              Keep recruiting momentum, employee readiness, and operations aligned in one product-grade dashboard built for confident daily decisions.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { label: "Active workforce", value: String(activeEmployeesCount), note: "People currently serving across departments.", icon: Users },
                { label: "Candidates moving", value: String(applicationsUnderReview), note: "Applications in review and interview stages.", icon: BriefcaseBusiness },
                { label: "Payroll volume", value: `Rs. ${Math.round(totalPayrollValue).toLocaleString("en-IN")}`, note: "Net salary flowing through current payroll cycles.", icon: Wallet },
              ].map((item) => (
                <div key={item.label} className="dashboard-subtle-card">
                  <div className="flex items-center justify-between gap-3">
                    <p className="dashboard-label">{item.label}</p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#1f2638] text-[#f3dcc0]">
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-[30px] font-semibold leading-none text-[#24190f]">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-[#7a664e]">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <PortalProfileCard
          name={user?.name || "Admin"}
          roleLabel="System Administrator"
          subtitle="You are holding the highest-level operational view across the HR stack, with people data, reviews, and approvals all flowing through this workspace."
          imageUrl={user?.profileImage || user?.profilePhotoUrl || ""}
          meta={[
            { label: "Departments", value: `${departmentsCovered} active teams`, icon: Building2 },
            { label: "Pending leaves", value: `${pendingLeaves.length} approvals`, icon: CalendarDays },
            { label: "HR review queue", value: `${pendingHrReviews} profiles`, icon: ClipboardCheck },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Candidates"
          value={candidates.length}
          change="Pipeline population"
          changeType="positive"
          icon={UserCheck}
          color="info"
          delay={0}
          onClick={() => navigate("/admin/candidates")}
        />
        <StatCard
          title="Active Employees"
          value={activeEmployeesCount}
          change={`${employees.length} total people records`}
          changeType="positive"
          icon={Users}
          color="primary"
          delay={1}
          onClick={() => navigate("/admin/employees")}
        />
        <StatCard
          title="Pending HR Reviews"
          value={pendingHrReviews}
          change="Needs evaluation actions"
          changeType="neutral"
          icon={ClipboardCheck}
          color="warning"
          delay={2}
          onClick={() => navigate("/admin/candidates")}
        />
        <StatCard
          title="People Ops Queue"
          value={pendingLeaves.length}
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
          subtitle="A compact readiness score blending employee activity, team coverage, and approval load."
          breakdown={[
            { label: "Active employees", value: `${activeEmployeesCount}/${employees.length || 0}` },
            { label: "Departments covered", value: `${departmentsCovered}` },
            { label: "Pending approvals", value: `${pendingLeaves.length}` },
          ]}
        />

        <TaskProgressList
          title="Admin Priority Stack"
          subtitle="The most important actions for this portal, expressed as clean progress blocks instead of noisy analytics."
          tasks={[
            {
              title: "Leave approvals",
              description: `${pendingLeaves.length} requests are waiting for action from the admin queue.`,
              progress: Math.min(100, pendingLeaves.length === 0 ? 100 : 100 - pendingLeaves.length * 12),
              icon: CalendarDays,
            },
            {
              title: "HR evaluations",
              description: `${pendingHrReviews} candidates still need final review and decisions.`,
              progress: Math.min(100, pendingHrReviews === 0 ? 100 : 100 - pendingHrReviews * 14),
              icon: ClipboardCheck,
            },
            {
              title: "Hiring throughput",
              description: `${applicationsUnderReview} applicants are moving through the active recruitment stream.`,
              progress: Math.min(100, applicationsUnderReview * 18),
              icon: BriefcaseBusiness,
            },
          ]}
        />
      </div>

      <PortalCalendarCard
        title="Executive Calendar"
        subtitle="Shared events, approvals, and workforce moments are organized into a calm monthly calendar built to keep the admin view clear and actionable."
        events={calendarEvents}
      />

      {loading ? (
        <div className="dashboard-subtle-card text-sm text-[#7a664e]">Refreshing dashboard data...</div>
      ) : null}
    </div>
  );
};

export default AdminDashboard;
