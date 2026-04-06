import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  titleClassName?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, titleClassName = "" }) => {
  const { user } = useAuth();
  const badge = user?.role === "candidate" ? "Candidate Portal" : user?.role === "employee" ? "Employee Workspace" : "Admin Workspace";
  const badgeClassName =
    user?.role === "candidate"
      ? "border-[rgba(var(--portal-primary-rgb),0.16)] bg-white/82 text-[var(--portal-primary-text)] dark:bg-white/[0.05]"
      : "border-[rgba(var(--portal-primary-rgb),0.18)] bg-white/72 text-[var(--portal-primary-text)] dark:bg-white/[0.05]";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="page-shell page-enter"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className={`mb-4 inline-flex items-center rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] shadow-soft backdrop-blur-xl ${badgeClassName}`}>
            {badge}
          </div>
          <h1 className={`${titleClassName || "gradient-text"} text-[32px] font-semibold tracking-tight sm:text-[40px]`}>{title}</h1>
          {subtitle && <p className="portal-copy mt-3 max-w-2xl text-sm leading-7 sm:text-[15px]">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </motion.div>
  );
};
