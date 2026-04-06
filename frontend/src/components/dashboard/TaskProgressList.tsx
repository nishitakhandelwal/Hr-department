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
      <h3 className="portal-heading mt-2 text-[24px] font-semibold">{title}</h3>
      <p className="portal-copy mt-2 text-sm leading-6">{subtitle}</p>

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
              <div className="portal-accent-icon flex h-11 w-11 items-center justify-center rounded-[18px]">
                <task.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="portal-heading text-sm font-semibold">{task.title}</h4>
                  <span className="text-xs font-semibold text-primary">{task.progress}%</span>
                </div>
                <p className="portal-muted mt-1 text-xs leading-5">{task.description}</p>
                <div className="portal-progress-track mt-3 h-2 overflow-hidden rounded-full">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
                    transition={{ duration: 0.7, delay: index * 0.08 }}
                    className="portal-progress-fill h-full rounded-full"
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
