import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSearch2, UserCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CandidateRecord } from "@/services/api";

const RecruiterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<CandidateRecord[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiService.list<CandidateRecord>("candidates");
        setRows(data);
      } catch (error) {
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to load recruiter dashboard", variant: "destructive" });
      }
    })();
  }, []);

  const total = rows.length;
  const shortlisted = useMemo(() => rows.filter((r) => r.status === "Under Review" || r.status === "Interview Scheduled").length, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Recruiter Dashboard" subtitle="View applications and shortlist candidates." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Applications" value={total} change="All candidates" changeType="neutral" icon={Users} color="primary" />
        <StatCard title="Shortlisted" value={shortlisted} change="Under review/interview" changeType="positive" icon={UserCheck} color="success" />
        <StatCard title="Open for Screening" value={Math.max(total - shortlisted, 0)} change="Initial review" changeType="neutral" icon={FileSearch2} color="warning" />
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Application Queue</h3>
        <div className="space-y-2">
          {rows.slice(0, 10).map((row) => (
            <button
              key={row._id}
              className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/40"
              onClick={() => navigate("/admin/candidates")}
            >
              <p className="font-medium">{row.fullName}</p>
              <p className="text-xs text-muted-foreground">{row.positionApplied || "-"} | {row.status}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecruiterDashboard;
