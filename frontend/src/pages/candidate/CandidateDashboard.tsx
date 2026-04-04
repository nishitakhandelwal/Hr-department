import React, { useMemo } from "react";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { ArrowRight, Bell, CalendarClock, CheckCircle2, FileText, FolderOpen, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import PortalProfileCard from "@/components/dashboard/PortalProfileCard";
import CircularStatsWidget from "@/components/dashboard/CircularStatsWidget";
import TaskProgressList from "@/components/dashboard/TaskProgressList";
import PortalCalendarCard, { type PortalCalendarEvent } from "@/components/dashboard/PortalCalendarCard";
import InlineStatusMessage from "@/components/InlineStatusMessage";
import { Button } from "@/components/ui/button";
import { useCandidatePortal } from "@/context/CandidatePortalContext";
import {
  getCandidateApplicationMeta,
  getCandidatePortalStep,
  getCandidatePortalStepLabel,
  getCandidateProfileCompletion,
} from "@/lib/candidatePortal";

const CandidateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { candidate, joiningForm, notifications, loading, error } = useCandidatePortal();

  const applicationMeta = useMemo(() => getCandidateApplicationMeta(candidate, joiningForm), [candidate, joiningForm]);
  const profileCompletion = useMemo(() => getCandidateProfileCompletion(candidate, joiningForm), [candidate, joiningForm]);
  const portalStep = useMemo(() => getCandidatePortalStep(candidate, joiningForm), [candidate, joiningForm]);
  const uploadedFiles = candidate?.documents?.uploadedFiles || [];
  const today = useMemo(() => startOfDay(new Date()), []);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;
  }

  if (!candidate) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Dashboard" subtitle="Track your hiring journey and complete your profile in one place." />
        <div className="dashboard-panel">
          <p className="text-lg font-semibold text-[#24190f]">Stage 1 application not submitted yet</p>
          <p className="mt-2 text-sm text-[#6f5a43]">Complete your Stage 1 application to unlock the full premium candidate portal experience.</p>
          {error ? <div className="mt-4"><InlineStatusMessage type="error" message={`Unable to load your application. ${error}`} /></div> : null}
          <Button className="mt-5 rounded-[18px]" onClick={() => navigate("/apply")}>Complete Stage 1</Button>
        </div>
      </div>
    );
  }

  const calendarEvents: PortalCalendarEvent[] = [];

  if (candidate.interviewSchedule?.date) {
    calendarEvents.push({
      id: "interview",
      title: "Interview schedule",
      date: format(parseISO(candidate.interviewSchedule.date), "yyyy-MM-dd"),
      type: "meeting",
      time: candidate.interviewSchedule.time || undefined,
      note: candidate.interviewSchedule.meetingLink ? "Meeting link has been shared in your application timeline." : "Interview details will continue to update here.",
    });
  }

  if ((candidate.stageCompleted || 0) < 1) {
    calendarEvents.push({
      id: "stage-1",
      title: "Complete Stage 1",
      date: format(addDays(today, 2), "yyyy-MM-dd"),
      type: "reminder",
      note: "Finish your first application step to unlock the rest of the portal.",
    });
  }

  if ((candidate.stageCompleted || 0) === 1 && !candidate.stage2SubmittedAt) {
    calendarEvents.push({
      id: "stage-2",
      title: "Complete Stage 2 profile",
      date: format(addDays(today, 3), "yyyy-MM-dd"),
      type: "reminder",
      note: "Add deeper profile details and supporting information for the review team.",
    });
  }

  calendarEvents.push({
    id: "documents",
    title: "Document readiness check",
    date: format(addDays(today, 5), "yyyy-MM-dd"),
    type: "meeting",
    time: "02:00 PM",
    note: uploadedFiles.length ? "Your uploaded files are already visible in the portal." : "Prepare and upload key documents to strengthen readiness.",
  });

  calendarEvents.push({
    id: "portal-update",
    title: "Application status refresh",
    date: format(addDays(today, 7), "yyyy-MM-dd"),
    type: "birthday",
    note: "The candidate portal keeps the next milestone visible as soon as it changes.",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${candidate.fullName}`}
        subtitle="A premium candidate dashboard that keeps your progress, next steps, and interview readiness calm, clear, and beautifully organized."
        action={
          <div className="flex gap-2">
            {(candidate.stageCompleted || 0) < 1 ? <Button onClick={() => navigate("/apply")} className="gap-2 rounded-[18px]">Complete Stage 1 <ArrowRight className="h-4 w-4" /></Button> : null}
            {(candidate.stageCompleted || 0) === 1 && !candidate.stage2SubmittedAt ? <Button onClick={() => navigate("/candidate/stage2")} className="gap-2 rounded-[18px]">Complete Stage 2 <ArrowRight className="h-4 w-4" /></Button> : null}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <div className="dashboard-panel relative overflow-hidden p-7">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(205,178,123,0.24),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute left-0 bottom-0 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(255,248,235,0.95),transparent_68%)] blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-[#e0cfb3] bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9a7747]">
              Candidate Journey
            </div>
            <h2 className="mt-4 max-w-3xl text-[34px] font-semibold leading-tight tracking-[-0.04em] text-[#24190f]">
              A polished application space that makes every next step feel guided and achievable.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f5a43]">
              From profile completion to interviews and document readiness, the candidate experience stays supportive, elegant, and product-grade.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { label: "Current stage", value: applicationMeta.currentStage, note: applicationMeta.nextStep, icon: CheckCircle2 },
                { label: "Completion", value: `${profileCompletion}%`, note: "Profile and document readiness score.", icon: FileText },
                { label: "Unread alerts", value: `${notifications.filter((item) => !item.read).length}`, note: "Fresh status changes and portal updates.", icon: Bell },
              ].map((item) => (
                <div key={item.label} className="dashboard-subtle-card">
                  <div className="flex items-center justify-between gap-3">
                    <p className="dashboard-label">{item.label}</p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#1f2638] text-[#f3dcc0]">
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-[28px] font-semibold leading-none text-[#24190f]">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-[#7a664e]">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <PortalProfileCard
          name={candidate.fullName}
          roleLabel="Candidate Portal"
          subtitle="This portal is designed to make your hiring path feel transparent and supportive, with every document, stage, and update presented in one cohesive system."
          meta={[
            { label: "Portal step", value: getCandidatePortalStepLabel(portalStep), icon: CalendarClock },
            { label: "Uploaded files", value: `${uploadedFiles.length} documents`, icon: FolderOpen },
            { label: "Profile access", value: "Open candidate profile", icon: UserCircle2 },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Current Status" value={candidate.status} change={applicationMeta.currentStage} changeType="neutral" icon={CheckCircle2} color="primary" />
        <StatCard title="Current Step" value={getCandidatePortalStepLabel(portalStep)} change={applicationMeta.nextStep} changeType="neutral" icon={CalendarClock} color="warning" />
        <StatCard title="Profile Completion" value={`${profileCompletion}%`} change="Profile and document readiness" changeType="positive" icon={FileText} color="success" onClick={() => navigate("/candidate/profile")} />
        <StatCard title="Notifications" value={notifications.length} change={`${notifications.filter((item) => !item.read).length} unread`} changeType="neutral" icon={Bell} color="info" onClick={() => navigate("/candidate/notifications")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CircularStatsWidget
          label="Application Readiness"
          value={profileCompletion}
          subtitle="A clean readiness score that tells you how close your profile is to feeling complete and review-ready."
          breakdown={[
            { label: "Current stage", value: applicationMeta.currentStage },
            { label: "Unread alerts", value: `${notifications.filter((item) => !item.read).length}` },
            { label: "Files uploaded", value: `${uploadedFiles.length}` },
          ]}
        />

        <TaskProgressList
          title="Candidate To-Do Flow"
          subtitle="A premium checklist view focused on the few actions that actually move your application forward."
          tasks={[
            {
              title: "Profile completion",
              description: "Complete every essential candidate field and keep your profile polished.",
              progress: profileCompletion,
              icon: FileText,
            },
            {
              title: "Document readiness",
              description: "Keep supporting files uploaded and available for recruiter review.",
              progress: Math.min(100, uploadedFiles.length * 25),
              icon: FolderOpen,
            },
            {
              title: "Interview preparation",
              description: candidate.interviewSchedule?.date ? "Your interview has been scheduled, so preparation should now feel focused." : "No interview yet, but you can still keep your materials ready.",
              progress: candidate.interviewSchedule?.date ? 84 : 36,
              icon: CalendarClock,
            },
          ]}
        />
      </div>

      <PortalCalendarCard
        title="Candidate Calendar"
        subtitle="Your next milestones, document checkpoints, and interview moments live in the same calm calendar system used across the entire HR product."
        events={calendarEvents}
      />

      {error ? <InlineStatusMessage type="error" message={error} /> : null}
    </div>
  );
};

export default CandidateDashboard;
