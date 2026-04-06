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
  primary: "portal-accent-icon border border-white/20",
  success: "bg-[linear-gradient(135deg,#dcead8_0%,#cadec9_100%)] text-[#243126] border border-[#bfd1bb] shadow-[0_16px_30px_rgba(82,110,87,0.16)] dark:bg-[linear-gradient(135deg,#1a1816,#23201d)] dark:text-[#E6C7A3] dark:border-[#2A2623] dark:shadow-[0_0_20px_rgba(230,199,163,0.14)]",
  warning: "bg-[linear-gradient(135deg,#f2dfbd_0%,#ebce95_100%)] text-[#3b2814] border border-[#dfbf81] shadow-[0_16px_30px_rgba(154,116,65,0.18)] dark:bg-[linear-gradient(135deg,#1a1816,#23201d)] dark:text-[#E6C7A3] dark:border-[#2A2623] dark:shadow-[0_0_20px_rgba(230,199,163,0.14)]",
  info: "bg-[linear-gradient(135deg,#ead8c6_0%,#ddb895_100%)] text-[#24170d] border border-[#cfa57d] shadow-[0_16px_30px_rgba(109,79,55,0.18)] dark:bg-[linear-gradient(135deg,#1a1816,#23201d)] dark:text-[#E6C7A3] dark:border-[#2A2623] dark:shadow-[0_0_20px_rgba(230,199,163,0.14)]",
  destructive: "bg-[linear-gradient(135deg,#fbe7e3_0%,#f6d5cf_100%)] text-[#ac5f55] border border-[#efc9c1] dark:bg-[linear-gradient(135deg,rgba(239,68,68,0.18),rgba(251,113,133,0.08))] dark:text-[#ffc7c7] dark:border-[rgba(239,68,68,0.18)]",
};

const accentMap = {
  primary: "from-[rgba(var(--portal-primary-rgb),0.22)] via-[rgba(var(--portal-primary-rgb),0.1)] to-transparent",
  success: "from-[#bed4b9]/80 via-[#edf5e7]/55 to-transparent dark:from-[rgba(34,197,94,0.22)] dark:via-transparent",
  warning: "from-[#e1bd82]/80 via-[#f7ebd0]/55 to-transparent dark:from-[rgba(245,158,11,0.22)] dark:via-transparent",
  info: "from-[#dec4ab]/80 via-[#f5ece3]/55 to-transparent dark:from-[rgba(166,124,82,0.24)] dark:via-transparent",
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
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${accentMap[color]} opacity-90`} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.52),transparent_72%)]" />
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
