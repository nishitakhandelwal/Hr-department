import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import CandidateStatusBadge from "@/components/candidate/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCandidatePortal } from "@/context/CandidatePortalContext";
import { getCandidateApplicationMeta } from "@/lib/candidatePortal";

const CandidateApplications: React.FC = () => {
  const navigate = useNavigate();
  const { candidate, joiningForm, loading, error } = useCandidatePortal();
  const meta = useMemo(() => getCandidateApplicationMeta(candidate, joiningForm), [candidate, joiningForm]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;

  if (!candidate) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job Applications" subtitle="Track every role you've applied for through Arihant Dream Infra Project Limited." />
        {error ? <Card><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card> : null}
        <Card><CardContent className="pt-6"><Button onClick={() => navigate("/apply")}>Apply Now</Button></CardContent></Card>
      </div>
    );
  }

  const rows = [{
    jobTitle: candidate.positionApplied || "General Application",
    appliedDate: candidate.submittedAt ? new Date(candidate.submittedAt).toLocaleDateString() : "-",
    stage: meta.currentStage,
    status: candidate.status,
    nextStep: meta.nextStep,
    updatedAt: candidate.lastUpdatedAt ? new Date(candidate.lastUpdatedAt).toLocaleString() : "-",
  }];

  return (
    <div className="space-y-6">
      <PageHeader title="Job Applications" subtitle="A clean view of your submitted applications and their current status." />
      <DataTable
        columns={[
          { key: "jobTitle", label: "Job Title" },
          { key: "appliedDate", label: "Applied Date" },
          { key: "stage", label: "Current Stage" },
          { key: "status", label: "Status", render: (item) => <CandidateStatusBadge status={item.status as typeof candidate.status} /> },
          { key: "nextStep", label: "Next Step" },
          { key: "updatedAt", label: "Last Updated" },
        ]}
        data={rows}
      />
    </div>
  );
};

export default CandidateApplications;
