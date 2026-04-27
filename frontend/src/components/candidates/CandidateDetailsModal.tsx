import React, { useEffect, useState } from "react";
import { FileText, Printer, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CandidateRecord, CandidateStatus } from "@/services/api";

export interface CandidateDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  saving: boolean;
  candidate: CandidateRecord | null;
  candidateId?: string;
  availableStatuses: CandidateStatus[];
  onSave: (payload: {
    candidateId: string;
    evaluationRemarks: string;
    adminNotes?: string;
    rating: number | null;
    status: CandidateStatus;
    interviewSchedule?: CandidateRecord["interviewSchedule"];
    videoFeedback?: string;
    videoRating?: number | null;
  }) => Promise<void>;
}

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("en-IN");
};

const readText = (value: unknown) => (typeof value === "string" && value.trim() ? value : "-");

const readNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "-";

const normalizeSchedule = (value?: CandidateRecord["interviewSchedule"]) => ({
  date: value?.date || "",
  time: value?.time || "",
  meetingLink: value?.meetingLink || "",
  mode: value?.mode || "",
  notes: value?.notes || "",
});

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const collectUploads = (candidate: CandidateRecord | null) => {
  if (!candidate) return [];

  const uploads: Array<{ label: string; url: string; meta?: string; type: "document" | "video" }> = [];

  if (candidate.resumeUrl) {
    uploads.push({
      label: candidate.resumeFileName || "Resume",
      url: candidate.resumeUrl,
      type: "document",
      meta: "Resume",
    });
  }

  if (candidate.documents?.resume?.url) {
    uploads.push({
      label: candidate.documents.resume.originalName || "Resume Document",
      url: candidate.documents.resume.url,
      type: "document",
      meta: "Resume document",
    });
  }

  if (candidate.documents?.certificates?.url) {
    uploads.push({
      label: candidate.documents.certificates.originalName || "Certificate",
      url: candidate.documents.certificates.url,
      type: "document",
      meta: candidate.documents.certificates.categoryLabel || "Certificate",
    });
  }

  (candidate.documents?.uploadedFiles || []).forEach((file, index) => {
    if (!file?.url) return;
    uploads.push({
      label: file.originalName || `Uploaded File ${index + 1}`,
      url: file.url,
      type: "document",
      meta:
        file.fieldId === "certificates"
          ? `Certificate${file.categoryLabel ? ` | ${file.categoryLabel}` : ""}`
          : file.label || "Supporting document",
    });
  });

  if (candidate.videoIntroduction?.url) {
    uploads.push({
      label: candidate.videoIntroduction.originalName || "Video Introduction",
      url: candidate.videoIntroduction.url,
      type: "video",
      meta: candidate.videoIntroduction.source ? `Video | ${candidate.videoIntroduction.source}` : "Video",
    });
  }

  return uploads;
};

const CandidateDetailsModal: React.FC<CandidateDetailsModalProps> = ({
  open,
  onOpenChange,
  loading,
  saving,
  candidate,
  candidateId,
  availableStatuses,
  onSave,
}) => {
  const [status, setStatus] = useState<CandidateStatus>("Under Review");
  const [evaluationRemarks, setEvaluationRemarks] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [interviewSchedule, setInterviewSchedule] = useState<CandidateRecord["interviewSchedule"]>(normalizeSchedule());
  const [videoFeedback, setVideoFeedback] = useState("");
  const [videoRating, setVideoRating] = useState<number | null>(null);

  useEffect(() => {
    if (!candidate) return;
    setStatus(candidate.status || "Under Review");
    setEvaluationRemarks(candidate.adminReview?.evaluationRemarks || "");
    setAdminNotes(candidate.adminReview?.adminNotes || "");
    setRating(candidate.adminReview?.rating ?? null);
    setInterviewSchedule(normalizeSchedule(candidate.interviewSchedule));
    setVideoFeedback(candidate.videoIntroduction?.adminFeedback || "");
    setVideoRating(candidate.videoIntroduction?.adminRating ?? null);
  }, [candidate]);

  useEffect(() => {
    if (!open) {
      setStatus("Under Review");
      setEvaluationRemarks("");
      setAdminNotes("");
      setRating(null);
      setInterviewSchedule(normalizeSchedule());
      setVideoFeedback("");
      setVideoRating(null);
    }
  }, [open]);

  const submit = async () => {
    const resolvedCandidateId = candidateId || candidate?._id || candidate?.id || "";

    if (!resolvedCandidateId) {
      return;
    }

    if (!status) {
      return;
    }

    const payload = {
      candidateId: resolvedCandidateId,
      evaluationRemarks: evaluationRemarks.trim(),
      adminNotes: adminNotes.trim(),
      rating: rating == null ? null : Number(rating),
      status,
      interviewSchedule: interviewSchedule?.date ? normalizeSchedule(interviewSchedule) : undefined,
      videoFeedback: videoFeedback.trim(),
      videoRating,
    };

    await onSave(payload);
  };

  const stage2 = (candidate?.stage2Details as Record<string, unknown> | undefined) ?? {};
  const uploads = collectUploads(candidate);

  const handlePrint = () => {
    if (!candidate) return;

    const summaryRows = [
      ["Candidate", readText(candidate.fullName)],
      ["Email", readText(candidate.email)],
      ["Phone", readText(candidate.phone)],
      ["Position", readText(candidate.positionApplied)],
      ["Status", readText(candidate.status)],
      ["Applied At", formatDateTime(candidate.submittedAt || candidate.createdAt)],
      ["Candidate ID", readText(candidate._id)],
      ["Experience", readText(stage2.experienceDetails)],
      ["Expected Salary", readNumber(stage2.expectedSalary)],
      ["Notice Period", readText(stage2.noticePeriod)],
      ["Current Company", readText(stage2.currentCompany)],
      ["Current Role", readText(stage2.currentRole)],
    ];

    const uploadRows =
      uploads.length === 0
        ? `<p class="muted">No uploaded files available.</p>`
        : `
          <div class="uploads">
            ${uploads
              .map(
                (item) => `
                  <div class="upload">
                    <div>
                      <p class="upload-title">${escapeHtml(item.label)}</p>
                      <p class="muted">${escapeHtml(item.meta || "-")}</p>
                    </div>
                    <p class="upload-url">${escapeHtml(item.url)}</p>
                  </div>
                `,
              )
              .join("")}
          </div>
        `;

    const html = `
      <html>
        <head>
          <title>${escapeHtml(candidate.fullName)} Review</title>
          <style>
            body { font-family: Segoe UI, Arial, sans-serif; margin: 32px; color: #171717; }
            h1 { font-size: 28px; margin: 0 0 8px; }
            h2 { font-size: 18px; margin: 28px 0 12px; }
            .muted { color: #666; margin: 0; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .card { border: 1px solid #ddd; border-radius: 14px; padding: 14px 16px; break-inside: avoid; }
            .label { font-size: 12px; color: #666; margin-bottom: 4px; }
            .value { font-size: 14px; font-weight: 600; }
            .block { border: 1px solid #ddd; border-radius: 14px; padding: 16px; white-space: pre-wrap; }
            .uploads { display: grid; gap: 12px; }
            .upload { border: 1px solid #ddd; border-radius: 14px; padding: 14px 16px; }
            .upload-title { margin: 0 0 4px; font-weight: 600; }
            .upload-url { margin: 10px 0 0; word-break: break-all; color: #333; font-size: 12px; }
            @media print { body { margin: 16px; } }
          </style>
        </head>
        <body>
          <h1>Candidate Review</h1>
          <p class="muted">${escapeHtml(candidate.fullName)} &middot; ${escapeHtml(candidate.positionApplied || "-")}</p>

          <h2>Summary</h2>
          <div class="grid">
            ${summaryRows
              .map(
                ([label, value]) => `
                  <div class="card">
                    <div class="label">${escapeHtml(label)}</div>
                    <div class="value">${escapeHtml(value)}</div>
                  </div>
                `,
              )
              .join("")}
          </div>

          <h2>Uploads</h2>
          ${uploadRows}

          <h2>Admin Notes</h2>
          <div class="block">${escapeHtml(adminNotes || "-")}</div>

          <h2>Evaluation Remarks</h2>
          <div class="block">${escapeHtml(evaluationRemarks || "-")}</div>

          <h2>Review Meta</h2>
          <div class="grid">
            <div class="card"><div class="label">Rating</div><div class="value">${escapeHtml(rating ? String(rating) : "No rating")}</div></div>
            <div class="card"><div class="label">Video Rating</div><div class="value">${escapeHtml(videoRating ? String(videoRating) : "No rating")}</div></div>
            <div class="card"><div class="label">Video Feedback</div><div class="value">${escapeHtml(videoFeedback || "-")}</div></div>
            <div class="card"><div class="label">Interview Date</div><div class="value">${escapeHtml(interviewSchedule.date || "-")}</div></div>
            <div class="card"><div class="label">Interview Time</div><div class="value">${escapeHtml(interviewSchedule.time || "-")}</div></div>
            <div class="card"><div class="label">Meeting Link</div><div class="value">${escapeHtml(interviewSchedule.meetingLink || "-")}</div></div>
            <div class="card"><div class="label">Interview Mode</div><div class="value">${escapeHtml(interviewSchedule.mode || "-")}</div></div>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    if (!frameDoc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-[#E7E5E4] bg-white text-slate-900 shadow-[0_24px_60px_rgba(15,14,13,0.14)] dark:!border-[#2A2623] dark:!bg-[linear-gradient(145deg,#050505,#111111)] dark:!text-white dark:shadow-[0_28px_70px_rgba(0,0,0,0.62)]">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">Stage 3: Admin Review & Decision</DialogTitle>
        </DialogHeader>

        {!candidate ? (
          <div className="py-8 text-sm text-slate-500 dark:text-slate-300">Loading or no data found</div>
        ) : (
          <div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-[#2A2623] dark:bg-[#111111] dark:text-white">
                Loading full candidate details. Summary is available below.
              </div>
            ) : null}

            <div className="rounded-[28px] border border-[#E7E5E4] bg-white/90 p-5 shadow-sm dark:border-[#24201C] dark:bg-[#0B0B0B] dark:shadow-[0_18px_40px_rgba(0,0,0,0.38)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Candidate Summary</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Core details for quick review before decision.</p>
                </div>
                <Badge className="border-[#D6C3AD] bg-[#F5E8D8] text-[#6D4C2F] dark:border-[#2A2623] dark:bg-black dark:text-white">
                  {candidate.status || "-"}
                </Badge>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Candidate</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readText(candidate.fullName)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Email</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readText(candidate.email)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Phone</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readText(candidate.phone)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Position</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readText(candidate.positionApplied)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Applied At</p>
                  <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(candidate.submittedAt || candidate.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Candidate ID</p>
                  <p className="break-all font-medium text-slate-900 dark:text-white">{readText(candidate._id)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Experience</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readText(stage2.experienceDetails)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Expected Salary</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readNumber(stage2.expectedSalary)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Notice Period</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readText(stage2.noticePeriod)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Current Company</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readText(stage2.currentCompany)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Current Role</p>
                  <p className="font-medium text-slate-900 dark:text-white">{readText(stage2.currentRole)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#E7E5E4] bg-white/90 p-5 shadow-sm dark:border-[#24201C] dark:bg-[#0B0B0B] dark:shadow-[0_18px_40px_rgba(0,0,0,0.38)]">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Uploaded Files</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Documents and videos shared by the candidate.</p>
              </div>
              {uploads.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">No uploaded files available for this candidate.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {uploads.map((item, index) => (
                    <a
                      key={`${item.url}-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all hover:border-[#C8A27C] hover:shadow-md dark:border-[#2A2623] dark:bg-black dark:text-white dark:hover:border-[#5A4630]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-300">{item.meta || "-"}</p>
                      </div>
                      <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E7E5E4] bg-[#F8F5F1] dark:border-[#2A2623] dark:bg-[#111111]">
                        {item.type === "video" ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-[#E7E5E4] bg-white/90 p-5 shadow-sm dark:border-[#24201C] dark:bg-[#0B0B0B] dark:shadow-[0_18px_40px_rgba(0,0,0,0.38)]">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Admin Evaluation & Notes</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Review the profile, capture notes, and decide the next stage.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-white">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as CandidateStatus)}>
                    <SelectTrigger className="border-[#D6D3D1] bg-white text-slate-900 shadow-sm dark:border-[#2A2623] dark:bg-black dark:text-white dark:shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#D6D3D1] bg-white text-slate-900 dark:border-[#2A2623] dark:bg-black dark:text-white">
                      {availableStatuses.map((item) => (
                        <SelectItem key={item} value={item} className="dark:focus:bg-[#181818] dark:focus:text-white">
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-white">Rating (1 to 5)</Label>
                  <Select value={rating ? String(rating) : "none"} onValueChange={(value) => setRating(value === "none" ? null : Number(value))}>
                    <SelectTrigger className="border-[#D6D3D1] bg-white text-slate-900 shadow-sm dark:border-[#2A2623] dark:bg-black dark:text-white dark:shadow-none">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent className="border-[#D6D3D1] bg-white text-slate-900 dark:border-[#2A2623] dark:bg-black dark:text-white">
                      <SelectItem value="none">No rating</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-slate-700 dark:text-white">HR/Admin Notes</Label>
                  <Textarea
                    rows={3}
                    className="border-[#D6D3D1] bg-white text-slate-900 placeholder:text-slate-400 shadow-sm dark:border-[#2A2623] dark:bg-black dark:text-white dark:placeholder:text-slate-400 dark:shadow-none"
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    placeholder="Add internal notes for this candidate..."
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-slate-700 dark:text-white">Evaluation Remarks</Label>
                  <Textarea
                    rows={4}
                    className="border-[#D6D3D1] bg-white text-slate-900 placeholder:text-slate-400 shadow-sm dark:border-[#2A2623] dark:bg-black dark:text-white dark:placeholder:text-slate-400 dark:shadow-none"
                    value={evaluationRemarks}
                    onChange={(event) => setEvaluationRemarks(event.target.value)}
                    placeholder="Write your evaluation remarks..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-white">Video Rating (1 to 5)</Label>
                  <Select value={videoRating ? String(videoRating) : "none"} onValueChange={(value) => setVideoRating(value === "none" ? null : Number(value))}>
                    <SelectTrigger className="border-[#D6D3D1] bg-white text-slate-900 shadow-sm dark:border-[#2A2623] dark:bg-black dark:text-white dark:shadow-none">
                      <SelectValue placeholder="Select video rating" />
                    </SelectTrigger>
                    <SelectContent className="border-[#D6D3D1] bg-white text-slate-900 dark:border-[#2A2623] dark:bg-black dark:text-white">
                      <SelectItem value="none">No rating</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-slate-700 dark:text-white">Video Feedback</Label>
                  <Textarea
                    rows={3}
                    className="border-[#D6D3D1] bg-white text-slate-900 placeholder:text-slate-400 shadow-sm dark:border-[#2A2623] dark:bg-black dark:text-white dark:placeholder:text-slate-400 dark:shadow-none"
                    value={videoFeedback}
                    onChange={(event) => setVideoFeedback(event.target.value)}
                    placeholder="Share feedback on the candidate's video introduction..."
                  />
                </div>

                {status === "Interview" || status === "Interview Scheduled" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 dark:text-white">Interview Date</Label>
                      <DatePicker className="border-[#D6D3D1] bg-white text-slate-900 dark:border-[#2A2623] dark:bg-black dark:text-white" value={interviewSchedule.date || ""} onChange={(event) => setInterviewSchedule((prev) => ({ ...prev, date: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 dark:text-white">Interview Time</Label>
                      <Input className="border-[#D6D3D1] bg-white text-slate-900 dark:border-[#2A2623] dark:bg-black dark:text-white" value={interviewSchedule.time || ""} onChange={(event) => setInterviewSchedule((prev) => ({ ...prev, time: event.target.value }))} placeholder="11:00 AM" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 dark:text-white">Meeting Link</Label>
                      <Input
                        className="border-[#D6D3D1] bg-white text-slate-900 dark:border-[#2A2623] dark:bg-black dark:text-white"
                        value={interviewSchedule.meetingLink || ""}
                        onChange={(event) => setInterviewSchedule((prev) => ({ ...prev, meetingLink: event.target.value }))}
                        placeholder="https://meet.google.com/..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 dark:text-white">Interview Mode</Label>
                      <Input className="border-[#D6D3D1] bg-white text-slate-900 dark:border-[#2A2623] dark:bg-black dark:text-white" value={interviewSchedule.mode || ""} onChange={(event) => setInterviewSchedule((prev) => ({ ...prev, mode: event.target.value }))} placeholder="Online / In-person" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-slate-700 dark:text-white">Interview Notes</Label>
                      <Textarea className="border-[#D6D3D1] bg-white text-slate-900 placeholder:text-slate-400 shadow-sm dark:border-[#2A2623] dark:bg-black dark:text-white dark:placeholder:text-slate-400 dark:shadow-none" rows={3} value={interviewSchedule.notes || ""} onChange={(event) => setInterviewSchedule((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Panel, agenda, venue, or preparation notes..." />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handlePrint} disabled={!candidate || saving} className="dark:border-[#2A2623] dark:bg-black dark:text-white dark:hover:bg-[#141414] dark:hover:text-white">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="dark:border-[#2A2623] dark:bg-black dark:text-white dark:hover:bg-[#141414] dark:hover:text-white">
            Close
          </Button>
          <Button type="button" disabled={saving || !candidate} onClick={submit} className="dark:border-[#2A2623] dark:bg-black dark:text-white dark:hover:bg-[#141414] dark:hover:text-white">
            {saving ? "Saving..." : "Save Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CandidateDetailsModal;
