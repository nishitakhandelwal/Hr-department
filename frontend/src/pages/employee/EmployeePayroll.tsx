import React, { useEffect, useMemo, useState } from "react";
import { DollarSign } from "lucide-react";
import { motion } from "framer-motion";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { apiService, type PayrollRecord } from "@/services/api";
import PayslipModal from "@/components/payroll/PayslipModal";
import { downloadPdfBlob } from "@/utils/downloadPdf";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const EmployeePayroll: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [payslips, setPayslips] = useState<PayrollRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);

  const loadPayroll = async () => {
    setLoading(true);
    try {
      const rows = await apiService.getPayroll();
      setPayslips(rows);
      setSelectedId(rows[0]?._id || "");
    } catch (error) {
      console.error("Failed to fetch payroll", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayroll();
  }, [user?.id]);

  const handleDownload = async (slip: PayrollRecord) => {
    setDownloadingId(slip._id);
    try {
      const result = await apiService.downloadPayrollPayslip(slip._id);
      downloadPdfBlob(
        result.blob,
        result.fileName || `${slip.employeeCode || slip.employeeName}-${slip.month}-${slip.year}-salary-slip.pdf`
      );
    } catch (error) {
      console.error("Failed to download salary slip", error);
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
        <StatCard title="Full Wages" value={currency.format(selectedSlip?.fullWages || 0)} change="Current cycle" icon={DollarSign} color="primary" />
        <StatCard title="Last Net Pay" value={currency.format(selectedSlip?.netSalary || 0)} change={selectedSlip ? `${selectedSlip.month} ${selectedSlip.year}` : "No record"} icon={DollarSign} color="success" delay={1} />
        <StatCard title="YTD Earnings" value={currency.format(ytd)} change={new Date().getFullYear().toString()} icon={DollarSign} color="info" delay={2} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading payroll...</div>
      ) : (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Payslip History</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Monthly Salary Slips</h2>
            </div>
            <p className="text-sm text-slate-500">
              {payslips.length} record{payslips.length === 1 ? "" : "s"}
            </p>
          </div>

          {payslips.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
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
                  className={`w-full rounded-[24px] border p-5 text-left shadow-[0_24px_80px_-48px_rgba(15,23,42,0.18)] transition-all ${
                    selectedId === slip._id
                      ? "border-blue-300 bg-blue-50/70"
                      : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Salary Slip</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {slip.month} {slip.year}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Attendance: {slip.presentDays} present, {slip.lateDays} late, {slip.absentDays} absent, {slip.leaveDays} leave
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Net Pay</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{currency.format(slip.netSalary || 0)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
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
