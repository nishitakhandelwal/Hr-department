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
        "relative overflow-hidden rounded-[28px] border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#2A211B)] p-6 shadow-card backdrop-blur-xl",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(230,199,163,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(166,124,82,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(230,199,163,0.22),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(166,124,82,0.12),transparent_34%)]" />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#F5F5F5]">Candidate Pipeline</p>
          <p className="mt-1 text-sm text-[#A1A1AA]">A clear, step-by-step view of the hiring journey.</p>
        </div>
        <div className="w-fit rounded-full border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#2A211B)] px-3 py-1 text-xs font-semibold text-[#E6C7A3] shadow-soft">
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
                      state === "done" && "border-[#2A2623] bg-[linear-gradient(135deg,#A67C52_0%,#E6C7A3_100%)] text-[#1A1816] shadow-[0_16px_34px_rgba(166,124,82,0.4)]",
                      state === "active" && "border-[#2A2623] bg-[rgba(230,199,163,0.2)] text-[#E6C7A3] shadow-[0_12px_28px_rgba(166,124,82,0.4)]",
                      state === "upcoming" && "border-[#2A2623] bg-[rgba(35,32,29,0.72)] text-[#A1A1AA]"
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
                    <p className="text-sm font-semibold text-[#F5F5F5]">{step.title}</p>
                    {step.description ? <p className="mt-1 text-xs leading-5 text-[#A1A1AA]">{step.description}</p> : null}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 ? (
                <div className="mt-6 h-px w-12 rounded-full bg-[#2A2623]">
                  <div className={cn("h-full rounded-full", index + 1 < currentStep ? "bg-[linear-gradient(135deg,#A67C52_0%,#E6C7A3_100%)]" : "bg-[#2A2623]")} />
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
