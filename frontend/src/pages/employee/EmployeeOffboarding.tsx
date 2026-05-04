import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileUp,
  RefreshCcw,
  Send,
  ShieldAlert,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiService, type OffboardingRecord } from "@/services/api";

const panelClassName =
  "rounded-[28px] border border-[var(--portal-surface-border)] bg-[linear-gradient(180deg,var(--portal-surface-bg-strong),var(--portal-surface-bg))] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:bg-[#0a0a0a] dark:shadow-[0_18px_45px_rgba(0,0,0,0.36)] sm:p-6";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const toLabel = (value?: string | null) =>
  String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const createDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

const requestPanelClassName =
  "rounded-[24px] border border-[var(--portal-surface-border)] bg-white/80 p-5 shadow-soft dark:bg-[#111111]";

const EmployeeOffboarding: React.FC = () => {
  const { toast } = useToast();
  const [record, setRecord] = useState<OffboardingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [uploading, setUploading] = useState(false);
  const [acknowledgedDocs, setAcknowledgedDocs] = useState(false);
  const [reason, setReason] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [comments, setComments] = useState("");
  const [submittingResignation, setSubmittingResignation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadOffboarding = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiService.getMyOffboarding();
      setRecord(result);
      setRemarks(result?.employeeRemarks || "");
      setAcknowledgedDocs(Boolean(result?.employeeChecklist?.documentsAcknowledged));
      setReason(result?.resignationRequest?.reason || "");
      setNoticePeriod(result?.resignationRequest?.noticePeriod || result?.noticePeriod || "");
      setLastWorkingDay(
        result?.resignationRequest?.lastWorkingDay
          ? new Date(result.resignationRequest.lastWorkingDay).toISOString().slice(0, 10)
          : result?.lastWorkingDay
            ? new Date(result.lastWorkingDay).toISOString().slice(0, 10)
            : ""
      );
      setComments(result?.resignationRequest?.comments || result?.employeeRemarks || "");
    } catch (error) {
      toast({
        title: "Unable to load offboarding",
        description: error instanceof Error ? error.message : "Your exit workflow could not be loaded.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadOffboarding();
  }, [loadOffboarding]);

  const checklist = useMemo(
    () => [
      {
        key: "exit-form",
        label: "Submit exit form",
        done: Boolean(record?.employeeChecklist?.exitFormSubmitted),
        hint: record?.documents?.exitForm?.originalName || "Upload your signed exit form.",
      },
      {
        key: "interview",
        label: "Complete exit interview",
        done: Boolean(record?.employeeChecklist?.exitInterviewCompleted),
        hint: "Mark this complete once your exit interview is done.",
      },
      {
        key: "assets",
        label: "Confirm asset return",
        done: Boolean(record?.employeeChecklist?.assetsReturned),
        hint: "Confirm that company assets have been returned.",
      },
      {
        key: "documents",
        label: "Acknowledge HR documents",
        done: Boolean(record?.employeeChecklist?.documentsAcknowledged),
        hint: "Review and acknowledge relieving, experience, or clearance documents.",
      },
    ],
    [record]
  );

  const completedTasks = checklist.filter((item) => item.done).length;
  const progressValue = checklist.length ? Math.round((completedTasks / checklist.length) * 100) : 0;
  const resignationStatus = record?.resignationRequest?.status || null;
  const isApproved = resignationStatus === "approved";
  const isPendingRequest = resignationStatus === "pending";
  const isRejectedRequest = resignationStatus === "rejected";

  const handleSubmitResignation = async () => {
    if (!reason.trim() || !noticePeriod.trim() || !lastWorkingDay) {
      toast({
        title: "Missing resignation details",
        description: "Reason, notice period, and last working day are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingResignation(true);
    try {
      const submitted = await apiService.submitMyResignation({
        reason: reason.trim(),
        noticePeriod: noticePeriod.trim(),
        lastWorkingDay,
        comments: comments.trim(),
      });
      setRecord(submitted);
      setRemarks(submitted.employeeRemarks || "");
      toast({
        title: "Resignation submitted",
        description: "Your request is now pending admin review.",
      });
    } catch (error) {
      toast({
        title: "Unable to submit resignation",
        description: error instanceof Error ? error.message : "Your resignation request could not be submitted.",
        variant: "destructive",
      });
    } finally {
      setSubmittingResignation(false);
    }
  };

  const handleActionUpdate = async (payload: Parameters<typeof apiService.updateMyOffboardingActions>[0], successTitle: string) => {
    setSaving(true);
    try {
      const updated = await apiService.updateMyOffboardingActions(payload);
      setRecord(updated);
      setRemarks(updated.employeeRemarks || "");
      setAcknowledgedDocs(Boolean(updated.employeeChecklist?.documentsAcknowledged));
      toast({ title: successTitle, description: "Your offboarding progress has been updated." });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "The offboarding update could not be saved.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExitFormUpload = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await apiService.uploadFile(file, "document");
      const updated = await apiService.updateMyOffboardingActions({
        documents: {
          exitForm: {
            key: uploaded.key,
            url: uploaded.url,
            originalName: uploaded.originalName,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
            uploadedAt: new Date().toISOString(),
          },
        },
      });
      setRecord(updated);
      toast({
        title: "Exit form submitted",
        description: "Your exit form has been uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "The exit form could not be uploaded.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDocumentDownload = async (url?: string, fileName?: string) => {
    if (!url) return;
    try {
      const blob = await apiService.downloadProtectedFile(url);
      createDownload(blob, fileName || "offboarding-document.pdf");
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "The document could not be downloaded.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Offboarding" subtitle="Track your exit workflow, pending actions, and final status updates." />
        <div className={`${panelClassName} text-sm text-[var(--portal-muted-color)]`}>Loading offboarding details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Offboarding"
        subtitle="Raise your resignation request, track review status, and continue the offboarding workflow once HR approves it."
        action={
          <Button
            variant="outline"
            onClick={() => void loadOffboarding()}
            className="rounded-xl border-[var(--portal-surface-border)] bg-white/90 text-[var(--portal-heading-color)] dark:bg-[#111111] dark:text-white"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <section className={panelClassName}>
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--portal-heading-color)] dark:text-white">Raise Resignation</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--portal-muted-color)]">
                Share your resignation reason, notice period, and proposed last working day. Your request stays pending until admin review.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="resignation-reason">Reason</Label>
                <Textarea
                  id="resignation-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Briefly explain why you are resigning."
                  disabled={isPendingRequest || isApproved}
                  className="mt-2 min-h-[110px] rounded-2xl border-[var(--portal-surface-border)] bg-white/90 text-[var(--portal-heading-color)] dark:bg-[#0f0f0f] dark:text-white"
                />
              </div>
              <div>
                <Label htmlFor="notice-period">Notice Period</Label>
                <Input
                  id="notice-period"
                  value={noticePeriod}
                  onChange={(event) => setNoticePeriod(event.target.value)}
                  placeholder="30 days"
                  disabled={isPendingRequest || isApproved}
                  className="mt-2 h-11 rounded-2xl border-[var(--portal-surface-border)] bg-white/90 dark:bg-[#0f0f0f]"
                />
              </div>
              <div>
                <Label htmlFor="last-working-day">Last Working Day</Label>
                <Input
                  id="last-working-day"
                  type="date"
                  value={lastWorkingDay}
                  onChange={(event) => setLastWorkingDay(event.target.value)}
                  disabled={isPendingRequest || isApproved}
                  className="mt-2 h-11 rounded-2xl border-[var(--portal-surface-border)] bg-white/90 dark:bg-[#0f0f0f]"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="resignation-comments">Comments</Label>
                <Textarea
                  id="resignation-comments"
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  placeholder="Add handover notes or anything HR should know."
                  disabled={isPendingRequest || isApproved}
                  className="mt-2 min-h-[100px] rounded-2xl border-[var(--portal-surface-border)] bg-white/90 text-[var(--portal-heading-color)] dark:bg-[#0f0f0f] dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-xl"
                disabled={submittingResignation || isPendingRequest || isApproved}
                onClick={() => void handleSubmitResignation()}
              >
                <Send className="mr-2 h-4 w-4" />
                {isRejectedRequest ? "Resubmit Resignation" : "Submit Resignation"}
              </Button>
              {(isPendingRequest || isApproved || isRejectedRequest) && record?.resignationRequest?.submittedAt ? (
                <p className="self-center text-sm text-[var(--portal-muted-color)]">
                  Submitted on {formatDate(record.resignationRequest.submittedAt)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className={requestPanelClassName}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-muted-color)]">Request Status</p>
                  <div className="mt-3">
                    <StatusBadge status={toLabel(resignationStatus || "not submitted")} />
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(var(--portal-primary-rgb),0.08)] text-[var(--portal-primary-text)]">
                  {isRejectedRequest ? <ShieldAlert className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--portal-muted-color)]">
                {isPendingRequest
                  ? "Your resignation is waiting for admin approval. You cannot edit the request until a decision is made."
                  : isApproved
                    ? "Your resignation has been approved and the offboarding workflow is now active."
                    : isRejectedRequest
                      ? "Your last resignation request was rejected. You can update the form and submit again."
                      : "No resignation request has been submitted yet."}
              </p>
            </div>

            {record?.resignationRequest ? (
              <div className={requestPanelClassName}>
                <h3 className="text-base font-semibold text-[var(--portal-heading-color)] dark:text-white">Latest Request Summary</h3>
                <div className="mt-4 grid gap-3">
                  {[
                    { label: "Reason", value: record.resignationRequest.reason || "-" },
                    { label: "Notice Period", value: record.resignationRequest.noticePeriod || "-" },
                    { label: "Requested Last Day", value: formatDate(record.resignationRequest.lastWorkingDay) },
                    { label: "Reviewed By", value: record.resignationRequest.reviewedByName || "-" },
                    { label: "Review Comments", value: record.resignationRequest.reviewComments || "-" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--portal-surface-border)] bg-white/70 px-4 py-3 dark:bg-[#0f0f0f]">
                      <span className="text-sm text-[var(--portal-muted-color)]">{item.label}</span>
                      <span className="max-w-[60%] text-right text-sm font-medium text-[var(--portal-heading-color)] dark:text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {record && isApproved ? (
        <>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Last Working Day", value: formatDate(record.lastWorkingDay || record.lastDay) },
          { label: "Notice Period", value: record.noticePeriod || "-" },
          { label: "Exit Status", value: toLabel(record.status) },
          { label: "FNF Status", value: toLabel(record.fnfStatus) },
        ].map((item) => (
          <div key={item.label} className={panelClassName}>
            <p className="text-sm text-[var(--portal-muted-color)]">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-[var(--portal-heading-color)] dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className={panelClassName}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--portal-heading-color)] dark:text-white">Exit Progress</h2>
              <p className="mt-2 text-sm text-[var(--portal-muted-color)]">
                Complete each employee action to keep your exit workflow moving cleanly across HR, IT, and Finance.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 px-4 py-3 text-right dark:bg-[#111111]">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--portal-muted-color)]">Completed</p>
              <p className="mt-1 text-lg font-semibold text-[var(--portal-heading-color)] dark:text-white">
                {completedTasks}/{checklist.length}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Progress
              value={progressValue}
              className="h-3 bg-[rgba(var(--portal-primary-rgb),0.12)] [&>div]:bg-[linear-gradient(135deg,var(--portal-primary-solid),var(--portal-primary-dark))]"
            />
            <p className="mt-2 text-sm text-[var(--portal-muted-color)]">{progressValue}% of employee-side tasks completed.</p>
          </div>

          <div className="mt-5 grid gap-3">
            {checklist.map((item) => (
              <div
                key={item.key}
                className="flex items-start gap-3 rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 px-4 py-4 dark:bg-[#111111]"
              >
                <div className="mt-0.5">
                  <Checkbox checked={item.done} disabled />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--portal-heading-color)] dark:text-white">{item.label}</p>
                    {item.done ? <StatusBadge status="Completed" /> : <StatusBadge status="Pending" />}
                  </div>
                  <p className="mt-1 text-sm text-[var(--portal-muted-color)]">{item.hint}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={panelClassName}>
          <h2 className="text-xl font-semibold text-[var(--portal-heading-color)] dark:text-white">Exit Snapshot</h2>
          <div className="mt-5 grid gap-3">
            {[
              { label: "Employee", value: record.employeeName || record.name || "-" },
              { label: "Employee ID", value: record.employeeCode || record.employeeId || "-" },
              { label: "Exit Type", value: toLabel(record.exitType || record.reason) },
              { label: "Actual Last Working Day", value: formatDate(record.actualLastWorkingDay) },
              { label: "Exit Interview", value: toLabel(record.exitInterviewStatus) },
              { label: "Assets Return", value: toLabel(record.assetsReturnStatus) },
              { label: "HR Clearance", value: toLabel(record.clearanceStatus?.hr) },
              { label: "IT Clearance", value: toLabel(record.clearanceStatus?.it) },
              { label: "Finance Clearance", value: toLabel(record.clearanceStatus?.finance) },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 px-4 py-3 dark:bg-[#111111]">
                <span className="text-sm text-[var(--portal-muted-color)]">{item.label}</span>
                <span className="text-sm font-medium text-[var(--portal-heading-color)] dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className={panelClassName}>
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-[var(--portal-primary-text)]" />
            <h2 className="text-xl font-semibold text-[var(--portal-heading-color)] dark:text-white">Employee Actions</h2>
          </div>

          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 p-4 dark:bg-[#111111]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--portal-heading-color)] dark:text-white">Submit Exit Form</p>
                  <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                    Upload your signed form so HR can complete the documentation flow.
                  </p>
                </div>
                <StatusBadge status={record.employeeChecklist?.exitFormSubmitted ? "Completed" : "Pending"} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => void handleExitFormUpload(event.target.files?.[0])}
                />
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading..." : record.documents?.exitForm?.url ? "Replace Exit Form" : "Upload Exit Form"}
                </Button>
                {record.documents?.exitForm?.url ? (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      void handleDocumentDownload(
                        record.documents?.exitForm?.url,
                        record.documents?.exitForm?.originalName || "exit-form.pdf"
                      )
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Submitted Copy
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 p-4 dark:bg-[#111111]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--portal-heading-color)] dark:text-white">Exit Interview</p>
                  <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                    Mark this once your exit interview has been completed.
                  </p>
                </div>
                <StatusBadge status={toLabel(record.exitInterviewStatus)} />
              </div>
              <Button
                className="mt-4 rounded-xl"
                disabled={saving || Boolean(record.employeeChecklist?.exitInterviewCompleted)}
                onClick={() => void handleActionUpdate({ completeExitInterview: true }, "Exit interview marked complete")}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {record.employeeChecklist?.exitInterviewCompleted ? "Completed" : "Mark As Completed"}
              </Button>
            </div>

            <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 p-4 dark:bg-[#111111]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--portal-heading-color)] dark:text-white">Asset Return Confirmation</p>
                  <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                    Confirm once all company assets have been returned to the appropriate team.
                  </p>
                </div>
                <StatusBadge status={toLabel(record.assetsReturnStatus)} />
              </div>
              <Button
                className="mt-4 rounded-xl"
                disabled={saving || Boolean(record.employeeChecklist?.assetsReturned)}
                onClick={() => void handleActionUpdate({ confirmAssetReturn: true }, "Assets return confirmed")}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {record.employeeChecklist?.assetsReturned ? "Confirmed" : "Confirm Asset Return"}
              </Button>
            </div>

            <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 p-4 dark:bg-[#111111]">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={acknowledgedDocs}
                  onCheckedChange={(checked) => setAcknowledgedDocs(Boolean(checked))}
                  id="acknowledge-documents"
                />
                <div className="space-y-1">
                  <Label htmlFor="acknowledge-documents" className="text-[var(--portal-heading-color)] dark:text-white">
                    I have reviewed the available HR exit documents.
                  </Label>
                  <p className="text-sm text-[var(--portal-muted-color)]">
                    This tells HR that you have seen the uploaded relieving, experience, and clearance documents.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 rounded-xl"
                disabled={saving}
                onClick={() => void handleActionUpdate({ acknowledgeDocuments: acknowledgedDocs }, "Document acknowledgement saved")}
              >
                Save Acknowledgement
              </Button>
            </div>
          </div>
        </section>

        <section className={panelClassName}>
          <h2 className="text-xl font-semibold text-[var(--portal-heading-color)] dark:text-white">Documents And Remarks</h2>
          <div className="mt-5 space-y-4">
            {[
              { label: "Relieving Letter", document: record.documents?.relievingLetter },
              { label: "Experience Letter", document: record.documents?.experienceLetter },
              { label: "Clearance Form", document: record.documents?.clearanceForm },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 p-4 dark:bg-[#111111]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--portal-heading-color)] dark:text-white">{item.label}</p>
                    <p className="mt-1 text-sm text-[var(--portal-muted-color)]">
                      {item.document?.originalName || "Not available yet"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!item.document?.url}
                    onClick={() => void handleDocumentDownload(item.document?.url, item.document?.originalName || `${item.label}.pdf`)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-white/80 p-4 dark:bg-[#111111]">
              <Label htmlFor="employee-remarks" className="text-[var(--portal-heading-color)] dark:text-white">
                Employee Remarks
              </Label>
              <Textarea
                id="employee-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Share any final notes for HR, Finance, or IT."
                className="mt-3 min-h-[140px] rounded-2xl border-[var(--portal-surface-border)] bg-white/90 text-[var(--portal-heading-color)] dark:bg-[#0f0f0f] dark:text-white"
              />
              <Button
                variant="outline"
                className="mt-4 rounded-xl"
                disabled={saving}
                onClick={() => void handleActionUpdate({ employeeRemarks: remarks }, "Remarks saved")}
              >
                Save Remarks
              </Button>
            </div>

            {record.remarks ? (
              <div className="rounded-2xl border border-[var(--portal-surface-border)] bg-[rgba(var(--portal-primary-rgb),0.06)] p-4 dark:bg-[#111111]">
                <p className="text-sm font-medium text-[var(--portal-heading-color)] dark:text-white">HR Remarks</p>
                <p className="mt-2 text-sm leading-7 text-[var(--portal-muted-color)]">{record.remarks}</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
        </>
      ) : null}

      {!record ? (
        <section className={panelClassName}>
          <h2 className="text-xl font-semibold text-[var(--portal-heading-color)] dark:text-white">No active offboarding case yet</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--portal-muted-color)]">
            Submit your resignation request above. Once admin approves it, your offboarding checklist and document actions will appear here automatically.
          </p>
        </section>
      ) : null}
    </div>
  );
};

export default EmployeeOffboarding;
