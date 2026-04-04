import React, { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, Send, Eye } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import letterPrintCss from "@/styles/letter-print.css?raw";
import {
  buildCorporateLetterHtml,
  corporateLetterTypes,
  CorporateLetterType,
  defaultCorporateLetterData,
  CorporateLetterData,
} from "@/lib/letterTemplates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadPdfBlob } from "@/utils/downloadPdf";
import { Checkbox } from "@/components/ui/checkbox";
import { apiService } from "@/services/api";

const companyLogo = "/logo.png";

const letterColors = [
  "bg-primary/10 text-primary",
  "bg-success/10 text-success",
  "bg-info/10 text-info",
  "bg-warning/10 text-warning",
  "bg-destructive/10 text-destructive",
  "bg-success/10 text-success",
  "bg-primary/10 text-primary",
  "bg-info/10 text-info",
];

const AdminLetters: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CorporateLetterType>("Salary Approval Letter");
  const [formData, setFormData] = useState<CorporateLetterData>(defaultCorporateLetterData);
  const [sendingEmail, setSendingEmail] = useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const payload = await apiService.getSettings();
        const company = payload.settings.company;
        setFormData((prev) => ({
          ...prev,
          companyName: company.companyName || prev.companyName,
          companyAddress: company.address || prev.companyAddress,
          companyContact: company.contactPhone || prev.companyContact,
        }));
      } catch {
        // no-op fallback to template defaults
      }
    })();
  }, []);

  const letterHtml = useMemo(
    () => buildCorporateLetterHtml(selectedType, formData, companyLogo),
    [selectedType, formData],
  );

  const updateField = (key: keyof CorporateLetterData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleExportPdf = async () => {
    try {
      const pdfBlob = await apiService.generateOfferLetterPdf({
        htmlContent: letterHtml,
        fileName: `${selectedType.replace(/\s+/g, "-").toLowerCase()}-${formData.employeeId || "employee"}.pdf`,
      });
      const filename = `${selectedType.replace(/\s+/g, "-").toLowerCase()}-${formData.employeeId || "employee"}.pdf`;
      downloadPdfBlob(pdfBlob, filename);
    } catch (error) {
      console.error("PDF export error:", error);
    }
  };

  const handleSendLetter = async () => {
    const email = formData.employeeEmail.trim();
    if (!email) {
      console.error("Employee email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("Please enter a valid employee email.");
      return;
    }

    try {
      setSendingEmail(true);
      const result = await apiService.sendLetterByEmail({
        letterType: selectedType,
        formData,
        htmlContent: letterHtml,
        employeeEmail: email,
      });
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string } | undefined)?.message || error.message
        : error instanceof Error
          ? error.message
          : "Failed to send letter. Please try again.";
      console.error(message);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Letters"
        subtitle="Generate and manage HR letters using templates"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground gap-2">
                <Plus className="w-4 h-4" />
                Create Letter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl h-[92vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Corporate HR Letter Generator (Preview Mode)</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden flex-1">
                <div className="overflow-y-auto border rounded-lg p-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="letter-type">Letter Type</Label>
                    <select
                      id="letter-type"
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value as CorporateLetterType)}
                      className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md"
                    >
                      {corporateLetterTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Employee Name</Label><Input value={formData.employeeName} onChange={(e) => updateField("employeeName", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Employee ID</Label><Input value={formData.employeeId} onChange={(e) => updateField("employeeId", e.target.value)} /></div>
                    <div className="space-y-1">
                      <Label>
                        Employee Email {selectedType === "Offer Letter" ? "*" : ""}
                      </Label>
                      <Input
                        type="email"
                        required={selectedType === "Offer Letter"}
                        value={formData.employeeEmail}
                        onChange={(e) => updateField("employeeEmail", e.target.value)}
                        placeholder="employee@company.com"
                      />
                    </div>
                    <div className="space-y-1"><Label>Designation</Label><Input value={formData.designation} onChange={(e) => updateField("designation", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Department</Label><Input value={formData.department} onChange={(e) => updateField("department", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Salary</Label><Input value={formData.salary} onChange={(e) => updateField("salary", e.target.value)} /></div>
                    <div className="space-y-1"><Label>CTC</Label><Input value={formData.ctc} onChange={(e) => updateField("ctc", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Joining Date</Label><DatePicker value={formData.joiningDate} onChange={(e) => updateField("joiningDate", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Last Working Date</Label><DatePicker value={formData.lastWorkingDate} onChange={(e) => updateField("lastWorkingDate", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Effective Date</Label><DatePicker value={formData.effectiveDate} onChange={(e) => updateField("effectiveDate", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Letter Date</Label><DatePicker value={formData.letterDate} onChange={(e) => updateField("letterDate", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Company Name</Label><Input value={formData.companyName} onChange={(e) => updateField("companyName", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Company Legal Name</Label><Input value={formData.companyLegalName} onChange={(e) => updateField("companyLegalName", e.target.value)} /></div>
                    <div className="space-y-1"><Label>CIN</Label><Input value={formData.CIN} onChange={(e) => updateField("CIN", e.target.value)} /></div>
                    <div className="space-y-1"><Label>GST</Label><Input value={formData.GST} onChange={(e) => updateField("GST", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Employment Type</Label><Input value={formData.employmentType} onChange={(e) => updateField("employmentType", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Office Address</Label><Input value={formData.officeAddress} onChange={(e) => updateField("officeAddress", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Company Address</Label><Input value={formData.companyAddress} onChange={(e) => updateField("companyAddress", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Company Contact</Label><Input value={formData.companyContact} onChange={(e) => updateField("companyContact", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Recipient Company</Label><Input value={formData.recipientCompanyName} onChange={(e) => updateField("recipientCompanyName", e.target.value)} /></div>
                    <div className="space-y-1"><Label>ISO Line</Label><Input value={formData.isoLine} onChange={(e) => updateField("isoLine", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Authorized Signatory</Label><Input value={formData.authorizedSignatoryName} onChange={(e) => updateField("authorizedSignatoryName", e.target.value)} /></div>
                    <div className="space-y-1"><Label>Signatory Designation</Label><Input value={formData.authorizedSignatoryDesignation} onChange={(e) => updateField("authorizedSignatoryDesignation", e.target.value)} /></div>
                  </div>

                  {/* Last Working Date Toggle */}
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      id="showLastWorkingDate"
                      checked={formData.showLastWorkingDate}
                      onCheckedChange={(checked) => updateField("showLastWorkingDate", Boolean(checked))}
                    />
                    <Label htmlFor="showLastWorkingDate" className="text-sm font-normal">
                      Show Last Working Date in letter
                    </Label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button className="gap-2" onClick={() => void handleExportPdf()}>
                      <Download className="w-4 h-4" />
                      Export PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleSendLetter}
                      disabled={sendingEmail}
                    >
                      <Send className="w-4 h-4" />
                      {sendingEmail ? "Sending..." : "Send Letter"}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => undefined}
                    >
                      <Eye className="w-4 h-4" />
                      Refresh Preview
                    </Button>
                  </div>
                </div>

                <div className="overflow-auto border rounded-lg bg-muted/20">
                  <style>{letterPrintCss}</style>
                  <div dangerouslySetInnerHTML={{ __html: letterHtml }} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {corporateLetterTypes.map((letter, i) => (
          <motion.div
            key={letter}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl p-5 border border-border shadow-card hover:shadow-card-hover transition-shadow cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-lg ${letterColors[i % letterColors.length]} flex items-center justify-center mb-3`}>
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-card-foreground text-sm">{letter}</h3>
            <p className="text-xs text-muted-foreground mt-1">Official corporate template</p>
            <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setSelectedType(letter);
                  setDialogOpen(true);
                }}
              >
                <Eye className="w-3 h-3" />
                Preview
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => undefined}><Send className="w-3 h-3" />Email</Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminLetters;
