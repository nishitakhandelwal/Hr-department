import React from "react";
import { Download, Loader2 } from "lucide-react";

import EmployeeIdCardDocument from "@/components/employees/EmployeeIdCardDocument";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSystemSettings } from "@/context/SystemSettingsContext";
import { downloadElementAsPdf } from "@/utils/html2pdf";
import type { EmployeeRecord } from "@/services/api";

type EmployeeIdCardModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeRecord | null;
  loading?: boolean;
  onEdit?: () => void;
};

const sanitizeFileSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "employee";

const EmployeeIdCardModal: React.FC<EmployeeIdCardModalProps> = ({
  open,
  onOpenChange,
  employee,
  loading = false,
  onEdit,
}) => {
  const { publicSettings } = useSystemSettings();
  const [downloading, setDownloading] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const companyName = publicSettings?.company?.companyName || "Arihant Dream Infra Project Ltd.";
  const companyLogoUrl = publicSettings?.company?.companyLogoUrl || "";

  const handleDownload = async () => {
    if (!employee || !printRef.current) return;

    setDownloading(true);
    try {
      await downloadElementAsPdf(
        printRef.current,
        `${sanitizeFileSegment(employee.fullName)}-id-card.pdf`
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !downloading && onOpenChange(nextOpen)}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white p-0 shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
        <DialogHeader className="shrink-0 border-b border-[#E5E7EB] px-6 py-5">
          <DialogTitle className="text-[#1F2937]">Employee ID Card</DialogTitle>
          <DialogDescription className="text-[#6B7280]">
            Preview the front and back of the corporate employee ID card and download it as a print-ready PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex min-h-[18rem] items-center justify-center rounded-[24px] border border-[#E5E7EB] bg-[#FCFCFD] text-[#8B5E3C]">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Loading employee details...
            </div>
          ) : employee ? (
            <div
              ref={printRef}
              className="rounded-[28px] bg-[#FBF7F2] p-6 shadow-[inset_0_0_0_1px_rgba(215,179,141,0.18)]"
            >
              <EmployeeIdCardDocument
                employee={employee}
                companyName={companyName}
                companyLogoUrl={companyLogoUrl}
                companyAddress={publicSettings?.company?.address || ""}
                companyWebsite={publicSettings?.company?.website || ""}
                companyEmail={publicSettings?.company?.contactEmail || ""}
                companyPhone={publicSettings?.company?.contactPhone || ""}
              />
            </div>
          ) : (
            <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FCFCFD] px-5 py-10 text-center text-[#6B7280]">
              Employee details are unavailable for ID card generation.
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-[#E5E7EB] bg-white px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={onEdit}
            disabled={!employee || loading || downloading || !onEdit}
          >
            Edit Details
          </Button>
          <Button
            onClick={() => void handleDownload()}
            disabled={!employee || loading || downloading}
            className="gap-2 rounded-xl border border-[#B68A5C] bg-[linear-gradient(135deg,#A67C52,#D9B38C)] px-5 text-white shadow-[0_16px_32px_rgba(166,124,82,0.22)]"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Downloading..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeIdCardModal;
