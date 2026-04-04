import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import CandidateStatusBadge from "@/components/candidate/StatusBadge";
import ProgressTracker from "@/components/candidate/ProgressTracker";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCandidatePortal } from "@/context/CandidatePortalContext";
import { getCandidateApplicationMeta } from "@/lib/candidatePortal";

const CandidateStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const { candidate, joiningForm, loading, error } = useCandidatePortal();
  const meta = useMemo(() => getCandidateApplicationMeta(candidate, joiningForm), [candidate, joiningForm]);
  const timeline = useMemo(() => (candidate?.activityTimeline ? [...candidate.activityTimeline].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()) : []), [candidate]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;
  if (!candidate) return <div className="space-y-6"><PageHeader title="Application Status" />{error ? <Card><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card> : null}<Card><CardContent className="pt-6"><Button onClick={() => navigate("/apply")}>Complete Stage 1</Button></CardContent></Card></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Application Status" subtitle="Follow every stage of your application, interview, internship, and joining workflow." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Progress Tracker</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/80 p-4"><p className="text-xs uppercase text-muted-foreground">Status</p><div className="mt-2"><CandidateStatusBadge status={candidate.status} /></div></div>
              <div className="rounded-xl border border-border/80 p-4"><p className="text-xs uppercase text-muted-foreground">Current Stage</p><p className="mt-2 font-medium">{meta.currentStage}</p></div>
              <div className="rounded-xl border border-border/80 p-4"><p className="text-xs uppercase text-muted-foreground">Next Step</p><p className="mt-2 font-medium">{meta.nextStep}</p></div>
            </div>
            <ProgressTracker candidate={candidate} joiningForm={joiningForm} currentStatus={candidate.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Interview Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {candidate.interviewSchedule?.date ? (
              <>
                <div><p className="text-xs uppercase text-muted-foreground">Date</p><p className="font-medium">{new Date(candidate.interviewSchedule.date).toLocaleDateString()}</p></div>
                <div><p className="text-xs uppercase text-muted-foreground">Time</p><p className="font-medium">{candidate.interviewSchedule.time || "-"}</p></div>
                <div><p className="text-xs uppercase text-muted-foreground">Mode</p><p className="font-medium">{candidate.interviewSchedule.mode || "Online"}</p></div>
                <div><p className="text-xs uppercase text-muted-foreground">Meeting Link</p>{candidate.interviewSchedule.meetingLink ? <a href={candidate.interviewSchedule.meetingLink} target="_blank" rel="noreferrer" className="text-primary underline">Open meeting link</a> : <p className="font-medium">Awaiting link</p>}</div>
              </>
            ) : (
              <p className="text-muted-foreground">No interview has been scheduled yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Internship & Joining</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Internship:</span> {candidate.internship?.status || "Not assigned"}</div>
            {candidate.internship?.startDate ? <div><span className="text-muted-foreground">Internship Period:</span> {new Date(candidate.internship.startDate).toLocaleDateString()} - {candidate.internship.endDate ? new Date(candidate.internship.endDate).toLocaleDateString() : "-"}</div> : null}
            <div><span className="text-muted-foreground">Joining Form:</span> {joiningForm?.status || candidate.joiningForm?.status || "Locked"}</div>
            <div><span className="text-muted-foreground">Joining Access:</span> {candidate.joiningForm?.isUnlocked ? "Unlocked" : "Locked"}</div>
            {candidate.joiningForm?.isUnlocked ? <Button onClick={() => navigate("/candidate/joining-form")}>Open Joining Form</Button> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Application Timeline</CardTitle></CardHeader>
          <CardContent>
            {timeline.length === 0 ? <p className="text-sm text-muted-foreground">No timeline activity yet.</p> : (
              <div className="space-y-3">
                {timeline.map((item) => (
                  <div key={`${item.key}-${item.at}`} className="rounded-xl border border-border/80 p-3">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">{new Date(item.at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CandidateStatusPage;
