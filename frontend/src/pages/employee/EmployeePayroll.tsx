import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IndianRupee } from "lucide-react";
import { motion } from "framer-motion";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiService, type PayrollRecord } from "@/services/api";
import PayslipModal from "@/components/payroll/PayslipModal";
import { downloadPdfBlob } from "@/utils/downloadPdf";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const EmployeePayroll: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [payslips, setPayslips] = useState<PayrollRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const rows = await apiService.getPayroll();
      setPayslips(rows);
      setSelectedId(rows[0]?._id || "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load payroll.";
      setErrorMessage(message);
      toast({ title: "Payroll unavailable", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadPayroll();
  }, [loadPayroll, user?.id]);

  const handleDownload = async (slip: PayrollRecord) => {
    setDownloadingId(slip._id);
    try {
      const result = await apiService.downloadPayrollPayslip(slip._id);
      downloadPdfBlob(
        result.blob,
        result.fileName || `${slip.employeeCode || slip.employeeName}-${slip.month}-${slip.year}-salary-slip.pdf`
      );
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Unable to download salary slip.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId("");
    }
  };

  const selectedSlip = useMemo(
    () => payslips.find((slip) => slip._id === selectedId) || payslips[0] || null,
    [payslips, selectedId]
  );

  const ytd = useMemo(() => payslips.reduce((sum, slip) => sum + slip.netSalary, 0), [payslips]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Payroll" subtitle="Review salary history in a clean list, open the payslip in a modal, and download the final PDF when needed." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Full Wages" value={currency.format(selectedSlip?.fullWages || 0)} change="Current cycle" icon={IndianRupee} color="primary" />
        <StatCard title="Last Net Pay" value={currency.format(selectedSlip?.netSalary || 0)} change={selectedSlip ? `${selectedSlip.month} ${selectedSlip.year}` : "No record"} icon={IndianRupee} color="success" delay={1} />
        <StatCard title="YTD Earnings" value={currency.format(ytd)} change={new Date().getFullYear().toString()} icon={IndianRupee} color="info" delay={2} />
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading payroll...</div>
      ) : (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-48px_rgba(166,124,82,0.18)] dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#111111,#1A1816)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-[#2A2623]">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-[#A1A1AA]">Payslip History</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-[#F5F5F5]">Monthly Salary Slips</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-[#A1A1AA]">
              {payslips.length} record{payslips.length === 1 ? "" : "s"}
            </p>
          </div>

          {payslips.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500 dark:border-[#2A2623] dark:bg-[rgba(35,32,29,0.72)] dark:text-[#A1A1AA]">
              No salary slips are available yet.
            </div>
          ) : (
            <div className="space-y-3">
              {payslips.map((slip, index) => (
                <motion.div
                  key={slip._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  onClick={() => setSelectedId(slip._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(slip._id);
                    }
                  }}
                  className={`w-full rounded-[24px] border p-5 text-left shadow-[0_24px_80px_-48px_rgba(166,124,82,0.18)] transition-all ${
                    selectedId === slip._id
                      ? "border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#2A211B)] text-[#F5F5F5]"
                      : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#2A2623] hover:bg-[rgba(230,199,163,0.2)] dark:border-[#2A2623] dark:bg-[rgba(20,18,17,0.94)] dark:text-[#F5F5F5] dark:hover:bg-[rgba(230,199,163,0.12)]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-[#A1A1AA]">Salary Slip</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-[#F5F5F5]">
                        {slip.month} {slip.year}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-[#A1A1AA]">
                        Attendance: {slip.presentDays} present, {slip.lateDays} late, {slip.absentDays} absent, {slip.leaveDays} leave
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-[rgba(35,32,29,0.88)]">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-[#A1A1AA]">Net Pay</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-[#F5F5F5]">{currency.format(slip.netSalary || 0)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#2A2623] dark:bg-black dark:text-white dark:hover:bg-[#141414]"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(slip._id);
                        setPayslipModalOpen(true);
                      }}
                    >
                      View Payslip
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:border dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] dark:text-[#1A1816] dark:hover:bg-[linear-gradient(135deg,#A67C52,#E6C7A3)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDownload(slip);
                      }}
                    >
                      {downloadingId === slip._id ? "Downloading..." : "Download PDF"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      <PayslipModal
        open={payslipModalOpen}
        onOpenChange={setPayslipModalOpen}
        record={selectedSlip}
        downloading={downloadingId === selectedSlip?._id}
        onServerDownload={selectedSlip ? () => void handleDownload(selectedSlip) : undefined}
      />
    </div>
  );
};

export default EmployeePayroll;
