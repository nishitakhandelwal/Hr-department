import React, { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, CheckCircle, Clock, DollarSign, FileText, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import PortalProfileCard from "@/components/dashboard/PortalProfileCard";
import CircularStatsWidget from "@/components/dashboard/CircularStatsWidget";
import TaskProgressList from "@/components/dashboard/TaskProgressList";
import PortalCalendarCard, { type PortalCalendarEvent } from "@/components/dashboard/PortalCalendarCard";
import { useAuth } from "@/context/AuthContext";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type AttendanceSummaryRow = {
  date: string;
  checkOut?: string;
  hoursWorked?: number;
};

type LeaveSummaryRow = {
  fromDate?: string;
  toDate?: string;
};

type PayrollSummaryRow = {
  month?: string;
  netSalary?: number;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [attendanceRows, setAttendanceRows] = useState<AttendanceSummaryRow[]>([]);
  const [leaveRows, setLeaveRows] = useState<LeaveSummaryRow[]>([]);
  const [payrollRows, setPayrollRows] = useState<PayrollSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [attendance, leaves, payroll] = await Promise.all([
          apiService.list<AttendanceSummaryRow>("attendance"),
          apiService.list<LeaveSummaryRow>("leave"),
          apiService.list<PayrollSummaryRow>("payroll"),
        ]);
        setAttendanceRows(attendance);
        setLeaveRows(leaves);
        setPayrollRows(payroll);
      } catch (error) {
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to load dashboard", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, toast]);

  const latestPayroll = payrollRows[0];
  const usedLeaveDays = leaveRows.reduce((sum: number, row) => {
    if (!row.fromDate || !row.toDate) return sum;
    const from = new Date(row.fromDate);
    const to = new Date(row.toDate);
    return sum + (Math.ceil((to.getTime() - from.getTime()) / (1000 * 3600 * 24)) + 1);
  }, 0);
  const today = useMemo(() => startOfDay(new Date()), []);
  const attendanceScore = attendanceRows.length ? Math.min(100, 62 + attendanceRows.length * 6) : 48;
  const todayStatus = attendanceRows[0] ? (attendanceRows[0]?.checkOut ? "Checked Out" : "Checked In") : "No record";

  const calendarEvents = useMemo<PortalCalendarEvent[]>(() => {
    const items: PortalCalendarEvent[] = leaveRows.slice(0, 3).map((leave, index) => ({
      id: `leave-${index}`,
      title: "Personal leave block",
      date: leave.fromDate || format(addDays(today, index + 4), "yyyy-MM-dd"),
      type: "holiday",
      note: leave.toDate ? `Scheduled through ${leave.toDate}.` : "Leave window added to your plan.",
    }));

    items.push({
      id: "standup",
      title: "Weekly team sync",
      date: format(addDays(today, 1), "yyyy-MM-dd"),
      type: "meeting",
      time: "11:00 AM",
      note: "A focused check-in with your reporting team.",
    });

    items.push({
      id: "payday",
      title: "Payroll release window",
      date: format(addDays(today, 6), "yyyy-MM-dd"),
      type: "reminder",
      note: latestPayroll?.month ? `Latest visible cycle: ${latestPayroll.month}.` : "Keep payslip documents ready.",
    });

    items.push({
      id: "birthday",
      title: "Team celebration",
      date: format(addDays(today, 8), "yyyy-MM-dd"),
      type: "birthday",
      note: "A small team moment captured in your shared calendar.",
    });

    return items;
  }, [leaveRows, latestPayroll?.month, today]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] || "User"}`}
        subtitle="A calm personal workspace for attendance, leave, payroll, and daily coordination with the same premium system used across every HR portal."
        action={
          <Button variant="outline" className="gap-2 rounded-[18px]" onClick={() => navigate("/employee/profile")}>
            Open Profile
            <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="dashboard-panel relative overflow-hidden p-7"
        >
          <div className="pointer-events-none absolute -right-10 top-2 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(207,174,116,0.24),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute left-0 top-0 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(255,248,235,0.95),transparent_68%)] blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-[#e0cfb3] bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9a7747]">
              Employee Pulse
            </div>
            <h2 className="mt-4 max-w-3xl text-[34px] font-semibold leading-tight tracking-[-0.04em] text-[#24190f]">
              Daily work, benefits, and visibility in one elegant, low-friction dashboard.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f5a43]">
              Everything important stays visible, polished, and easy to act on without turning the employee experience into an analytics wall.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { label: "Attendance entries", value: String(attendanceRows.length), note: "Recent records captured in your timeline.", icon: Clock },
                { label: "Leave used", value: `${usedLeaveDays} days`, note: "Approved leave already consumed this cycle.", icon: CalendarDays },
                { label: "Latest payroll", value: currency.format(Number(latestPayroll?.netSalary || 0)), note: latestPayroll?.month || "Payroll data becomes visible here.", icon: DollarSign },
              ].map((item) => (
                <div key={item.label} className="dashboard-subtle-card">
                  <div className="flex items-center justify-between gap-3">
                    <p className="dashboard-label">{item.label}</p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#1f2638] text-[#f3dcc0]">
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-[28px] font-semibold leading-none text-[#24190f]">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-[#7a664e]">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <PortalProfileCard
          name={user?.name || "Employee"}
          roleLabel="Employee Portal"
          subtitle="This personal dashboard keeps your workflow simple: review attendance, check leave balance, confirm payroll, and stay ready for team events."
          imageUrl={user?.profileImage || user?.profilePhotoUrl || ""}
          meta={[
            { label: "Current status", value: todayStatus, icon: CheckCircle },
            { label: "Leave balance", value: `${Math.max(20 - usedLeaveDays, 0)} days`, icon: CalendarDays },
            { label: "Profile access", value: "Open employee profile", icon: UserCircle },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's Status" value={todayStatus} change="Live check-in flow" changeType="positive" icon={Clock} color="success" delay={0} onClick={() => navigate("/employee/attendance")} />
        <StatCard title="Leave Balance" value={`${Math.max(20 - usedLeaveDays, 0)} days`} change={`${usedLeaveDays} used`} changeType="neutral" icon={CalendarDays} color="info" delay={1} onClick={() => navigate("/employee/leave")} />
        <StatCard title="This Month's Pay" value={currency.format(Number(latestPayroll?.netSalary || 0))} change={latestPayroll?.month || "No payroll record yet"} changeType="positive" icon={DollarSign} color="primary" delay={2} onClick={() => navigate("/employee/payroll")} />
        <StatCard title="Letters" value="Open module" change="Downloads and formal docs" changeType="neutral" icon={FileText} color="warning" delay={3} onClick={() => navigate("/employee/letters")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CircularStatsWidget
          label="Attendance Consistency"
          value={attendanceScore}
          subtitle="A quick confidence score blending attendance activity, leave usage, and personal routine stability."
          breakdown={[
            { label: "Attendance records", value: `${attendanceRows.length}` },
            { label: "Leave consumed", value: `${usedLeaveDays} days` },
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
              progress: Math.min(100, 40 + attendanceRows.length * 10),
              icon: Clock,
            },
            {
              title: "Leave planning",
              description: "Track time away early so approvals and handovers stay easy.",
              progress: Math.max(20, 100 - usedLeaveDays * 4),
              icon: CalendarDays,
            },
            {
              title: "Payroll awareness",
              description: "Review the latest cycle and keep compensation details visible.",
              progress: latestPayroll ? 88 : 34,
              icon: DollarSign,
            },
          ]}
        />
      </div>

      <PortalCalendarCard
        title="Employee Calendar"
        subtitle="Meetings, holidays, personal leave, and team moments are organized into the same premium calendar system used across the full HR platform."
        events={calendarEvents}
      />

      {loading ? <div className="dashboard-subtle-card text-sm text-[#7a664e]">Refreshing your workspace...</div> : null}
    </div>
  );
};

export default EmployeeDashboard;
