import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Camera, CheckCircle2, File as FileIcon, FileImage, FileText, RefreshCcw, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CandidateRecord } from "@/services/api";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import { destructiveButtonClass } from "@/lib/destructive";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const emptyReference = () => ({
  name: "",
  relationship: "",
  company: "",
  contact: "",
  email: "",
});

const emptyEmployment = () => ({
  company: "",
  designation: "",
  from: "",
  to: "",
  responsibilities: "",
});

const hasReferenceContent = (reference: ReturnType<typeof emptyReference>) =>
  [reference.name, reference.relationship, reference.company, reference.contact, reference.email].some((value) => value.trim());

const hasEmploymentContent = (employment: ReturnType<typeof emptyEmployment>) =>
  [employment.company, employment.designation, employment.from, employment.to, employment.responsibilities].some((value) => value.trim());

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const validateReferenceRows = (rows: ReturnType<typeof emptyReference>[]) => {
  const startedRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => hasReferenceContent(row));

  for (const { row, index } of startedRows) {
    if (!row.name.trim() || !row.contact.trim()) {
      return `Reference row ${index + 1} needs both name and contact.`;
    }
    if (row.email.trim() && !isValidEmail(row.email)) {
      return `Reference row ${index + 1} has an invalid email address.`;
    }
  }

  return "";
};

const validateEmploymentRows = (rows: ReturnType<typeof emptyEmployment>[]) => {
  const startedRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => hasEmploymentContent(row));

  for (const { row, index } of startedRows) {
    if (!row.company.trim() || !row.designation.trim()) {
      return `Employment row ${index + 1} needs both company and designation.`;
    }
  }

  return "";
};

const getFileExtension = (fileName: string) => {
  const index = fileName.lastIndexOf(".");
  return index < 0 ? "" : fileName.slice(index).toLowerCase();
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const CandidateStage2: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentAddedAt, setDocumentAddedAt] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [noticePeriod, setNoticePeriod] = useState("");
  const [experienceDetails, setExperienceDetails] = useState("");
  const [expectedSalary, setExpectedSalary] = useState<number>(0);
  const [candidateRemarks, setCandidateRemarks] = useState("");
  const [managementAssessment, setManagementAssessment] = useState({
    communication: "",
    technicalSkill: "",
    attitude: "",
    leadership: "",
  });
  const [references, setReferences] = useState([emptyReference()]);
  const [employmentHistory, setEmploymentHistory] = useState([emptyEmployment()]);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState("");
  const [confirmDocumentDeleteOpen, setConfirmDocumentDeleteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const record = await apiService.getMyCandidateApplication();
        setCandidate(record);
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Unable to load stage 2 data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
    };
  }, [documentPreviewUrl]);

  const isLocked = useMemo(() => Boolean(candidate?.stage2SubmittedAt || (candidate?.stageCompleted || 0) >= 2), [candidate]);

  useEffect(() => {
    if (!loading && !candidate) {
      navigate("/apply", { replace: true });
      return;
    }
    if (!loading && candidate && (candidate.stageCompleted || 0) < 1) {
      navigate("/apply", { replace: true });
    }
  }, [candidate, loading, navigate]);

  const validateFile = (file: File) => {
    const extension = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return "Invalid format. Allowed: PDF, JPG, PNG, DOC, DOCX.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 10MB limit.";
    }
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return "Invalid format. Allowed: PDF, JPG, PNG, DOC, DOCX.";
    }
    return "";
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setStartingCamera(false);
  };

  const setSelectedDocument = (file: File | null) => {
    if (!file) return;
    const errorMessage = validateFile(file);
    if (errorMessage) {
      setUploadError(errorMessage);
      setUploadSuccess("");
      return;
    }
    setUploadError("");
    setUploadSuccess("Document ready for Stage 2 submission.");
    if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
    setDocumentPreviewUrl(URL.createObjectURL(file));
    setDocumentFile(file);
    setDocumentAddedAt(new Date().toISOString());
  };

  const startCamera = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setUploadError("Camera is not supported in this browser.");
      return;
    }
    setUploadError("");
    setStartingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setUploadError("Unable to access camera. Please allow camera permission and use HTTPS/localhost.");
    } finally {
      setStartingCamera(false);
    }
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setUploadError("Camera is not ready yet. Please try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setUploadError("Failed to capture image from camera.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setUploadError("Failed to capture image from camera.");
      return;
    }
    const captured = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
    setSelectedDocument(captured);
    stopCamera();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!candidate) return;

    if (isLocked) {
      toast({ title: "Stage 2 Locked", description: "Stage 2 has already been submitted.", variant: "destructive" });
      navigate("/candidate/dashboard", { replace: true });
      return;
    }

    const nextErrors: Record<string, string> = {};
    if (!noticePeriod.trim()) nextErrors.noticePeriod = "Notice period is required.";
    if (!experienceDetails.trim()) nextErrors.experienceDetails = "Experience details are required.";
    if (!expectedSalary || Number(expectedSalary) <= 0) nextErrors.expectedSalary = "Expected salary must be greater than 0.";
    const referenceError = validateReferenceRows(references);
    if (referenceError) nextErrors.references = referenceError;
    const employmentError = validateEmploymentRows(employmentHistory);
    if (employmentError) nextErrors.employmentHistory = employmentError;
    if (!managementAssessment.communication.trim() || !managementAssessment.technicalSkill.trim()) {
      nextErrors.assessment = "Communication and Technical Skill are required.";
    }
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast({ title: "Please complete required fields", variant: "destructive" });
      return;
    }

    if (!documentFile) {
      setUploadError("Please upload at least one document before completing Stage 2.");
      return;
    }

    setSubmitting(true);
    setUploadError("");
    setUploadSuccess("");
    setFieldErrors({});
    setUploadProgress(0);
    try {
      await apiService.submitCandidateStage2({
        noticePeriod,
        experienceDetails,
        expectedSalary: Number(expectedSalary || 0),
        references,
        employmentHistory,
        managementAssessment,
        candidateRemarks,
        resume: documentFile,
        onUploadProgress: (progress) => setUploadProgress(progress),
      });
      setUploadProgress(100);
      toast({ title: "Stage 2 submitted", description: "Your profile is now under review." });
      navigate("/candidate/dashboard", { replace: true });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not upload document.");
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Could not submit stage 2",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  const activeExt = getFileExtension(documentFile?.name || "");
  const fileIcon = [".jpg", ".jpeg", ".png"].includes(activeExt) ? (
    <FileImage className="h-5 w-5 text-sky-600" />
  ) : [".pdf", ".doc", ".docx"].includes(activeExt) ? (
    <FileText className="h-5 w-5 text-indigo-600" />
  ) : (
    <FileIcon className="h-5 w-5 text-muted-foreground" />
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Stage 2: Detailed Candidate Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Complete your professional details and upload documents. Stage 2 will be locked once submitted.
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Notice Period *</Label>
                  <Input disabled={isLocked} value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} />
                  {fieldErrors.noticePeriod ? <p className="text-xs text-destructive">{fieldErrors.noticePeriod}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Salary *</Label>
                  <Input
                    disabled={isLocked}
                    type="number"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(Number(e.target.value || 0))}
                  />
                  {fieldErrors.expectedSalary ? <p className="text-xs text-destructive">{fieldErrors.expectedSalary}</p> : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Experience Details *</Label>
                  <Textarea disabled={isLocked} rows={3} value={experienceDetails} onChange={(e) => setExperienceDetails(e.target.value)} />
                  {fieldErrors.experienceDetails ? <p className="text-xs text-destructive">{fieldErrors.experienceDetails}</p> : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Reference Details (Optional)</h3>
                  <Button type="button" variant="outline" disabled={isLocked} onClick={() => setReferences((prev) => [...prev, emptyReference()])}>
                    Add Row
                  </Button>
                </div>
                {references.map((item, index) => (
                  <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-5">
                    <Input disabled={isLocked} placeholder="Name" value={item.name} onChange={(e) => setReferences((prev) => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} />
                    <Input disabled={isLocked} placeholder="Relationship" value={item.relationship} onChange={(e) => setReferences((prev) => prev.map((row, i) => (i === index ? { ...row, relationship: e.target.value } : row)))} />
                    <Input disabled={isLocked} placeholder="Company" value={item.company} onChange={(e) => setReferences((prev) => prev.map((row, i) => (i === index ? { ...row, company: e.target.value } : row)))} />
                    <Input disabled={isLocked} placeholder="Contact" value={item.contact} onChange={(e) => setReferences((prev) => prev.map((row, i) => (i === index ? { ...row, contact: e.target.value } : row)))} />
                    <div className="flex gap-2">
                      <Input disabled={isLocked} placeholder="Email" value={item.email} onChange={(e) => setReferences((prev) => prev.map((row, i) => (i === index ? { ...row, email: e.target.value } : row)))} />
                      <Button type="button" variant="destructive" disabled={isLocked || references.length === 1} onClick={() => setReferences((prev) => prev.filter((_, i) => i !== index))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {fieldErrors.references ? <p className="text-xs text-destructive">{fieldErrors.references}</p> : null}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Employment History (Optional)</h3>
                  <Button type="button" variant="outline" disabled={isLocked} onClick={() => setEmploymentHistory((prev) => [...prev, emptyEmployment()])}>
                    Add Row
                  </Button>
                </div>
                {employmentHistory.map((item, index) => (
                  <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-5">
                    <Input disabled={isLocked} placeholder="Company" value={item.company} onChange={(e) => setEmploymentHistory((prev) => prev.map((row, i) => (i === index ? { ...row, company: e.target.value } : row)))} />
                    <Input disabled={isLocked} placeholder="Designation" value={item.designation} onChange={(e) => setEmploymentHistory((prev) => prev.map((row, i) => (i === index ? { ...row, designation: e.target.value } : row)))} />
                    <DatePicker disabled={isLocked} value={item.from} onChange={(e) => setEmploymentHistory((prev) => prev.map((row, i) => (i === index ? { ...row, from: e.target.value } : row)))} />
                    <DatePicker disabled={isLocked} value={item.to} onChange={(e) => setEmploymentHistory((prev) => prev.map((row, i) => (i === index ? { ...row, to: e.target.value } : row)))} />
                    <div className="flex gap-2">
                      <Input disabled={isLocked} placeholder="Responsibilities" value={item.responsibilities} onChange={(e) => setEmploymentHistory((prev) => prev.map((row, i) => (i === index ? { ...row, responsibilities: e.target.value } : row)))} />
                      <Button type="button" variant="destructive" disabled={isLocked || employmentHistory.length === 1} onClick={() => setEmploymentHistory((prev) => prev.filter((_, i) => i !== index))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {fieldErrors.employmentHistory ? <p className="text-xs text-destructive">{fieldErrors.employmentHistory}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Communication *</Label>
                  <Input disabled={isLocked} value={managementAssessment.communication} onChange={(e) => setManagementAssessment((prev) => ({ ...prev, communication: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Technical Skill *</Label>
                  <Input disabled={isLocked} value={managementAssessment.technicalSkill} onChange={(e) => setManagementAssessment((prev) => ({ ...prev, technicalSkill: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Attitude</Label>
                  <Input disabled={isLocked} value={managementAssessment.attitude} onChange={(e) => setManagementAssessment((prev) => ({ ...prev, attitude: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Leadership</Label>
                  <Input disabled={isLocked} value={managementAssessment.leadership} onChange={(e) => setManagementAssessment((prev) => ({ ...prev, leadership: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Remarks (Optional)</Label>
                  <Textarea disabled={isLocked} rows={3} value={candidateRemarks} onChange={(e) => setCandidateRemarks(e.target.value)} />
                </div>
                {fieldErrors.assessment ? <p className="text-xs text-destructive sm:col-span-2">{fieldErrors.assessment}</p> : null}
              </div>

              <div className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <p className="font-semibold">Document Upload</p>
                  <p className="text-xs text-muted-foreground">Upload PDF, JPG, PNG, DOC, DOCX (max 10MB)</p>
                </div>

                {!isLocked && (
                  <div
                    className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                      dragActive ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      setSelectedDocument(event.dataTransfer.files?.[0] || null);
                    }}
                  >
                    <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 font-medium">Drag and drop file upload</p>
                    <p className="text-xs text-muted-foreground">or use the options below</p>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-1 h-4 w-4" />
                        Upload from device
                      </Button>
                      <Button type="button" variant="outline" disabled={startingCamera} onClick={startCamera}>
                        <Camera className="mr-1 h-4 w-4" />
                        {startingCamera ? "Opening camera..." : "Capture using camera"}
                      </Button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(event) => setSelectedDocument(event.target.files?.[0] || null)}
                    />
                  </div>
                )}

                {cameraOpen && !isLocked && (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Camera Preview</p>
                    <video ref={videoRef} className="w-full rounded-md border border-border bg-black" autoPlay muted playsInline />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={captureFromCamera}>
                        <Camera className="mr-1 h-4 w-4" />
                        Capture Photo
                      </Button>
                      <Button type="button" variant="outline" onClick={stopCamera}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {documentFile && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <div className="rounded-md bg-muted p-2">{fileIcon}</div>
                        <div>
                          <p className="font-medium break-all">{documentFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(getFileExtension(documentFile.name).replace(".", "").toUpperCase() || "FILE")} | {formatFileSize(documentFile.size)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Added: {documentAddedAt ? new Date(documentAddedAt).toLocaleString() : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {documentPreviewUrl ? (
                          <Button size="sm" type="button" variant="outline" onClick={() => window.open(documentPreviewUrl, "_blank")}>
                            Preview
                          </Button>
                        ) : null}
                        {!isLocked ? (
                          <>
                          <Button size="sm" type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                            <RefreshCcw className="mr-1 h-4 w-4" />
                            Replace
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            className={destructiveButtonClass}
                            onClick={() => setConfirmDocumentDeleteOpen(true)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                          </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {documentPreviewUrl && [".jpg", ".jpeg", ".png"].includes(activeExt) ? (
                      <img src={documentPreviewUrl} alt="Selected document preview" className="mt-3 max-h-56 rounded-md border border-border object-contain" />
                    ) : null}
                  </div>
                )}

                {submitting && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Uploading document</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                {uploadSuccess && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <p>{uploadSuccess}</p>
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <p>{uploadError}</p>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLocked || submitting}>
                {submitting ? "Submitting..." : isLocked ? "Stage 2 Already Submitted" : "Complete Stage 2"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <DeleteConfirmDialog
        open={confirmDocumentDeleteOpen}
        onOpenChange={setConfirmDocumentDeleteOpen}
        title="Remove Uploaded Document"
        description="Are you sure you want to remove this document?"
        confirmLabel="Remove"
        onConfirm={() => {
          if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
          setDocumentPreviewUrl("");
          setDocumentFile(null);
          setDocumentAddedAt("");
          setUploadError("");
          setUploadSuccess("");
          setUploadProgress(0);
          setConfirmDocumentDeleteOpen(false);
        }}
      />
    </div>
  );
};

export default CandidateStage2;
