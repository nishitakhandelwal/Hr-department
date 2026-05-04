import React from "react";
import { FileCheck2 } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";

const CandidateJoiningForm: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Joining Form"
        subtitle="Your joining form workspace will appear here once HR unlocks it for your profile."
      />

      <section className="rounded-3xl border border-[var(--portal-surface-border)] bg-[linear-gradient(180deg,var(--portal-surface-bg-strong),var(--portal-surface-bg))] p-8 shadow-[0_22px_55px_rgba(15,23,42,0.08)] dark:bg-[#0f0f0f] dark:shadow-[0_22px_55px_rgba(0,0,0,0.35)]">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(var(--portal-primary-rgb),0.12)] text-[var(--portal-primary-solid)]">
            <FileCheck2 className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-[var(--portal-heading-color)] dark:text-white">
            Joining form access is controlled by HR
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--portal-muted-color)]">
            If your onboarding has started, HR will unlock the form and the full submission experience will appear on this page automatically.
          </p>
        </div>
      </section>
    </div>
  );
};

export default CandidateJoiningForm;
