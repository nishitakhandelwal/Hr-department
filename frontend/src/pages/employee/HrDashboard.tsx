import React from "react";
import { ArrowRight, BriefcaseBusiness, CalendarCheck2, ClipboardCheck, Hourglass, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import CircularStatsWidget from "@/components/dashboard/CircularStatsWidget";
import PortalCalendarCard, { type PortalCalendarEvent } from "@/components/dashboard/PortalCalendarCard";
import PortalDashboardSkeleton from "@/components/dashboard/PortalDashboardSkeleton";
import { PortalDataTable, type PortalTableColumn } from "@/components/dashboard/PortalDataTable";
import PortalHeroPanel from "@/components/dashboard/PortalHeroPanel";
import PortalProfileCard from "@/components/dashboard/PortalProfileCard";
import TaskProgressList from "@/components/dashboard/TaskProgressList";
import CandidateStatusBadge from "@/components/candidate/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CandidateRecord } from "@/services/api";

const HrDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<CandidateRecord[]>([]);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await apiService.list<CandidateRecord>("candidates");
        React.startTransition(() => setRows(data));
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load HR dashboard",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const underReview = React.useMemo(() => rows.filter((row) => row.status === "Under Review" || row.status === "HR Review").length, [rows]);
  const interviewScheduled = React.useMemo(() => rows.filter((row) => row.status === "Interview Scheduled" || row.status === "Interview").length, [rows]);
  const completedProfiles = React.useMemo(() => rows.filter((row) => Boolean(row.stage1?.submittedAt) && Boolean(row.stage2SubmittedAt)).length, [rows]);
  const offersInFlight = React.useMemo(() => rows.filter((row) => row.status === "Offered" || row.status === "Accepted").length, [rows]);
  const profileCompletionScore = rows.length === 0 ? 0 : Math.round((completedProfiles / rows.length) * 100);

  const calendarEvents = React.useMemo<PortalCalendarEvent[]>(
    () =>
      rows
        .filter((row) => row.interviewSchedule?.date)
        .slice(0, 8)
        .map((row) => ({
          id: row._id,
          title: row.fullName,
          date: row.interviewSchedule?.date || "",
          type: "meeting",
          time: row.interviewSchedule?.time,
          note: row.positionApplied ? `Interview for ${row.positionApplied}` : "Candidate interview scheduled.",
        })),
    [rows]
  );

  const candidateColumns = React.useMemo<PortalTableColumn<CandidateRecord>[]>(
    () => [
      {
        key: "candidate",
        header: "Candidate",
        render: (row) => (
          <div>
            <p className="portal-heading font-semibold">{row.fullName}</p>
            <p className="portal-muted mt-1 text-xs">{row.email}</p>
          </div>
        ),
      },
      {
        key: "role",
        header: "Role",
        render: (row) => (
          <div>
            <p className="portal-heading text-sm font-medium">{row.positionApplied || "Role pending"}</p>
            <p className="portal-muted mt-1 text-xs">Stage {(row.stage2SubmittedAt ? 2 : row.stage1?.submittedAt ? 1 : 0) + 1}</p>
          </div>
        ),
      },
      {
        key: "interview",
        header: "Interview",
        render: (row) => (
          <div>
            <p className="portal-heading text-sm font-medium">{row.interviewSchedule?.date || "Not scheduled"}</p>
            <p className="portal-muted mt-1 text-xs">{row.interviewSchedule?.time || "Awaiting coordination"}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        className: "text-right",
        render: (row) => <div className="flex justify-end"><CandidateStatusBadge status={row.status} /></div>,
      },
    ],
    []
  );

  if (loading && rows.length === 0) {
    return <PortalDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Manager Dashboard"
        subtitle="A premium recruiting command center for candidate flow, interview readiness, and decision-making across the HR pipeline."
        action={(
          <Button variant="outline" className="gap-2 rounded-[18px]" onClick={() => navigate("/admin/candidates")}>
            Open Candidate Hub
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <PortalHeroPanel
          eyebrow="Talent Operations"
          title="Move candidates through review with clarity, pace, and less dashboard friction."
          description="This HR workspace keeps the recruitment pipeline visible from profile completion through interviews and offers, while staying polished enough for everyday operational use."
          highlights={[
            {
              label: "Active reviews",
              value: String(underReview),
              note: "Candidates currently sitting in HR evaluation or review status.",
              icon: ClipboardCheck,
            },
            {
              label: "Interviews booked",
              value: String(interviewScheduled),
              note: "Scheduled conversations across the current candidate pipeline.",
              icon: CalendarCheck2,
            },
            {
              label: "Offers in motion",
              value: String(offersInFlight),
              note: "Accepted or offered candidates moving toward onboarding.",
              icon: BriefcaseBusiness,
            },
          ]}
        />

        <PortalProfileCard
          name={user?.name || "HR Manager"}
          roleLabel="HR Portal"
          subtitle="Keep the hiring engine aligned, spot blockers earlier, and move promising candidates through each stage without losing the premium experience."
          imageUrl={user?.profileImage || user?.profilePhotoUrl || ""}
          meta={[
            { label: "Candidate pool", value: `${rows.length} applications`, icon: Users },
            { label: "Review queue", value: `${underReview} pending evaluations`, icon: Hourglass },
            { label: "Interviews", value: `${interviewScheduled} scheduled`, icon: CalendarCheck2 },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Candidates Under Review" value={underReview} change="Needs structured review" changeType="neutral" icon={Users} color="info" delay={0} onClick={() => navigate("/admin/candidates")} />
        <StatCard title="Interviews Scheduled" value={interviewScheduled} change="Live coordination" changeType="positive" icon={CalendarCheck2} color="primary" delay={1} onClick={() => navigate("/admin/candidates")} />
        <StatCard title="Profiles Completed" value={completedProfiles} change={`${rows.length} total applications`} changeType="neutral" icon={ClipboardCheck} color="warning" delay={2} onClick={() => navigate("/admin/candidates")} />
        <StatCard title="Offers In Flight" value={offersInFlight} change="Pipeline near close" changeType="positive" icon={BriefcaseBusiness} color="success" delay={3} onClick={() => navigate("/admin/candidates")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CircularStatsWidget
          label="Profile Readiness"
          value={profileCompletionScore}
          subtitle="A quick signal showing how much of the current hiring pipeline is actually ready for deeper HR handling."
          breakdown={[
            { label: "Completed profiles", value: `${completedProfiles}` },
            { label: "Under review", value: `${underReview}` },
            { label: "Interviews scheduled", value: `${interviewScheduled}` },
          ]}
        />

        <TaskProgressList
          title="HR Action Stack"
          subtitle="A focused view of what needs movement next inside the talent funnel."
          tasks={[
            {
              title: "Clear review backlog",
              description: `${underReview} profile(s) still need structured HR review and decisions.`,
              progress: Math.max(18, 100 - underReview * 12),
              icon: ClipboardCheck,
            },
            {
              title: "Interview coordination",
              description: `${interviewScheduled} interview slot(s) are already booked and visible here.`,
              progress: Math.min(100, interviewScheduled * 18),
              icon: CalendarCheck2,
            },
            {
              title: "Offer conversion",
              description: `${offersInFlight} candidate(s) are in offer-ready or accepted territory.`,
              progress: Math.min(100, offersInFlight * 24),
              icon: BriefcaseBusiness,
            },
          ]}
        />
      </div>

      <PortalDataTable
        title="Candidate Pipeline"
        subtitle="A dynamic, pagination-ready table for recent candidates, interview planning, and fast status checks."
        columns={candidateColumns}
        rows={rows}
        loading={loading}
        pageSize={6}
        emptyTitle="No candidates available"
        emptyDescription="Candidate applications will appear here as soon as the recruitment pipeline starts receiving submissions."
        getRowKey={(row) => row._id}
        onRowClick={() => navigate("/admin/candidates")}
      />

      <PortalCalendarCard
        title="Interview Calendar"
        subtitle="Upcoming interview slots appear directly in the HR dashboard so schedules remain visible without switching context."
        events={calendarEvents}
      />
    </div>
  );
};

export default HrDashboard;
