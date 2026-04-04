import React from "react";
import { Badge } from "@/components/ui/badge";
import type { CandidateStatus } from "@/services/api";

interface StatusBadgeProps {
  status: CandidateStatus | "Not Applied";
}

const colorMap: Record<StatusBadgeProps["status"], string> = {
  "Not Applied": "bg-slate-200 text-slate-800",
  Draft: "bg-slate-200 text-slate-800",
  Applied: "bg-blue-100 text-blue-800",
  "Profile Completed": "bg-indigo-100 text-indigo-800",
  "HR Review": "bg-amber-100 text-amber-800",
  "Under Review": "bg-amber-100 text-amber-800",
  Interview: "bg-violet-100 text-violet-800",
  "Interview Scheduled": "bg-violet-100 text-violet-800",
  Selected: "bg-emerald-100 text-emerald-800",
  Internship: "bg-orange-100 text-orange-800",
  Offered: "bg-cyan-100 text-cyan-800",
  "Joining Form Requested": "bg-fuchsia-100 text-fuchsia-800",
  "Joining Form Submitted": "bg-purple-100 text-purple-800",
  "Joining Form Correction Requested": "bg-yellow-100 text-yellow-800",
  "Joining Form Rejected": "bg-rose-100 text-rose-800",
  "Employee Onboarding": "bg-teal-100 text-teal-800",
  "Converted to Employee": "bg-green-100 text-green-800",
  Accepted: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

const CandidateStatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return <Badge className={colorMap[status]}>{status}</Badge>;
};

export default CandidateStatusBadge;
