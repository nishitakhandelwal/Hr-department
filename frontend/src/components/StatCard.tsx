import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  color: "primary" | "success" | "warning" | "info" | "destructive";
  delay?: number;
  onClick?: () => void;
}

const colorMap = {
  primary: "border border-[#2563eb]/20 bg-[#2563eb] text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)] dark:border-[#60a5fa]/16 dark:bg-[#1d4ed8] dark:text-white dark:shadow-[0_10px_22px_rgba(29,78,216,0.2)]",
  success: "border border-[#16a34a]/20 bg-[#16a34a] text-white shadow-[0_10px_22px_rgba(22,163,74,0.18)] dark:border-[#4ade80]/16 dark:bg-[#15803d] dark:text-white dark:shadow-[0_10px_22px_rgba(21,128,61,0.2)]",
  warning: "border border-[#e11d48]/20 bg-[#e11d48] text-white shadow-[0_10px_22px_rgba(225,29,72,0.18)] dark:border-[#fb7185]/16 dark:bg-[#be123c] dark:text-white dark:shadow-[0_10px_22px_rgba(190,18,60,0.2)]",
  info: "border border-[#7c3aed]/20 bg-[#7c3aed] text-white shadow-[0_10px_22px_rgba(124,58,237,0.18)] dark:border-[#a78bfa]/16 dark:bg-[#6d28d9] dark:text-white dark:shadow-[0_10px_22px_rgba(109,40,217,0.2)]",
  destructive: "bg-[linear-gradient(135deg,#fbe7e3_0%,#f6d5cf_100%)] text-[#ac5f55] border border-[#efc9c1] dark:bg-[linear-gradient(135deg,rgba(239,68,68,0.18),rgba(251,113,133,0.08))] dark:text-[#ffc7c7] dark:border-[rgba(239,68,68,0.18)]",
};

const accentMap = {
  primary: "from-[#60a5fa]/85 via-[#1d4ed8]/45 to-transparent dark:from-[#93c5fd]/55 dark:via-transparent",
  success: "from-[#4ade80]/85 via-[#15803d]/45 to-transparent dark:from-[#86efac]/55 dark:via-transparent",
  warning: "from-[#fb7185]/85 via-[#be123c]/45 to-transparent dark:from-[#fda4af]/55 dark:via-transparent",
  info: "from-[#a78bfa]/85 via-[#7c3aed]/45 to-transparent dark:from-[#c4b5fd]/55 dark:via-transparent",
  destructive: "from-[#e8b8af]/80 via-[#fae9e4]/55 to-transparent dark:from-[rgba(239,68,68,0.22)] dark:via-transparent",
};

export const StatCard: React.FC<StatCardProps> = ({
  title, value, change, changeType = "neutral", icon: Icon, color, delay = 0, onClick
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`group relative overflow-hidden rounded-[24px] border border-[var(--portal-surface-border)] bg-[linear-gradient(180deg,var(--portal-surface-bg-strong),var(--portal-surface-bg))] p-5 shadow-card backdrop-blur-xl transition-all duration-300 ${
        onClick ? "cursor-pointer hover:-translate-y-1.5 hover:shadow-card-hover" : ""
      }`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentMap[color]} opacity-30`} />
      <div className="flex items-start justify-between gap-4">
        <div className="relative min-w-0 space-y-2">
          <p className="portal-muted text-sm font-medium">{title}</p>
          <p className="premium-number text-[32px] font-semibold leading-none portal-heading">{value}</p>
          {change && (
            <p className={`max-w-[18rem] text-xs font-medium leading-5 ${
              changeType === "positive" ? "text-[#5f8158]" :
              changeType === "negative" ? "text-[#aa5f55]" : "portal-muted"
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className={`relative z-[1] flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-soft transition-transform duration-300 group-hover:scale-105 ${colorMap[color]}`}>
          <Icon className="h-5 w-5 [stroke-width:2.35]" />
        </div>
      </div>
      <div className="portal-progress-track relative mt-5 h-px w-full overflow-hidden rounded-full">
        <div className={`h-full w-2/3 bg-gradient-to-r ${accentMap[color]}`} />
      </div>
    </motion.div>
  );
};
