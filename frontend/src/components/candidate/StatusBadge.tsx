import React from "react";
import { Badge } from "@/components/ui/badge";
import type { CandidateStatus } from "@/services/api";

interface StatusBadgeProps {
  status: CandidateStatus | "Not Applied";
}

const colorMap: Record<StatusBadgeProps["status"], string> = {
  "Not Applied": "bg-slate-200 text-slate-800",
  Draft: "bg-slate-200 text-slate-800",
  Applied: "border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#2A211B)] text-[#E6C7A3]",
  "Profile Completed": "border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#2A211B)] text-[#E6C7A3]",
  "HR Review": "bg-amber-100 text-amber-800",
  "Under Review": "bg-amber-100 text-amber-800",
  Interview: "border border-[#2A2623] bg-[rgba(230,199,163,0.2)] text-[#E6C7A3]",
  "Interview Scheduled": "border border-[#2A2623] bg-[rgba(230,199,163,0.2)] text-[#E6C7A3]",
  Selected: "bg-emerald-100 text-emerald-800",
  Internship: "bg-orange-100 text-orange-800",
  Offered: "border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#2A211B)] text-[#E6C7A3]",
  "Joining Form Requested": "border border-[#2A2623] bg-[rgba(230,199,163,0.2)] text-[#E6C7A3]",
  "Joining Form Submitted": "border border-[#2A2623] bg-[rgba(230,199,163,0.2)] text-[#E6C7A3]",
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
