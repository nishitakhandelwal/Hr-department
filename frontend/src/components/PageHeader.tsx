import React from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="page-shell page-enter"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center rounded-full border border-[#deceb5] bg-white/75 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9a7747] shadow-soft backdrop-blur-xl">
            Refined HR Workspace
          </div>
          <h1 className="gradient-text text-[32px] font-semibold tracking-tight sm:text-[40px]">{title}</h1>
          {subtitle && <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6e5b45] sm:text-[15px]">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </motion.div>
  );
};
