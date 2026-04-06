import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, FileImage, FileText, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
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

const statusClassMap: Record<string, string> = {
  Requested: "border border-slate-200 bg-slate-100 text-slate-700",
  Submitted: "border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#2A211B)] text-[#E6C7A3]",
  "Correction Requested": "border border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border border-rose-200 bg-rose-50 text-rose-700",
};

const getFileExtension = (url = "") => {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split(".").pop()?.toLowerCase() || "";
  } catch {
    return url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  }
};

const isImageUrl = (url: string) => ["jpg", "jpeg", "png", "gif", "webp"].includes(getFileExtension(url));
const isPdfUrl = (url: string) => getFileExtension(url) === "pdf";

const AdminJoiningForms: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<JoiningFormRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState("Submitted");
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

    setSubmitting(true);
    try {
      await apiService.reviewJoiningForm(reviewModal.formId, {
        action: reviewModal.action,
        remarks: remarks.trim(),
      });
      toast({
        title: "Updated",
        description: `${actionLabelMap[reviewModal.action]} decision submitted successfully.`,
      });
      closeReviewModal();
      await load();
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

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Review Queue</p>
            <p className="mt-1 text-sm text-slate-500">Filter submissions by status and review each form with documented remarks.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 shadow-none outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
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
            <Button variant="outline" className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Candidate</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Submitted At</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={4}>
                    No joining forms found for the selected status.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const candidate = typeof row.candidateId === "object" ? row.candidateId : null;
                  const linkedUser = "userId" in row && typeof row.userId === "object" ? row.userId : null;
                  const docs = [
                    { label: "Resume", url: row.documents?.resume?.url || "" },
                    { label: "Photograph", url: row.documents?.photograph?.url || "" },
                    { label: "Certificates", url: row.documents?.certificates?.url || "" },
                    { label: "ID Proof", url: row.documents?.idProof?.url || "" },
                  ].filter((item) => item.url);
                  const primaryName = candidate?.fullName || linkedUser?.name || "Joining Form Record";
                  const secondaryText = candidate?.email || linkedUser?.email || "Submitted profile";

                  return (
                    <tr key={row._id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{primaryName}</div>
                        <div className="mt-1 text-xs text-slate-500">{secondaryText}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClassMap[row.status] || "border border-slate-200 bg-slate-100 text-slate-700"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex min-w-max flex-wrap gap-2 lg:flex-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`${actionButtonClass} border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900`}
                            disabled={!docs.length}
                            onClick={() => setDocumentPreview({ open: true, form: row })}
                          >
                            <Eye className="h-4 w-4" />
                            Docs
                          </Button>
                          <Button
                            size="sm"
                            className={`${actionButtonClass} bg-[#4f46e5] text-white hover:bg-[#4338ca]`}
                            onClick={() => openReviewModal(row._id, "approve")}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`${actionButtonClass} border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-900`}
                            onClick={() => openReviewModal(row._id, "request_correction")}
                          >
                            <ShieldAlert className="h-4 w-4" />
                            Correction
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`${actionButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800`}
                            onClick={() => openReviewModal(row._id, "reject")}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
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
        <DialogContent className="max-w-md border-slate-200 bg-white p-0 shadow-[0_28px_80px_rgba(166,124,82,0.18)]">
          <div className="rounded-[26px] bg-white p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl font-semibold text-slate-950">Add Remarks</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-500">
                Add remarks for the <span className="font-semibold text-slate-700">{modalActionLabel}</span> action before submitting this review.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-2">
              <label htmlFor="joining-form-remarks" className="text-sm font-medium text-slate-700">
                Remarks
              </label>
              <Textarea
                id="joining-form-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Write clear review remarks for HR records..."
                className="min-h-[132px] border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/20"
              />
            </div>

            <DialogFooter className="mt-6 flex-row justify-end gap-3 space-x-0">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-50"
                onClick={closeReviewModal}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-10 rounded-xl bg-[#4f46e5] px-5 text-white hover:bg-[#4338ca]"
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
        <DialogContent className="max-w-4xl border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Joining Form Documents</DialogTitle>
            <DialogDescription>
              Review uploaded files in a cleaner layout without leaving the dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "Resume", url: documentPreview.form?.documents?.resume?.url || "" },
              { label: "Photograph", url: documentPreview.form?.documents?.photograph?.url || "" },
              { label: "Certificates", url: documentPreview.form?.documents?.certificates?.url || "" },
              { label: "ID Proof", url: documentPreview.form?.documents?.idProof?.url || "" },
            ]
              .filter((item) => item.url)
              .map((item) => (
                <div key={item.label} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      {isImageUrl(item.url) ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{getFileExtension(item.url).toUpperCase() || "FILE"}</p>
                    </div>
                  </div>

                  <div className="p-4">
                    {isImageUrl(item.url) ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img src={item.url} alt={item.label} className="h-52 w-full object-cover" />
                      </a>
                    ) : (
                      <div className="flex h-52 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                        {isPdfUrl(item.url) ? "PDF preview available in new tab." : "Preview not available for this file type."}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}>
                        {isPdfUrl(item.url) ? "View PDF" : "View File"}
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
