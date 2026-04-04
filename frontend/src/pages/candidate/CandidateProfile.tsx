import React, { useEffect, useRef, useState } from "react";
import { Camera, Edit2, Plus, Save, Square, Upload, Video, X } from "lucide-react";

import ProfileAvatar from "@/components/common/ProfileAvatar";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useCandidatePortal } from "@/context/CandidatePortalContext";
import { apiService, type CandidateRecord } from "@/services/api";
import ProfileImageManager from "@/components/profile/ProfileImageManager";

const emptyQualification = { degree: "", institute: "", year: "", percentage: "" };
const emptyReference = { name: "", relationship: "", company: "", contact: "", email: "" };
const emptyEmployment = { company: "", designation: "", from: "", to: "", responsibilities: "" };
const MAX_VIDEO_SIZE_MB = 50;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

type CandidateProfileForm = {
  fullName: string;
  phone: string;
  positionApplied: string;
  stage1: CandidateRecord["stage1"];
  stage2Details: CandidateRecord["stage2Details"];
};

const createForm = (candidate: CandidateRecord | null): CandidateProfileForm => ({
  fullName: candidate?.fullName || "",
  phone: candidate?.phone || "",
  positionApplied: candidate?.positionApplied || "",
  stage1: {
    personalDetails: {
      dateOfBirth: candidate?.stage1?.personalDetails?.dateOfBirth || "",
      fatherName: candidate?.stage1?.personalDetails?.fatherName || "",
      motherName: candidate?.stage1?.personalDetails?.motherName || "",
      maritalStatus: candidate?.stage1?.personalDetails?.maritalStatus || "",
      presentResidentialAccommodation: candidate?.stage1?.personalDetails?.presentResidentialAccommodation || "",
      domicile: candidate?.stage1?.personalDetails?.domicile || "",
    },
    contactDetails: {
      alternatePhone: candidate?.stage1?.contactDetails?.alternatePhone || "",
      currentAddress: candidate?.stage1?.contactDetails?.currentAddress || "",
      permanentAddress: candidate?.stage1?.contactDetails?.permanentAddress || "",
    },
    qualificationDetails: {
      highestQualification: candidate?.stage1?.qualificationDetails?.highestQualification || "",
      qualifications: candidate?.stage1?.qualificationDetails?.qualifications?.length
        ? candidate.stage1.qualificationDetails.qualifications
        : [emptyQualification],
    },
    declarationAccepted: candidate?.stage1?.declarationAccepted || false,
    submittedAt: candidate?.stage1?.submittedAt,
  },
  stage2Details: {
    experienceDetails: candidate?.stage2Details?.experienceDetails || "",
    references: candidate?.stage2Details?.references?.length ? candidate.stage2Details.references : [emptyReference],
    employmentHistory: candidate?.stage2Details?.employmentHistory?.length
      ? candidate.stage2Details.employmentHistory
      : [emptyEmployment],
    expectedSalary: candidate?.stage2Details?.expectedSalary || 0,
    noticePeriod: candidate?.stage2Details?.noticePeriod || "",
    managementAssessment: {
      communication: candidate?.stage2Details?.managementAssessment?.communication || "",
      technicalSkill: candidate?.stage2Details?.managementAssessment?.technicalSkill || "",
      attitude: candidate?.stage2Details?.managementAssessment?.attitude || "",
      leadership: candidate?.stage2Details?.managementAssessment?.leadership || "",
    },
    candidateRemarks: candidate?.stage2Details?.candidateRemarks || "",
  },
});

const getRecordedFileExtension = (mimeType: string) => {
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("mp4")) return "mp4";
  return "webm";
};

const CandidateProfile: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const profileImageUrl = user?.profileImage || user?.profilePhotoUrl || "";
  const { toast } = useToast();
  const { candidate, setCandidate, loading } = useCandidatePortal();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CandidateProfileForm>(() => createForm(candidate));

  const [videoMode, setVideoMode] = useState<"record" | "upload">("record");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSource, setVideoSource] = useState<"recorded" | "uploaded">("uploaded");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoError, setVideoError] = useState("");
  const [videoSuccess, setVideoSuccess] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setForm(createForm(candidate));
  }, [candidate]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoPreviewUrl]);

  const resetVideoMessages = () => {
    setVideoError("");
    setVideoSuccess("");
  };

  const stopStream = () => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  };

  const applyVideoFile = (file: File, source: "recorded" | "uploaded") => {
    const maxSizeBytes = MAX_VIDEO_SIZE_MB * 1024 * 1024;
    const isAllowedVideoType = ALLOWED_VIDEO_TYPES.some((mimeType) => file.type === mimeType || file.type.startsWith(`${mimeType};`));
    if (!isAllowedVideoType) {
      setVideoError("Only MP4, WEBM, and MOV videos are supported.");
      return false;
    }
    if (file.size > maxSizeBytes) {
      setVideoError(`Video size must be ${MAX_VIDEO_SIZE_MB} MB or less.`);
      return false;
    }

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoSource(source);
    setVideoPreviewUrl(objectUrl);
    setVideoError("");
    setVideoSuccess("");
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiService.updateMyCandidateProfile(form);
      setCandidate(updated);
      setEditing(false);
      toast({ title: "Profile updated", description: "Your candidate details have been saved." });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save profile.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startRecording = async () => {
    resetVideoMessages();

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVideoError("Webcam recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }

      const preferredMimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";

      recordedChunksRef.current = [];
      const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedType = recorder.mimeType || "video/webm";
        const blob = new Blob(recordedChunksRef.current, { type: recordedType });
        const extension = getRecordedFileExtension(recordedType);
        const file = new File([blob], `video-introduction-${Date.now()}.${extension}`, { type: recordedType });
        applyVideoFile(file, "recorded");
        stopStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setVideoMode("record");
    } catch (error) {
      stopStream();
      setVideoError(error instanceof Error ? error.message : "Unable to access webcam.");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    setRecording(false);
  };

  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetVideoMessages();
    applyVideoFile(file, "uploaded");
    stopStream();
    setRecording(false);
    setVideoMode("upload");
    event.target.value = "";
  };

  const clearVideoSelection = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    stopStream();
    setRecording(false);
    setVideoFile(null);
    setVideoPreviewUrl("");
    setUploadProgress(0);
    resetVideoMessages();
  };

  const submitVideo = async () => {
    if (!videoFile) {
      setVideoError("Please record or upload a video before submitting.");
      return;
    }

    setUploadingVideo(true);
    setUploadProgress(0);
    resetVideoMessages();

    try {
      const updated = await apiService.uploadCandidateVideo({
        video: videoFile,
        source: videoSource,
        onUploadProgress: setUploadProgress,
      });
      setCandidate(updated);
      setVideoSuccess("Video introduction uploaded successfully.");
      toast({ title: "Upload complete", description: "Your video introduction has been submitted." });
      setVideoFile(null);
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      setVideoPreviewUrl("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload video.";
      setVideoError(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploadingVideo(false);
    }
  };

  const updateQualification = (index: number, key: keyof typeof emptyQualification, value: string) => {
    setForm((prev) => ({
      ...prev,
      stage1: {
        ...prev.stage1,
        qualificationDetails: {
          ...prev.stage1.qualificationDetails,
          highestQualification: prev.stage1.qualificationDetails?.highestQualification || "",
          qualifications: (prev.stage1.qualificationDetails?.qualifications || []).map((row, i) =>
            i === index ? { ...row, [key]: value } : row
          ),
        },
      },
    }));
  };

  const updateReference = (index: number, key: keyof typeof emptyReference, value: string) => {
    setForm((prev) => ({
      ...prev,
      stage2Details: {
        ...prev.stage2Details,
        references: (prev.stage2Details.references || []).map((row, i) => (i === index ? { ...row, [key]: value } : row)),
      },
    }));
  };

  const updateEmployment = (index: number, key: keyof typeof emptyEmployment, value: string) => {
    setForm((prev) => ({
      ...prev,
      stage2Details: {
        ...prev.stage2Details,
        employmentHistory: (prev.stage2Details.employmentHistory || []).map((row, i) =>
          i === index ? { ...row, [key]: value } : row
        ),
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Edit your candidate details and add a short video introduction for the hiring team."
        action={
          editing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setForm(createForm(candidate));
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )
        }
      />

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Profile Image</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ProfileAvatar
            name={user?.name || "Candidate"}
            imageUrl={profileImageUrl}
            className="h-24 w-24"
            fallbackClassName="text-2xl"
          />
          <ProfileImageManager
            name={user?.name || "Candidate"}
            imageUrl={profileImageUrl}
            onUpload={async (file) => {
              setUploadingPhoto(true);
              try {
                const updatedUser = await apiService.updateMyProfilePhoto(file);
                console.log("Uploaded URL:", updatedUser.profileImage || updatedUser.profilePhotoUrl || "");
                console.log("Saved user:", updatedUser);
                await refreshProfile();
              } finally {
                setUploadingPhoto(false);
              }
            }}
            onRemove={async () => {
              setUploadingPhoto(true);
              try {
                const updatedUser = await apiService.removeMyProfilePhoto();
                console.log("Saved user:", updatedUser);
                await refreshProfile();
              } finally {
                setUploadingPhoto(false);
              }
            }}
            disabled={uploadingPhoto}
          />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-slate-700" />
            Video Introduction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <Tabs value={videoMode} onValueChange={(value) => setVideoMode(value as "record" | "upload")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="record">Record with Webcam</TabsTrigger>
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                </TabsList>

                <TabsContent value="record" className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
                    <video ref={liveVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={() => void startRecording()} disabled={recording || uploadingVideo}>
                      <Camera className="mr-2 h-4 w-4" />
                      Start Recording
                    </Button>
                    <Button type="button" variant="outline" onClick={() => stopRecording()} disabled={!recording}>
                      <Square className="mr-2 h-4 w-4" />
                      Stop Recording
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Record a short introduction. Supported output formats are MP4, WEBM, and MOV up to 50 MB.
                  </p>
                </TabsContent>

                <TabsContent value="upload" className="space-y-4">
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
                    <div className="space-y-2">
                      <Label htmlFor="candidate-video-upload">Choose a video file</Label>
                      <Input
                        id="candidate-video-upload"
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                        onChange={handleVideoFileChange}
                        disabled={uploadingVideo}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use MP4, WEBM, or MOV. Maximum file size is {MAX_VIDEO_SIZE_MB} MB.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {uploadProgress > 0 && uploadingVideo ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Upload progress</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2.5" />
                </div>
              ) : null}

              {videoError ? (
                <Alert variant="destructive">
                  <AlertTitle>Upload failed</AlertTitle>
                  <AlertDescription>{videoError}</AlertDescription>
                </Alert>
              ) : null}

              {videoSuccess ? (
                <Alert>
                  <AlertTitle>Upload successful</AlertTitle>
                  <AlertDescription>{videoSuccess}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Preview before submission</h3>
                  <p className="text-xs text-muted-foreground">Review your selected video before sending it to HR.</p>
                </div>
                {videoFile ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearVideoSelection}>
                    Clear
                  </Button>
                ) : null}
              </div>

              {videoPreviewUrl ? (
                <div className="space-y-3">
                  <video controls className="aspect-video w-full rounded-2xl border border-slate-200 bg-black" src={videoPreviewUrl}>
                    Your browser does not support video playback.
                  </video>
                  <div className="grid gap-2 text-xs text-muted-foreground">
                    <p>Name: {videoFile?.name || "-"}</p>
                    <p>Format: {videoFile?.type || "-"}</p>
                    <p>Size: {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB` : "-"}</p>
                  </div>
                  <Button type="button" onClick={() => void submitVideo()} disabled={uploadingVideo || !videoFile}>
                    {videoSource === "recorded" ? <Camera className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                    {uploadingVideo ? "Submitting..." : "Submit Video"}
                  </Button>
                </div>
              ) : candidate?.videoIntroduction?.url ? (
                <div className="space-y-3">
                  <video
                    controls
                    className="aspect-video w-full rounded-2xl border border-slate-200 bg-black"
                    src={candidate.videoIntroduction.url}
                  >
                    Your browser does not support video playback.
                  </video>
                  <div className="grid gap-2 text-xs text-muted-foreground">
                    <p>Latest submission: {candidate.videoIntroduction.originalName || "Video introduction"}</p>
                    <p>
                      Uploaded on:{" "}
                      {candidate.videoIntroduction.uploadedAt
                        ? new Date(candidate.videoIntroduction.uploadedAt).toLocaleString()
                        : "-"}
                    </p>
                    <p>Source: {candidate.videoIntroduction.source || "-"}</p>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-muted-foreground">
                  Record or upload a video to preview it here.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stage 1 Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5"><Label>Full Name</Label><Input disabled={!editing} value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input disabled value={candidate?.email || ""} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input disabled={!editing} value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Position Applied</Label><Input disabled={!editing} value={form.positionApplied} onChange={(e) => setForm((prev) => ({ ...prev, positionApplied: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Date of Birth</Label><DatePicker disabled={!editing} value={form.stage1.personalDetails?.dateOfBirth || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, personalDetails: { ...prev.stage1.personalDetails, dateOfBirth: e.target.value } } }))} /></div>
          <div className="space-y-1.5"><Label>Marital Status</Label><Input disabled={!editing} value={form.stage1.personalDetails?.maritalStatus || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, personalDetails: { ...prev.stage1.personalDetails, maritalStatus: e.target.value } } }))} /></div>
          <div className="space-y-1.5"><Label>Father&apos;s Name</Label><Input disabled={!editing} value={form.stage1.personalDetails?.fatherName || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, personalDetails: { ...prev.stage1.personalDetails, fatherName: e.target.value } } }))} /></div>
          <div className="space-y-1.5"><Label>Mother&apos;s Name</Label><Input disabled={!editing} value={form.stage1.personalDetails?.motherName || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, personalDetails: { ...prev.stage1.personalDetails, motherName: e.target.value } } }))} /></div>
          <div className="space-y-1.5"><Label>Accommodation</Label><Input disabled={!editing} value={form.stage1.personalDetails?.presentResidentialAccommodation || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, personalDetails: { ...prev.stage1.personalDetails, presentResidentialAccommodation: e.target.value } } }))} /></div>
          <div className="space-y-1.5"><Label>Alternate Phone</Label><Input disabled={!editing} value={form.stage1.contactDetails?.alternatePhone || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, contactDetails: { ...prev.stage1.contactDetails, alternatePhone: e.target.value } } }))} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Current Address</Label><Textarea disabled={!editing} rows={3} value={form.stage1.contactDetails?.currentAddress || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, contactDetails: { ...prev.stage1.contactDetails, currentAddress: e.target.value } } }))} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Permanent Address</Label><Textarea disabled={!editing} rows={3} value={form.stage1.contactDetails?.permanentAddress || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, contactDetails: { ...prev.stage1.contactDetails, permanentAddress: e.target.value } } }))} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Highest Qualification</Label><Input disabled={!editing} value={form.stage1.qualificationDetails?.highestQualification || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, qualificationDetails: { ...prev.stage1.qualificationDetails, highestQualification: e.target.value, qualifications: prev.stage1.qualificationDetails?.qualifications || [emptyQualification] } } }))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Qualification Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(form.stage1.qualificationDetails?.qualifications || [emptyQualification]).map((item, index) => (
            <div key={`qualification-${index}`} className="grid gap-3 rounded-xl border border-border/80 p-4 md:grid-cols-4">
              <Input disabled={!editing} placeholder="Degree" value={item.degree || ""} onChange={(e) => updateQualification(index, "degree", e.target.value)} />
              <Input disabled={!editing} placeholder="Institute" value={item.institute || ""} onChange={(e) => updateQualification(index, "institute", e.target.value)} />
              <Input disabled={!editing} placeholder="Year" value={item.year || ""} onChange={(e) => updateQualification(index, "year", e.target.value)} />
              <div className="flex gap-2">
                <Input disabled={!editing} placeholder="Percentage" value={item.percentage || ""} onChange={(e) => updateQualification(index, "percentage", e.target.value)} />
                {editing ? <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, qualificationDetails: { ...prev.stage1.qualificationDetails, highestQualification: prev.stage1.qualificationDetails?.highestQualification || "", qualifications: (prev.stage1.qualificationDetails?.qualifications || []).filter((_, i) => i !== index) } } }))}>Remove</Button> : null}
              </div>
            </div>
          ))}
          {editing ? <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, stage1: { ...prev.stage1, qualificationDetails: { ...prev.stage1.qualificationDetails, highestQualification: prev.stage1.qualificationDetails?.highestQualification || "", qualifications: [...(prev.stage1.qualificationDetails?.qualifications || []), emptyQualification] } } }))}><Plus className="mr-2 h-4 w-4" />Add Qualification</Button> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stage 2 Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5"><Label>Notice Period</Label><Input disabled={!editing} value={form.stage2Details.noticePeriod || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, noticePeriod: e.target.value } }))} /></div>
          <div className="space-y-1.5"><Label>Expected Salary</Label><Input disabled={!editing} type="number" value={form.stage2Details.expectedSalary || 0} onChange={(e) => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, expectedSalary: Number(e.target.value || 0) } }))} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Experience Details</Label><Textarea disabled={!editing} rows={3} value={form.stage2Details.experienceDetails || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, experienceDetails: e.target.value } }))} /></div>
          <div className="space-y-1.5"><Label>Communication</Label><Input disabled={!editing} value={form.stage2Details.managementAssessment?.communication || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, managementAssessment: { ...prev.stage2Details.managementAssessment, communication: e.target.value } } }))} /></div>
          <div className="space-y-1.5"><Label>Technical Skill</Label><Input disabled={!editing} value={form.stage2Details.managementAssessment?.technicalSkill || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, managementAssessment: { ...prev.stage2Details.managementAssessment, technicalSkill: e.target.value } } }))} /></div>
          <div className="space-y-1.5"><Label>Attitude</Label><Input disabled={!editing} value={form.stage2Details.managementAssessment?.attitude || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, managementAssessment: { ...prev.stage2Details.managementAssessment, attitude: e.target.value } } }))} /></div>
          <div className="space-y-1.5"><Label>Leadership</Label><Input disabled={!editing} value={form.stage2Details.managementAssessment?.leadership || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, managementAssessment: { ...prev.stage2Details.managementAssessment, leadership: e.target.value } } }))} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Candidate Remarks</Label><Textarea disabled={!editing} rows={3} value={form.stage2Details.candidateRemarks || ""} onChange={(e) => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, candidateRemarks: e.target.value } }))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>References</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(form.stage2Details.references || [emptyReference]).map((item, index) => (
            <div key={`reference-${index}`} className="grid gap-3 rounded-xl border border-border/80 p-4 md:grid-cols-5">
              <Input disabled={!editing} placeholder="Name" value={item.name || ""} onChange={(e) => updateReference(index, "name", e.target.value)} />
              <Input disabled={!editing} placeholder="Relationship" value={item.relationship || ""} onChange={(e) => updateReference(index, "relationship", e.target.value)} />
              <Input disabled={!editing} placeholder="Company" value={item.company || ""} onChange={(e) => updateReference(index, "company", e.target.value)} />
              <Input disabled={!editing} placeholder="Contact" value={item.contact || ""} onChange={(e) => updateReference(index, "contact", e.target.value)} />
              <div className="flex gap-2">
                <Input disabled={!editing} placeholder="Email" value={item.email || ""} onChange={(e) => updateReference(index, "email", e.target.value)} />
                {editing ? <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, references: (prev.stage2Details.references || []).filter((_, i) => i !== index) } }))}>Remove</Button> : null}
              </div>
            </div>
          ))}
          {editing ? <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, references: [...(prev.stage2Details.references || []), emptyReference] } }))}><Plus className="mr-2 h-4 w-4" />Add Reference</Button> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Employment History</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(form.stage2Details.employmentHistory || [emptyEmployment]).map((item, index) => (
            <div key={`employment-${index}`} className="grid gap-3 rounded-xl border border-border/80 p-4 md:grid-cols-5">
              <Input disabled={!editing} placeholder="Company" value={item.company || ""} onChange={(e) => updateEmployment(index, "company", e.target.value)} />
              <Input disabled={!editing} placeholder="Designation" value={item.designation || ""} onChange={(e) => updateEmployment(index, "designation", e.target.value)} />
              <DatePicker disabled={!editing} value={item.from || ""} onChange={(e) => updateEmployment(index, "from", e.target.value)} />
              <DatePicker disabled={!editing} value={item.to || ""} onChange={(e) => updateEmployment(index, "to", e.target.value)} />
              <div className="flex gap-2">
                <Input disabled={!editing} placeholder="Responsibilities" value={item.responsibilities || ""} onChange={(e) => updateEmployment(index, "responsibilities", e.target.value)} />
                {editing ? <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, employmentHistory: (prev.stage2Details.employmentHistory || []).filter((_, i) => i !== index) } }))}>Remove</Button> : null}
              </div>
            </div>
          ))}
          {editing ? <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, stage2Details: { ...prev.stage2Details, employmentHistory: [...(prev.stage2Details.employmentHistory || []), emptyEmployment] } }))}><Plus className="mr-2 h-4 w-4" />Add Employment</Button> : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default CandidateProfile;
