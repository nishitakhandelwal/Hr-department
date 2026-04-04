import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck2, ClipboardCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CandidateRecord } from "@/services/api";
import PipelineStageBoard from "@/components/candidate/PipelineStageBoard";
import CandidateStatusBadge from "@/components/candidate/StatusBadge";

const HrDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<CandidateRecord[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiService.list<CandidateRecord>("candidates");
        setRows(data);
      } catch (error) {
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to load HR dashboard", variant: "destructive" });
      }
    })();
  }, []);

  const underReview = useMemo(() => rows.filter((r) => r.status === "Under Review").length, [rows]);
  const interviewScheduled = useMemo(() => rows.filter((r) => r.status === "Interview Scheduled").length, [rows]);
  const completedProfiles = useMemo(() => rows.filter((r) => (r.stageCompleted || 0) >= 2).length, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="HR Manager Dashboard" subtitle="Track candidate progression and complete pending reviews." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Candidates Under Review" value={underReview} change="Live" changeType="neutral" icon={Users} color="info" />
        <StatCard title="Interviews Scheduled" value={interviewScheduled} change="Live" changeType="positive" icon={CalendarCheck2} color="primary" />
        <StatCard title="Profiles Completed" value={completedProfiles} change={`${rows.length} total applications`} changeType="neutral" icon={ClipboardCheck} color="warning" />
      </div>

      <PipelineStageBoard
        currentStep={3}
        steps={[
          { key: "submitted", title: "Application Submitted", description: `${rows.filter((r) => (r.stageCompleted || 0) < 1).length}` },
          { key: "profile", title: "Profile Completed", description: `${rows.filter((r) => (r.stageCompleted || 0) === 1).length}` },
          { key: "review", title: "HR Review", description: `${underReview}` },
          { key: "interview", title: "Interview", description: `${interviewScheduled}` },
          { key: "offer", title: "Offer", description: `${rows.filter((r) => r.status === "Offered" || r.status === "Accepted").length}` },
        ]}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold">Recent Candidates</h3>
          <button className="text-xs font-medium text-primary hover:underline" onClick={() => navigate("/admin/candidates")}>
            Open candidate management
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Position</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row) => (
                <tr
                  key={row._id}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30"
                  onClick={() => navigate("/admin/candidates")}
                >
                  <td className="px-4 py-3 font-medium">{row.fullName}</td>
                  <td className="px-4 py-3">{row.positionApplied || "-"}</td>
                  <td className="px-4 py-3">Stage {Math.max(1, Number(row.stageCompleted || 0) + 1)}</td>
                  <td className="px-4 py-3">
                    <CandidateStatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HrDashboard;
