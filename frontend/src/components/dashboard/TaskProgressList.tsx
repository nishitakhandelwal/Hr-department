import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type TaskProgressItem = {
  title: string;
  description: string;
  progress: number;
  icon: LucideIcon;
};

type TaskProgressListProps = {
  title: string;
  subtitle: string;
  tasks: TaskProgressItem[];
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
      <h3 className="mt-2 text-[24px] font-semibold text-[#24190f]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6f5a43]">{subtitle}</p>

      <div className="mt-6 space-y-4">
        {tasks.map((task, index) => (
          <motion.div
            key={task.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.06 }}
            className="dashboard-subtle-card"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#1f2638] text-[#f3dcc0] shadow-[0_14px_26px_rgba(23,25,36,0.18)]">
                <task.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[#24190f]">{task.title}</h4>
                  <span className="text-xs font-semibold text-[#9a7747]">{task.progress}%</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#7b6852]">{task.description}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eadfcd]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
                    transition={{ duration: 0.7, delay: index * 0.08 }}
                    className="h-full rounded-full bg-[linear-gradient(90deg,#ae8045_0%,#d5b27a_55%,#ecd8b5_100%)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default TaskProgressList;
