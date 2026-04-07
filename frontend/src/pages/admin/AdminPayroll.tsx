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
import { apiService, type PayrollRecord, type PayrollSettings } from "@/services/api";
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
  latePenaltyAmount: 0,
  absentPenaltyAmount: 0,
  overtimeMultiplier: 1,
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
  "mt-2 h-10 rounded-lg border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-3 text-sm text-[#F5F5F5] shadow-none focus-visible:border-[#A67C52] focus-visible:ring-[rgba(230,199,163,0.2)]";

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
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="rounded-2xl border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-5 shadow-[0_18px_40px_rgba(166,124,82,0.18)]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#A1A1AA]">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-[#F5F5F5]">{value}</p>
        <p className="mt-1 text-sm text-[#A1A1AA]">{hint}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(230,199,163,0.14)] bg-[rgba(230,199,163,0.12)] text-[#E6C7A3]">
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
  const [selectedPayrollId, setSelectedPayrollId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [generatedPayslipIds, setGeneratedPayslipIds] = useState<string[]>([]);
  const [fallbackPayrollRecord, setFallbackPayrollRecord] = useState<PayrollRecord | null>(null);
  const fallbackPayslipRef = React.useRef<HTMLDivElement>(null);

  if (!payrollEnabled) {
    return null;
  }

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

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  React.useEffect(() => {
    void loadPayroll(selectedMonth);
  }, [loadPayroll, selectedMonth]);

  const payrollRows: PayrollRow[] = useMemo(
    () =>
      payrollRecords.map((record) => ({
        _id: record._id,
        employeeName: record.employeeName,
        monthLabel: `${record.month} ${record.year}`,
        presentDays: record.presentDays + record.lateDays,
        absentDays: record.absentDays,
        grossSalaryFormatted: currency.format(record.fullWages || 0),
        deductionsFormatted: currency.format(record.totalDeductions || 0),
        netSalaryFormatted: currency.format(record.netSalary || 0),
        status: record.status ? `${record.status.charAt(0).toUpperCase()}${record.status.slice(1)}` : "Processed",
      })),
    [payrollRecords]
  );

  const filteredPayrollRows = useMemo(() => {
    const term = appliedFilters.search.toLowerCase();
    return payrollRows.filter((row) => {
      const matchesSearch = !term || row.employeeName.toLowerCase().includes(term) || row.monthLabel.toLowerCase().includes(term);
      const matchesStatus = !appliedFilters.status || row.status === appliedFilters.status;
      return matchesSearch && matchesStatus;
    });
  }, [appliedFilters.search, appliedFilters.status, payrollRows]);

  const selectedRecord = useMemo(
    () => payrollRecords.find((record) => record._id === selectedPayrollId) || payrollRecords[0] || null,
    [payrollRecords, selectedPayrollId]
  );

  const handleRunPayroll = async () => {
    const { month, year } = parseMonthValue(selectedMonth);
    setLoading(true);
    try {
      const response = await apiService.runPayroll({ month, year });
      const processedRecords = response.data?.records || [];
      setPayrollRecords(processedRecords);
      setSummary(response.data?.summary || null);
      setSkipped(response.data?.skippedEmployees || response.data?.skipped || []);
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

  const monthLabel = summary?.month && summary?.year ? `${summary.month} ${summary.year}` : "Selected month";

  return (
    <div className="space-y-6 pb-2">
      <section className="rounded-3xl border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-6 shadow-[0_20px_50px_rgba(166,124,82,0.16)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#F5F5F5]">{pageTitle}</h1>
            <p className="max-w-2xl text-sm leading-6 text-[#A1A1AA]">
              Review payroll month by month, manage payslip actions, and keep the workspace focused on the register instead of side panels.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:flex-row md:flex-nowrap md:items-center md:justify-end xl:w-auto">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="h-9 w-full rounded-lg border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-3.5 text-sm text-[#F5F5F5] shadow-[0_10px_24px_rgba(166,124,82,0.18)] md:w-[190px] md:shrink-0"
            />
            <Button
              variant="outline"
              className={`${toolbarButtonClass} border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#E6C7A3] md:shrink-0`}
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <Button
              className={`${toolbarButtonClass} border border-[rgba(166,124,82,0.24)] bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] text-[#1A1816] shadow-[0_14px_32px_rgba(166,124,82,0.24)] hover:bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] hover:shadow-[0_18px_36px_rgba(166,124,82,0.32)] md:shrink-0`}
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
              className={`${toolbarButtonClass} border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#E6C7A3] md:shrink-0`}
              loading={pageLoading}
              emptyMessage="No data to export"
              preferServerExport={false}
            />
          </div>
        </div>
      </section>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="rounded-3xl border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] shadow-[0_20px_50px_rgba(166,124,82,0.16)]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-base font-semibold text-[#F5F5F5]">{rulesTitle}</p>
            <p className="mt-1 text-sm text-[#A1A1AA]">Collapsed by default to keep the register clean. Expand only when you need to update company rules.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className={`${toolbarButtonClass} border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#E6C7A3]`}
              onClick={() => void handleSaveConfig()}
              disabled={configSaving}
            >
              <Save className="h-4 w-4" />
              {configSaving ? savingRulesLabel : saveRulesLabel}
            </Button>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className={`${toolbarButtonClass} border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#E6C7A3]`}
              >
                <Settings2 className="h-4 w-4" />
                {settingsOpen ? hideSettingsLabel : showSettingsLabel}
                <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="border-t border-[#2A2623] px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-2xl border border-[#2A2623] bg-[linear-gradient(135deg,#181513,#211d1a)] p-5">
              <h2 className="text-sm font-semibold text-[#F5F5F5]">Working Days</h2>
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
                <div className="flex items-center justify-between rounded-xl border border-[#2A2623] bg-[rgba(35,32,29,0.72)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#F5F5F5]">Include Paid Leave</p>
                    <p className="text-xs text-[#A1A1AA]">Leaves count toward earned wages</p>
                  </div>
                  <Switch
                    checked={payrollConfig.includePaidLeaveInWages}
                    onCheckedChange={(checked) => setPayrollConfig((prev) => ({ ...prev, includePaidLeaveInWages: checked }))}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#2A2623] bg-[linear-gradient(135deg,#181513,#211d1a)] p-5">
              <h2 className="text-sm font-semibold text-[#F5F5F5]">Penalties And Overtime</h2>
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
              </div>
            </section>

            <section className="rounded-2xl border border-[#2A2623] bg-[linear-gradient(135deg,#181513,#211d1a)] p-5">
              <h2 className="text-sm font-semibold text-[#F5F5F5]">Statutory Deductions</h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-[#2A2623] bg-[rgba(35,32,29,0.72)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#F5F5F5]">Provident Fund</p>
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

                <div className="rounded-xl border border-[#2A2623] bg-[rgba(35,32,29,0.72)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#F5F5F5]">Employee State Insurance</p>
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
        <StatCard title={totalPayrollLabel} value={currency.format(summary?.totalPayroll || 0)} hint={monthLabel} icon={Wallet} />
        <StatCard title={processedLabel} value={summary?.processedEmployees || 0} hint={processedHint} icon={CheckCircle2} />
        <StatCard title={pendingLabel} value={summary?.pendingEmployees || 0} hint={pendingHint} icon={Clock3} />
      </section>

      <section className="rounded-3xl border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] shadow-[0_20px_50px_rgba(166,124,82,0.16)]">
        <div className="flex flex-col gap-3 border-b border-[#2A2623] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-[#F5F5F5]">{payrollRegisterLabel}</h2>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Use Generate, View, and Download actions in sequence without crowding the main workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[#A1A1AA]">
            {appliedFilters.search ? (
              <span className="rounded-full border border-[#2A2623] bg-[rgba(230,199,163,0.12)] px-3 py-1.5 text-[#E6C7A3]">Search: {appliedFilters.search}</span>
            ) : null}
            {appliedFilters.status ? (
              <span className="rounded-full border border-[#2A2623] bg-[rgba(230,199,163,0.12)] px-3 py-1.5 text-[#E6C7A3]">Status: {appliedFilters.status}</span>
            ) : null}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {pageLoading ? (
            <div className="rounded-2xl border border-dashed border-[#2A2623] bg-[linear-gradient(135deg,#181513,#211d1a)] px-6 py-10 text-sm text-[#A1A1AA]">
              Loading payroll records...
            </div>
          ) : (
            <PayrollTable
              data={filteredPayrollRows}
              actionLoadingId={downloadingId}
              generatedPayrollIds={generatedPayslipIds}
              onGeneratePayslip={handleGeneratePayslip}
              onViewPayslip={(row) => handleOpenPayslip(row._id)}
              onDownloadPdf={(row) => {
                const record = payrollRecords.find((item) => item._id === row._id);
                if (record) void handleDownloadPayslip(record);
              }}
            />
          )}
        </div>
      </section>

      {!!skipped.length && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <h3 className="font-semibold">{skippedTitle}</h3>
          <div className="mt-2 space-y-1 text-amber-900/80">
            {skipped.map((entry) => (
              <p key={`${entry.employeeId}-${entry.reason}`}>
                {entry.employeeName}: {entry.reason}
              </p>
            ))}
          </div>
        </section>
      )}

      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="max-w-md">
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
              className={`${toolbarButtonClass} border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#E6C7A3]`}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button className={`${toolbarButtonClass} border border-[rgba(166,124,82,0.24)] bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] text-[#1A1816] shadow-[0_14px_32px_rgba(166,124,82,0.24)] hover:bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] hover:shadow-[0_18px_36px_rgba(166,124,82,0.32)]`} onClick={() => void handleRunPayroll()} disabled={loading || !canRunPayroll}>
              {loading ? processingLabel : processPayrollLabel}
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
            label: "Status",
            type: "select",
            placeholder: "All statuses",
            options: [{ label: "Processed", value: "Processed" }],
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
