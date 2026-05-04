import React, { useCallback, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  PlayCircle,
  Save,
  Settings2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PayrollTable, { PayrollRow, payrollExportColumns } from "@/components/tables/PayrollTable";
import { apiService, type AdvanceRecord, type EmployeeRecord, type PayrollRecord, type PayrollSettings } from "@/services/api";
import FilterDrawer from "@/components/common/FilterDrawer";
import { ExportButton } from "@/components/common/ExportButton";
import { downloadPdfBlob } from "@/utils/downloadPdf";
import { downloadElementAsPdf } from "@/utils/html2pdf";
import PayslipModal from "@/components/payroll/PayslipModal";
import PayslipDocument from "@/components/payroll/PayslipDocument";
import { useToast } from "@/hooks/use-toast";
import { useFeature, useLabel, usePermission } from "@/context/SystemSettingsContext";

type PayrollSummary = {
  totalPayroll: number;
  processedEmployees: number;
  pendingEmployees: number;
  month: string;
  monthNumber: number;
  year: number;
  employeesMissingSalary?: number;
};

type SkippedPayroll = {
  employeeId: string;
  employeeName: string;
  reason: string;
};

type AdvanceFormState = {
  employeeId: string;
  amount: string;
  notes: string;
};

type PaymentFormState = {
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes: string;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const currentMonthValue = () => {
  const current = new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
};

const parseMonthValue = (value: string) => {
  const [yearRaw, monthRaw] = value.split("-");
  return {
    year: Number(yearRaw),
    month: Number(monthRaw),
  };
};

const defaultPayrollConfig: PayrollSettings = {
  workingDaysMode: "weekdays",
  fixedWorkingDays: 26,
  standardDailyHours: 8,
  includePaidLeaveInWages: true,
  halfDayPayableFraction: 0.5,
  incompleteDayPayableFraction: 0,
  lateToHalfDayEnabled: false,
  lateToHalfDayThreshold: 0,
  latePenaltyAmount: 0,
  absentPenaltyAmount: 0,
  overtimeMultiplier: 1,
  freezePayrollOnGenerate: true,
  pf: {
    enabled: true,
    employeeRate: 12,
    employerRate: 12,
    wageLimit: 15000,
  },
  esi: {
    enabled: false,
    employeeRate: 0.75,
    employerRate: 3.25,
    wageLimit: 21000,
  },
};

const toolbarButtonClass =
  "h-9 rounded-lg px-4 py-2 text-sm font-medium shadow-none transition-colors";

const fieldClassName =
  "mt-2 h-10 rounded-lg border-[var(--portal-surface-border)] bg-white px-3 text-sm text-[var(--portal-heading-color)] shadow-none focus-visible:border-[#cbd5e1] focus-visible:ring-[#e2e8f0] dark:bg-[#111111] dark:text-white dark:focus-visible:border-[#3a3a3a] dark:focus-visible:ring-[rgba(255,255,255,0.12)]";

const panelClassName =
  "rounded-3xl border border-[var(--portal-surface-border)] bg-[var(--portal-surface-bg-strong)] shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:bg-[#0f0f0f] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]";

const innerPanelClassName =
  "rounded-2xl border border-[var(--portal-surface-border)] bg-white p-5 shadow-none dark:bg-[#111111]";

const subtleCardClassName =
  "rounded-xl border border-[var(--portal-surface-border)] bg-white px-4 py-3 dark:bg-[#151515]";

const outlineToolbarButtonClass =
  `${toolbarButtonClass} border-[var(--portal-surface-border)] bg-white text-[var(--portal-heading-color)] hover:bg-[#f8fafc] dark:bg-[#111111] dark:text-white dark:hover:bg-[#181818]`;

const primaryToolbarButtonClass =
  `${toolbarButtonClass} border border-[#1f2937] bg-[#1f2937] text-white shadow-none hover:bg-[#111827] dark:border-[#2a2a2a] dark:bg-white dark:text-black dark:hover:bg-[#e8e8e8]`;
const semanticPayrollToneMap = {
  success: "border border-slate-300 bg-slate-100 text-slate-700 shadow-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  process: "border border-slate-300 bg-slate-100 text-slate-700 shadow-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  finance: "border border-slate-300 bg-slate-100 text-slate-700 shadow-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  pending: "border border-slate-300 bg-slate-100 text-slate-700 shadow-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const payrollModeOptions: Array<{ label: string; value: PayrollSettings["workingDaysMode"] }> = [
  { label: "Weekdays", value: "weekdays" },
  { label: "Calendar Days", value: "calendar" },
  { label: "Fixed Days", value: "fixed" },
];

const StatCard = ({
  title,
  value,
  hint,
  icon: Icon,
  tone = "process",
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "process" | "finance" | "pending";
}) => (
  <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/86 p-5 shadow-none dark:bg-[#111111]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--portal-muted-color)]">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--portal-heading-color)] dark:text-white">{value}</p>
        <p className="mt-1 text-sm text-[var(--portal-muted-color)]">{hint}</p>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${semanticPayrollToneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const AdminPayroll: React.FC = () => {
  const { toast } = useToast();
  const payrollEnabled = useFeature("payroll");
  const canRunPayroll = usePermission("run_payroll");
  const pageTitle = useLabel("admin.payroll.title", "Payroll");
  const runPayrollLabel = useLabel("admin.payroll.run", "Run Payroll");
  const rulesTitle = useLabel("admin.payroll.rules.title", "Payroll Rules");
  const saveRulesLabel = useLabel("admin.payroll.saveRules", "Save Rules");
  const savingRulesLabel = useLabel("admin.payroll.savingRules", "Saving...");
  const showSettingsLabel = useLabel("admin.payroll.showSettings", "Show Settings");
  const hideSettingsLabel = useLabel("admin.payroll.hideSettings", "Hide Settings");
  const totalPayrollLabel = useLabel("admin.payroll.stats.total", "Total Payroll");
  const processedLabel = useLabel("admin.payroll.stats.processed", "Processed");
  const processedHint = useLabel("admin.payroll.stats.processedHint", "Employees completed");
  const pendingLabel = useLabel("admin.payroll.stats.pending", "Pending");
  const pendingHint = useLabel("admin.payroll.stats.pendingHint", "Employees waiting");
  const payrollRegisterLabel = useLabel("admin.payroll.register.title", "Payroll Register");
  const skippedTitle = useLabel("admin.payroll.skipped.title", "Skipped During Payroll Run");
  const runDialogTitle = useLabel("admin.payroll.dialog.runTitle", "Run Payroll");
  const processPayrollLabel = useLabel("admin.payroll.process", "Process Payroll");
  const processingLabel = useLabel("admin.payroll.processing", "Processing...");
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ search: "", status: "" });
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "" });
  const [skipped, setSkipped] = useState<SkippedPayroll[]>([]);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [payrollConfig, setPayrollConfig] = useState<PayrollSettings>(defaultPayrollConfig);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [advanceActionId, setAdvanceActionId] = useState("");
  const [advanceForm, setAdvanceForm] = useState<AdvanceFormState>({ employeeId: "", amount: "", notes: "" });
  const [selectedPayrollId, setSelectedPayrollId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [generatedPayslipIds, setGeneratedPayslipIds] = useState<string[]>([]);
  const [fallbackPayrollRecord, setFallbackPayrollRecord] = useState<PayrollRecord | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "Bank Transfer",
    reference: "",
    notes: "",
  });
  const fallbackPayslipRef = React.useRef<HTMLDivElement>(null);

  const loadPayroll = useCallback(async (monthValue = selectedMonth) => {
    const { month, year } = parseMonthValue(monthValue);
    setPageLoading(true);
    try {
      const [records, summaryData] = await Promise.all([
        apiService.getPayroll({ month, year }),
        apiService.getPayrollSummary({ month, year }),
      ]);
      setPayrollRecords(records);
      setSummary(summaryData);
      setSelectedPayrollId((current) => current || records[0]?._id || "");
    } catch (error) {
      toast({
        title: "Unable to load payroll",
        description: error instanceof Error ? error.message : "Payroll data could not be loaded.",
        variant: "destructive",
      });
    } finally {
      setPageLoading(false);
    }
  }, [selectedMonth, toast]);

  const loadConfig = useCallback(async () => {
    try {
      const config = await apiService.getPayrollConfig();
      setPayrollConfig(config);
    } catch (error) {
      toast({
        title: "Unable to load payroll rules",
        description: error instanceof Error ? error.message : "Payroll settings could not be loaded.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadAdvanceWorkspace = useCallback(async () => {
    setAdvanceLoading(true);
    try {
      const [advanceRows, employeeRows] = await Promise.all([
        apiService.listPayrollAdvances(),
        apiService.listEmployees(),
      ]);
      setAdvances(advanceRows);
      setEmployees(employeeRows);
      setAdvanceForm((current) => ({
        ...current,
        employeeId: current.employeeId || employeeRows[0]?._id || "",
      }));
    } catch (error) {
      toast({
        title: "Unable to load advances",
        description: error instanceof Error ? error.message : "Advance salary data could not be loaded.",
        variant: "destructive",
      });
    } finally {
      setAdvanceLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  React.useEffect(() => {
    void loadPayroll(selectedMonth);
  }, [loadPayroll, selectedMonth]);

  React.useEffect(() => {
    void loadAdvanceWorkspace();
  }, [loadAdvanceWorkspace]);

  const payrollRows: PayrollRow[] = useMemo(
    () =>
      payrollRecords.map((record) => ({
        _id: record._id,
        employeeName: record.employeeName,
        monthLabel: `${record.month} ${record.year}`,
        presentDays: Number((record.presentDays || 0).toFixed(2)),
        lateDays: Number((record.lateDays || 0).toFixed(2)),
        halfDays: Number((record.halfDays || 0).toFixed(2)),
        absentDays: Number(record.absentDays.toFixed(2)),
        incompleteDays: Number((record.incompleteDays || 0).toFixed(2)),
        payableDays: Number((record.payableDays || 0).toFixed(2)),
        perDaySalaryFormatted: currency.format(record.perDaySalary || 0),
        earnedSalaryFormatted: currency.format(record.earnedSalary || record.earnedWages || 0),
        overtimePayFormatted: currency.format(record.overtimePay || 0),
        grossSalaryFormatted: currency.format(record.fullWages || 0),
        advanceDeductionFormatted: currency.format(record.advanceDeduction || 0),
        deductionsFormatted: currency.format(record.totalDeductions || 0),
        netSalaryFormatted: currency.format(record.netSalary || 0),
        status: record.status ? `${record.status.charAt(0).toUpperCase()}${record.status.slice(1)}` : "Processed",
        paymentStatus: record.paymentStatus ? record.paymentStatus.replaceAll("_", " ") : "Unpaid",
      })),
    [payrollRecords]
  );

  const filteredPayrollRows = useMemo(() => {
    const term = appliedFilters.search.toLowerCase();
    return payrollRows.filter((row) => {
      const matchesSearch = !term || row.employeeName.toLowerCase().includes(term) || row.monthLabel.toLowerCase().includes(term);
      const matchesStatus = !appliedFilters.status || row.paymentStatus === appliedFilters.status;
      return matchesSearch && matchesStatus;
    });
  }, [appliedFilters.search, appliedFilters.status, payrollRows]);

  const selectedRecord = useMemo(
    () => payrollRecords.find((record) => record._id === selectedPayrollId) || payrollRecords[0] || null,
    [payrollRecords, selectedPayrollId]
  );

  if (!payrollEnabled) {
    return null;
  }

  const handleRunPayroll = async () => {
    const { month, year } = parseMonthValue(selectedMonth);
    setLoading(true);
    try {
      const response = await apiService.runPayroll({ month, year });
      const processedRecords = response.data?.records || [];
      setPayrollRecords(processedRecords);
      setSummary(response.data?.summary || null);
      setSkipped(response.data?.skippedEmployees || response.data?.skipped || []);
      setAdvances(response.data?.advances || []);
      setSelectedPayrollId(processedRecords[0]?._id || "");
      setGeneratedPayslipIds([]);
      setRunDialogOpen(false);
      toast({
        title: "Payroll processed",
        description:
          response.message || `Payroll run completed for ${processedRecords.length} employee${processedRecords.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      toast({
        title: "Payroll run failed",
        description: error instanceof Error ? error.message : "Unable to process payroll right now.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdvance = async () => {
    const amount = Number(advanceForm.amount || 0);
    if (!advanceForm.employeeId || amount <= 0) {
      toast({
        title: "Advance details missing",
        description: "Choose an employee and enter an amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    setAdvanceSubmitting(true);
    try {
      await apiService.createPayrollAdvance({
        employeeId: advanceForm.employeeId,
        amount,
        notes: advanceForm.notes.trim(),
      });
      await loadAdvanceWorkspace();
      setAdvanceForm((current) => ({ employeeId: current.employeeId, amount: "", notes: "" }));
      toast({
        title: "Advance created",
        description: "The salary advance is now available for upcoming payroll deductions.",
      });
    } catch (error) {
      toast({
        title: "Unable to create advance",
        description: error instanceof Error ? error.message : "Advance could not be created.",
        variant: "destructive",
      });
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  const handleAdvanceStatusUpdate = async (advanceId: string, status: AdvanceRecord["status"]) => {
    setAdvanceActionId(advanceId);
    try {
      await apiService.updatePayrollAdvance(advanceId, { status });
      await loadAdvanceWorkspace();
      toast({
        title: "Advance updated",
        description: `Advance marked as ${status.replaceAll("_", " ")}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to update advance",
        description: error instanceof Error ? error.message : "Advance status could not be updated.",
        variant: "destructive",
      });
    } finally {
      setAdvanceActionId("");
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      const saved = await apiService.updatePayrollConfig(payrollConfig);
      setPayrollConfig(saved);
      toast({
        title: "Payroll rules updated",
        description: "The payroll settings will be used in the next payroll run.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save payroll settings.",
        variant: "destructive",
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleGeneratePayslip = (row: PayrollRow) => {
    setSelectedPayrollId(row._id);
    setGeneratedPayslipIds((current) => (current.includes(row._id) ? current : [...current, row._id]));
    toast({
      title: "Payslip generated",
      description: `${row.employeeName}'s payslip is ready to view or download.`,
    });
  };

  const handleDownloadPayslip = async (record: PayrollRecord) => {
    setDownloadingId(record._id);
    try {
      flushSync(() => {
        setFallbackPayrollRecord(record);
      });

      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
      if (!fallbackPayslipRef.current) {
        throw new Error("Payslip preview could not be prepared.");
      }

      const fallbackFileName =
        `${record.employeeCode || record.employeeName}-${record.month}-${record.year}-salary-slip.pdf`
          .replace(/[^a-zA-Z0-9._-]+/g, "-");
      await downloadElementAsPdf(fallbackPayslipRef.current, fallbackFileName);
      toast({
        title: "Payslip downloaded",
        description: `${record.employeeName}'s payslip has been downloaded.`,
      });
    } catch (error) {
      try {
        const result = await apiService.downloadPayrollPayslip(record._id);
        const resolvedFileName =
          result.fileName || `${record.employeeCode || record.employeeName}-${record.month}-${record.year}-salary-slip.pdf`;
        downloadPdfBlob(result.blob, resolvedFileName);
        toast({
          title: "Payslip downloaded",
          description: `${record.employeeName}'s payslip was downloaded using the server fallback.`,
        });
      } catch (fallbackError) {
        toast({
          title: "Download failed",
          description:
            fallbackError instanceof Error
              ? fallbackError.message
              : error instanceof Error
                ? error.message
                : "Unable to download payslip right now.",
          variant: "destructive",
        });
      }
    } finally {
      setDownloadingId("");
    }
  };

  const handleOpenPayslip = (payrollId: string) => {
    setSelectedPayrollId(payrollId);
    setPayslipModalOpen(true);
  };

  const handleOpenPaymentDialog = (row: PayrollRow) => {
    const record = payrollRecords.find((item) => item._id === row._id);
    if (!record) return;

    setSelectedPayrollId(record._id);
    setPaymentForm({
      amount: String(record.unpaidAmount || record.netSalary || 0),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: record.paymentMethod || "Bank Transfer",
      reference: record.paymentReference || "",
      notes: record.paymentNotes || "",
    });
    setPaymentDialogOpen(true);
  };

  const handleSavePayment = async () => {
    const record = payrollRecords.find((item) => item._id === selectedPayrollId);
    if (!record) return;

    setPaymentSubmitting(true);
    try {
      const saved = await apiService.updatePayrollPayment(record._id, {
        action: "record",
        amount: Number(paymentForm.amount || 0),
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod.trim(),
        reference: paymentForm.reference.trim(),
        notes: paymentForm.notes.trim(),
      });
      setPayrollRecords((current) => current.map((item) => (item._id === saved._id ? saved : item)));
      setPaymentDialogOpen(false);
      toast({
        title: "Payment updated",
        description: `${saved.employeeName}'s payroll is now ${String(saved.paymentStatus || "updated").replaceAll("_", " ")}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to update payment",
        description: error instanceof Error ? error.message : "Payment could not be recorded.",
        variant: "destructive",
      });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleResetPayment = async () => {
    const record = payrollRecords.find((item) => item._id === selectedPayrollId);
    if (!record) return;

    setPaymentSubmitting(true);
    try {
      const saved = await apiService.updatePayrollPayment(record._id, { action: "reset" });
      setPayrollRecords((current) => current.map((item) => (item._id === saved._id ? saved : item)));
      setPaymentDialogOpen(false);
      toast({
        title: "Payment reset",
        description: `${saved.employeeName}'s payroll was marked unpaid.`,
      });
    } catch (error) {
      toast({
        title: "Unable to reset payment",
        description: error instanceof Error ? error.message : "Payment status could not be reset.",
        variant: "destructive",
      });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const monthLabel = summary?.month && summary?.year ? `${summary.month} ${summary.year}` : "Selected month";

  return (
    <div className="space-y-6 pb-2">
      <section className={`${panelClassName} p-6`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--portal-heading-color)] dark:text-white">{pageTitle}</h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--portal-muted-color)]">
              Review payroll month by month, manage payslip actions, and keep the workspace focused on the register instead of side panels.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:flex-row md:flex-nowrap md:items-center md:justify-end xl:w-auto">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="h-9 w-full rounded-lg border-[var(--portal-surface-border)] bg-white/90 px-3.5 text-sm text-[var(--portal-heading-color)] shadow-none md:w-[190px] md:shrink-0 dark:bg-[#111111] dark:text-white"
            />
            <Button
              variant="outline"
              className={`${outlineToolbarButtonClass} md:shrink-0`}
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <Button
              className={`${primaryToolbarButtonClass} md:shrink-0`}
              onClick={() => setRunDialogOpen(true)}
            >
              <PlayCircle className="h-4 w-4" />
              {runPayrollLabel}
            </Button>
            <ExportButton
              moduleName="payroll"
              rows={filteredPayrollRows}
              fallbackRows={payrollRows}
              columns={payrollExportColumns}
              filters={{ ...appliedFilters, month: selectedMonth }}
              className={`${outlineToolbarButtonClass} md:shrink-0`}
              loading={pageLoading}
              emptyMessage="No data to export"
              preferServerExport={false}
            />
          </div>
        </div>
      </section>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className={panelClassName}>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-base font-semibold text-[var(--portal-heading-color)] dark:text-white">{rulesTitle}</p>
            <p className="mt-1 text-sm text-[var(--portal-muted-color)]">Collapsed by default to keep the register clean. Expand only when you need to update company rules.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className={outlineToolbarButtonClass}
              onClick={() => void handleSaveConfig()}
              disabled={configSaving}
            >
              <Save className="h-4 w-4" />
              {configSaving ? savingRulesLabel : saveRulesLabel}
            </Button>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className={outlineToolbarButtonClass}
              >
                <Settings2 className="h-4 w-4" />
                {settingsOpen ? hideSettingsLabel : showSettingsLabel}
                <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="border-t border-[var(--portal-surface-border)] px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <section className={innerPanelClassName}>
              <h2 className="text-sm font-semibold text-[var(--portal-heading-color)] dark:text-white">Working Days</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="workingDaysMode">Working Days Mode</Label>
                  <select
                    id="workingDaysMode"
                    className={`w-full ${fieldClassName}`}
                    value={payrollConfig.workingDaysMode}
                    onChange={(event) =>
                      setPayrollConfig((prev) => ({
                        ...prev,
                        workingDaysMode: event.target.value as PayrollSettings["workingDaysMode"],
                      }))
                    }
                  >
                    {payrollModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="fixedWorkingDays">Fixed Working Days</Label>
                  <Input
                    id="fixedWorkingDays"
                    type="number"
                    min="1"
                    max="31"
                    value={payrollConfig.fixedWorkingDays}
                    onChange={(event) => setPayrollConfig((prev) => ({ ...prev, fixedWorkingDays: Number(event.target.value || 26) }))}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <Label htmlFor="standardDailyHours">Standard Daily Hours</Label>
                  <Input
                    id="standardDailyHours"
                    type="number"
                    min="1"
                    max="24"
                    value={payrollConfig.standardDailyHours}
                    onChange={(event) => setPayrollConfig((prev) => ({ ...prev, standardDailyHours: Number(event.target.value || 8) }))}
                    className={fieldClassName}
                  />
                </div>
                <div className={`flex items-center justify-between ${subtleCardClassName}`}>
                  <div>
                    <p className="text-sm font-medium text-[var(--portal-heading-color)] dark:text-white">Include Paid Leave</p>
                    <p className="text-xs text-[var(--portal-muted-color)]">Leaves count toward earned wages</p>
                  </div>
                  <Switch
                    checked={payrollConfig.includePaidLeaveInWages}
                    onCheckedChange={(checked) => setPayrollConfig((prev) => ({ ...prev, includePaidLeaveInWages: checked }))}
                  />
                </div>
                <div>
                  <Label htmlFor="halfDayPayableFraction">Half Day Payable Fraction</Label>
                  <Input
                    id="halfDayPayableFraction"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={payrollConfig.halfDayPayableFraction}
                    onChange={(event) => setPayrollConfig((prev) => ({ ...prev, halfDayPayableFraction: Number(event.target.value || 0) }))}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <Label htmlFor="incompleteDayPayableFraction">Incomplete Day Payable Fraction</Label>
                  <Input
                    id="incompleteDayPayableFraction"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={payrollConfig.incompleteDayPayableFraction}
                    onChange={(event) => setPayrollConfig((prev) => ({ ...prev, incompleteDayPayableFraction: Number(event.target.value || 0) }))}
                    className={fieldClassName}
                  />
                </div>
              </div>
            </section>

            <section className={innerPanelClassName}>
              <h2 className="text-sm font-semibold text-[var(--portal-heading-color)] dark:text-white">Penalties And Overtime</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="latePenaltyAmount">Late Penalty Amount</Label>
                  <Input
                    id="latePenaltyAmount"
                    type="number"
                    min="0"
                    value={payrollConfig.latePenaltyAmount}
                    onChange={(event) => setPayrollConfig((prev) => ({ ...prev, latePenaltyAmount: Number(event.target.value || 0) }))}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <Label htmlFor="absentPenaltyAmount">Absent Penalty Amount</Label>
                  <Input
                    id="absentPenaltyAmount"
                    type="number"
                    min="0"
                    value={payrollConfig.absentPenaltyAmount}
                    onChange={(event) => setPayrollConfig((prev) => ({ ...prev, absentPenaltyAmount: Number(event.target.value || 0) }))}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <Label htmlFor="overtimeMultiplier">Overtime Multiplier</Label>
                  <Input
                    id="overtimeMultiplier"
                    type="number"
                    min="0"
                    step="0.25"
                    value={payrollConfig.overtimeMultiplier}
                    onChange={(event) => setPayrollConfig((prev) => ({ ...prev, overtimeMultiplier: Number(event.target.value || 1) }))}
                    className={fieldClassName}
                  />
                </div>
                <div className={`flex items-center justify-between ${subtleCardClassName}`}>
                  <div>
                    <p className="text-sm font-medium text-[var(--portal-heading-color)] dark:text-white">Convert Late Marks To Half Day</p>
                    <p className="text-xs text-[var(--portal-muted-color)]">Deduct half-day value after repeated late entries</p>
                  </div>
                  <Switch
                    checked={payrollConfig.lateToHalfDayEnabled}
                    onCheckedChange={(checked) => setPayrollConfig((prev) => ({ ...prev, lateToHalfDayEnabled: checked }))}
                  />
                </div>
                <div>
                  <Label htmlFor="lateToHalfDayThreshold">Late Entries Per Half Day Deduction</Label>
                  <Input
                    id="lateToHalfDayThreshold"
                    type="number"
                    min="0"
                    value={payrollConfig.lateToHalfDayThreshold}
                    onChange={(event) => setPayrollConfig((prev) => ({ ...prev, lateToHalfDayThreshold: Number(event.target.value || 0) }))}
                    className={fieldClassName}
                  />
                </div>
                <div className={`flex items-center justify-between ${subtleCardClassName}`}>
                  <div>
                    <p className="text-sm font-medium text-[var(--portal-heading-color)] dark:text-white">Freeze Payroll On Generate</p>
                    <p className="text-xs text-[var(--portal-muted-color)]">Prevents later attendance edits from changing processed salary</p>
                  </div>
                  <Switch
                    checked={payrollConfig.freezePayrollOnGenerate}
                    onCheckedChange={(checked) => setPayrollConfig((prev) => ({ ...prev, freezePayrollOnGenerate: checked }))}
                  />
                </div>
              </div>
            </section>

            <section className={innerPanelClassName}>
              <h2 className="text-sm font-semibold text-[var(--portal-heading-color)] dark:text-white">Statutory Deductions</h2>
              <div className="mt-4 space-y-4">
                <div className={`${subtleCardClassName} p-4`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--portal-heading-color)] dark:text-white">Provident Fund</p>
                    <Switch
                      checked={payrollConfig.pf.enabled}
                      onCheckedChange={(checked) => setPayrollConfig((prev) => ({ ...prev, pf: { ...prev.pf, enabled: checked } }))}
                    />
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Employee rate"
                      value={payrollConfig.pf.employeeRate}
                      onChange={(event) => setPayrollConfig((prev) => ({ ...prev, pf: { ...prev.pf, employeeRate: Number(event.target.value || 0) } }))}
                      className={fieldClassName}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Employer rate"
                      value={payrollConfig.pf.employerRate}
                      onChange={(event) => setPayrollConfig((prev) => ({ ...prev, pf: { ...prev.pf, employerRate: Number(event.target.value || 0) } }))}
                      className={fieldClassName}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Wage limit"
                      value={payrollConfig.pf.wageLimit}
                      onChange={(event) => setPayrollConfig((prev) => ({ ...prev, pf: { ...prev.pf, wageLimit: Number(event.target.value || 0) } }))}
                      className={fieldClassName}
                    />
                  </div>
                </div>

                <div className={`${subtleCardClassName} p-4`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--portal-heading-color)] dark:text-white">Employee State Insurance</p>
                    <Switch
                      checked={payrollConfig.esi.enabled}
                      onCheckedChange={(checked) => setPayrollConfig((prev) => ({ ...prev, esi: { ...prev.esi, enabled: checked } }))}
                    />
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Employee rate"
                      value={payrollConfig.esi.employeeRate}
                      onChange={(event) => setPayrollConfig((prev) => ({ ...prev, esi: { ...prev.esi, employeeRate: Number(event.target.value || 0) } }))}
                      className={fieldClassName}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Employer rate"
                      value={payrollConfig.esi.employerRate}
                      onChange={(event) => setPayrollConfig((prev) => ({ ...prev, esi: { ...prev.esi, employerRate: Number(event.target.value || 0) } }))}
                      className={fieldClassName}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Wage limit"
                      value={payrollConfig.esi.wageLimit}
                      onChange={(event) => setPayrollConfig((prev) => ({ ...prev, esi: { ...prev.esi, wageLimit: Number(event.target.value || 0) } }))}
                      className={fieldClassName}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard title={totalPayrollLabel} value={currency.format(summary?.totalPayroll || 0)} hint={monthLabel} icon={Wallet} tone="finance" />
        <StatCard title={processedLabel} value={summary?.processedEmployees || 0} hint={processedHint} icon={CheckCircle2} tone="success" />
        <StatCard title={pendingLabel} value={summary?.pendingEmployees || 0} hint={pendingHint} icon={Clock3} tone="pending" />
      </section>

      <section className={`${panelClassName} p-5 sm:p-6`}>
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className={innerPanelClassName}>
            <div>
              <h2 className="text-lg font-semibold text-[var(--portal-heading-color)] dark:text-white">Advance Salary</h2>
              <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                Create recoverable employee advances. Payroll will deduct up to 30% of net salary each month.
              </p>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="advanceEmployee">Employee</Label>
                <select
                  id="advanceEmployee"
                  className={`w-full ${fieldClassName}`}
                  value={advanceForm.employeeId}
                  onChange={(event) => setAdvanceForm((prev) => ({ ...prev, employeeId: event.target.value }))}
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.fullName || employee.userId?.name || employee.employeeId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="advanceAmount">Advance Amount</Label>
                <Input
                  id="advanceAmount"
                  type="number"
                  min="0"
                  value={advanceForm.amount}
                  onChange={(event) => setAdvanceForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className={fieldClassName}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="advanceNotes">Notes</Label>
                <Input
                  id="advanceNotes"
                  value={advanceForm.notes}
                  onChange={(event) => setAdvanceForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className={fieldClassName}
                  placeholder="Reason or reference"
                />
              </div>
              <Button className={primaryToolbarButtonClass} onClick={() => void handleCreateAdvance()} disabled={advanceSubmitting}>
                {advanceSubmitting ? "Saving..." : "Add Advance"}
              </Button>
            </div>
          </div>

          <div className={innerPanelClassName}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--portal-heading-color)] dark:text-white">Open Advances</h3>
                <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                  Remaining balances update automatically during each payroll run.
                </p>
              </div>
              <div className="rounded-full border border-[var(--portal-surface-border)] bg-[rgba(var(--portal-primary-rgb),0.08)] px-3 py-1 text-xs font-medium text-[var(--portal-heading-color)] dark:bg-[#181818] dark:text-[#d4d4d4]">
                {advances.filter((entry) => entry.status === "pending" || entry.status === "partially_deducted").length} active
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {advanceLoading ? (
                <div className="rounded-2xl border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-5 py-6 text-sm text-[var(--portal-muted-color)] dark:bg-[#111111]">
                  Loading advances...
                </div>
              ) : advances.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-5 py-6 text-sm text-[var(--portal-muted-color)] dark:bg-[#111111]">
                  No salary advances added yet.
                </div>
              ) : (
                advances.map((advance) => (
                  <div key={advance._id} className={`${subtleCardClassName} p-4`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--portal-heading-color)] dark:text-white">
                          {advance.employee?.fullName || advance.employee?.employeeId || "Employee"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--portal-muted-color)]">
                          {advance.employee?.designation || "No designation"}{advance.employee?.department ? ` • ${advance.employee.department}` : ""}
                        </p>
                        <p className="mt-2 text-xs text-[var(--portal-copy-color)] dark:text-[#d4d4d4]">
                          Advance {currency.format(advance.amount)} • Remaining {currency.format(advance.remainingAmount)}
                        </p>
                        {advance.notes ? (
                          <p className="mt-2 text-xs text-[var(--portal-muted-color)]">{advance.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--portal-surface-border)] bg-[rgba(var(--portal-primary-rgb),0.08)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--portal-heading-color)] dark:bg-[#181818] dark:text-[#d4d4d4]">
                          {advance.status.replaceAll("_", " ")}
                        </span>
                        {(advance.status === "pending" || advance.status === "partially_deducted") ? (
                          <>
                            <Button
                              variant="outline"
                              className={outlineToolbarButtonClass}
                              disabled={advanceActionId === advance._id}
                              onClick={() => void handleAdvanceStatusUpdate(advance._id, "completed")}
                            >
                              Complete
                            </Button>
                            <Button
                              variant="outline"
                              className={outlineToolbarButtonClass}
                              disabled={advanceActionId === advance._id}
                              onClick={() => void handleAdvanceStatusUpdate(advance._id, "cancelled")}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={panelClassName}>
        <div className="flex flex-col gap-3 border-b border-[var(--portal-surface-border)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--portal-heading-color)] dark:text-white">{payrollRegisterLabel}</h2>
            <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
              Use Generate, View, and Download actions in sequence without crowding the main workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--portal-muted-color)]">
            {appliedFilters.search ? (
              <span className="rounded-full border border-[var(--portal-surface-border)] bg-[rgba(var(--portal-primary-rgb),0.08)] px-3 py-1.5 text-[var(--portal-heading-color)] dark:bg-[#181818] dark:text-[#d4d4d4]">Search: {appliedFilters.search}</span>
            ) : null}
            {appliedFilters.status ? (
              <span className="rounded-full border border-[var(--portal-surface-border)] bg-[rgba(var(--portal-primary-rgb),0.08)] px-3 py-1.5 text-[var(--portal-heading-color)] dark:bg-[#181818] dark:text-[#d4d4d4]">Status: {appliedFilters.status}</span>
            ) : null}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {pageLoading ? (
            <div className="rounded-2xl border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-6 py-10 text-sm text-[var(--portal-muted-color)] dark:bg-[#111111]">
              Loading payroll records...
            </div>
          ) : (
            <PayrollTable
              data={filteredPayrollRows}
              actionLoadingId={downloadingId}
              generatedPayrollIds={generatedPayslipIds}
              onGeneratePayslip={handleGeneratePayslip}
              onViewPayslip={(row) => handleOpenPayslip(row._id)}
              onManagePayment={handleOpenPaymentDialog}
              onDownloadPdf={(row) => {
                const record = payrollRecords.find((item) => item._id === row._id);
                if (record) void handleDownloadPayslip(record);
              }}
            />
          )}
        </div>
      </section>

      {!!skipped.length && (
        <section className="rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-5 py-4 text-sm text-[var(--portal-heading-color)] dark:bg-[#111111] dark:text-white">
          <h3 className="font-semibold">{skippedTitle}</h3>
          <div className="mt-2 space-y-1 text-[var(--portal-muted-color)]">
            {skipped.map((entry) => (
              <p key={`${entry.employeeId}-${entry.reason}`}>
                {entry.employeeName}: {entry.reason}
              </p>
            ))}
          </div>
        </section>
      )}

      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="max-w-md border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] text-[var(--portal-heading-color)] dark:bg-[#0a0a0a] dark:text-white">
          <DialogHeader>
            <DialogTitle>{runDialogTitle}</DialogTitle>
            <DialogDescription>
              This will calculate payroll for the selected month, apply configured rules, and refresh the dashboard with the latest processed records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                className={outlineToolbarButtonClass}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button className={primaryToolbarButtonClass} onClick={() => void handleRunPayroll()} disabled={loading || !canRunPayroll}>
              {loading ? processingLabel : processPayrollLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-lg border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] text-[var(--portal-heading-color)] dark:bg-[#0a0a0a] dark:text-white">
          <DialogHeader>
            <DialogTitle>Update Payment</DialogTitle>
            <DialogDescription>
              Track the payout for this payroll entry without losing the underlying attendance-based salary calculation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min="0" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentDate: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Input value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className={outlineToolbarButtonClass} onClick={() => void handleResetPayment()} disabled={paymentSubmitting}>
              Mark Unpaid
            </Button>
            <Button className={primaryToolbarButtonClass} onClick={() => void handleSavePayment()} disabled={paymentSubmitting}>
              {paymentSubmitting ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        values={draftFilters}
        onChange={(key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }))}
        onApply={(values) =>
          setAppliedFilters({
            search: values.search || "",
            status: values.status || "",
          })
        }
        onReset={() => {
          const cleared = { search: "", status: "" };
          setDraftFilters(cleared);
          setAppliedFilters(cleared);
        }}
        filters={[
          { key: "search", label: "Search", type: "text", placeholder: "Search by employee or payroll month" },
          {
            key: "status",
            label: "Payment Status",
            type: "select",
            placeholder: "All payment states",
            options: [
              { label: "Unpaid", value: "Unpaid" },
              { label: "Partially paid", value: "Partially paid" },
              { label: "Paid", value: "Paid" },
            ],
          },
        ]}
      />

      <PayslipModal
        open={payslipModalOpen}
        onOpenChange={setPayslipModalOpen}
        record={selectedRecord}
        downloading={downloadingId === selectedRecord?._id}
        onServerDownload={selectedRecord ? () => void handleDownloadPayslip(selectedRecord) : undefined}
      />
      <div className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] bg-white">
        {fallbackPayrollRecord ? (
          <PayslipDocument
            ref={fallbackPayslipRef}
            record={fallbackPayrollRecord}
          />
        ) : null}
      </div>
    </div>
  );
};

export default AdminPayroll;
