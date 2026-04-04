import React from "react";
import PipelineStageBoard from "./PipelineStageBoard";
import { type CandidateRecord, type JoiningFormRecord } from "@/services/api";
import { getCandidatePortalStep } from "@/lib/candidatePortal";

interface ProgressTrackerProps {
  candidate: CandidateRecord | null;
  joiningForm?: JoiningFormRecord | null;
  currentStatus?: string;
}
const ProgressTracker: React.FC<ProgressTrackerProps> = ({ candidate, joiningForm, currentStatus }) => {
  const currentStep = getCandidatePortalStep(candidate, joiningForm || null);
  const steps = [
    { key: "submitted", title: "Submitted", description: "Stage 1 application received" },
    { key: "review", title: "Review", description: (candidate?.stageCompleted || 0) >= 2 ? "Detailed form completed and waiting for review" : "Stage 2 unlocks after Stage 1" },
    { key: "interview", title: "Interview", description: currentStatus === "Interview" || currentStatus === "Interview Scheduled" ? "Interview round is active" : "Interview scheduling appears here" },
    { key: "offer", title: "Offer", description: "Selection and offer decision" },
    { key: "onboarding", title: "Onboarding", description: "Joining form and employee conversion" },
  ];

  return <PipelineStageBoard currentStep={currentStep} steps={steps} />;
};

export default ProgressTracker;
