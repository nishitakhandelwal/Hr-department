import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, FileImage, FileText, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { useSystemSettings } from "@/context/SystemSettingsContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiService, type JoiningFormRecord } from "@/services/api";

type ReviewAction = "approve" | "request_correction" | "reject";

type ReviewModalState = {
  open: boolean;
  formId: string;
  action: ReviewAction;
};

type DocumentPreviewState = {
  open: boolean;
  form: JoiningFormRecord | null;
};

const actionLabelMap: Record<ReviewAction, string> = {
  approve: "Approve",
  request_correction: "Correction",
  reject: "Reject",
};

const actionButtonClass =
  "h-9 rounded-xl px-3.5 text-sm font-medium shadow-none transition-all duration-200";

const getStatusClassName = (status: string, isDarkMode: boolean) => {
  if (isDarkMode) {
    return {
      Requested: "border border-[#2A2623] bg-[rgba(35,32,29,0.72)] text-[#A1A1AA]",
      Submitted: "border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#2A211B)] text-[#E6C7A3]",
      "Correction Requested": "border border-[rgba(166,124,82,0.22)] bg-[rgba(166,124,82,0.16)] text-[#E6C7A3]",
      Approved: "border border-[rgba(230,199,163,0.18)] bg-[rgba(230,199,163,0.12)] text-[#E6C7A3]",
      Rejected: "border border-red-400/25 bg-red-500/10 text-red-300",
    }[status] || "border border-[#2A2623] bg-[rgba(35,32,29,0.72)] text-[#A1A1AA]";
  }

  return {
    Requested: "border border-[#D6D3D1] bg-[#F5F5F4] text-[#18181B]",
    Submitted: "border border-[#E7D7C4] bg-[#F8F5F1] text-[#18181B]",
    "Correction Requested": "border border-[#E7D7C4] bg-[#F6E7D3] text-[#18181B]",
    Approved: "border border-[#E7D7C4] bg-[#EFE3D3] text-[#18181B]",
    Rejected: "border border-[#F3C3C3] bg-[#FCE8E8] text-[#18181B]",
  }[status] || "border border-[#D6D3D1] bg-[#F5F5F4] text-[#18181B]";
};

const getFileExtension = (value = "") => {
  try {
    const pathname = new URL(value).pathname;
    return pathname.split(".").pop()?.toLowerCase() || "";
  } catch {
    return value.split("?")[0].split(".").pop()?.toLowerCase() || "";
  }
};

const detectPreviewType = (document?: { url?: string; originalName?: string; mimeType?: string }) => {
  const mimeType = String(document?.mimeType || "").toLowerCase();
  const originalNameExtension = getFileExtension(document?.originalName || "");
  const urlExtension = getFileExtension(document?.url || "");
  const extension = originalNameExtension || urlExtension;

  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
    return "image" as const;
  }
  if (mimeType === "application/pdf" || extension === "pdf") {
    return "pdf" as const;
  }
  return "file" as const;
};

const AdminJoiningForms: React.FC = () => {
  const { toast } = useToast();
  const { theme } = useSystemSettings();
  const isDarkMode = theme === "dark";
  const [rows, setRows] = useState<JoiningFormRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewModal, setReviewModal] = useState<ReviewModalState>({
    open: false,
    formId: "",
    action: "approve",
  });
  const [documentPreview, setDocumentPreview] = useState<DocumentPreviewState>({
    open: false,
    form: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.listJoiningForms({ status: statusFilter || undefined });
      setRows(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load joining forms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReviewModal = (formId: string, action: ReviewAction) => {
    setRemarks("");
    setReviewModal({ open: true, formId, action });
  };

  const closeReviewModal = () => {
    if (submitting) return;
    setReviewModal((current) => ({ ...current, open: false }));
    setRemarks("");
  };

  const submitDecision = async () => {
    if (!reviewModal.formId || !remarks.trim()) return;

    const nextAction = reviewModal.action;
    const nextFormId = reviewModal.formId;
    const nextRemarks = remarks.trim();

    setReviewModal({ open: false, formId: "", action: "approve" });
    setRemarks("");
    setSubmitting(true);
    try {
      const response = await apiService.reviewJoiningForm(nextFormId, {
        action: nextAction,
        remarks: nextRemarks,
      });
      toast({
        title: "Updated",
        description: `${actionLabelMap[nextAction]} decision submitted successfully.`,
      });
      await load();
      if (nextAction === "approve" && response?.employee) {
        toast({
          title: "Employee Created",
          description: "Joining form approved and the profile has been converted into an employee.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to review joining form",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const modalActionLabel = useMemo(() => actionLabelMap[reviewModal.action], [reviewModal.action]);

  return (
    <div className="space-y-6">
      <PageHeader title="Joining Forms" subtitle="Review submitted joining forms with cleaner actions and decision remarks." />

      <section className={isDarkMode
        ? "rounded-3xl border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-5 shadow-[0_20px_50px_rgba(166,124,82,0.16)] sm:p-6"
        : "rounded-3xl border border-[#E7E5E4] bg-white p-5 shadow-[0_20px_50px_rgba(15,14,13,0.08)] sm:p-6"}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`text-base font-semibold ${isDarkMode ? "text-[#F5F5F5]" : "text-[#18181B]"}`}>Review Queue</p>
            <p className={`mt-1 text-sm ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>Filter submissions by status and review each form with documented remarks. All records are shown by default so employee activation uploads do not stay hidden.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className={isDarkMode
                ? "h-10 rounded-xl border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-3.5 text-sm text-[#F5F5F5] shadow-none outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                : "h-10 rounded-xl border border-[#D6D3D1] bg-white px-3.5 text-sm text-[#18181B] shadow-none outline-none transition focus:border-[#A67C52] focus:ring-2 focus:ring-[rgba(166,124,82,0.15)]"}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="Requested">Requested</option>
              <option value="Submitted">Submitted</option>
              <option value="Correction Requested">Correction Requested</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <Button
              variant="outline"
              className={isDarkMode
                ? "h-10 rounded-xl border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-4 text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#E6C7A3]"
                : "h-10 rounded-xl border-[#D6D3D1] bg-white px-4 text-[#18181B] hover:border-[#A67C52] hover:bg-[#F8F5F1] hover:text-[#18181B]"}
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <section className={isDarkMode
        ? "overflow-hidden rounded-3xl border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] shadow-[0_20px_50px_rgba(166,124,82,0.16)]"
        : "overflow-hidden rounded-3xl border border-[#E7E5E4] bg-white shadow-[0_20px_50px_rgba(15,14,13,0.08)]"}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={isDarkMode ? "bg-[rgba(230,199,163,0.08)]" : "bg-[#F8F5F1]"}>
              <tr className={isDarkMode ? "border-b border-[#2A2623]" : "border-b border-[#E7E5E4]"}>
                <th className={`px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>Profile</th>
                <th className={`px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>Status</th>
                <th className={`px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>Submitted At</th>
                <th className={`px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className={`px-5 py-10 text-center text-sm ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`} colSpan={4}>
                    No joining forms found for the selected filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const candidate = typeof row.candidateId === "object" ? row.candidateId : null;
                  const linkedUser = "userId" in row && typeof row.userId === "object" ? row.userId : null;
                  const docs = [
                    { label: "Resume", ...row.documents?.resume },
                    { label: "Photograph", ...row.documents?.photograph },
                    { label: "Certificates", ...row.documents?.certificates },
                    { label: "ID Proof", ...row.documents?.idProof },
                  ].filter((item) => item.url);
                  const primaryName = candidate?.fullName || linkedUser?.name || "Joining Form Record";
                  const secondaryText = candidate?.email || linkedUser?.email || "Submitted profile";

                  return (
                    <tr key={row._id} className={isDarkMode ? "border-b border-[#2A2623] last:border-b-0 hover:bg-[rgba(230,199,163,0.08)]" : "border-b border-[#F4F4F5] last:border-b-0 hover:bg-[#FAF7F2]"}>
                      <td className="px-5 py-4">
                        <div className={`font-medium ${isDarkMode ? "text-[#F5F5F5]" : "text-[#18181B]"}`}>{primaryName}</div>
                        <div className={`mt-1 text-xs ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>{secondaryText}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(row.status, isDarkMode)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className={`px-5 py-4 ${isDarkMode ? "text-[#D4D4D8]" : "text-[#27272A]"}`}>
                        {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex min-w-max flex-wrap gap-2 lg:flex-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`${actionButtonClass} ${isDarkMode ? "border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#E6C7A3]" : "border-[#D6D3D1] bg-white text-[#18181B] hover:border-[#A67C52] hover:bg-[#F8F5F1] hover:text-[#18181B]"}`}
                            disabled={!docs.length}
                            onClick={() => setDocumentPreview({ open: true, form: row })}
                          >
                            <Eye className="h-4 w-4" />
                            Docs
                          </Button>
                          {row.status !== "Approved" && row.status !== "Rejected" ? (
                            <>
                              <Button
                                size="sm"
                                className={`${actionButtonClass} border border-[rgba(166,124,82,0.24)] bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] text-[#1A1816] hover:shadow-[0_16px_34px_rgba(166,124,82,0.28)]`}
                                onClick={() => openReviewModal(row._id, "approve")}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${actionButtonClass} ${isDarkMode ? "border border-[rgba(166,124,82,0.22)] bg-[rgba(166,124,82,0.16)] text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#F5F5F5]" : "border border-[#E7D7C4] bg-[#F6E7D3] text-[#18181B] hover:border-[#D6B58C] hover:bg-[#F3DFC6] hover:text-[#18181B]"}`}
                                onClick={() => openReviewModal(row._id, "request_correction")}
                              >
                                <ShieldAlert className="h-4 w-4" />
                                Correction
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${actionButtonClass} ${isDarkMode ? "border-red-400/25 bg-red-500/10 text-red-300 hover:border-red-400/35 hover:bg-red-500/14 hover:text-red-200" : "border border-[#F3C3C3] bg-[#FCE8E8] text-[#18181B] hover:border-[#E7A8A8] hover:bg-[#F9D9D9] hover:text-[#18181B]"}`}
                                onClick={() => openReviewModal(row._id, "reject")}
                              >
                                <XCircle className="h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={reviewModal.open} onOpenChange={(open) => (open ? undefined : closeReviewModal())}>
        <DialogContent className={isDarkMode ? "max-w-md border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-0 shadow-[0_28px_80px_rgba(166,124,82,0.22)]" : "max-w-md border-[#E7E5E4] bg-white p-0 shadow-[0_28px_80px_rgba(15,14,13,0.14)]"}>
          <div className={isDarkMode ? "rounded-[26px] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-6" : "rounded-[26px] bg-white p-6"}>
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className={`text-xl font-semibold ${isDarkMode ? "text-[#F5F5F5]" : "text-[#18181B]"}`}>Add Remarks</DialogTitle>
              <DialogDescription className={`text-sm leading-6 ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>
                Add remarks for the <span className={`font-semibold ${isDarkMode ? "text-[#E6C7A3]" : "text-[#A67C52]"}`}>{modalActionLabel}</span> action before submitting this review.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-2">
              <label htmlFor="joining-form-remarks" className={`text-sm font-medium ${isDarkMode ? "text-[#F5F5F5]" : "text-[#18181B]"}`}>
                Remarks
              </label>
              <Textarea
                id="joining-form-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Write clear review remarks for HR records..."
                className={isDarkMode ? "min-h-[132px] border-[#2A2623] bg-[rgba(35,32,29,0.72)] text-[#F5F5F5] placeholder:text-[#71717A] focus-visible:ring-primary/20" : "min-h-[132px] border-[#D6D3D1] bg-white text-[#18181B] placeholder:text-[#71717A] focus-visible:ring-[rgba(166,124,82,0.2)]"}
              />
            </div>

            <DialogFooter className="mt-6 flex-row justify-end gap-3 space-x-0">
              <Button
                type="button"
                variant="outline"
                className={isDarkMode ? "h-10 rounded-xl border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-5 text-[#E6C7A3] hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)]" : "h-10 rounded-xl border-[#D6D3D1] bg-white px-5 text-[#18181B] hover:border-[#A67C52] hover:bg-[#F8F5F1]"}
                onClick={closeReviewModal}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-10 rounded-xl border border-[rgba(166,124,82,0.24)] bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] px-5 text-[#1A1816] hover:shadow-[0_16px_34px_rgba(166,124,82,0.28)]"
                onClick={() => void submitDecision()}
                disabled={submitting || !remarks.trim()}
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={documentPreview.open}
        onOpenChange={(open) => setDocumentPreview((current) => ({ ...current, open }))}
      >
        <DialogContent className={isDarkMode ? "max-w-4xl border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)]" : "max-w-4xl border-[#E7E5E4] bg-white"}>
          <DialogHeader>
            <DialogTitle>Joining Form Documents</DialogTitle>
            <DialogDescription>
              Review uploaded files in a cleaner layout without leaving the dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "Resume", ...documentPreview.form?.documents?.resume },
              { label: "Photograph", ...documentPreview.form?.documents?.photograph },
              { label: "Certificates", ...documentPreview.form?.documents?.certificates },
              { label: "ID Proof", ...documentPreview.form?.documents?.idProof },
            ]
              .filter((item) => item.url)
              .map((item) => (
                <div key={item.label} className={isDarkMode ? "overflow-hidden rounded-2xl border border-[#2A2623] bg-[rgba(35,32,29,0.72)] shadow-[0_16px_36px_rgba(166,124,82,0.16)]" : "overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-[0_12px_28px_rgba(15,14,13,0.08)]"}>
                  <div className={`flex items-center gap-3 px-4 py-3 ${isDarkMode ? "border-b border-[#2A2623]" : "border-b border-[#F4F4F5]"}`}>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDarkMode ? "bg-[rgba(230,199,163,0.12)] text-[#E6C7A3]" : "bg-[#F8F5F1] text-[#A67C52]"}`}>
                      {detectPreviewType(item) === "image" ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isDarkMode ? "text-[#F5F5F5]" : "text-[#18181B]"}`}>{item.label}</p>
                      <p className={`text-xs ${isDarkMode ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>{(getFileExtension(item.originalName || "") || getFileExtension(item.url || "") || "file").toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="p-4">
                    {detectPreviewType(item) === "image" ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className={`block overflow-hidden rounded-xl ${isDarkMode ? "border border-[#2A2623] bg-[rgba(35,32,29,0.72)]" : "border border-[#E7E5E4] bg-[#FAFAF9]"}`}>
                        <img src={item.url} alt={item.label} className="h-52 w-full object-cover" />
                      </a>
                    ) : detectPreviewType(item) === "pdf" ? (
                      <div className={`overflow-hidden rounded-xl ${isDarkMode ? "border border-[#2A2623] bg-[rgba(35,32,29,0.72)]" : "border border-[#E7E5E4] bg-[#FAFAF9]"}`}>
                        <iframe
                          src={item.url}
                          title={`${item.label} preview`}
                          className="h-52 w-full"
                        />
                      </div>
                    ) : (
                      <div className={`flex h-52 items-center justify-center rounded-xl text-sm ${isDarkMode ? "border border-[#2A2623] bg-[rgba(35,32,29,0.72)] text-[#A1A1AA]" : "border border-[#E7E5E4] bg-[#FAFAF9] text-[#52525B]"}`}>
                        Preview not available for this file type.
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}>
                        {detectPreviewType(item) === "pdf" ? "View PDF" : "View File"}
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}>
                        Open URL
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminJoiningForms;
