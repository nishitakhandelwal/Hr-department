import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileImage, FileSpreadsheet, FileText, Link2 } from "lucide-react";
import type { CandidateRecord, CandidateStatus } from "@/services/api";

export interface CandidateDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  saving: boolean;
  candidate: CandidateRecord | null;
  onSave: (payload: {
    evaluationRemarks: string;
    adminNotes?: string;
    rating: number | null;
    status: CandidateStatus;
    interviewSchedule?: CandidateRecord["interviewSchedule"];
    videoFeedback?: string;
    videoRating?: number | null;
  }) => Promise<void>;
}

const REVIEWABLE_STATUSES: CandidateStatus[] = [
  "Profile Completed",
  "HR Review",
  "Under Review",
  "Interview",
  "Interview Scheduled",
  "Selected",
  "Internship",
  "Offered",
  "Joining Form Requested",
  "Joining Form Submitted",
  "Joining Form Correction Requested",
  "Employee Onboarding",
  "Converted to Employee",
  "Accepted",
  "Rejected",
];

const labelize = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (x) => x.toUpperCase());

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value || "-";
  if (value instanceof Date) return value.toLocaleString();
  return JSON.stringify(value);
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

const getDocumentIcon = (url: string) => {
  if (isImageUrl(url)) return FileImage;
  if (isPdfUrl(url)) return FileText;
  return FileSpreadsheet;
};

const extractDocumentUrls = (record: CandidateRecord | null): Array<{ key: string; url: string }> => {
  if (!record) return [];
  const docs: Array<{ key: string; url: string }> = [];
  const seen = new Set<string>();

  const visit = (obj: unknown, path: string) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => visit(item, `${path}[${idx}]`));
      return;
    }

    Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
      const nextPath = path ? `${path}.${key}` : key;
      if (typeof value === "string" && /^https?:\/\//i.test(value) && /url|document|file|resume|attachment/i.test(key)) {
        if (!seen.has(value)) {
          docs.push({ key: nextPath, url: value });
          seen.add(value);
        }
      } else {
        visit(value, nextPath);
      }
    });
  };

  visit(record, "");
  return docs;
};

const getDocumentTitle = (key: string) =>
  labelize(
    key
      .split(".")
      .pop()
      ?.replace(/\[\d+\]/g, "")
      .replace(/url$/i, "") || "document"
  );

const renderObjectFields = (value: unknown, prefix = ""): Array<{ label: string; value: string }> => {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) => {
    const label = prefix ? `${prefix} - ${labelize(key)}` : labelize(key);
    if (v === null || v === undefined || v === "") return [{ label, value: "-" }];
    if (Array.isArray(v)) {
      if (!v.length) return [{ label, value: "-" }];
      if (v.every((item) => typeof item !== "object")) return [{ label, value: v.map((item) => formatValue(item)).join(", ") }];
      return v.flatMap((item, idx) => renderObjectFields(item, `${label} ${idx + 1}`));
    }
    if (typeof v === "object") {
      return renderObjectFields(v, label);
    }
    return [{ label, value: formatValue(v) }];
  });
};

const CandidateDetailsModal: React.FC<CandidateDetailsModalProps> = ({
  open,
  onOpenChange,
  loading,
  saving,
  candidate,
  onSave,
}) => {
  const [status, setStatus] = useState<CandidateStatus>("Under Review");
  const [evaluationRemarks, setEvaluationRemarks] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [interviewSchedule, setInterviewSchedule] = useState<CandidateRecord["interviewSchedule"]>({});
  const [videoFeedback, setVideoFeedback] = useState("");
  const [videoRating, setVideoRating] = useState<number | null>(null);

  const resetForm = () => {
    setStatus("Under Review");
    setEvaluationRemarks("");
    setAdminNotes("");
    setRating(null);
    setInterviewSchedule({});
    setVideoFeedback("");
    setVideoRating(null);
  };

  useEffect(() => {
    if (!candidate) return;
    setStatus(REVIEWABLE_STATUSES.includes(candidate.status) ? candidate.status : "Under Review");
    setEvaluationRemarks(candidate.adminReview?.evaluationRemarks || "");
    setAdminNotes(candidate.adminReview?.adminNotes || "");
    setRating(candidate.adminReview?.rating ?? null);
    setInterviewSchedule(candidate.interviewSchedule || {});
    setVideoFeedback(candidate.videoIntroduction?.adminFeedback || "");
    setVideoRating(candidate.videoIntroduction?.adminRating ?? null);
  }, [candidate]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const dynamicTimeline = useMemo(() => {
    const entries = candidate?.activityTimeline ? [...candidate.activityTimeline] : [];
    const keys = new Set(entries.map((item) => item.key));
    const maybePush = (key: string, title: string, description: string, at?: string | Date | null) => {
      if (!at || keys.has(key)) return;
      entries.push({ key, title, description, at: new Date(at).toISOString() });
      keys.add(key);
    };

    if (candidate) {
      maybePush(
        "stage1_completed",
        "Stage 1 Completed",
        "Candidate completed the Stage 1 application.",
        candidate.stage1?.submittedAt || candidate.submittedAt || candidate.createdAt
      );
      maybePush(
        "stage2_submitted",
        "Stage 2 Submitted",
        "Candidate submitted Stage 2 details.",
        candidate.stage2SubmittedAt
      );
      if (candidate.resumeUrl) {
        maybePush(
          "documents_uploaded",
          "Documents Uploaded",
          "Candidate uploaded supporting documents.",
          candidate.stage2SubmittedAt || candidate.updatedAt
        );
      }
      if (candidate.adminReview?.reviewedAt || candidate.status === "Under Review" || candidate.status === "Interview Scheduled") {
        maybePush(
          "admin_review_started",
          "Admin Review Started",
          "Admin opened the application for review and decision.",
          candidate.adminReview?.reviewedAt || candidate.lastUpdatedAt || candidate.updatedAt
        );
      }
    }

    return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [candidate]);

  const stage2Fields = useMemo(() => {
    if (!candidate?.stage2Details) return [];
    return renderObjectFields(candidate.stage2Details).filter((row) => row.label !== "References" && row.label !== "Employment History");
  }, [candidate]);

  const futureStageSections = useMemo(() => {
    if (!candidate) return [];
    const entries = Object.entries(candidate as Record<string, unknown>).filter(([key]) => /^stage\d+/i.test(key) && !/^stage1$/i.test(key));
    return entries.map(([key, value]) => ({
      key,
      title: labelize(key),
      fields: renderObjectFields(value),
    }));
  }, [candidate]);

  const documents = useMemo(() => extractDocumentUrls(candidate), [candidate]);

  const submit = async () => {
    await onSave({
      evaluationRemarks,
      adminNotes,
      rating,
      status,
      interviewSchedule,
      videoFeedback,
      videoRating,
    });
  };

  const applyDecision = (action: "approve" | "reject" | "interview" | "request_info") => {
    if (action === "approve") setStatus("Selected");
    if (action === "reject") setStatus("Rejected");
    if (action === "interview") setStatus("Interview");
    if (action === "request_info") {
      setStatus("HR Review");
      if (!adminNotes.toLowerCase().includes("request more information")) {
        setAdminNotes((prev) => `${prev ? `${prev}\n` : ""}Request more information from candidate.`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Stage 3: Admin Review & Decision</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-sm text-muted-foreground">Loading candidate details...</div>
        ) : !candidate ? (
          <div className="py-8 text-sm text-muted-foreground">No candidate data available.</div>
        ) : (
          <div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Candidate Profile Summary</h3>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div><p className="text-xs text-muted-foreground">Candidate</p><p className="font-medium">{candidate.fullName}</p></div>
                <div><p className="text-xs text-muted-foreground">Position</p><p className="font-medium">{candidate.positionApplied || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Experience</p><p className="font-medium">{candidate.stage2Details?.experienceDetails || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Expected Salary</p><p className="font-medium">{candidate.stage2Details?.expectedSalary || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge>{candidate.status}</Badge></div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-sm font-semibold">Stage 1 Details</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Full Name:</span> {candidate.fullName}</p>
                <p><span className="text-muted-foreground">Email:</span> {candidate.email}</p>
                <p><span className="text-muted-foreground">Phone Number:</span> {candidate.phone || "-"}</p>
                <p><span className="text-muted-foreground">Position Applied For:</span> {candidate.positionApplied || "-"}</p>
                <p><span className="text-muted-foreground">Date of Application:</span> {new Date(candidate.submittedAt || candidate.createdAt).toLocaleString()}</p>
                <p><span className="text-muted-foreground">Candidate ID:</span> {candidate._id}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-sm font-semibold">Stage 2 Details</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Notice Period:</span> {candidate.stage2Details?.noticePeriod || "-"}</p>
                <p><span className="text-muted-foreground">Expected Salary:</span> {candidate.stage2Details?.expectedSalary || "-"}</p>
                <p><span className="text-muted-foreground">Total Experience:</span> {candidate.stage2Details?.experienceDetails || "-"}</p>
                <p><span className="text-muted-foreground">Current Company:</span> {(candidate.stage2Details as Record<string, unknown>)?.currentCompany as string || "-"}</p>
                <p><span className="text-muted-foreground">Current Role:</span> {(candidate.stage2Details as Record<string, unknown>)?.currentRole as string || "-"}</p>
                <p><span className="text-muted-foreground">Skills:</span> {(candidate.stage2Details as Record<string, unknown>)?.skills as string || "-"}</p>
                <p><span className="text-muted-foreground">Location:</span> {(candidate.stage2Details as Record<string, unknown>)?.location as string || "-"}</p>
              </div>
              {stage2Fields.length ? (
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  {stage2Fields.map((row, idx) => (
                    <p key={`${row.label}-${idx}`}><span className="text-muted-foreground">{row.label}:</span> {row.value}</p>
                  ))}
                </div>
              ) : null}
            </div>

            {futureStageSections.map((section) => (
              <div key={section.key} className="rounded-lg border border-border p-4">
                <h3 className="mb-2 text-sm font-semibold">{section.title} (Dynamic)</h3>
                {!section.fields.length ? (
                  <p className="text-sm text-muted-foreground">No additional fields yet.</p>
                ) : (
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    {section.fields.map((row, idx) => (
                      <p key={`${row.label}-${idx}`}>
                        <span className="text-muted-foreground">{row.label}:</span> {row.value}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-sm font-semibold">Documents</h3>
              {documents.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {documents.map((doc) => {
                    const Icon = getDocumentIcon(doc.url);
                    const title = getDocumentTitle(doc.key);

                    return (
                      <div
                        key={doc.key}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                            <p className="truncate text-xs text-slate-500">{getFileExtension(doc.url).toUpperCase() || "FILE"}</p>
                          </div>
                        </div>

                        <div className="px-4 py-4">
                          {isImageUrl(doc.url) ? (
                            <a href={doc.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                              <img src={doc.url} alt={title} className="h-44 w-full object-cover" />
                            </a>
                          ) : isPdfUrl(doc.url) ? (
                            <div className="flex h-44 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                              PDF document ready for preview
                            </div>
                          ) : (
                            <div className="flex h-44 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                              File preview not available for this format
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}>
                              {isPdfUrl(doc.url) ? <FileText className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                              {isPdfUrl(doc.url) ? "View PDF" : "View File"}
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}>
                              <Link2 className="mr-2 h-4 w-4" />
                              View URL
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents have been uploaded yet.</p>
              )}
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Video Introduction</h3>
              {candidate.videoIntroduction?.url ? (
                <div className="space-y-4">
                  <video
                    controls
                    preload="metadata"
                    crossOrigin="anonymous"
                    className="w-full rounded-xl border border-border bg-black"
                    src={candidate.videoIntroduction.url}
                  >
                    Your browser does not support embedded video playback.
                  </video>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <p><span className="text-muted-foreground">File Name:</span> {candidate.videoIntroduction.originalName || "-"}</p>
                    <p><span className="text-muted-foreground">Uploaded At:</span> {candidate.videoIntroduction.uploadedAt ? new Date(candidate.videoIntroduction.uploadedAt).toLocaleString() : "-"}</p>
                    <p><span className="text-muted-foreground">Source:</span> {candidate.videoIntroduction.source || "-"}</p>
                    <p><span className="text-muted-foreground">Size:</span> {candidate.videoIntroduction.size ? `${(candidate.videoIntroduction.size / (1024 * 1024)).toFixed(1)} MB` : "-"}</p>
                  </div>
                  <Button variant="outline" onClick={() => window.open(candidate.videoIntroduction?.url, "_blank")}>
                    Play in New Tab
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No video introduction has been submitted yet.</p>
              )}
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-sm font-semibold">Submission Timeline</h3>
              {dynamicTimeline.length ? (
                <div className="space-y-2">
                  {dynamicTimeline.map((item) => (
                    <div key={item.key} className="rounded border border-border p-2 text-xs">
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-muted-foreground">{item.description}</p>
                      <p className="text-muted-foreground">{new Date(item.at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No timeline activity available.</p>
              )}
            </div>

            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Admin Evaluation & Notes</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as CandidateStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEWABLE_STATUSES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Rating (1 to 5)</Label>
                  <Select value={rating ? String(rating) : "none"} onValueChange={(value) => setRating(value === "none" ? null : Number(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Label>HR/Admin Notes</Label>
                  <Textarea rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Add internal notes for this candidate..." />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Evaluation Remarks</Label>
                  <Textarea rows={4} value={evaluationRemarks} onChange={(e) => setEvaluationRemarks(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Video Rating (1 to 5)</Label>
                  <Select value={videoRating ? String(videoRating) : "none"} onValueChange={(value) => setVideoRating(value === "none" ? null : Number(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select video rating" />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Label>Video Feedback</Label>
                  <Textarea
                    rows={3}
                    value={videoFeedback}
                    onChange={(e) => setVideoFeedback(e.target.value)}
                    placeholder="Share feedback on the candidate's video introduction..."
                  />
                </div>
                {status === "Interview" || status === "Interview Scheduled" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Interview Date</Label>
                      <DatePicker value={interviewSchedule?.date || ""} onChange={(e) => setInterviewSchedule((prev) => ({ ...prev, date: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Interview Time</Label>
                      <Input value={interviewSchedule?.time || ""} onChange={(e) => setInterviewSchedule((prev) => ({ ...prev, time: e.target.value }))} placeholder="11:00 AM" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Meeting Link</Label>
                      <Input value={interviewSchedule?.meetingLink || ""} onChange={(e) => setInterviewSchedule((prev) => ({ ...prev, meetingLink: e.target.value }))} placeholder="https://meet.google.com/..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Interview Mode</Label>
                      <Input value={interviewSchedule?.mode || ""} onChange={(e) => setInterviewSchedule((prev) => ({ ...prev, mode: e.target.value }))} placeholder="Online / In-person" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Interview Notes</Label>
                      <Textarea rows={3} value={interviewSchedule?.notes || ""} onChange={(e) => setInterviewSchedule((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Panel, agenda, venue, or preparation notes..." />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => applyDecision("approve")}>Approve</Button>
                <Button type="button" variant="outline" onClick={() => applyDecision("reject")}>Reject</Button>
                <Button type="button" variant="outline" onClick={() => applyDecision("interview")}>Move to Interview</Button>
                <Button type="button" variant="outline" onClick={() => applyDecision("request_info")}>Request More Information</Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button disabled={loading || saving || !candidate} onClick={() => void submit()}>
            {saving ? "Saving..." : "Save Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CandidateDetailsModal;
