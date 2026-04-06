import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { apiService, type CandidateRecord, type EmployeeRecord, type JoiningFormPrefillData, type JoiningFormRecord } from "@/services/api";
import InlineStatusMessage from "@/components/InlineStatusMessage";

const emptyEducation = { degreeOrDiploma: "", university: "", yearOfPassing: "", percentage: "" };
const MAX_JOINING_FORM_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const joiningFormFileConfig = {
  resume: {
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png",
    mimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"] as string[],
    invalidMessage: "Resume must be PDF, DOC, DOCX, JPG, or PNG.",
  },
  photograph: {
    accept: ".jpg,.jpeg,.png",
    mimeTypes: ["image/jpeg", "image/png"] as string[],
    invalidMessage: "Photograph must be JPG or PNG.",
  },
  certificates: {
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png",
    mimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"] as string[],
    invalidMessage: "Certificates must be PDF, DOC, DOCX, JPG, or PNG.",
  },
  idProof: {
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png",
    mimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"] as string[],
    invalidMessage: "ID proof must be PDF, DOC, DOCX, JPG, or PNG.",
  },
} as const;

const normalizeEducationRows = (
  formData: JoiningFormRecord | null,
  candidateData: CandidateRecord | null
) => {
  const savedRows = formData?.educationDetails || [];
  const candidateQualifications = candidateData?.stage1?.qualificationDetails?.qualifications || [];

  if (savedRows.length) {
    return savedRows.map((row) => ({
      degreeOrDiploma: row.degreeOrDiploma || "",
      university: row.university || "",
      yearOfPassing: row.yearOfPassing || "",
      percentage: row.percentage || "",
    }));
  }

  if (candidateQualifications.length) {
    return candidateQualifications.map((row) => ({
      degreeOrDiploma: row.degree || "",
      university: row.institute || "",
      yearOfPassing: row.year || "",
      percentage: row.percentage || "",
    }));
  }

  return [emptyEducation];
};

const buildPrefillValues = ({
  formData,
  candidateData,
  employeeData,
  prefillData,
  user,
}: {
  formData: JoiningFormRecord | null;
  candidateData: CandidateRecord | null;
  employeeData: EmployeeRecord | null;
  prefillData?: JoiningFormPrefillData;
  user: ReturnType<typeof useAuth>["user"];
}) => {
  const candidateDob = prefillData?.dateOfBirth || candidateData?.stage1?.personalDetails?.dateOfBirth || "";
  const resolvedDateOfBirth = formData?.personalInformation?.dateOfBirth || prefillData?.dateOfBirth || candidateDob;

  return {
    fullName:
      formData?.personalInformation?.fullName ||
      prefillData?.fullName ||
      candidateData?.fullName ||
      employeeData?.fullName ||
      user?.name ||
      "",
    dateOfBirth: resolvedDateOfBirth,
    age: formData?.personalInformation?.age || prefillData?.age || toAge(resolvedDateOfBirth),
    maritalStatus: formData?.personalInformation?.maritalStatus || prefillData?.maritalStatus || candidateData?.stage1?.personalDetails?.maritalStatus || "",
    placeOfBirth: formData?.personalInformation?.placeOfBirth || prefillData?.placeOfBirth || "",
    fatherName: formData?.familyDetails?.fatherName || prefillData?.fatherName || candidateData?.stage1?.personalDetails?.fatherName || "",
    fatherOccupation: formData?.familyDetails?.fatherOccupation || prefillData?.fatherOccupation || "",
    motherName: formData?.familyDetails?.motherName || prefillData?.motherName || candidateData?.stage1?.personalDetails?.motherName || "",
    motherOccupation: formData?.familyDetails?.motherOccupation || prefillData?.motherOccupation || "",
    presentAddress:
      formData?.addressDetails?.presentAddress ||
      prefillData?.presentAddress ||
      candidateData?.stage1?.contactDetails?.currentAddress ||
      employeeData?.address?.presentAddress ||
      "",
    permanentAddress:
      formData?.addressDetails?.permanentAddress ||
      prefillData?.permanentAddress ||
      candidateData?.stage1?.contactDetails?.permanentAddress ||
      employeeData?.address?.permanentAddress ||
      "",
    phoneNumber:
      formData?.personalInformation?.phoneNumber ||
      prefillData?.phoneNumber ||
      candidateData?.phone ||
      employeeData?.phone ||
      user?.phone ||
      user?.phoneNumber ||
      "",
    mobileNumber: formData?.personalInformation?.mobileNumber || prefillData?.mobileNumber || candidateData?.stage1?.contactDetails?.alternatePhone || "",
    emailAddress:
      formData?.personalInformation?.emailAddress ||
      prefillData?.emailAddress ||
      candidateData?.email ||
      employeeData?.email ||
      user?.email ||
      "",
    accommodationDetails:
      formData?.accommodationDetails ||
      prefillData?.accommodationDetails ||
      candidateData?.stage1?.personalDetails?.presentResidentialAccommodation ||
      candidateData?.stage1?.personalDetails?.domicile ||
      "",
    educationDetails:
      formData?.educationDetails?.length || candidateData?.stage1?.qualificationDetails?.qualifications?.length
        ? normalizeEducationRows(formData, candidateData)
        : (employeeData?.educationDetails || []).length
          ? (employeeData?.educationDetails || []).map((row) => ({
              degreeOrDiploma: row.degreeOrDiploma || "",
              university: row.university || "",
              yearOfPassing: row.yearOfPassing || "",
              percentage: row.percentage || "",
            }))
        : (prefillData?.educationDetails || []).length
          ? (prefillData?.educationDetails || []).map((row) => ({
              degreeOrDiploma: row.degreeOrDiploma || "",
              university: row.university || "",
              yearOfPassing: row.yearOfPassing || "",
              percentage: row.percentage || "",
            }))
          : [emptyEducation],
    declarationAccepted: Boolean(formData?.declarationAccepted),
  };
};

const hasPrefilledData = (values: ReturnType<typeof buildPrefillValues>) =>
  Boolean(
    values.fullName ||
      values.emailAddress ||
      values.phoneNumber ||
      values.dateOfBirth ||
      values.presentAddress ||
      values.permanentAddress ||
      values.fatherName ||
      values.motherName ||
      values.accommodationDetails ||
      values.educationDetails.some((row) => row.degreeOrDiploma || row.university || row.yearOfPassing || row.percentage)
  );

const toAge = (dateOfBirth: string) => {
  if (!dateOfBirth) return "";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age > 0 ? String(age) : "";
};

const CandidateJoiningForm: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const isEmployeeActivation = user?.role === "employee";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeRecord | null>(null);
  const [existingForm, setExistingForm] = useState<JoiningFormRecord | null>(null);
  const [autoFillNotice, setAutoFillNotice] = useState("");
  const hasHydratedRef = useRef(false);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [age, setAge] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherOccupation, setFatherOccupation] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherOccupation, setMotherOccupation] = useState("");
  const [presentAddress, setPresentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [accommodationDetails, setAccommodationDetails] = useState("");
  const [educationDetails, setEducationDetails] = useState([emptyEducation]);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const [files, setFiles] = useState<{
    resume: File | null;
    photograph: File | null;
    certificates: File | null;
    idProof: File | null;
  }>({ resume: null, photograph: null, certificates: null, idProof: null });

  const [filePreview, setFilePreview] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const loadData = await apiService.getMyJoiningFormLoadData().catch(() => null);
        const formData = loadData?.form || null;
        const [candidateData, employeeData] = await Promise.all([
          isEmployeeActivation ? Promise.resolve(null) : apiService.getMyCandidateApplication(),
          isEmployeeActivation ? apiService.getMyEmployeeProfile().catch(() => null) : Promise.resolve(null),
        ]);
        setCandidate(candidateData);
        setEmployeeProfile(employeeData);
        setExistingForm(formData);
        if (!hasHydratedRef.current) {
          const prefill = buildPrefillValues({
            formData,
            candidateData,
            employeeData,
            prefillData: loadData?.prefillData,
            user,
          });
          setFullName(prefill.fullName);
          setDateOfBirth(prefill.dateOfBirth);
          setAge(prefill.age);
          setMaritalStatus(prefill.maritalStatus);
          setPlaceOfBirth(prefill.placeOfBirth);
          setFatherName(prefill.fatherName);
          setFatherOccupation(prefill.fatherOccupation);
          setMotherName(prefill.motherName);
          setMotherOccupation(prefill.motherOccupation);
          setPresentAddress(prefill.presentAddress);
          setPermanentAddress(prefill.permanentAddress);
          setPhoneNumber(prefill.phoneNumber);
          setMobileNumber(prefill.mobileNumber);
          setEmailAddress(prefill.emailAddress);
          setAccommodationDetails(prefill.accommodationDetails);
          setEducationDetails(prefill.educationDetails);
          setDeclarationAccepted(prefill.declarationAccepted);
          setAutoFillNotice(
            hasPrefilledData(prefill) ? "Data auto-filled from your profile and earlier application details." : ""
          );
          hasHydratedRef.current = true;
        }
      } catch (error) {
        toast({
          title: "Failed to load joining form",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
          setLoading(false);
      }
    })();
  }, [isEmployeeActivation, toast, user]);

  useEffect(() => {
    const nextPreview: Record<string, string> = {};
    (Object.keys(files) as Array<keyof typeof files>).forEach((key) => {
      const file = files[key];
      if (file) nextPreview[key] = URL.createObjectURL(file);
    });
    setFilePreview(nextPreview);

    return () => {
      Object.values(nextPreview).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const isLocked = useMemo(() => {
    if (isEmployeeActivation) return false;
    return !candidate?.joiningForm?.isUnlocked;
  }, [candidate, isEmployeeActivation]);

  const updateEducation = (index: number, key: keyof (typeof emptyEducation), value: string) => {
    setEducationDetails((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    if (isLocked) {
      const message = "Please wait for HR to unlock this form.";
      setSubmitError(message);
      toast({ title: "Joining form is locked", description: message, variant: "destructive" });
      return;
    }

    if (!declarationAccepted) {
      const message = "Please accept declaration before submit.";
      setSubmitError(message);
      toast({ title: "Declaration required", description: message, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiService.submitMyJoiningForm({
        fullName,
        dateOfBirth,
        age,
        maritalStatus,
        placeOfBirth,
        fatherName,
        fatherOccupation,
        motherName,
        motherOccupation,
        presentAddress,
        permanentAddress,
        phoneNumber,
        mobileNumber,
        emailAddress,
        accommodationDetails,
        educationDetails,
        declarationAccepted,
        files,
      });
      await refreshProfile();
      toast({ title: "Submitted", description: "Joining form submitted successfully." });
      navigate(isEmployeeActivation ? "/employee/dashboard" : "/candidate/dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit joining form.";
      setSubmitError(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto flex max-w-4xl items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  const handleFileChange = (field: keyof typeof files, file: File | null, input: HTMLInputElement | null) => {
    setSubmitError("");
    if (!file) {
      setFiles((prev) => ({ ...prev, [field]: null }));
      return;
    }

    const config = joiningFormFileConfig[field];
    if (!config.mimeTypes.includes(file.type)) {
      if (input) input.value = "";
      setSubmitError(config.invalidMessage);
      toast({ title: "Invalid file type", description: config.invalidMessage, variant: "destructive" });
      return;
    }

    if (file.size > MAX_JOINING_FORM_FILE_SIZE_BYTES) {
      if (input) input.value = "";
      const message = "Each file must be 10 MB or smaller.";
      setSubmitError(message);
      toast({ title: "File too large", description: message, variant: "destructive" });
      return;
    }

    setFiles((prev) => ({
      ...prev,
      [field]: file,
    }));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{isEmployeeActivation ? "Activate Your Account" : "Complete Joining Form"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {isEmployeeActivation
                ? "Please complete this mandatory joining form to activate your employee account. Upload documents in PDF, DOC, DOCX, JPG, PNG formats."
                : "Only selected candidates can access this form. Upload documents in PDF, DOC, DOCX, JPG, PNG formats."}
            </p>
            {autoFillNotice ? (
              <p className="mt-3 text-sm font-medium text-emerald-700">{autoFillNotice}</p>
            ) : null}
            {isEmployeeActivation ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Joining Form completion is mandatory before you can access dashboard, attendance, payroll, and other employee modules.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Full Name</Label><Input value={fullName} disabled={isLocked} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Date of Birth</Label><DatePicker value={dateOfBirth} disabled={isLocked} onChange={(e) => setDateOfBirth(e.target.value)} /></div>
                <div><Label>Age</Label><Input value={age} disabled={isLocked} onChange={(e) => setAge(e.target.value)} /></div>
                <div><Label>Marital Status</Label><Input value={maritalStatus} disabled={isLocked} onChange={(e) => setMaritalStatus(e.target.value)} /></div>
                <div><Label>Place of Birth</Label><Input value={placeOfBirth} disabled={isLocked} onChange={(e) => setPlaceOfBirth(e.target.value)} /></div>
                <div><Label>Phone Number</Label><Input value={phoneNumber} disabled={isLocked} onChange={(e) => setPhoneNumber(e.target.value)} /></div>
                <div><Label>Mobile Number</Label><Input value={mobileNumber} disabled={isLocked} onChange={(e) => setMobileNumber(e.target.value)} /></div>
                <div>
                  <Label>Email Address</Label>
                  <Input value={emailAddress} readOnly disabled={isLocked} onChange={(e) => setEmailAddress(e.target.value)} />
                </div>
                <div><Label>Father's Name</Label><Input value={fatherName} disabled={isLocked} onChange={(e) => setFatherName(e.target.value)} /></div>
                <div><Label>Father's Occupation</Label><Input value={fatherOccupation} disabled={isLocked} onChange={(e) => setFatherOccupation(e.target.value)} /></div>
                <div><Label>Mother's Name</Label><Input value={motherName} disabled={isLocked} onChange={(e) => setMotherName(e.target.value)} /></div>
                <div><Label>Mother's Occupation</Label><Input value={motherOccupation} disabled={isLocked} onChange={(e) => setMotherOccupation(e.target.value)} /></div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Present Address</Label>
                  <Textarea rows={3} value={presentAddress} disabled={isLocked} onChange={(e) => setPresentAddress(e.target.value)} />
                </div>
                <div>
                  <Label>Permanent Address</Label>
                  <Textarea rows={3} value={permanentAddress} disabled={isLocked} onChange={(e) => setPermanentAddress(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Accommodation Details</Label>
                <div className="grid gap-2 pt-2 sm:grid-cols-2 md:grid-cols-4">
                  {["Owned", "Rented", "Company Accommodation", "Relatives/Friends", "Paying Guest"].map((option) => (
                    <button
                      type="button"
                      key={option}
                      disabled={isLocked}
                      onClick={() => setAccommodationDetails(option)}
                      className={`rounded-md border px-3 py-2 text-sm ${accommodationDetails === option ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Education Details</Label>
                  <Button type="button" variant="outline" disabled={isLocked} onClick={() => setEducationDetails((prev) => [...prev, emptyEducation])}>
                    Add Row
                  </Button>
                </div>
                {educationDetails.map((row, index) => (
                  <div key={index} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-5">
                    <Input placeholder="Degree/Diploma" value={row.degreeOrDiploma} disabled={isLocked} onChange={(e) => updateEducation(index, "degreeOrDiploma", e.target.value)} />
                    <Input placeholder="University" value={row.university} disabled={isLocked} onChange={(e) => updateEducation(index, "university", e.target.value)} />
                    <Input placeholder="Year of Passing" value={row.yearOfPassing} disabled={isLocked} onChange={(e) => updateEducation(index, "yearOfPassing", e.target.value)} />
                    <Input placeholder="Percentage" value={row.percentage} disabled={isLocked} onChange={(e) => updateEducation(index, "percentage", e.target.value)} />
                    <Button type="button" variant="destructive" disabled={isLocked || educationDetails.length === 1} onClick={() => setEducationDetails((prev) => prev.filter((_, i) => i !== index))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Document Uploads</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {(["resume", "photograph", "certificates", "idProof"] as const).map((field) => (
                    <div key={field} className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium capitalize">{field}</p>
                      <Input
                        type="file"
                        accept={joiningFormFileConfig[field].accept}
                        disabled={isLocked}
                        onChange={(e) => handleFileChange(field, e.target.files?.[0] || null, e.target)}
                      />
                      {files[field] ? <p className="mt-1 text-xs text-muted-foreground">Selected: {files[field]?.name}</p> : null}
                      {filePreview[field] && files[field]?.type?.startsWith("image/") ? (
                        <img src={filePreview[field]} alt={field} className="mt-2 h-24 w-24 rounded border border-border object-cover" />
                      ) : null}
                      {!files[field] && existingForm?.documents?.[field]?.url ? (
                        <a className="mt-2 block text-xs text-primary underline" href={existingForm.documents[field]?.url} target="_blank" rel="noreferrer">
                          View uploaded file
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md border border-border p-3">
                <Checkbox checked={declarationAccepted} onCheckedChange={(checked) => setDeclarationAccepted(Boolean(checked))} disabled={isLocked} />
                <p className="text-sm text-muted-foreground">I hereby declare that all information furnished above is true and complete.</p>
              </div>

              {submitError ? <InlineStatusMessage type="error" message={submitError} /> : null}

              <div className="flex gap-3">
                <Button type="submit" disabled={isLocked || submitting}>
                  {submitting ? "Submitting..." : "Submit Joining Form"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(isEmployeeActivation ? "/joining-form" : "/candidate/dashboard")}>Back</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CandidateJoiningForm;
