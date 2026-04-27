import type { CandidateRecord, JoiningFormRecord } from "@/services/api";

export const getCandidateApplicationMeta = (
  candidate: CandidateRecord | null,
  joiningForm: JoiningFormRecord | null,
) => {
  if (!candidate) {
    return {
      status: "Not Applied",
      currentStage: "Not Started",
      nextStep: "Complete Stage 1 application form",
    };
  }

  if (candidate.status === "Converted to Employee") {
    return {
      status: candidate.status,
      currentStage: "Employee Onboarding",
      nextStep: "Wait for employee access confirmation",
    };
  }

  if (candidate.status === "Joining Form Requested" || candidate.status === "Joining Form Submitted") {
    return {
      status: candidate.status,
      currentStage: "Joining Form",
      nextStep:
        candidate.status === "Joining Form Requested" || joiningForm?.status === "Requested"
          ? "Complete your joining form"
          : "Waiting for onboarding review",
    };
  }

  if (candidate.status === "Internship") {
    return {
      status: candidate.status,
      currentStage: "Internship",
      nextStep: "Track internship status and upcoming onboarding updates",
    };
  }

  const stage = Number(candidate.stageCompleted || 0);
  if (stage >= 2) {
    return {
      status: candidate.status,
      currentStage: candidate.status === "Interview" || candidate.status === "Interview Scheduled" ? "Interview" : "Review",
      nextStep: candidate.status === "Interview" || candidate.status === "Interview Scheduled" ? "Prepare for interview" : "Await HR review",
    };
  }

  return {
    status: candidate.status,
    currentStage: "Detailed Form",
    nextStep: "Complete Stage 2 profile",
  };
};

export const getCandidatePortalStep = (candidate: CandidateRecord | null, joiningForm: JoiningFormRecord | null) => {
  if (!candidate) return 1;
  if (candidate.status === "Converted to Employee" || candidate.status === "Employee Onboarding") return 5;
  if (
    candidate.status === "Joining Form Requested" ||
    candidate.status === "Joining Form Submitted" ||
    candidate.status === "Joining Form Correction Requested" ||
    joiningForm?.status === "Requested" ||
    joiningForm?.status === "Submitted"
  ) {
    return 5;
  }
  if (candidate.status === "Offered" || candidate.status === "Accepted" || candidate.status === "Selected") return 4;
  if (candidate.status === "Interview" || candidate.status === "Interview Scheduled") return 3;
  if (
    candidate.status === "HR Review" ||
    candidate.status === "Under Review" ||
    candidate.status === "Profile Completed" ||
    Number(candidate.stageCompleted || 0) >= 2
  ) {
    return 2;
  }
  return 1;
};

export const getCandidatePortalStepLabel = (step: number) => {
  if (step <= 1) return "Submitted";
  if (step === 2) return "Review";
  if (step === 3) return "Interview";
  if (step === 4) return "Offer";
  return "Onboarding";
};

export const getCandidateProfileCompletion = (candidate: CandidateRecord | null, joiningForm: JoiningFormRecord | null) => {
  if (!candidate) return 0;

  const certificateUploads =
    (candidate.documents?.uploadedFiles || []).filter((file) => file?.fieldId === "certificates" && file.url).length ||
    (candidate.documents?.certificates?.url ? 1 : 0);

  let completed = 0;
  if (candidate.stage1?.declarationAccepted) completed += 35;
  if ((candidate.stageCompleted || 0) >= 2) completed += 40;
  if (candidate.documents?.resume?.url || candidate.resumeUrl) completed += 10;
  if (certificateUploads > 0) completed += 5;
  if ((candidate.documents?.uploadedFiles?.length || 0) > 0) completed += 5;
  if (joiningForm?.status === "Submitted" || candidate.joiningForm?.status === "Submitted") completed += 10;

  return Math.min(completed, 100);
};
