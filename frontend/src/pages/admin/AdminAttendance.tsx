import React, { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Filter, FileClock, PencilLine, XCircle } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { DataTable, StatusBadge } from "@/components/DataTable";
import AttendanceTable, { attendanceExportColumns } from "@/components/tables/AttendanceTable";
import { ExportButton } from "@/components/common/ExportButton";
import { useToast } from "@/hooks/use-toast";
import {
  apiService,
  type AttendanceCorrectionRequestRecord,
  type AttendanceRecord,
} from "@/services/api";
import FilterDrawer from "@/components/common/FilterDrawer";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EmployeeRecord } from "@/services/api";

type AttendanceRow = {
  _id: string;
  employeeId: string;
  name: string;
  date: string;
  dateISO: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: string;
  entryType?: string;
  isManual: boolean;
};

type CorrectionRow = {
  _id: string;
  employeeName: string;
  date: string;
  type: string;
  requestedTime: string;
  reason: string;
  status: string;
  adminRemarks: string;
};

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatDateInput = (value: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimeInput = (value?: string) => {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";

  const twentyFourHour = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHour) {
    return `${String(Number(twentyFourHour[1])).padStart(2, "0")}:${twentyFourHour[2]}`;
  }

  const twelveHour = text.match(/^(0?\d|1[0-2]):([0-5]\d)\s?(AM|PM)$/);
  if (!twelveHour) return "";

  let hours = Number(twelveHour[1]) % 12;
  if (twelveHour[3] === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${twelveHour[2]}`;
};

const getEmployeeNameFromRecord = (row: AttendanceRecord) =>
  typeof row.employeeId === "object" ? row.employeeId?.userId?.name || row.employeeId?.fullName || "" : "";

const AdminAttendance: React.FC = () => {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<AttendanceCorrectionRequestRecord[]>([]);
  const [correctionRows, setCorrectionRows] = useState<CorrectionRow[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ search: "", status: "", date: "" });
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "", date: "" });
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AttendanceCorrectionRequestRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMode, setOverrideMode] = useState<"create" | "edit">("create");
  const [overrideError, setOverrideError] = useState("");
  const [overrideForm, setOverrideForm] = useState({
    employeeId: "",
    date: "",
    checkIn: "",
    checkOut: "",
    status: "present" as "present" | "late" | "absent" | "leave",
  });
  const { toast } = useToast();

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [attendanceData, correctionData, employeeData] = await Promise.all([
        apiService.list<AttendanceRecord>("attendance"),
        apiService.listAttendanceCorrectionRequests(),
        apiService.listEmployees(),
      ]);

      const mappedAttendance: AttendanceRow[] = attendanceData.map((row) => ({
        _id: row._id,
        employeeId: typeof row.employeeId === "object" ? row.employeeId?._id || "" : row.employeeId || "",
        name: getEmployeeNameFromRecord(row),
        date: row.date ? formatDateLabel(row.date) : "",
        dateISO: formatDateInput(row.date),
        checkIn: row.checkIn || "-",
        checkOut: row.checkOut || "-",
        hours: row.hoursWorked ? `${row.hoursWorked}h` : "-",
        status: row.status ? String(row.status).charAt(0).toUpperCase() + String(row.status).slice(1) : "Present",
        entryType: row.isManual ? "Manual Entry" : "",
        isManual: Boolean(row.isManual),
      }));

      const mappedCorrections: CorrectionRow[] = correctionData.map((request) => ({
        _id: request._id,
        employeeName:
          typeof request.employeeId === "object"
            ? request.employeeId?.userId?.name || request.employeeId?.fullName || ""
            : typeof request.userId === "object"
            ? request.userId?.name || ""
            : "",
        date: formatDateLabel(request.date),
        type: request.type === "check-in" ? "Check-in" : "Check-out",
        requestedTime: request.time,
        reason: request.reason,
        status: request.status.charAt(0).toUpperCase() + request.status.slice(1),
        adminRemarks: request.adminRemarks || "-",
      }));

      setRows(mappedAttendance);
      setEmployees(employeeData);
      setCorrectionRequests(correctionData);
      setCorrectionRows(mappedCorrections);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch attendance",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const filteredAttendance = rows.filter((row) => {
    const term = appliedFilters.search.toLowerCase();
    const matchesSearch = !term || row.name.toLowerCase().includes(term) || row.date.toLowerCase().includes(term);
    const matchesStatus = !appliedFilters.status || row.status === appliedFilters.status;
    const matchesDate =
      !appliedFilters.date ||
      row.date === new Date(appliedFilters.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return matchesSearch && matchesStatus && matchesDate;
  });

  const pendingCorrections = useMemo(
    () => correctionRows.filter((row) => row.status === "Pending").length,
    [correctionRows]
  );
  const approvedCorrections = useMemo(
    () => correctionRows.filter((row) => row.status === "Approved").length,
    [correctionRows]
  );

  const employeeOptions = useMemo(
    () =>
      employees
        .map((employee) => ({
          id: employee._id,
          name:
            typeof employee.userId === "object"
              ? employee.userId?.name || employee.fullName || employee.email || "Employee"
              : employee.fullName || employee.email || "Employee",
          email:
            typeof employee.userId === "object"
              ? employee.userId?.email || employee.email || ""
              : employee.email || "",
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [employees]
  );

  const openOverrideDialog = (row?: AttendanceRow) => {
    if (row) {
      setOverrideMode("edit");
      setOverrideForm({
        employeeId: row.employeeId,
        date: row.dateISO,
        checkIn: formatTimeInput(row.checkIn === "-" ? "" : row.checkIn),
        checkOut: formatTimeInput(row.checkOut === "-" ? "" : row.checkOut),
        status: row.status.toLowerCase() as "present" | "late" | "absent" | "leave",
      });
    } else {
      setOverrideMode("create");
      setOverrideForm({
        employeeId: "",
        date: formatDateInput(new Date().toISOString()),
        checkIn: "",
        checkOut: "",
        status: "present",
      });
    }
    setOverrideError("");
    setOverrideDialogOpen(true);
  };

  const validateOverrideForm = () => {
    if (!overrideForm.employeeId) return "Employee is required.";
    if (!overrideForm.date) return "Date is required.";
    if (overrideForm.checkIn && !/^\d{2}:\d{2}$/.test(overrideForm.checkIn)) return "Please enter a valid check-in time.";
    if (overrideForm.checkOut && !/^\d{2}:\d{2}$/.test(overrideForm.checkOut)) return "Please enter a valid check-out time.";

    if (overrideForm.checkIn && overrideForm.checkOut && overrideForm.checkOut <= overrideForm.checkIn) {
      return "Check-out time must be after check-in time.";
    }

    return "";
  };

  const handleOverrideSave = async () => {
    const validationError = validateOverrideForm();
    if (validationError) {
      setOverrideError(validationError);
      toast({ title: "Validation error", description: validationError, variant: "destructive" });
      return;
    }

    setOverrideLoading(true);
    setOverrideError("");
    try {
      await apiService.adminOverrideAttendance({
        employeeId: overrideForm.employeeId,
        date: overrideForm.date,
        checkIn: overrideForm.checkIn || undefined,
        checkOut: overrideForm.checkOut || undefined,
        status: overrideForm.status,
      });

      toast({
        title: overrideMode === "edit" ? "Attendance updated" : "Attendance created",
        description: "Manual attendance override has been saved successfully.",
      });

      setOverrideDialogOpen(false);
      await loadAttendance();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save manual attendance";
      setOverrideError(message);
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setOverrideLoading(false);
    }
  };

  const openReviewDialog = (id: string, action: "approved" | "rejected") => {
    const request = correctionRequests.find((item) => item._id === id) || null;
    if (!request) return;

    setReviewTarget(request);
    setReviewAction(action);
    setReviewRemarks("");
    setReviewDialogOpen(true);
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    setReviewLoading(true);
    try {
      await apiService.reviewAttendanceCorrection(reviewTarget._id, {
        action: reviewAction,
        adminRemarks: reviewRemarks.trim(),
      });

      toast({
        title: reviewAction === "approved" ? "Request approved" : "Request rejected",
        description:
          reviewAction === "approved"
            ? "Attendance has been updated automatically."
            : "The correction request has been rejected.",
      });

      setReviewDialogOpen(false);
      setReviewTarget(null);
      setReviewRemarks("");
      await loadAttendance();
    } catch (error) {
      toast({
        title: "Review failed",
        description: error instanceof Error ? error.message : "Failed to review correction request",
        variant: "destructive",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Track employee attendance, manage missed check-in or check-out requests, and keep working hours accurate."
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => openOverrideDialog()}
              className="gap-2 rounded-xl"
              type="button"
            >
              <PencilLine className="h-4 w-4" />
              Edit Attendance
            </Button>
            <Button
              variant="outline"
              className="gap-2 rounded-xl border-slate-200 bg-white/90"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <ExportButton
              moduleName="attendance"
              rows={filteredAttendance}
              fallbackRows={rows}
              columns={attendanceExportColumns}
              filters={appliedFilters}
              loading={loading}
              emptyMessage="No data to export"
              preferServerExport={false}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Attendance Records" value={rows.length} change="All tracked entries" icon={FileClock} color="primary" />
        <StatCard title="Pending Corrections" value={pendingCorrections} change="Needs admin review" icon={XCircle} color="warning" delay={1} />
        <StatCard title="Approved Corrections" value={approvedCorrections} change="Attendance updated" icon={CheckCircle2} color="success" delay={2} />
      </div>

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="rounded-2xl bg-white p-1 shadow-card">
          <TabsTrigger value="attendance" className="rounded-xl px-4">Attendance Records</TabsTrigger>
          <TabsTrigger value="corrections" className="rounded-xl px-4">Correction Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading attendance...</div>
          ) : filteredAttendance.length === 0 ? (
            <EmptyState
              title="No attendance records found"
              description="No data is available for the selected filters."
              action={<Button variant="outline" onClick={() => void loadAttendance()}>Refresh list</Button>}
            />
          ) : (
            <AttendanceTable
              data={filteredAttendance.map((row) => ({
                ...row,
                actions: (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl dark:border-[#2A2623] dark:bg-[rgba(230,199,163,0.06)] dark:text-[#E6C7A3]"
                    onClick={(event) => {
                      event.stopPropagation();
                      openOverrideDialog(row);
                    }}
                  >
                    Edit Attendance
                  </Button>
                ),
              }))}
            />
          )}
        </TabsContent>

        <TabsContent value="corrections">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading correction requests...</div>
          ) : correctionRows.length === 0 ? (
            <EmptyState
              title="No correction requests yet"
              description="Missed attendance requests will appear here for approval."
              action={<Button variant="outline" onClick={() => void loadAttendance()}>Refresh list</Button>}
            />
          ) : (
            <DataTable
              columns={[
                { key: "employeeName", label: "Employee Name" },
                { key: "date", label: "Date" },
                { key: "type", label: "Type" },
                { key: "requestedTime", label: "Requested Time" },
                { key: "reason", label: "Reason" },
                { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
                { key: "adminRemarks", label: "Admin Remarks" },
                {
                  key: "actions",
                  label: "Actions",
                  render: (item) => (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl"
                        disabled={reviewLoading || item.status !== "Pending"}
                        onClick={(event) => {
                          event.stopPropagation();
                          openReviewDialog(String(item._id), "approved");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5"
                        disabled={reviewLoading || item.status !== "Pending"}
                        onClick={(event) => {
                          event.stopPropagation();
                          openReviewDialog(String(item._id), "rejected");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={correctionRows}
            />
          )}
        </TabsContent>
      </Tabs>

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        values={draftFilters}
        onChange={(key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }))}
        onApply={(values) =>
          setAppliedFilters({
            search: values.search || "",
            status: values.status || "",
            date: values.date || "",
          })
        }
        onReset={() => {
          const cleared = { search: "", status: "", date: "" };
          setDraftFilters(cleared);
          setAppliedFilters(cleared);
        }}
        filters={[
          { key: "search", label: "Search", type: "text", placeholder: "Search by employee or date" },
          {
            key: "status",
            label: "Status",
            type: "select",
            placeholder: "All statuses",
            options: [
              { label: "Present", value: "Present" },
              { label: "Late", value: "Late" },
              { label: "Absent", value: "Absent" },
              { label: "Leave", value: "Leave" },
            ],
          },
          { key: "date", label: "Date", type: "date" },
        ]}
      />

      <Dialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          if (overrideLoading) return;
          setOverrideDialogOpen(open);
          if (!open) setOverrideError("");
        }}
      >
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{overrideMode === "edit" ? "Edit Attendance" : "Create Attendance"}</DialogTitle>
            <DialogDescription>
              Add missing check-in or check-out details, or create a manual attendance entry when no record exists.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Employee</label>
              <Select
                value={overrideForm.employeeId}
                onValueChange={(value) => setOverrideForm((prev) => ({ ...prev, employeeId: value }))}
                disabled={overrideLoading || overrideMode === "edit"}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}{employee.email ? ` - ${employee.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Date</label>
              <DatePicker
                value={overrideForm.date}
                onChange={(event) => setOverrideForm((prev) => ({ ...prev, date: event.target.value }))}
                className="rounded-2xl"
                disabled={overrideLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
              <Select
                value={overrideForm.status}
                onValueChange={(value) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    status: value as "present" | "late" | "absent" | "leave",
                  }))
                }
                disabled={overrideLoading}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Check-in</label>
              <Input
                type="time"
                value={overrideForm.checkIn}
                onChange={(event) => setOverrideForm((prev) => ({ ...prev, checkIn: event.target.value }))}
                className="rounded-2xl"
                disabled={overrideLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Check-out</label>
              <Input
                type="time"
                value={overrideForm.checkOut}
                onChange={(event) => setOverrideForm((prev) => ({ ...prev, checkOut: event.target.value }))}
                className="rounded-2xl"
                disabled={overrideLoading}
              />
            </div>
          </div>

          {overrideError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {overrideError}
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" disabled={overrideLoading} onClick={() => setOverrideDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="button" disabled={overrideLoading} onClick={() => void handleOverrideSave()} className="rounded-xl">
              {overrideLoading ? "Saving..." : overrideMode === "edit" ? "Save Attendance" : "Create Attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          if (reviewLoading) return;
          setReviewDialogOpen(open);
          if (!open) {
            setReviewTarget(null);
            setReviewRemarks("");
          }
        }}
      >
        <DialogContent className="max-w-xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{reviewAction === "approved" ? "Approve" : "Reject"} Correction Request</DialogTitle>
            <DialogDescription>
              {reviewAction === "approved"
                ? "Approving this request will update the employee attendance record automatically."
                : "Reject this request if the submitted time or reason is not valid."}
            </DialogDescription>
          </DialogHeader>

          {reviewTarget ? (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-slate-50/80 p-4 text-sm text-slate-700">
                <p><span className="font-medium text-slate-950">Employee:</span> {typeof reviewTarget.employeeId === "object" ? reviewTarget.employeeId?.userId?.name || reviewTarget.employeeId?.fullName : ""}</p>
                <p><span className="font-medium text-slate-950">Date:</span> {formatDateLabel(reviewTarget.date)}</p>
                <p><span className="font-medium text-slate-950">Type:</span> {reviewTarget.type === "check-in" ? "Check-in" : "Check-out"}</p>
                <p><span className="font-medium text-slate-950">Requested Time:</span> {reviewTarget.time}</p>
                <p><span className="font-medium text-slate-950">Reason:</span> {reviewTarget.reason}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Admin remarks</label>
                <Textarea
                  value={reviewRemarks}
                  onChange={(event) => setReviewRemarks(event.target.value)}
                  placeholder={
                    reviewAction === "approved"
                      ? "Optional notes for the employee."
                      : "Optional reason for rejection."
                  }
                  className="min-h-[120px] rounded-2xl"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={reviewLoading} onClick={() => setReviewDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button disabled={reviewLoading} onClick={() => void handleReview()} className="rounded-xl">
              {reviewLoading ? "Saving..." : reviewAction === "approved" ? "Approve Request" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAttendance;
