import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CandidateRecord } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useCandidatePortal } from "@/context/CandidatePortalContext";

type QualificationRow = {
  degree: string;
  institute: string;
  year: string;
  percentage: string;
};

const POSITION_OPTIONS = [
  "HR Executive",
  "HR Manager",
  "Recruiter",
  "Software Developer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "UI/UX Designer",
  "Graphic Designer",
  "Accountant",
  "Sales Executive",
  "Marketing Executive",
  "Business Development Executive",
  "Operations Executive",
  "Office Assistant",
] as const;

const emptyQualification = (): QualificationRow => ({
  degree: "",
  institute: "",
  year: "",
  percentage: "",
});

const CandidateApply: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { setCandidate, refreshPortal } = useCandidatePortal();
  const navigate = useNavigate();
  const isCandidateUser = user?.role === "candidate";

  const [loading, setLoading] = useState(false);
  const [myApplication, setMyApplication] = useState<CandidateRecord | null>(null);
  const [loadingMyApplication, setLoadingMyApplication] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [positionMode, setPositionMode] = useState<"preset" | "other">("preset");

  const [form, setForm] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    phone: "",
    positionApplied: "",
    dateOfBirth: "",
    fatherName: "",
    motherName: "",
    maritalStatus: "",
    presentResidentialAccommodation: "",
    alternatePhone: "",
    currentAddress: "",
    permanentAddress: "",
    highestQualification: "",
    declarationAccepted: false,
  });
  const [qualifications, setQualifications] = useState<QualificationRow[]>([emptyQualification()]);
  const isLocked = useMemo(
    () => Boolean(isCandidateUser && myApplication && ((myApplication.stageCompleted || 0) >= 1 || myApplication.stage1?.submittedAt)),
    [isCandidateUser, myApplication]
  );
  const selectedPositionOption = useMemo(() => {
    if (positionMode === "other") return "Other";
    if (!form.positionApplied) return "";
    return POSITION_OPTIONS.includes(form.positionApplied as (typeof POSITION_OPTIONS)[number]) ? form.positionApplied : "Other";
  }, [form.positionApplied, positionMode]);
  const formCardClassName =
    "border border-[rgba(230,199,163,0.16)] bg-[linear-gradient(180deg,rgba(28,24,22,0.98),rgba(20,18,17,0.96))] shadow-[0_26px_70px_rgba(0,0,0,0.28)]";
  const sectionTitleClassName = "text-[30px] font-semibold tracking-tight text-[#f6efe5]";
  const sectionBodyClassName = "text-sm text-[#c8b8a6]";
  const labelClassName = "text-sm font-medium text-[#d6b27c]";
  const cardContentClassName = "bg-transparent text-[#c8b8a6]";
  const fieldClassName =
    "border-[rgba(230,199,163,0.14)] bg-[#2a2724] text-[#f5efe7] placeholder:text-[#9f907f] shadow-[0_10px_30px_rgba(0,0,0,0.22)] hover:border-[#c69442]/45 focus-visible:border-[#d6b27c] focus-visible:ring-[#d6b27c]/20 [color-scheme:dark]";
  const selectTriggerClassName =
    "border-[rgba(230,199,163,0.14)] bg-[#161413] text-[#f5efe7] shadow-[0_10px_30px_rgba(0,0,0,0.22)] hover:border-[#c69442]/45 focus:ring-[#d6b27c]/20 data-[placeholder]:text-[#9f907f]";
  const selectContentClassName = "border-[rgba(230,199,163,0.14)] bg-[#1b1817] text-[#f5efe7]";
  const selectItemClassName = "text-[#f5efe7] focus:bg-[rgba(214,178,124,0.14)] focus:text-[#f6d7a5]";
  const outlineButtonClassName = "border-[rgba(230,199,163,0.16)] bg-[rgba(36,31,29,0.92)] text-[#f0dfc7] hover:border-[#d6b27c]/40 hover:bg-[rgba(56,46,39,0.96)] hover:text-[#f6efe5]";

  useEffect(() => {
    if (!isCandidateUser) return;
    void (async () => {
      setLoadingMyApplication(true);
      try {
        const record = await apiService.getMyCandidateApplication();
        setMyApplication(record);
        if (record) {
          const nextPosition = record.positionApplied || "";
          setForm((prev) => ({
            ...prev,
            fullName: record.fullName || prev.fullName,
            email: record.email || prev.email,
            phone: record.phone || prev.phone,
            positionApplied: nextPosition,
            dateOfBirth: record.stage1?.personalDetails?.dateOfBirth || prev.dateOfBirth,
            fatherName: record.stage1?.personalDetails?.fatherName || prev.fatherName,
            motherName: record.stage1?.personalDetails?.motherName || prev.motherName,
            maritalStatus: record.stage1?.personalDetails?.maritalStatus || prev.maritalStatus,
            presentResidentialAccommodation:
              record.stage1?.personalDetails?.presentResidentialAccommodation ||
              record.stage1?.personalDetails?.domicile ||
              prev.presentResidentialAccommodation,
            alternatePhone: record.stage1?.contactDetails?.alternatePhone || prev.alternatePhone,
            currentAddress: record.stage1?.contactDetails?.currentAddress || prev.currentAddress,
            permanentAddress: record.stage1?.contactDetails?.permanentAddress || prev.permanentAddress,
            highestQualification: record.stage1?.qualificationDetails?.highestQualification || prev.highestQualification,
            declarationAccepted: record.stage1?.declarationAccepted || prev.declarationAccepted,
          }));
          setPositionMode(
            nextPosition && !POSITION_OPTIONS.includes(nextPosition as (typeof POSITION_OPTIONS)[number]) ? "other" : "preset"
          );
          setQualifications(
            record.stage1?.qualificationDetails?.qualifications?.length
              ? record.stage1.qualificationDetails.qualifications.map((q) => ({
                  degree: q.degree || "",
                  institute: q.institute || "",
                  year: q.year || "",
                  percentage: q.percentage || "",
                }))
              : [emptyQualification()]
          );
        }
      } catch (error) {
        toast({
          title: "Unable to load profile",
          description: error instanceof Error ? error.message : "Failed to fetch your application",
          variant: "destructive",
        });
      } finally {
        setLoadingMyApplication(false);
      }
    })();
  }, [isCandidateUser, toast]);

  useEffect(() => {
    if (!isCandidateUser || loadingMyApplication) return;
    if ((myApplication?.stageCompleted || 0) >= 1 || myApplication?.stage1?.submittedAt) {
      navigate("/candidate/dashboard", { replace: true });
    }
  }, [isCandidateUser, loadingMyApplication, myApplication, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.fullName.trim() || !form.email.trim()) {
      toast({ title: "Validation Error", description: "Full name and email are required.", variant: "destructive" });
      return;
    }
    if (!form.positionApplied.trim()) {
      toast({ title: "Validation Error", description: "Please select or enter the position applied.", variant: "destructive" });
      return;
    }
    if (!form.declarationAccepted) {
      toast({ title: "Validation Error", description: "Please accept the declaration to continue.", variant: "destructive" });
      return;
    }
    if (isLocked) {
      toast({ title: "Application Locked", description: "Your application has already been submitted.", variant: "destructive" });
      navigate("/candidate/dashboard");
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.createCandidateApplication({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        positionApplied: form.positionApplied.trim(),
        personalDetails: {
          dateOfBirth: form.dateOfBirth.trim(),
          fatherName: form.fatherName.trim(),
          motherName: form.motherName.trim(),
          maritalStatus: form.maritalStatus.trim(),
          presentResidentialAccommodation: form.presentResidentialAccommodation.trim(),
          domicile: form.presentResidentialAccommodation.trim(),
        },
        contactDetails: {
          alternatePhone: form.alternatePhone.trim(),
          currentAddress: form.currentAddress.trim(),
          permanentAddress: form.permanentAddress.trim(),
        },
        qualificationDetails: {
          highestQualification: form.highestQualification.trim(),
          qualifications: qualifications.map((q) => ({
            degree: q.degree.trim(),
            institute: q.institute.trim(),
            year: q.year.trim(),
            percentage: q.percentage.trim(),
          })),
        },
        declarationAccepted: true,
      });

      if (response.success) {
        setSubmitted(true);
        setCandidate(response.data);
        toast({ title: "Application submitted successfully!", description: "Your Stage 1 details have been saved." });
        await refreshPortal();
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        navigate("/candidate/stage2", { replace: true });
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast({
          title: "Application already submitted",
          description: "Your current account already has a submitted application.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Submission failed",
          description: error instanceof Error ? error.message : "Unable to submit application",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className={formCardClassName}>
          <CardHeader>
            <CardTitle className="text-[28px] font-semibold text-[#7a5720]">Candidate Portal Workflow</CardTitle>
          </CardHeader>
          <CardContent className={`${cardContentClassName} ${sectionBodyClassName}`}>
            Stage 1: Application Form. Stage 2: HR Review and Interview Processing. Stage 3: Final Decision.
            {isCandidateUser && (
              <div className="mt-2 text-[#efe2d1]">
                Current Status: <span className="font-semibold">{myApplication?.status || "Not Applied"}</span>
              </div>
            )}
            {isLocked && (
              <div className="mt-2 text-sm font-medium text-amber-600">Your application has already been submitted.</div>
            )}
          </CardContent>
        </Card>

        <Card className={formCardClassName}>
          <CardHeader>
            <CardTitle className={sectionTitleClassName}>Stage 1: Candidate Application Form</CardTitle>
          </CardHeader>
          <CardContent className={cardContentClassName}>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Full Name *</Label>
                  <Input className={fieldClassName} disabled={isLocked} value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    readOnly
                    disabled={isLocked}
                    className={`${fieldClassName} ${user?.email ? "cursor-not-allowed bg-[#24211f] text-[#d6b27c]" : ""}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Phone</Label>
                  <Input className={fieldClassName} disabled={isLocked} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Position Applied</Label>
                  <Select
                    disabled={isLocked}
                    value={selectedPositionOption}
                    onValueChange={(value) => {
                      setPositionMode(value === "Other" ? "other" : "preset");
                      setForm((p) => ({
                        ...p,
                        positionApplied: value === "Other" ? p.positionApplied : value,
                      }));
                    }}
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      {POSITION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option} className={selectItemClassName}>
                          {option}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other" className={selectItemClassName}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedPositionOption === "Other" ? (
                    <Input
                      className={fieldClassName}
                      disabled={isLocked}
                      placeholder="Enter position applied"
                      value={form.positionApplied}
                      onChange={(e) => setForm((p) => ({ ...p, positionApplied: e.target.value }))}
                    />
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Date of Birth</Label>
                  <Input className={fieldClassName} disabled={isLocked} type="date" value={form.dateOfBirth} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Marital Status</Label>
                  <Select disabled={isLocked} value={form.maritalStatus} onValueChange={(value) => setForm((p) => ({ ...p, maritalStatus: value }))}>
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Select marital status" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      <SelectItem value="Single" className={selectItemClassName}>Single</SelectItem>
                      <SelectItem value="Married" className={selectItemClassName}>Married</SelectItem>
                      <SelectItem value="Divorced" className={selectItemClassName}>Divorced</SelectItem>
                      <SelectItem value="Widowed" className={selectItemClassName}>Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Father's Name</Label>
                  <Input className={fieldClassName} disabled={isLocked} value={form.fatherName} onChange={(e) => setForm((p) => ({ ...p, fatherName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Mother's Name</Label>
                  <Input className={fieldClassName} disabled={isLocked} value={form.motherName} onChange={(e) => setForm((p) => ({ ...p, motherName: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className={labelClassName}>Indicate the type of your present residential accommodation.</Label>
                  <Select
                    disabled={isLocked}
                    value={form.presentResidentialAccommodation}
                    onValueChange={(value) => setForm((p) => ({ ...p, presentResidentialAccommodation: value }))}
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Select accommodation type" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      <SelectItem value="Owned" className={selectItemClassName}>Owned</SelectItem>
                      <SelectItem value="Rented" className={selectItemClassName}>Rented</SelectItem>
                      <SelectItem value="Family-owned" className={selectItemClassName}>Family-owned</SelectItem>
                      <SelectItem value="Company-provided" className={selectItemClassName}>Company-provided</SelectItem>
                      <SelectItem value="Hostel/PG" className={selectItemClassName}>Hostel/PG</SelectItem>
                      <SelectItem value="Other" className={selectItemClassName}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Alternate Phone</Label>
                  <Input className={fieldClassName} disabled={isLocked} value={form.alternatePhone} onChange={(e) => setForm((p) => ({ ...p, alternatePhone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClassName}>Highest Qualification</Label>
                  <Input className={fieldClassName} disabled={isLocked} value={form.highestQualification} onChange={(e) => setForm((p) => ({ ...p, highestQualification: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className={labelClassName}>Current Address</Label>
                  <Textarea className={fieldClassName} disabled={isLocked} rows={2} value={form.currentAddress} onChange={(e) => setForm((p) => ({ ...p, currentAddress: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className={labelClassName}>Permanent Address</Label>
                  <Textarea className={fieldClassName} disabled={isLocked} rows={2} value={form.permanentAddress} onChange={(e) => setForm((p) => ({ ...p, permanentAddress: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#f0dfc7]">Qualification Details</h3>
                  <Button type="button" variant="outline" className={outlineButtonClassName} disabled={isLocked} onClick={() => setQualifications((prev) => [...prev, emptyQualification()])}>
                    Add Row
                  </Button>
                </div>
                {qualifications.map((qualification, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-[22px] border border-[rgba(230,199,163,0.14)] bg-[rgba(36,31,29,0.86)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] sm:grid-cols-4"
                  >
                    <Input
                      className={fieldClassName}
                      disabled={isLocked}
                      placeholder="Degree"
                      value={qualification.degree}
                      onChange={(e) =>
                        setQualifications((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, degree: e.target.value } : row))
                        )
                      }
                    />
                    <Input
                      className={fieldClassName}
                      disabled={isLocked}
                      placeholder="Institute"
                      value={qualification.institute}
                      onChange={(e) =>
                        setQualifications((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, institute: e.target.value } : row))
                        )
                      }
                    />
                    <Input
                      className={fieldClassName}
                      disabled={isLocked}
                      placeholder="Year"
                      value={qualification.year}
                      onChange={(e) =>
                        setQualifications((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, year: e.target.value } : row))
                        )
                      }
                    />
                    <div className="flex gap-2">
                      <Input
                        className={fieldClassName}
                        disabled={isLocked}
                        placeholder="% / CGPA"
                        value={qualification.percentage}
                        onChange={(e) =>
                          setQualifications((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, percentage: e.target.value } : row))
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isLocked || qualifications.length === 1}
                        onClick={() => setQualifications((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 rounded-[22px] border border-[rgba(230,199,163,0.14)] bg-[rgba(36,31,29,0.86)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                <Checkbox
                  className="border-[rgba(230,199,163,0.24)] data-[state=checked]:border-[#d6b27c] data-[state=checked]:bg-[#d6b27c] data-[state=checked]:text-[#1a1714]"
                  disabled={isLocked}
                  checked={form.declarationAccepted}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, declarationAccepted: Boolean(checked) }))}
                />
                <p className="text-sm text-[#c8b8a6]">
                  I declare that all details provided are true and correct to the best of my knowledge.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={submitted || isLocked || loading || (isCandidateUser && loadingMyApplication)}>
                {loading ? "Submitting..." : isLocked ? "Stage 1 Already Submitted" : "Submit Stage 1"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CandidateApply;
