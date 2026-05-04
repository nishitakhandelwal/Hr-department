import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, CircleDashed, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PipelineStep = {
  key: string;
  title: string;
  description?: string;
};

interface PipelineStageBoardProps {
  currentStep: number;
  steps: PipelineStep[];
  className?: string;
}

const PipelineStageBoard: React.FC<PipelineStageBoardProps> = ({ currentStep, steps, className }) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-[var(--portal-surface-border)] bg-[linear-gradient(180deg,var(--portal-surface-bg-strong),var(--portal-subtle-surface))] p-6 shadow-[var(--shadow-card)] backdrop-blur-xl dark:bg-[linear-gradient(180deg,#121212,#191919)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--portal-primary-rgb),0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(var(--portal-primary-rgb),0.08),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(230,199,163,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.03),transparent_30%)]" />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--portal-heading-color)] dark:text-white">Candidate Pipeline</p>
          <p className="mt-1 text-sm text-[var(--portal-muted-color)]">A clear, step-by-step view of the hiring journey.</p>
        </div>
        <div className="w-fit rounded-full border border-[rgba(var(--portal-primary-rgb),0.24)] bg-[rgba(var(--portal-primary-rgb),0.12)] px-3 py-1 text-xs font-semibold text-[var(--portal-primary-text)] shadow-soft dark:border-[rgba(230,199,163,0.18)] dark:bg-[rgba(230,199,163,0.08)] dark:text-[#E6C7A3]">
          Step {Math.min(currentStep, steps.length)} of {steps.length}
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-start gap-0">
        {steps.map((step, index) => {
          const state = index + 1 < currentStep ? "done" : index + 1 === currentStep ? "active" : "upcoming";
          return (
            <React.Fragment key={step.key}>
              <div className="w-[216px]">
                <div className="flex items-start gap-3">
                  <motion.div
                    whileHover={{ y: -3, scale: 1.03 }}
                    transition={{ duration: 0.22 }}
                    className={cn(
                      "mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200",
                      state === "done" && "border-[#D6B58C] bg-[linear-gradient(135deg,#C6925C_0%,#EAC79B_100%)] text-[#2E2115] shadow-[0_16px_34px_rgba(166,124,82,0.18)]",
                      state === "active" && "border-[#D6B58C] bg-[#F6EBDD] text-[#8A5A2F] shadow-[0_12px_28px_rgba(166,124,82,0.12)]",
                      state === "upcoming" && "border-[var(--portal-surface-border)] bg-[var(--portal-surface-bg-strong)] text-[var(--portal-muted-color)] dark:bg-[#202020] dark:text-[#9CA3AF]"
                    )}
                  >
                    {state === "done" ? (
                      <CheckCircle2 className="h-5 w-5 [stroke-width:2.5]" />
                    ) : state === "active" ? (
                      <Clock3 className="h-5 w-5 [stroke-width:2.5]" />
                    ) : (
                      <CircleDashed className="h-5 w-5 [stroke-width:2.4]" />
                    )}
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--portal-heading-color)] dark:text-white">{step.title}</p>
                    {step.description ? <p className="mt-1 text-xs leading-5 text-[var(--portal-muted-color)]">{step.description}</p> : null}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 ? (
                <div className="mt-6 h-px w-12 rounded-full bg-[var(--portal-surface-border)] dark:bg-[rgba(255,255,255,0.08)]">
                  <div className={cn("h-full rounded-full", index + 1 < currentStep ? "bg-[linear-gradient(135deg,#C6925C_0%,#EAC79B_100%)]" : "bg-[var(--portal-surface-border)] dark:bg-[rgba(255,255,255,0.08)]")} />
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default PipelineStageBoard;
