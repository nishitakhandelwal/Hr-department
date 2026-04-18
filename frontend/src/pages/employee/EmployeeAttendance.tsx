import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, FileClock } from "lucide-react";

import GeoAttendanceCard from "@/components/attendance/GeoAttendanceCard";
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
  type GeoFenceValidationResult,
} from "@/services/api";

type AttendanceTableRow = {
  _id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  office: string;
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

const getCurrentCoordinates = () =>
  new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission was denied. Please allow location access to mark attendance."));
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error("Your current location could not be determined. Please try again."));
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error("Location request timed out. Please try again."));
          return;
        }
        reject(new Error("Failed to fetch your current location."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });

const EmployeeAttendance: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [locationError, setLocationError] = useState("");
  const [validation, setValidation] = useState<GeoFenceValidationResult | null>(null);
  const [openCorrectionModal, setOpenCorrectionModal] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceTableRow[]>([]);
  const [requestRows, setRequestRows] = useState<CorrectionTableRow[]>([]);
  const [correctionError, setCorrectionError] = useState("");
  const [form, setForm] = useState({
    date: todayValue(),
    type: "check-in" as "check-in" | "check-out",
    time: "",
    reason: "",
  });

  const loadAttendance = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setErrorMessage("");
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
          office:
            entry.checkOutLocation?.officeName ||
            entry.checkInLocation?.officeName ||
            "-",
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
      const latestToday = attendance.find((entry) => new Date(entry.date).toDateString() === today.toDateString()) || null;
      setTodayAttendance(latestToday);
      setCheckedIn(Boolean(latestToday?.checkIn && !latestToday?.checkOut));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load attendance";
      setErrorMessage(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const handleRefreshLocation = useCallback(async () => {
    setGeoLoading(true);
    setLocationError("");
    try {
      const coordinates = await getCurrentCoordinates();
      const result = await apiService.validateAttendanceLocation(coordinates);
      setValidation(result);
      setLocationStatus(result.message);
      toast({
        title: result.matched ? "Location verified" : "Outside office zone",
        description: result.message,
        variant: result.matched ? "default" : "destructive",
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to verify location";
      setLocationError(message);
      setLocationStatus("");
      setValidation(null);
      toast({
        title: "Location error",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      setGeoLoading(false);
    }
  }, [toast]);

  const handleToggle = async () => {
    setGeoLoading(true);
    setLocationError("");

    try {
      const coordinates = await getCurrentCoordinates();
      const action = checkedIn ? "check-out" : "check-in";
      const result = await apiService.markAttendance({
        action,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });

      setValidation(result.validation);
      setLocationStatus(result.validation.message);
      toast({
        title: action === "check-in" ? "Checked in" : "Checked out",
        description: result.validation.matchedLocation
          ? `${result.attendance.checkIn && action === "check-in" ? "Attendance recorded" : "Attendance updated"} for ${result.validation.matchedLocation.name}.`
          : "Attendance updated successfully.",
      });

      await loadAttendance();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark attendance";
      setLocationError(message);
      toast({
        title: "Attendance error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setGeoLoading(false);
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
      setCorrectionError(validationError);
      toast({ title: "Validation error", description: validationError, variant: "destructive" });
      return;
    }

    setCorrectionError("");
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
      setCorrectionError("");
      resetForm();
      await loadAttendance();
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : "Failed to submit correction request");
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
  const isCorrectionFormComplete = Boolean(form.date && form.type && form.time && form.reason.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        subtitle="Mark geo-fenced attendance, review recorded office matches, and request missed check-ins or check-outs when needed."
        action={
          <Button
            variant="outline"
            onClick={() => setOpenCorrectionModal(true)}
            className="rounded-xl border-slate-200 bg-white/90 dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#1A1816,#23201D)] dark:text-[#E6C7A3] dark:hover:border-[rgba(230,199,163,0.22)] dark:hover:bg-[rgba(230,199,163,0.12)] dark:hover:text-[#F5F5F5]"
          >
            <FileClock className="mr-2 h-4 w-4" />
            Missed Check-in/Out
          </Button>
        }
      />

      <GeoAttendanceCard
        loading={loading}
        locating={geoLoading}
        checkedIn={checkedIn}
        statusMessage={locationStatus}
        locationError={locationError}
        validation={validation}
        todayAttendance={todayAttendance}
        onRefreshLocation={handleRefreshLocation}
        onToggleAttendance={handleToggle}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Days Present" value={presentDays} change="Attendance history" icon={Clock} color="success" />
        <StatCard title="Pending Requests" value={pendingRequests} change="Awaiting approval" icon={FileClock} color="warning" delay={1} />
        <StatCard title="Avg. Hours" value={avgHours} change="Per recorded day" icon={Clock} color="primary" delay={2} />
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="space-y-4 rounded-[28px] border bg-white p-5 shadow-card sm:p-6 dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#111111,#1A1816)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-[#F5F5F5]">Attendance Log</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your recorded attendance history, including the office that matched your geo-fenced check-in or check-out.</p>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading attendance...</div>
          ) : (
            <DataTable
              columns={[
                { key: "date", label: "Date" },
                { key: "checkIn", label: "Check In" },
                { key: "checkOut", label: "Check Out" },
                { key: "office", label: "Office" },
                { key: "hours", label: "Hours" },
                { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
              ]}
              data={attendanceRows}
            />
          )}
        </section>

        <section className="space-y-4 rounded-[28px] border bg-white p-5 shadow-card sm:p-6 dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#111111,#1A1816)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-[#F5F5F5]">Correction Requests</h2>
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
          if (!open && !submitLoading) {
            resetForm();
            setCorrectionError("");
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-[30px] border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-0 dark:border-[#2A2623] dark:bg-[linear-gradient(145deg,#050505,#111111)]">
          <div className="rounded-[30px] p-6 sm:p-7 dark:text-[#F5F5F5]">
            <DialogHeader>
              <DialogTitle className="dark:text-[#F5F5F5]">Request Attendance Correction</DialogTitle>
              <DialogDescription className="dark:text-[#A1A1AA]">
                Submit a missed check-in or check-out for admin approval. Direct edits to past attendance are not allowed.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-[#F5F5F5]">Date</label>
                <DatePicker
                  value={form.date}
                  max={todayValue()}
                  onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                  className="h-11 rounded-2xl dark:border-[#2A2623] dark:bg-[#111111] dark:text-[#F5F5F5]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-[#F5F5F5]">Type</label>
                <Select value={form.type} onValueChange={(value: "check-in" | "check-out") => setForm((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger className="h-11 rounded-2xl dark:border-[#2A2623] dark:bg-[#111111] dark:text-[#F5F5F5]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-[#2A2623] dark:bg-[#111111] dark:text-[#F5F5F5]">
                    <SelectItem value="check-in" className="dark:text-[#F5F5F5]">Check-in</SelectItem>
                    <SelectItem value="check-out" className="dark:text-[#F5F5F5]">Check-out</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-[#F5F5F5]">Time</label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
                  className="h-11 rounded-2xl dark:border-[#2A2623] dark:bg-[#111111] dark:text-[#F5F5F5]"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-[#F5F5F5]">Reason</label>
                <Textarea
                  value={form.reason}
                  onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Explain what happened and why this attendance entry is missing."
                  className="min-h-[120px] rounded-2xl dark:border-[#2A2623] dark:bg-[#111111] dark:text-[#F5F5F5]"
                />
              </div>
            </div>

            {correctionError ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {correctionError}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Fill date, type, time, and reason before submitting the request.
              </p>
            )}

            <DialogFooter className="mt-6 gap-2 sm:justify-end">
              <Button variant="outline" disabled={submitLoading} onClick={() => setOpenCorrectionModal(false)} className="rounded-xl dark:border-[#2A2623] dark:bg-black dark:text-white dark:hover:bg-[#141414] dark:hover:text-white">
                Cancel
              </Button>
              <Button disabled={submitLoading || !isCorrectionFormComplete} onClick={() => void handleSubmitCorrection()} className="rounded-xl dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] dark:text-[#1A1816] dark:hover:bg-[linear-gradient(135deg,#A67C52,#E6C7A3)]">
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
