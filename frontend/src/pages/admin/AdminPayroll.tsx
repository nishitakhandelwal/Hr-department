import React, { useMemo, useState } from "react";
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
  "mt-2 h-10 rounded-lg border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-none focus-visible:border-[#4f46e5] focus-visible:ring-[#4f46e5]/20";

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
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const AdminPayroll: React.FC = () => {
  const { toast } = useToast();
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

  const loadPayroll = async (monthValue = selectedMonth) => {
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
  };

  const loadConfig = async () => {
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
  };

  React.useEffect(() => {
    void loadConfig();
  }, []);

  React.useEffect(() => {
    void loadPayroll(selectedMonth);
  }, [selectedMonth]);

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
        console.error("Failed to download salary slip", error, fallbackError);
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
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Payroll</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Review payroll month by month, manage payslip actions, and keep the workspace focused on the register instead of side panels.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:flex-row md:flex-nowrap md:items-center md:justify-end xl:w-auto">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="h-9 w-full rounded-lg border-slate-200 bg-white px-3.5 text-sm shadow-none md:w-[190px] md:shrink-0"
            />
            <Button
              variant="outline"
              className={`${toolbarButtonClass} border-slate-200 bg-[#f3f4f6] text-[#111827] hover:border-slate-200 hover:bg-slate-200 hover:text-[#111827] md:shrink-0`}
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <Button
              className={`${toolbarButtonClass} bg-[#4f46e5] text-white hover:bg-[#4338ca] md:shrink-0`}
              onClick={() => setRunDialogOpen(true)}
            >
              <PlayCircle className="h-4 w-4" />
              Run Payroll
            </Button>
            <ExportButton
              moduleName="payroll"
              rows={filteredPayrollRows}
              fallbackRows={payrollRows}
              columns={payrollExportColumns}
              filters={{ ...appliedFilters, month: selectedMonth }}
              className={`${toolbarButtonClass} border-slate-200 bg-[#f3f4f6] text-[#111827] hover:border-slate-200 hover:bg-slate-200 hover:text-[#111827] md:shrink-0`}
              loading={pageLoading}
              emptyMessage="No data to export"
              preferServerExport={false}
            />
          </div>
        </div>
      </section>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-base font-semibold text-slate-900">Payroll Rules</p>
            <p className="mt-1 text-sm text-slate-500">Collapsed by default to keep the register clean. Expand only when you need to update company rules.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className={`${toolbarButtonClass} border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900`}
              onClick={() => void handleSaveConfig()}
              disabled={configSaving}
            >
              <Save className="h-4 w-4" />
              {configSaving ? "Saving..." : "Save Rules"}
            </Button>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className={`${toolbarButtonClass} border-slate-200 bg-[#f3f4f6] text-[#111827] hover:border-slate-200 hover:bg-slate-200 hover:text-[#111827]`}
              >
                <Settings2 className="h-4 w-4" />
                {settingsOpen ? "Hide Settings" : "Show Settings"}
                <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="border-t border-slate-200 px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-semibold text-slate-900">Working Days</h2>
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
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Include Paid Leave</p>
                    <p className="text-xs text-slate-500">Leaves count toward earned wages</p>
                  </div>
                  <Switch
                    checked={payrollConfig.includePaidLeaveInWages}
                    onCheckedChange={(checked) => setPayrollConfig((prev) => ({ ...prev, includePaidLeaveInWages: checked }))}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-semibold text-slate-900">Penalties And Overtime</h2>
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

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-semibold text-slate-900">Statutory Deductions</h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">Provident Fund</p>
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

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">Employee State Insurance</p>
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
        <StatCard title="Total Payroll" value={currency.format(summary?.totalPayroll || 0)} hint={monthLabel} icon={Wallet} />
        <StatCard title="Processed" value={summary?.processedEmployees || 0} hint="Employees completed" icon={CheckCircle2} />
        <StatCard title="Pending" value={summary?.pendingEmployees || 0} hint="Employees waiting" icon={Clock3} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Payroll Register</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use Generate, View, and Download actions in sequence without crowding the main workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            {appliedFilters.search ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5">Search: {appliedFilters.search}</span>
            ) : null}
            {appliedFilters.status ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5">Status: {appliedFilters.status}</span>
            ) : null}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {pageLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-sm text-slate-500">
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
          <h3 className="font-semibold">Skipped During Payroll Run</h3>
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
            <DialogTitle>Run Payroll</DialogTitle>
            <DialogDescription>
              This will calculate payroll for the selected month, apply configured rules, and refresh the dashboard with the latest processed records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                className={`${toolbarButtonClass} border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900`}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button className={`${toolbarButtonClass} bg-[#4f46e5] text-white hover:bg-[#4338ca]`} onClick={() => void handleRunPayroll()} disabled={loading}>
              {loading ? "Processing..." : "Confirm And Process"}
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
