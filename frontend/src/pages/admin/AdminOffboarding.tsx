import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  Download,
  FileUp,
  FileText,
  FolderSync,
  Landmark,
  Search,
  ShieldCheck,
  PencilLine,
  Plus,
  RefreshCcw,
  Trash2,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/DataTable";
import { ExportButton } from "@/components/common/ExportButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  apiService,
  type EmployeeRecord,
  type OffboardingRecord,
  type OffboardingStatus,
} from "@/services/api";
import { destructiveButtonClass } from "@/lib/destructive";

type OffboardingFormState = {
  employeeRef: string;
  employeeName: string;
  employeeCode: string;
  employeeEmail: string;
  department: string;
  managerName: string;
  joiningDate: string;
  exitType: "resignation" | "termination" | "absconding";
  noticePeriod: string;
  lastWorkingDay: string;
  actualLastWorkingDay: string;
  exitInterviewStatus: OffboardingStatus;
  hrClearance: OffboardingStatus;
  itClearance: OffboardingStatus;
  financeClearance: OffboardingStatus;
  assetsReturnStatus: OffboardingStatus;
  fnfStatus: OffboardingStatus;
  rehireEligibility: "eligible" | "not_eligible" | "under_review";
  status: OffboardingStatus;
  remarks: string;
  employeeRemarks: string;
};

const STATUS_OPTIONS: OffboardingStatus[] = ["pending", "approved", "completed", "rejected"];
const EXIT_TYPE_OPTIONS: Array<OffboardingFormState["exitType"]> = ["resignation", "termination", "absconding"];
const REHIRE_OPTIONS: Array<OffboardingFormState["rehireEligibility"]> = ["eligible", "not_eligible", "under_review"];
const DOCUMENT_KEYS = [
  { key: "relievingLetter", label: "Relieving Letter" },
  { key: "experienceLetter", label: "Experience Letter" },
  { key: "clearanceForm", label: "Clearance Form" },
] as const;

const offboardingExportColumns = [
  { key: "employeeCode", label: "Employee ID" },
  { key: "employeeName", label: "Employee" },
  { key: "department", label: "Department" },
  { key: "managerName", label: "Manager" },
  { key: "joiningDate", label: "Joining Date" },
  { key: "exitType", label: "Exit Type" },
  { key: "noticePeriod", label: "Notice Period" },
  { key: "lastWorkingDay", label: "Last Working Day" },
  { key: "actualLastWorkingDay", label: "Actual Last Working Day" },
  { key: "exitInterviewStatus", label: "Exit Interview" },
  { key: "clearanceHr", label: "HR Clearance" },
  { key: "clearanceIt", label: "IT Clearance" },
  { key: "clearanceFinance", label: "Finance Clearance" },
  { key: "assetsReturnStatus", label: "Assets Return" },
  { key: "fnfStatus", label: "FNF Status" },
  { key: "rehireEligibility", label: "Rehire Eligibility" },
  { key: "status", label: "Status" },
];

const emptyForm = (): OffboardingFormState => ({
  employeeRef: "",
  employeeName: "",
  employeeCode: "",
  employeeEmail: "",
  department: "",
  managerName: "",
  joiningDate: "",
  exitType: "resignation",
  noticePeriod: "",
  lastWorkingDay: "",
  actualLastWorkingDay: "",
  exitInterviewStatus: "pending",
  hrClearance: "pending",
  itClearance: "pending",
  financeClearance: "pending",
  assetsReturnStatus: "pending",
  fnfStatus: "pending",
  rehireEligibility: "under_review",
  status: "pending",
  remarks: "",
  employeeRemarks: "",
});

const panelClassName =
  "rounded-[28px] border border-[var(--portal-surface-border)] bg-[linear-gradient(180deg,var(--portal-surface-bg-strong),var(--portal-surface-bg))] shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:bg-[#0a0a0a] dark:shadow-[0_18px_45px_rgba(0,0,0,0.36)]";

const inputClassName =
  "border-[var(--portal-surface-border)] bg-white/90 text-[var(--portal-heading-color)] dark:bg-[#111111] dark:text-white";

const subtlePanelClassName =
  "rounded-[22px] border border-[var(--portal-surface-border)] bg-white/76 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:bg-[#111111]";

const compactSelectClassName = `h-9 rounded-xl border-[var(--portal-surface-border)] bg-white text-[var(--portal-heading-color)] dark:bg-[#111111] dark:text-white`;

const toInputDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const toLabel = (value?: string | null) =>
  String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isDoneStatus = (value?: string | null) => ["approved", "completed"].includes(String(value || "").toLowerCase());

const getWorkflowCompletion = (record: OffboardingRecord) => {
  const checkpoints = [
    record.exitInterviewStatus,
    record.clearanceStatus?.hr,
    record.clearanceStatus?.it,
    record.clearanceStatus?.finance,
    record.assetsReturnStatus,
    record.fnfStatus,
  ];
  const completed = checkpoints.filter((item) => isDoneStatus(item)).length;
  return {
    completed,
    total: checkpoints.length,
    percent: Math.round((completed / checkpoints.length) * 100),
  };
};

const getDocumentSummary = (record: OffboardingRecord) => {
  const uploaded = DOCUMENT_KEYS.filter((item) => Boolean(record.documents?.[item.key]?.url)).length;
  return `${uploaded}/${DOCUMENT_KEYS.length} uploaded`;
};

const getEmployeeRecordId = (record?: OffboardingRecord | null) =>
  typeof record?.employeeRef === "string"
    ? record.employeeRef
    : record?.employeeRef && typeof record.employeeRef === "object"
      ? record.employeeRef._id
      : "";

const buildFormFromRecord = (record?: OffboardingRecord | null): OffboardingFormState => ({
  employeeRef: getEmployeeRecordId(record),
  employeeName: record?.employeeName || record?.name || "",
  employeeCode: record?.employeeCode || record?.employeeId || "",
  employeeEmail: record?.employeeEmail || "",
  department: record?.department || "",
  managerName: record?.managerName || record?.reportingPerson || "",
  joiningDate: toInputDate(record?.joiningDate),
  exitType: record?.exitType || "resignation",
  noticePeriod: record?.noticePeriod || "",
  lastWorkingDay: toInputDate(record?.lastWorkingDay || record?.lastDay),
  actualLastWorkingDay: toInputDate(record?.actualLastWorkingDay),
  exitInterviewStatus: record?.exitInterviewStatus || "pending",
  hrClearance: record?.clearanceStatus?.hr || "pending",
  itClearance: record?.clearanceStatus?.it || "pending",
  financeClearance: record?.clearanceStatus?.finance || "pending",
  assetsReturnStatus: record?.assetsReturnStatus || "pending",
  fnfStatus: record?.fnfStatus || "pending",
  rehireEligibility: record?.rehireEligibility || "under_review",
  status: record?.status || "pending",
  remarks: record?.remarks || "",
  employeeRemarks: record?.employeeRemarks || "",
});

const createDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

const AdminOffboarding: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<OffboardingRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OffboardingRecord | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailRecordId, setDetailRecordId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<OffboardingFormState>(emptyForm());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [offboardingRows, employeeRows] = await Promise.all([
        apiService.listOffboarding(),
        apiService.listEmployees(),
      ]);
      setRows(offboardingRows);
      setEmployees(employeeRows);
    } catch (error) {
      toast({
        title: "Unable to load offboarding",
        description: error instanceof Error ? error.message : "Offboarding records could not be loaded.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const employeeLookup = useMemo(
    () => new Map(employees.map((employee) => [employee._id, employee])),
    [employees]
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [
        row.employeeCode,
        row.employeeName,
        row.department,
        row.managerName,
        row.exitType,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [rows, search]);

  const resignationRequests = useMemo(
    () => filteredRows.filter((row) => Boolean(row.resignationRequest)),
    [filteredRows]
  );

  const pendingResignationRequests = useMemo(
    () => resignationRequests.filter((row) => row.resignationRequest?.status === "pending"),
    [resignationRequests]
  );

  const activeOffboardingRows = useMemo(
    () => filteredRows.filter((row) => !row.resignationRequest || row.resignationRequest.status === "approved"),
    [filteredRows]
  );

  const detailRecord = useMemo(
    () => activeOffboardingRows.find((row) => row._id === detailRecordId) || rows.find((row) => row._id === detailRecordId) || null,
    [activeOffboardingRows, detailRecordId, rows]
  );

  const exportRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        employeeCode: row.employeeCode || row.employeeId || "",
        employeeName: row.employeeName || row.name || "",
        department: row.department || "",
        managerName: row.managerName || row.reportingPerson || "",
        joiningDate: formatDate(row.joiningDate),
        exitType: toLabel(row.exitType || row.reason),
        noticePeriod: row.noticePeriod || "",
        lastWorkingDay: formatDate(row.lastWorkingDay || row.lastDay),
        actualLastWorkingDay: formatDate(row.actualLastWorkingDay),
        exitInterviewStatus: toLabel(row.exitInterviewStatus),
        clearanceHr: toLabel(row.clearanceStatus?.hr),
        clearanceIt: toLabel(row.clearanceStatus?.it),
        clearanceFinance: toLabel(row.clearanceStatus?.finance),
        assetsReturnStatus: toLabel(row.assetsReturnStatus),
        fnfStatus: toLabel(row.fnfStatus),
        rehireEligibility: toLabel(row.rehireEligibility),
        status: toLabel(row.status),
      })),
    [filteredRows]
  );

  const summary = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((row) => row.status === "pending").length,
      completed: rows.filter((row) => row.status === "completed").length,
      fnfOpen: rows.filter((row) => row.fnfStatus !== "completed").length,
      resignationPending: rows.filter((row) => row.resignationRequest?.status === "pending").length,
    }),
    [rows]
  );

  const openCreateDialog = () => {
    setEditingRecord(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (record: OffboardingRecord) => {
    setEditingRecord(record);
    setForm(buildFormFromRecord(record));
    setDialogOpen(true);
  };

  const openDetailDialog = (record: OffboardingRecord) => {
    setDetailRecordId(record._id || "");
    setDetailDialogOpen(true);
  };

  const applyEmployeeSelection = (employeeId: string) => {
    const employee = employeeLookup.get(employeeId);
    setForm((current) => ({
      ...current,
      employeeRef: employeeId,
      employeeName: employee?.fullName || "",
      employeeCode: employee?.employeeId || "",
      employeeEmail: employee?.email || "",
      department: employee?.department || "",
      joiningDate: toInputDate(employee?.joiningDate),
    }));
  };

  const handleSave = async () => {
    if (!form.employeeName.trim() || !form.department.trim() || !form.lastWorkingDay) {
      toast({
        title: "Missing required fields",
        description: "Employee, department, and last working day are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employeeRef: form.employeeRef || undefined,
        employeeName: form.employeeName.trim(),
        employeeCode: form.employeeCode.trim(),
        employeeEmail: form.employeeEmail.trim(),
        department: form.department.trim(),
        managerName: form.managerName.trim(),
        joiningDate: form.joiningDate || undefined,
        exitType: form.exitType,
        noticePeriod: form.noticePeriod.trim(),
        lastWorkingDay: form.lastWorkingDay,
        actualLastWorkingDay: form.actualLastWorkingDay || undefined,
        exitInterviewStatus: form.exitInterviewStatus,
        clearanceStatus: {
          hr: form.hrClearance,
          it: form.itClearance,
          finance: form.financeClearance,
        },
        assetsReturnStatus: form.assetsReturnStatus,
        fnfStatus: form.fnfStatus,
        rehireEligibility: form.rehireEligibility,
        status: form.status,
        remarks: form.remarks.trim(),
        employeeRemarks: form.employeeRemarks.trim(),
      };

      if (editingRecord?._id) {
        await apiService.updateOffboarding(editingRecord._id, payload);
      } else {
        await apiService.createOffboarding(payload);
      }

      toast({
        title: editingRecord?._id ? "Offboarding updated" : "Offboarding created",
        description: `${form.employeeName} now has an updated exit workflow record.`,
      });
      setDialogOpen(false);
      setEditingRecord(null);
      setForm(emptyForm());
      await loadWorkspace();
    } catch (error) {
      toast({
        title: "Unable to save record",
        description: error instanceof Error ? error.message : "Offboarding changes could not be saved.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusPatch = async (
    record: OffboardingRecord,
    payload: Partial<OffboardingRecord> & Record<string, unknown>,
    successMessage: string
  ) => {
    if (!record._id) return;
    setActionId(record._id);
    try {
      await apiService.updateOffboarding(record._id, payload);
      await loadWorkspace();
      toast({ title: "Updated", description: successMessage });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Status could not be updated.",
        variant: "destructive",
      });
    } finally {
      setActionId("");
    }
  };

  const handleDelete = async (record: OffboardingRecord) => {
    if (!record._id) return;
    setActionId(record._id);
    try {
      await apiService.deleteOffboarding(record._id);
      toast({
        title: "Offboarding removed",
        description: `${record.employeeName || record.name || "Employee"} was removed from the exit register.`,
      });
      await loadWorkspace();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Offboarding record could not be deleted.",
        variant: "destructive",
      });
    } finally {
      setActionId("");
    }
  };

  const handleResignationReview = async (record: OffboardingRecord, decision: "approved" | "rejected") => {
    if (!record._id) return;
    setActionId(record._id);
    try {
      await apiService.reviewResignationRequest(record._id, { decision });
      toast({
        title: decision === "approved" ? "Resignation approved" : "Resignation rejected",
        description:
          decision === "approved"
            ? `${record.employeeName || record.name || "Employee"} has been moved into active offboarding.`
            : `${record.employeeName || record.name || "Employee"} has been informed of the rejection.`,
      });
      await loadWorkspace();
    } catch (error) {
      toast({
        title: "Review failed",
        description: error instanceof Error ? error.message : "The resignation request could not be reviewed.",
        variant: "destructive",
      });
    } finally {
      setActionId("");
    }
  };

  const handleDocumentUpload = async (
    record: OffboardingRecord,
    documentKey: (typeof DOCUMENT_KEYS)[number]["key"],
    file?: File | null
  ) => {
    if (!record._id || !file) return;
    setActionId(record._id);
    try {
      const uploaded = await apiService.uploadFile(file, "document");
      await apiService.updateOffboarding(record._id, {
        documents: {
          [documentKey]: {
            key: uploaded.key,
            url: uploaded.url,
            originalName: uploaded.originalName,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
            uploadedAt: new Date().toISOString(),
          },
        },
      });
      toast({
        title: "Document uploaded",
        description: `${toLabel(documentKey)} is now attached to ${record.employeeName || record.name || "the record"}.`,
      });
      await loadWorkspace();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Document could not be uploaded.",
        variant: "destructive",
      });
    } finally {
      setActionId("");
      const inputKey = `${record._id}-${documentKey}`;
      if (fileInputRefs.current[inputKey]) {
        fileInputRefs.current[inputKey]!.value = "";
      }
    }
  };

  const handleDocumentDownload = async (
    record: OffboardingRecord,
    documentKey: (typeof DOCUMENT_KEYS)[number]["key"],
    fallbackLabel: string
  ) => {
    const document = record.documents?.[documentKey];
    if (!document?.url) return;
    try {
      const blob = await apiService.downloadProtectedFile(document.url);
      createDownload(blob, document.originalName || `${record.employeeCode || "employee"}-${fallbackLabel}.pdf`);
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Document could not be downloaded.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offboarding"
        subtitle="Coordinate employee exits with clear approvals, document handling, and a live progress view that keeps HR, IT, Finance, and the employee aligned."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void loadWorkspace()}
              className="rounded-xl border-[var(--portal-surface-border)] bg-white/90 text-[var(--portal-heading-color)] dark:bg-[#111111] dark:text-white"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <ExportButton
              moduleName="offboarding"
              rows={exportRows}
              fallbackRows={exportRows}
              columns={offboardingExportColumns}
              loading={loading}
              emptyMessage="No offboarding data to export"
              preferServerExport={false}
            />
            <Button
              onClick={openCreateDialog}
              className="rounded-xl border border-[rgba(var(--portal-primary-rgb),0.18)] bg-[linear-gradient(135deg,var(--portal-primary-solid),var(--portal-primary-dark))] text-white shadow-[0_14px_32px_rgba(var(--portal-primary-rgb),0.24)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Offboarding
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Exit Cases", value: summary.total, icon: BriefcaseBusiness, tone: "bg-[rgba(var(--portal-primary-rgb),0.08)] text-[var(--portal-primary-text)]" },
          { label: "Resignation Requests", value: summary.resignationPending, icon: FileText, tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
          { label: "Pending Attention", value: summary.pending, icon: Clock3, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
          { label: "Completed", value: summary.completed, icon: BadgeCheck, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
          { label: "FNF Open", value: summary.fnfOpen, icon: Landmark, tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`${panelClassName} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--portal-muted-color)]">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-[var(--portal-heading-color)] dark:text-white">{item.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className={`${panelClassName} p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 border-b border-[var(--portal-surface-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--portal-heading-color)] dark:text-white">Exit Control Center</h2>
            <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
              Review fresh resignation requests first, then manage the active offboarding workflow below.
            </p>
            <div className="mt-3 inline-flex items-center rounded-full border border-[rgba(var(--portal-primary-rgb),0.14)] bg-[rgba(var(--portal-primary-rgb),0.06)] px-3 py-1 text-xs font-semibold text-[var(--portal-primary-text)]">
              {filteredRows.length} visible records
            </div>
          </div>
          <div className="flex w-full max-w-lg items-center gap-3 rounded-[22px] border border-[var(--portal-surface-border)] bg-white/88 px-4 py-3 shadow-soft dark:bg-[#111111]">
            <Search className="h-4 w-4 text-[var(--portal-muted-color)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee, department, manager, exit type"
              className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-5 py-8 text-sm text-[var(--portal-muted-color)] dark:bg-[#111111]">
              Loading offboarding register...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-5 py-8 text-sm text-[var(--portal-muted-color)] dark:bg-[#111111]">
              No offboarding records match the current search.
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--portal-heading-color)] dark:text-white">Pending Resignation Requests</h3>
                    <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                      Approve to start offboarding automatically, or reject if the request should not proceed.
                    </p>
                  </div>
                  <div className="rounded-full border border-[rgba(var(--portal-primary-rgb),0.14)] bg-[rgba(var(--portal-primary-rgb),0.06)] px-3 py-1 text-xs font-semibold text-[var(--portal-primary-text)]">
                    {pendingResignationRequests.length} pending
                  </div>
                </div>
                {pendingResignationRequests.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-5 py-6 text-sm text-[var(--portal-muted-color)]">
                    No pending resignation requests right now.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {pendingResignationRequests.map((record) => (
                      <div key={record._id} className={`${subtlePanelClassName} p-5`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-[var(--portal-heading-color)] dark:text-white">{record.employeeName || record.name || "Employee"}</p>
                            <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                              {(record.employeeCode || record.employeeId || "No employee ID")} | {record.department || "No department"}
                            </p>
                          </div>
                          <StatusBadge status="Pending" />
                        </div>
                        <div className="mt-4 grid gap-3">
                          {[
                            { label: "Reason", value: record.resignationRequest?.reason || "-" },
                            { label: "Notice Period", value: record.resignationRequest?.noticePeriod || record.noticePeriod || "-" },
                            { label: "Requested Last Day", value: formatDate(record.resignationRequest?.lastWorkingDay || record.lastWorkingDay || record.lastDay) },
                            { label: "Comments", value: record.resignationRequest?.comments || record.employeeRemarks || "-" },
                          ].map((item) => (
                            <div key={item.label} className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/70 px-4 py-3 dark:bg-[#0f0f0f]">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-muted-color)]">{item.label}</p>
                              <p className="mt-1 text-sm text-[var(--portal-heading-color)] dark:text-white">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            className="rounded-xl"
                            disabled={actionId === record._id}
                            onClick={() => void handleResignationReview(record, "approved")}
                          >
                            Approve And Start Offboarding
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            disabled={actionId === record._id}
                            onClick={() => void handleResignationReview(record, "rejected")}
                          >
                            Reject Request
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--portal-heading-color)] dark:text-white">Active Offboarding Register</h3>
                    <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                      Structured operational cards for active exits, documents, and cross-team clearance progress.
                    </p>
                  </div>
                  <div className="rounded-full border border-[rgba(var(--portal-primary-rgb),0.14)] bg-[rgba(var(--portal-primary-rgb),0.06)] px-3 py-1 text-xs font-semibold text-[var(--portal-primary-text)]">
                    {activeOffboardingRows.length} active records
                  </div>
                </div>
                {activeOffboardingRows.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-5 py-6 text-sm text-[var(--portal-muted-color)]">
                    No active offboarding records match the current search.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    {activeOffboardingRows.map((record) => (
                      <article key={record._id} className={`${subtlePanelClassName} p-5`}>
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(var(--portal-primary-rgb),0.08)] text-[var(--portal-primary-text)]">
                              <UserRound className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-[var(--portal-heading-color)] dark:text-white">{record.employeeName || record.name || "Employee"}</p>
                              <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                                {(record.employeeCode || record.employeeId || "No employee ID")} | {record.department || "No department"}
                              </p>
                              <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                                Last day {formatDate(record.lastWorkingDay || record.lastDay)} | Progress {getWorkflowCompletion(record).completed}/{getWorkflowCompletion(record).total}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={toLabel(record.status)} />
                            <StatusBadge status={toLabel(record.exitType || record.reason)} />
                            <div className="mx-1 h-2 w-24 overflow-hidden rounded-full bg-[rgba(var(--portal-primary-rgb),0.08)]">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,var(--portal-primary-solid),var(--portal-primary-dark))]"
                                style={{ width: `${getWorkflowCompletion(record).percent}%` }}
                              />
                            </div>
                            <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => openDetailDialog(record)}>
                              Manage
                            </Button>
                            <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => openEditDialog(record)}>
                              <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              className={`h-9 rounded-xl ${destructiveButtonClass}`}
                              disabled={actionId === record._id}
                              onClick={() => void handleDelete(record)}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && !saving) {
            setEditingRecord(null);
            setForm(emptyForm());
          }
        }}
      >
        <DialogContent className="max-w-5xl rounded-[30px] border-[var(--portal-surface-border)] bg-[linear-gradient(180deg,var(--portal-surface-bg-strong),var(--portal-surface-bg))] p-0 dark:bg-[#0a0a0a]">
          <div className="p-6 sm:p-7">
            <DialogHeader>
              <DialogTitle className="text-[var(--portal-heading-color)] dark:text-white">
                {editingRecord?._id ? "Update Offboarding Record" : "Create Offboarding Record"}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2 xl:col-span-3">
                <Label>Employee</Label>
                <Select value={form.employeeRef || undefined} onValueChange={applyEmployeeSelection}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee._id} value={employee._id}>
                        {employee.fullName} ({employee.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Employee Name</Label>
                <Input
                  value={form.employeeName}
                  onChange={(event) => setForm((current) => ({ ...current, employeeName: event.target.value }))}
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input
                  value={form.employeeCode}
                  onChange={(event) => setForm((current) => ({ ...current, employeeCode: event.target.value }))}
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Employee Email</Label>
                <Input
                  value={form.employeeEmail}
                  onChange={(event) => setForm((current) => ({ ...current, employeeEmail: event.target.value }))}
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Manager / Reporting Person</Label>
                <Input
                  value={form.managerName}
                  onChange={(event) => setForm((current) => ({ ...current, managerName: event.target.value }))}
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={form.joiningDate}
                  onChange={(event) => setForm((current) => ({ ...current, joiningDate: event.target.value }))}
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>

              <div className="space-y-2">
                <Label>Exit Type</Label>
                <Select value={form.exitType} onValueChange={(value: OffboardingFormState["exitType"]) => setForm((current) => ({ ...current, exitType: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXIT_TYPE_OPTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {toLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notice Period</Label>
                <Input
                  value={form.noticePeriod}
                  onChange={(event) => setForm((current) => ({ ...current, noticePeriod: event.target.value }))}
                  placeholder="30 days"
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Rehire Eligibility</Label>
                <Select value={form.rehireEligibility} onValueChange={(value: OffboardingFormState["rehireEligibility"]) => setForm((current) => ({ ...current, rehireEligibility: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REHIRE_OPTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {toLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Last Working Day</Label>
                <Input
                  type="date"
                  value={form.lastWorkingDay}
                  onChange={(event) => setForm((current) => ({ ...current, lastWorkingDay: event.target.value }))}
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Actual Last Working Day</Label>
                <Input
                  type="date"
                  value={form.actualLastWorkingDay}
                  onChange={(event) => setForm((current) => ({ ...current, actualLastWorkingDay: event.target.value }))}
                  className={`h-11 rounded-2xl ${inputClassName}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Overall Status</Label>
                <Select value={form.status} onValueChange={(value: OffboardingStatus) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {toLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Exit Interview Status</Label>
                <Select value={form.exitInterviewStatus} onValueChange={(value: OffboardingStatus) => setForm((current) => ({ ...current, exitInterviewStatus: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {toLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assets Return Status</Label>
                <Select value={form.assetsReturnStatus} onValueChange={(value: OffboardingStatus) => setForm((current) => ({ ...current, assetsReturnStatus: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {toLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>FNF Status</Label>
                <Select value={form.fnfStatus} onValueChange={(value: OffboardingStatus) => setForm((current) => ({ ...current, fnfStatus: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {toLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>HR Clearance</Label>
                <Select value={form.hrClearance} onValueChange={(value: OffboardingStatus) => setForm((current) => ({ ...current, hrClearance: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {toLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>IT Clearance</Label>
                <Select value={form.itClearance} onValueChange={(value: OffboardingStatus) => setForm((current) => ({ ...current, itClearance: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {toLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Finance Clearance</Label>
                <Select value={form.financeClearance} onValueChange={(value: OffboardingStatus) => setForm((current) => ({ ...current, financeClearance: value }))}>
                  <SelectTrigger className={`h-11 rounded-2xl ${inputClassName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {toLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 xl:col-span-3">
                <Label>Admin Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                  placeholder="Keep a concise summary of approvals, dependencies, or special handling."
                  className={`min-h-[120px] rounded-2xl ${inputClassName}`}
                />
              </div>
              <div className="space-y-2 xl:col-span-3">
                <Label>Employee Remarks</Label>
                <Textarea
                  value={form.employeeRemarks}
                  onChange={(event) => setForm((current) => ({ ...current, employeeRemarks: event.target.value }))}
                  placeholder="Employee-facing notes or context from the exit workflow."
                  className={`min-h-[100px] rounded-2xl ${inputClassName}`}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <DialogClose asChild>
                <Button variant="outline" disabled={saving} className="rounded-xl">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-xl border border-[rgba(var(--portal-primary-rgb),0.18)] bg-[linear-gradient(135deg,var(--portal-primary-solid),var(--portal-primary-dark))] text-white shadow-[0_14px_32px_rgba(var(--portal-primary-rgb),0.24)]"
              >
                {saving ? "Saving..." : editingRecord?._id ? "Save Changes" : "Create Record"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) setDetailRecordId("");
        }}
      >
        <DialogContent className="max-w-6xl rounded-[30px] border-[var(--portal-surface-border)] bg-[linear-gradient(180deg,var(--portal-surface-bg-strong),var(--portal-surface-bg))] p-0 dark:bg-[#0a0a0a]">
          {detailRecord ? (
            <div className="p-6 sm:p-7">
              <DialogHeader>
                <DialogTitle className="text-[var(--portal-heading-color)] dark:text-white">
                  Manage Offboarding: {detailRecord.employeeName || detailRecord.name || "Employee"}
                </DialogTitle>
              </DialogHeader>

              <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.15fr_0.95fr]">
                <div className="space-y-4">
                  <div className={`${subtlePanelClassName} p-4`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-muted-color)]">Employee Snapshot</p>
                    <div className="mt-3 grid gap-2">
                      {[
                        { label: "Employee ID", value: detailRecord.employeeCode || detailRecord.employeeId || "-" },
                        { label: "Department", value: detailRecord.department || "-" },
                        { label: "Manager", value: detailRecord.managerName || detailRecord.reportingPerson || "-" },
                        { label: "Joining", value: formatDate(detailRecord.joiningDate) },
                        { label: "Exit type", value: toLabel(detailRecord.exitType || detailRecord.reason) },
                        { label: "Rehire", value: toLabel(detailRecord.rehireEligibility) },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-[var(--portal-muted-color)]">{item.label}</span>
                          <span className="font-medium text-[var(--portal-heading-color)] dark:text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`${subtlePanelClassName} p-4`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-muted-color)]">Final Status</p>
                    <div className="mt-3">
                      <StatusBadge status={toLabel(detailRecord.status)} />
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(var(--portal-primary-rgb),0.08)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,var(--portal-primary-solid),var(--portal-primary-dark))]"
                        style={{ width: `${getWorkflowCompletion(detailRecord).percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-[var(--portal-muted-color)]">
                      {getWorkflowCompletion(detailRecord).completed}/{getWorkflowCompletion(detailRecord).total} checkpoints cleared
                    </p>
                    <Select
                      value={detailRecord.status || "pending"}
                      onValueChange={(value: OffboardingStatus) =>
                        void handleStatusPatch(detailRecord, { status: value }, "Overall exit status updated.")
                      }
                      disabled={actionId === detailRecord._id}
                    >
                      <SelectTrigger className={`mt-3 h-10 rounded-xl ${inputClassName}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {toLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className={`${subtlePanelClassName} p-4`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-muted-color)]">Exit Plan</p>
                    <div className="mt-3 grid gap-2">
                      {[
                        { label: "Notice", value: detailRecord.noticePeriod || "-" },
                        { label: "Last day", value: formatDate(detailRecord.lastWorkingDay || detailRecord.lastDay) },
                        { label: "Actual exit", value: formatDate(detailRecord.actualLastWorkingDay) },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-[var(--portal-muted-color)]">{item.label}</span>
                          <span className="font-medium text-[var(--portal-heading-color)] dark:text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${subtlePanelClassName} p-4`}>
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--portal-primary-text)]" />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-muted-color)]">Workflow Controls</p>
                  </div>

                  <Accordion type="multiple" className="space-y-3">
                    <AccordionItem value="interview" className="rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-4 dark:bg-[#151515]">
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--portal-muted-color)]">Exit Interview</span>
                          <StatusBadge status={toLabel(detailRecord.exitInterviewStatus)} />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <Select
                          value={detailRecord.exitInterviewStatus || "pending"}
                          onValueChange={(value: OffboardingStatus) =>
                            void handleStatusPatch(detailRecord, { exitInterviewStatus: value }, "Exit interview status updated.")
                          }
                          disabled={actionId === detailRecord._id}
                        >
                          <SelectTrigger className={compactSelectClassName}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {toLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="clearance" className="rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-4 dark:bg-[#151515]">
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--portal-muted-color)]">Department Clearances</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="grid gap-3">
                          {[
                            { key: "hr", label: "HR", value: detailRecord.clearanceStatus?.hr || "pending" },
                            { key: "it", label: "IT", value: detailRecord.clearanceStatus?.it || "pending" },
                            { key: "finance", label: "Finance", value: detailRecord.clearanceStatus?.finance || "pending" },
                          ].map((item) => (
                            <div key={item.key} className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/70 p-3 dark:bg-[#101010]">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--portal-muted-color)]">{item.label}</span>
                                <StatusBadge status={toLabel(item.value)} />
                              </div>
                              <Select
                                value={item.value}
                                onValueChange={(value: OffboardingStatus) =>
                                  void handleStatusPatch(
                                    detailRecord,
                                    {
                                      clearanceStatus: {
                                        hr: item.key === "hr" ? value : detailRecord.clearanceStatus?.hr || "pending",
                                        it: item.key === "it" ? value : detailRecord.clearanceStatus?.it || "pending",
                                        finance: item.key === "finance" ? value : detailRecord.clearanceStatus?.finance || "pending",
                                      },
                                    },
                                    `${item.label} clearance updated.`
                                  )
                                }
                                disabled={actionId === detailRecord._id}
                              >
                                <SelectTrigger className={compactSelectClassName}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {toLabel(status)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="ops" className="rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-4 dark:bg-[#151515]">
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--portal-muted-color)]">Assets And FNF</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          {[
                            { label: "Assets", value: detailRecord.assetsReturnStatus || "pending", field: "assetsReturnStatus" as const, icon: FolderSync, message: "Assets return status updated." },
                            { label: "FNF", value: detailRecord.fnfStatus || "pending", field: "fnfStatus" as const, icon: Landmark, message: "FNF status updated." },
                          ].map((item) => {
                            const Icon = item.icon;
                            return (
                              <div key={item.label} className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/70 p-3 dark:bg-[#101010]">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-[var(--portal-primary-text)]" />
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--portal-muted-color)]">{item.label}</span>
                                  </div>
                                  <StatusBadge status={toLabel(item.value)} />
                                </div>
                                <Select
                                  value={item.value}
                                  onValueChange={(value: OffboardingStatus) =>
                                    void handleStatusPatch(detailRecord, { [item.field]: value }, item.message)
                                  }
                                  disabled={actionId === detailRecord._id}
                                >
                                  <SelectTrigger className={compactSelectClassName}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPTIONS.map((status) => (
                                      <SelectItem key={status} value={status}>
                                        {toLabel(status)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                <div className={`${subtlePanelClassName} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-muted-color)]">Documents</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--portal-heading-color)]">{getDocumentSummary(detailRecord)}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(var(--portal-primary-rgb),0.08)] text-[var(--portal-primary-text)]">
                      <FileText className="h-4 w-4" />
                    </div>
                  </div>

                  <Accordion type="multiple" className="mt-3 space-y-3">
                    {DOCUMENT_KEYS.map((documentConfig) => {
                      const document = detailRecord.documents?.[documentConfig.key];
                      const inputKey = `${detailRecord._id}-${documentConfig.key}`;
                      return (
                        <AccordionItem key={documentConfig.key} value={documentConfig.key} className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/70 px-4 dark:bg-[#101010]">
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--portal-muted-color)]">{documentConfig.label}</span>
                              {document?.url ? <StatusBadge status="Completed" /> : <StatusBadge status="Pending" />}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <p className="truncate text-xs text-[var(--portal-muted-color)]">
                              {document?.originalName || "No file uploaded"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <input
                                ref={(element) => {
                                  fileInputRefs.current[inputKey] = element;
                                }}
                                type="file"
                                className="hidden"
                                onChange={(event) =>
                                  void handleDocumentUpload(detailRecord, documentConfig.key, event.target.files?.[0])
                                }
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg border-[var(--portal-surface-border)] bg-white/90"
                                disabled={actionId === detailRecord._id}
                                onClick={() => fileInputRefs.current[inputKey]?.click()}
                              >
                                <FileUp className="mr-1.5 h-3.5 w-3.5" />
                                {document?.url ? "Replace" : "Upload"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg border-[var(--portal-surface-border)] bg-white/90"
                                disabled={!document?.url}
                                onClick={() =>
                                  void handleDocumentDownload(detailRecord, documentConfig.key, documentConfig.label.toLowerCase().replaceAll(" ", "-"))
                                }
                              >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Download
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => openEditDialog(detailRecord)}>
                  <PencilLine className="mr-2 h-4 w-4" />
                  Edit Full Record
                </Button>
                <DialogClose asChild>
                  <Button variant="outline" className="rounded-xl">Close</Button>
                </DialogClose>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOffboarding;
