import React from "react";
import { Download, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PayrollRecord } from "@/services/api";
import PayslipDocument from "@/components/payroll/PayslipDocument";
import { downloadElementAsPdf } from "@/utils/html2pdf";

type PayslipModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: PayrollRecord | null;
  downloading?: boolean;
  onServerDownload?: () => void;
};

const buildFileName = (record: PayrollRecord) =>
  `${String(record.employeeCode || record.employeeName || "payslip").replace(/[^a-zA-Z0-9._-]+/g, "-")}-${record.month}-${record.year}-payslip.pdf`;

const actionButtonClass =
  "h-9 rounded-lg px-4 py-2 text-sm font-medium shadow-none transition-colors";

const PayslipModal: React.FC<PayslipModalProps> = ({
  open,
  onOpenChange,
  record,
  downloading = false,
  onServerDownload,
}) => {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [localDownloading, setLocalDownloading] = React.useState(false);

  const handleClientPdf = async () => {
    if (!record || !printRef.current) return;
    setLocalDownloading(true);
    try {
      await downloadElementAsPdf(printRef.current, buildFileName(record));
    } finally {
      setLocalDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-slate-950">
                <Eye className="h-5 w-5" />
                View Payslip
              </DialogTitle>
              <DialogDescription className="mt-2">
                Review the payslip in a modal first, then download the final PDF when you are ready.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className={`${actionButtonClass} border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900`}
                onClick={() => void handleClientPdf()}
                disabled={!record || localDownloading}
              >
                <Download className="h-4 w-4" />
                {localDownloading ? "Preparing..." : "Download PDF"}
              </Button>
              {onServerDownload ? (
                <Button
                  className={`${actionButtonClass} bg-[#4f46e5] text-white hover:bg-[#4338ca]`}
                  onClick={onServerDownload}
                  disabled={!record || downloading}
                >
                  <Download className="h-4 w-4" />
                  {downloading ? "Downloading..." : "Download"}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(92vh-110px)] overflow-y-auto bg-slate-100 p-4 sm:p-6">
          {record ? <PayslipDocument ref={printRef} record={record} className="shadow-[0_20px_60px_rgba(166,124,82,0.16)]" /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayslipModal;
