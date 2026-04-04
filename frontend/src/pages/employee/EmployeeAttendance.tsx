import React, { useEffect, useMemo, useState } from "react";
import { Clock, FileClock, LogIn, LogOut } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { DataTable, StatusBadge } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  apiService,
  type AttendanceCorrectionRequestRecord,
  type AttendanceRecord,
} from "@/services/api";

type AttendanceTableRow = {
  _id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: string;
};

type CorrectionTableRow = {
  _id: string;
  date: string;
  type: string;
  requestedTime: string;
  reason: string;
  status: string;
  adminRemarks: string;
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const EmployeeAttendance: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [openCorrectionModal, setOpenCorrectionModal] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceTableRow[]>([]);
  const [requestRows, setRequestRows] = useState<CorrectionTableRow[]>([]);
  const [form, setForm] = useState({
    date: todayValue(),
    type: "check-in" as "check-in" | "check-out",
    time: "",
    reason: "",
  });

  const loadAttendance = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [attendance, correctionRequests] = await Promise.all([
        apiService.list<AttendanceRecord>("attendance"),
        apiService.listAttendanceCorrectionRequests(),
      ]);

      const normalizedAttendance = attendance
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((entry) => ({
          _id: entry._id,
          date: formatDateLabel(entry.date),
          checkIn: entry.checkIn || "-",
          checkOut: entry.checkOut || "-",
          hours: entry.hoursWorked ? `${entry.hoursWorked}h` : "-",
          status: entry.status ? `${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}` : "Present",
        }));

      const normalizedRequests = correctionRequests.map((request: AttendanceCorrectionRequestRecord) => ({
        _id: request._id,
        date: formatDateLabel(request.date),
        type: request.type === "check-in" ? "Check-in" : "Check-out",
        requestedTime: request.time,
        reason: request.reason,
        status: request.status.charAt(0).toUpperCase() + request.status.slice(1),
        adminRemarks: request.adminRemarks || "-",
      }));

      setAttendanceRows(normalizedAttendance);
      setRequestRows(normalizedRequests);

      const today = new Date();
      const latestToday = attendance.find((entry) => new Date(entry.date).toDateString() === today.toDateString());
      setCheckedIn(Boolean(latestToday?.checkIn && !latestToday?.checkOut));
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load attendance",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttendance();
  }, [user?.id]);

  const handleToggle = async () => {
    const now = new Date();
    const dateISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const timeText = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    try {
      const attendance = await apiService.list<AttendanceRecord>("attendance");
      const today = attendance.find((entry) => new Date(entry.date).toDateString() === new Date(dateISO).toDateString());

      if (!today) {
        await apiService.create("attendance", {
          date: dateISO,
          checkIn: timeText,
          status: "present",
        });
        toast({ title: "Checked in", description: "Your check-in has been recorded successfully." });
      } else if (!today.checkOut) {
        await apiService.update("attendance", today._id, {
          checkOut: timeText,
          status: "present",
        });
        toast({ title: "Checked out", description: "Your check-out has been recorded successfully." });
      }

      await loadAttendance();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark attendance",
        variant: "destructive",
      });
    }
  };

  const resetForm = () =>
    setForm({
      date: todayValue(),
      type: "check-in",
      time: "",
      reason: "",
    });

  const validateCorrectionForm = () => {
    if (!form.date || !form.type || !form.time || !form.reason.trim()) {
      return "All fields are required.";
    }

    if (!/^\d{2}:\d{2}$/.test(form.time)) {
      return "Please enter a valid time.";
    }

    if (form.date > todayValue()) {
      return "Future dates are not allowed.";
    }

    return "";
  };

  const handleSubmitCorrection = async () => {
    const validationError = validateCorrectionForm();
    if (validationError) {
      toast({ title: "Validation error", description: validationError, variant: "destructive" });
      return;
    }

    setSubmitLoading(true);
    try {
      await apiService.submitAttendanceCorrection({
        date: form.date,
        type: form.type,
        time: form.time,
        reason: form.reason.trim(),
      });

      toast({
        title: "Request submitted",
        description: "Your attendance correction request is now pending admin approval.",
      });
      setOpenCorrectionModal(false);
      resetForm();
      await loadAttendance();
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Failed to submit correction request",
        variant: "destructive",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const presentDays = useMemo(() => attendanceRows.filter((row) => row.status === "Present").length, [attendanceRows]);
  const pendingRequests = useMemo(() => requestRows.filter((row) => row.status === "Pending").length, [requestRows]);
  const avgHours = useMemo(() => {
    if (!attendanceRows.length) return "0h";
    const total = attendanceRows.reduce((sum, row) => sum + Number(row.hours.replace("h", "") || 0), 0);
    return `${(total / attendanceRows.length).toFixed(1)}h`;
  }, [attendanceRows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        subtitle="Track daily attendance, request missed check-ins or check-outs, and follow approval status in one place."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setOpenCorrectionModal(true)}
              className="gap-2 rounded-xl border-slate-200 bg-white/90"
            >
              <FileClock className="h-4 w-4" />
              Missed Check-in/Out
            </Button>
            <Button
              onClick={() => void handleToggle()}
              disabled={loading}
              className={checkedIn ? "gap-2 bg-destructive text-destructive-foreground" : "gradient-primary gap-2 text-primary-foreground"}
            >
              {checkedIn ? (
                <>
                  <LogOut className="h-4 w-4" />
                  Check Out
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Check In
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Days Present" value={presentDays} change="Attendance history" icon={Clock} color="success" />
        <StatCard title="Pending Requests" value={pendingRequests} change="Awaiting approval" icon={FileClock} color="warning" delay={1} />
        <StatCard title="Avg. Hours" value={avgHours} change="Per recorded day" icon={Clock} color="primary" delay={2} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="space-y-4 rounded-[28px] border bg-white p-5 shadow-card sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Attendance Log</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your recorded check-in, check-out, and working hours.</p>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading attendance...</div>
          ) : (
            <DataTable
              columns={[
                { key: "date", label: "Date" },
                { key: "checkIn", label: "Check In" },
                { key: "checkOut", label: "Check Out" },
                { key: "hours", label: "Hours" },
                { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
              ]}
              data={attendanceRows}
            />
          )}
        </section>

        <section className="space-y-4 rounded-[28px] border bg-white p-5 shadow-card sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Correction Requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">Past requests stay read-only until an admin approves or rejects them.</p>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading requests...</div>
          ) : (
            <DataTable
              columns={[
                { key: "date", label: "Date" },
                { key: "type", label: "Type" },
                { key: "requestedTime", label: "Requested Time" },
                { key: "reason", label: "Reason" },
                { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
                { key: "adminRemarks", label: "Admin Remarks" },
              ]}
              data={requestRows}
            />
          )}
        </section>
      </div>

      <Dialog
        open={openCorrectionModal}
        onOpenChange={(open) => {
          setOpenCorrectionModal(open);
          if (!open && !submitLoading) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl rounded-[30px] border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-0">
          <div className="rounded-[30px] p-6 sm:p-7">
            <DialogHeader>
              <DialogTitle>Request Attendance Correction</DialogTitle>
              <DialogDescription>
                Submit a missed check-in or check-out for admin approval. Direct edits to past attendance are not allowed.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Date</label>
                <DatePicker
                  value={form.date}
                  max={todayValue()}
                  onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Type</label>
                <Select value={form.type} onValueChange={(value: "check-in" | "check-out") => setForm((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger className="h-11 rounded-2xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check-in">Check-in</SelectItem>
                    <SelectItem value="check-out">Check-out</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Time</label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Reason</label>
                <Textarea
                  value={form.reason}
                  onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Explain what happened and why this attendance entry is missing."
                  className="min-h-[120px] rounded-2xl"
                />
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2 sm:justify-end">
              <Button variant="outline" disabled={submitLoading} onClick={() => setOpenCorrectionModal(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button disabled={submitLoading} onClick={() => void handleSubmitCorrection()} className="rounded-xl">
                {submitLoading ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeAttendance;
