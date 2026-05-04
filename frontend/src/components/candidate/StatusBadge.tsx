import React from "react";
import { Badge } from "@/components/ui/badge";
import type { CandidateStatus } from "@/services/api";

interface StatusBadgeProps {
  status: CandidateStatus | "Not Applied";
}

const colorMap: Record<StatusBadgeProps["status"], string> = {
  "Not Applied": "border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] text-[var(--portal-muted-color)] dark:bg-[rgba(255,255,255,0.05)] dark:text-[#c4c4c4]",
  Draft: "border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] text-[var(--portal-muted-color)] dark:bg-[rgba(255,255,255,0.05)] dark:text-[#c4c4c4]",
  Applied: "border border-[#D6B58C] bg-[#F8E8D5] text-[#7A5637] dark:border-[rgba(230,199,163,0.18)] dark:bg-[rgba(230,199,163,0.08)] dark:text-[#E6C7A3]",
  "Profile Completed": "border border-[#D6B58C] bg-[#F8E8D5] text-[#7A5637] dark:border-[rgba(230,199,163,0.18)] dark:bg-[rgba(230,199,163,0.08)] dark:text-[#E6C7A3]",
  "HR Review": "border border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-300",
  "Under Review": "border border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-300",
  Interview: "border border-[#D6B58C] bg-[#F6EBDD] text-[#8A5A2F] dark:border-[rgba(230,199,163,0.18)] dark:bg-[rgba(230,199,163,0.1)] dark:text-[#E6C7A3]",
  "Interview Scheduled": "border border-[#D6B58C] bg-[#F6EBDD] text-[#8A5A2F] dark:border-[rgba(230,199,163,0.18)] dark:bg-[rgba(230,199,163,0.1)] dark:text-[#E6C7A3]",
  Selected: "border border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  Internship: "border border-orange-500/20 bg-orange-500/12 text-orange-700 dark:text-orange-300",
  Offered: "border border-[#D6B58C] bg-[#F8E8D5] text-[#7A5637] dark:border-[rgba(230,199,163,0.18)] dark:bg-[rgba(230,199,163,0.08)] dark:text-[#E6C7A3]",
  "Joining Form Requested": "border border-[#D6B58C] bg-[#F6EBDD] text-[#8A5A2F] dark:border-[rgba(230,199,163,0.18)] dark:bg-[rgba(230,199,163,0.1)] dark:text-[#E6C7A3]",
  "Joining Form Submitted": "border border-[#D6B58C] bg-[#F6EBDD] text-[#8A5A2F] dark:border-[rgba(230,199,163,0.18)] dark:bg-[rgba(230,199,163,0.1)] dark:text-[#E6C7A3]",
  "Joining Form Correction Requested": "border border-yellow-500/20 bg-yellow-500/12 text-yellow-700 dark:text-yellow-300",
  "Joining Form Rejected": "border border-rose-500/20 bg-rose-500/12 text-rose-700 dark:text-rose-300",
  "Employee Onboarding": "border border-teal-500/20 bg-teal-500/12 text-teal-700 dark:text-teal-300",
  "Converted to Employee": "border border-green-500/20 bg-green-500/12 text-green-700 dark:text-green-300",
  Accepted: "border border-green-500/20 bg-green-500/12 text-green-700 dark:text-green-300",
  Rejected: "border border-red-500/20 bg-red-500/12 text-red-700 dark:text-red-300",
};

const CandidateStatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return <Badge className={colorMap[status]}>{status}</Badge>;
};

export default CandidateStatusBadge;
