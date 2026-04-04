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
        "relative overflow-hidden rounded-[28px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.82))] p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,14,28,0.96),rgba(15,20,37,0.94))]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.10),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.08),transparent_34%)]" />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Candidate Pipeline</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A clear, step-by-step view of the hiring journey.</p>
        </div>
        <div className="w-fit rounded-full border border-primary/15 bg-[linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))] px-3 py-1 text-xs font-semibold text-primary shadow-soft dark:border-primary/25 dark:bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(56,189,248,0.12))]">
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
                      state === "done" && "border-primary/20 bg-[linear-gradient(135deg,#6366F1_0%,#8B5CF6_100%)] text-white shadow-[0_16px_34px_rgba(99,102,241,0.32)]",
                      state === "active" && "border-primary/30 bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(56,189,248,0.12))] text-primary shadow-[0_12px_28px_rgba(99,102,241,0.18)] dark:shadow-[0_16px_32px_rgba(79,70,229,0.28)]",
                      state === "upcoming" && "border-border bg-slate-50/90 text-slate-400 dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-500"
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
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{step.title}</p>
                    {step.description ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{step.description}</p> : null}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 ? (
                <div className="mt-6 h-px w-12 rounded-full bg-border dark:bg-white/10">
                  <div className={cn("h-full rounded-full", index + 1 < currentStep ? "bg-[linear-gradient(90deg,#6366F1_0%,#8B5CF6_100%)]" : "bg-border dark:bg-white/10")} />
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
