import React, { useMemo } from "react";
import { Briefcase, CheckCircle2, FileText, LifeBuoy, Sparkles, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import InlineStatusMessage from "@/components/InlineStatusMessage";
import { Button } from "@/components/ui/button";
import { useCandidatePortal } from "@/context/CandidatePortalContext";
import { useAuth } from "@/context/AuthContext";
import { useSystemSettings } from "@/context/SystemSettingsContext";

type DashboardAction = {
  title: string;
  description: string;
  link: string;
  icon: typeof Briefcase;
};

const CandidateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { candidate, notifications, loading, error } = useCandidatePortal();
  const { publicSettings } = useSystemSettings();

  const displayName = candidate?.fullName || user?.name || "Candidate";
  const supportEmail = publicSettings?.company?.contactEmail?.trim() || "Not configured";
  const stage1Submitted = Boolean(candidate?.stage1?.submittedAt);
  const stage2Submitted = Boolean(candidate?.stage2SubmittedAt);
  const canApply = !stage1Submitted;

  const profileCompletion = useMemo(() => {
    if (!candidate) return 0;
    if (stage2Submitted) return 100;
    if (stage1Submitted) return 70;
    return 30;
  }, [candidate, stage1Submitted, stage2Submitted]);

  const currentStatus = candidate?.status || "Application started";

  const nextStep = useMemo(() => {
    if (!candidate) return "Start your application";
    if (!stage1Submitted) return "Submit Stage 1";
    if (!stage2Submitted) return "Complete Stage 2";
    return "Wait for HR review";
  }, [candidate, stage1Submitted, stage2Submitted]);

  const upcomingActions = useMemo<DashboardAction[]>(() => {
    if (!candidate) {
      return [
        {
          title: "Submit your application",
          description: "Start by completing Stage 1 to begin your profile.",
          link: "/apply",
          icon: Briefcase,
        },
      ];
    }

    const actions: DashboardAction[] = [];

    if (!stage1Submitted) {
      actions.push({
        title: "Submit Stage 1",
        description: "Complete the basic candidate application form.",
        link: "/apply",
        icon: FileText,
      });
    } else if (!stage2Submitted) {
      actions.push({
        title: "Complete Stage 2",
        description: "Finish your detailed candidate profile for HR evaluation.",
        link: "/candidate/stage2",
        icon: Sparkles,
      });
    }

    if (!candidate.videoIntroduction?.url) {
      actions.push({
        title: "Add video introduction",
        description: "Record or upload a short introduction video for HR.",
        link: "/candidate/profile",
        icon: Video,
      });
    }

    if ((candidate.documents?.uploadedFiles?.length || 0) === 0) {
      actions.push({
        title: "Upload documents",
        description: "Add your resume and certificates to keep your profile complete.",
        link: "/candidate/documents",
        icon: FileText,
      });
    }

    if (candidate.interviewSchedule?.date) {
      actions.push({
        title: "Prepare for interview",
        description: `Interview scheduled for ${candidate.interviewSchedule.date}. Review your notifications.`,
        link: "/candidate/notifications",
        icon: CheckCircle2,
      });
    }

    if (actions.length === 0) {
      actions.push({
        title: "No immediate actions",
        description: "Your application is up to date. You can review your profile or notifications anytime.",
        link: "/candidate/profile",
        icon: CheckCircle2,
      });
    }

    return actions;
  }, [candidate, stage1Submitted, stage2Submitted]);

  const primaryAction = canApply
    ? {
        label: "Apply Now",
        onClick: () => navigate("/apply"),
        icon: Briefcase,
      }
    : stage2Submitted
      ? {
          label: "View Profile",
          onClick: () => navigate("/candidate/profile"),
          icon: CheckCircle2,
        }
      : {
          label: "Continue Stage 2",
          onClick: () => navigate("/candidate/stage2"),
          icon: Sparkles,
        };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[rgba(var(--portal-primary-rgb),0.18)] border-t-[var(--portal-primary-solid)]" />
      </div>
    );
  }

  const PrimaryActionIcon = primaryAction.icon;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={`Welcome, ${displayName}`}
        subtitle={canApply ? "Start your application and keep your candidate profile moving forward." : "Your candidate dashboard is active. Review your progress and next steps here."}
        action={(
          <Button className="gap-2" onClick={primaryAction.onClick}>
            <PrimaryActionIcon className="h-4 w-4 [stroke-width:2.35]" />
            {primaryAction.label}
          </Button>
        )}
      />

      {error ? <InlineStatusMessage type="error" message={error} className="page-shell" /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <div className="space-y-6">
          <section className="page-shell">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="portal-kicker">Candidate Overview</div>
                <h2 className="portal-heading mt-5 text-3xl font-cursive font-normal leading-tight tracking-normal sm:text-5xl">
                  {canApply ? "Your application journey starts here." : "Everything you need is organized in one calm workspace."}
                </h2>
                <p className="portal-copy mt-4 max-w-2xl text-sm leading-7 sm:text-base">
                  Track your application status, profile readiness, HR review progress, and the next best action without opening multiple pages.
                </p>
              </div>

              <div className="dashboard-subtle-card max-w-sm flex-1">
                <div className="flex items-center gap-4">
                  <div className="portal-accent-icon flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="dashboard-label">Application Summary</p>
                    <p className="portal-heading mt-2 text-3xl font-semibold premium-number">{profileCompletion}%</p>
                    <p className="portal-muted mt-2 text-sm">{nextStep}</p>
                  </div>
                </div>
                <div className="portal-progress-track mt-5 h-2.5 rounded-full">
                  <div className="portal-progress-fill h-full rounded-full transition-all duration-500" style={{ width: `${profileCompletion}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="dashboard-subtle-card">
                <p className="dashboard-label">Current Status</p>
                <p className="portal-heading mt-3 text-xl font-semibold">{currentStatus}</p>
                <p className="portal-muted mt-2 text-sm">{stage1Submitted ? "Your initial application has been captured." : "Your application is not submitted yet."}</p>
              </div>
              <div className="dashboard-subtle-card">
                <p className="dashboard-label">Next Step</p>
                <p className="portal-heading mt-3 text-xl font-semibold">{nextStep}</p>
                <p className="portal-muted mt-2 text-sm">{stage2Submitted ? "Your file is waiting for HR evaluation." : "Complete the next milestone to keep the process moving."}</p>
              </div>
              <div className="dashboard-subtle-card">
                <p className="dashboard-label">Portal Readiness</p>
                <p className="portal-heading mt-3 text-xl font-semibold">{stage1Submitted ? "Stage 1 locked" : "Ready to apply"}</p>
                <p className="portal-muted mt-2 text-sm">
                  {stage1Submitted ? "Once the form is submitted, the Stage 1 application form will not reopen." : "You can still submit your first-stage application."}
                </p>
              </div>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="portal-heading text-2xl font-semibold">Upcoming actions</h2>
                <p className="portal-copy mt-2 text-sm leading-6">The most relevant actions are surfaced here so you always know what to do next.</p>
              </div>
              <div className="portal-kicker">{upcomingActions.length} active</div>
            </div>

            <div className="mt-5 space-y-4">
              {upcomingActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <div key={action.title} className="dashboard-subtle-card">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="portal-accent-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                          <ActionIcon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="portal-heading text-base font-semibold">{action.title}</p>
                          <p className="portal-copy mt-1 text-sm leading-6">{action.description}</p>
                        </div>
                      </div>
                      <Button size="sm" variant={action.link === "/candidate/profile" ? "outline" : "default"} onClick={() => navigate(action.link)}>
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="dashboard-panel">
            <h2 className="portal-heading text-2xl font-semibold">Quick stats</h2>
            <div className="mt-5 grid gap-4">
              <div className="dashboard-subtle-card">
                <p className="dashboard-label">Notifications</p>
                <p className="portal-heading mt-3 text-3xl font-semibold premium-number">{notifications.length}</p>
              </div>
              <div className="dashboard-subtle-card">
                <p className="dashboard-label">Stage 1 Submitted</p>
                <p className="portal-heading mt-3 text-2xl font-semibold">{stage1Submitted ? "Yes" : "No"}</p>
              </div>
              <div className="dashboard-subtle-card">
                <p className="dashboard-label">Stage 2 Submitted</p>
                <p className="portal-heading mt-3 text-2xl font-semibold">{stage2Submitted ? "Yes" : "No"}</p>
              </div>
              <div className="dashboard-subtle-card">
                <p className="dashboard-label">Video Introduction</p>
                <p className="portal-heading mt-3 text-2xl font-semibold">{candidate?.videoIntroduction?.url ? "Uploaded" : "Pending"}</p>
              </div>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="flex items-start gap-4">
              <div className="portal-accent-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                <LifeBuoy className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="portal-heading text-2xl font-semibold">Support</h2>
                <p className="portal-copy mt-2 text-sm leading-6">If you need help with your application, contact HR on the official support email below.</p>
                <p className="mt-4 text-base font-semibold text-[var(--portal-primary-solid)] dark:text-[var(--portal-primary-dark)]">{supportEmail}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CandidateDashboard;
