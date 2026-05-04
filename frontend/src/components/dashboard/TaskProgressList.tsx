import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type TaskProgressItem = {
  title: string;
  description: string;
  progress: number;
  icon: LucideIcon;
  tone?: "success" | "process" | "finance" | "pending" | "teal";
};

type TaskProgressListProps = {
  title: string;
  subtitle: string;
  tasks: TaskProgressItem[];
};

const toneClassMap = {
  success: {
    icon: "border border-[#16a34a]/20 bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.16)]",
    progress: "bg-[#16a34a]",
    text: "text-[#166534] dark:text-[#86efac]",
  },
  process: {
    icon: "border border-[#2563eb]/20 bg-[#2563eb] text-white shadow-[0_8px_18px_rgba(37,99,235,0.16)]",
    progress: "bg-[#2563eb]",
    text: "text-[#1d4ed8] dark:text-[#93c5fd]",
  },
  finance: {
    icon: "border border-[#7c3aed]/20 bg-[#7c3aed] text-white shadow-[0_8px_18px_rgba(124,58,237,0.16)]",
    progress: "bg-[#7c3aed]",
    text: "text-[#6d28d9] dark:text-[#c4b5fd]",
  },
  pending: {
    icon: "border border-[#e11d48]/20 bg-[#e11d48] text-white shadow-[0_8px_18px_rgba(225,29,72,0.16)]",
    progress: "bg-[#e11d48]",
    text: "text-[#be123c] dark:text-[#fda4af]",
  },
  teal: {
    icon: "border border-[#0f766e]/20 bg-[#0f766e] text-white shadow-[0_8px_18px_rgba(15,118,110,0.16)]",
    progress: "bg-[#0f766e]",
    text: "text-[#0f766e] dark:text-[#5eead4]",
  },
};

const TaskProgressList: React.FC<TaskProgressListProps> = ({ title, subtitle, tasks }) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="dashboard-panel"
    >
      <p className="dashboard-label">Task Progress</p>
      <h3 className="portal-heading mt-2 text-[24px] font-semibold">{title}</h3>
      <p className="portal-copy mt-2 text-sm leading-6">{subtitle}</p>

      <div className="mt-6 space-y-4">
        {tasks.map((task, index) => {
          const tone = toneClassMap[task.tone || "process"];
          return (
            <motion.div
              key={task.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.06 }}
              className="dashboard-subtle-card"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-[18px] border ${tone.icon}`}>
                  <task.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="portal-heading text-sm font-semibold">{task.title}</h4>
                    <span className={`text-xs font-semibold ${tone.text}`}>{task.progress}%</span>
                  </div>
                  <p className="portal-muted mt-1 text-xs leading-5">{task.description}</p>
                  <div className="portal-progress-track mt-3 h-2 overflow-hidden rounded-full">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
                      transition={{ duration: 0.7, delay: index * 0.08 }}
                      className={`h-full rounded-full ${tone.progress}`}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
};

export default TaskProgressList;
