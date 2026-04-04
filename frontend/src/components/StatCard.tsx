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
  primary: "bg-[linear-gradient(135deg,#f0e0c4_0%,#ead4ad_100%)] text-[#8a6736] border border-[#dec8a3]",
  success: "bg-[linear-gradient(135deg,#e4efe4_0%,#d2e1ce_100%)] text-[#5e7d58] border border-[#c6d7c3]",
  warning: "bg-[linear-gradient(135deg,#f7e8cf_0%,#f2dcb4_100%)] text-[#a1783f] border border-[#e3c998]",
  info: "bg-[linear-gradient(135deg,#e5edf5_0%,#dbe6f2_100%)] text-[#5e7592] border border-[#cfdae7]",
  destructive: "bg-[linear-gradient(135deg,#f8e1dc_0%,#f0cbc3_100%)] text-[#a06056] border border-[#e2b8af]",
};

const accentMap = {
  primary: "from-[#dcb887]/80 via-[#f2e3c8]/60 to-transparent",
  success: "from-[#bed4b9]/80 via-[#edf5e7]/55 to-transparent",
  warning: "from-[#e1bd82]/80 via-[#f7ebd0]/55 to-transparent",
  info: "from-[#bfd0e4]/80 via-[#eef4f9]/55 to-transparent",
  destructive: "from-[#e8b8af]/80 via-[#fae9e4]/55 to-transparent",
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
      className={`group relative overflow-hidden rounded-[24px] border border-[#ddceb5] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(248,241,230,0.95))] p-5 shadow-card backdrop-blur-xl transition-all duration-300 ${
        onClick ? "cursor-pointer hover:-translate-y-1.5 hover:shadow-card-hover" : ""
      }`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${accentMap[color]} opacity-90`} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.52),transparent_72%)]" />
      <div className="flex items-start justify-between gap-4">
        <div className="relative min-w-0 space-y-2">
          <p className="text-sm font-medium text-[#7c6850]">{title}</p>
          <p className="premium-number text-[32px] font-semibold leading-none text-[#24190f]">{value}</p>
          {change && (
            <p className={`max-w-[18rem] text-xs font-medium leading-5 ${
              changeType === "positive" ? "text-[#5f8158]" :
              changeType === "negative" ? "text-[#aa5f55]" : "text-[#8d785f]"
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className={`relative z-[1] flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-soft transition-transform duration-300 group-hover:scale-105 ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="relative mt-5 h-px w-full overflow-hidden rounded-full bg-[#e5d8c4]">
        <div className={`h-full w-2/3 bg-gradient-to-r ${accentMap[color]}`} />
      </div>
    </motion.div>
  );
};
