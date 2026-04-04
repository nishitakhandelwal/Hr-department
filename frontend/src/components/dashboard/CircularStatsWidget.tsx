import React from "react";
import { motion } from "framer-motion";

type CircularStatsWidgetProps = {
  label: string;
  value: number;
  suffix?: string;
  subtitle: string;
  breakdown: Array<{ label: string; value: string }>;
};

const CircularStatsWidget: React.FC<CircularStatsWidgetProps> = ({ label, value, suffix = "%", subtitle, breakdown }) => {
  const normalized = Math.max(0, Math.min(100, value));
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalized / 100) * circumference;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.48 }}
      className="dashboard-panel"
    >
      <p className="dashboard-label">{label}</p>
      <div className="mt-4 flex items-center justify-center">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <svg className="h-40 w-40 -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(203,185,156,0.35)" strokeWidth="12" />
            <motion.circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="url(#premium-ring)"
              strokeWidth="12"
              strokeLinecap="round"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
              strokeDasharray={circumference}
            />
            <defs>
              <linearGradient id="premium-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#b18443" />
                <stop offset="55%" stopColor="#d5b27a" />
                <stop offset="100%" stopColor="#f1ddba" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute text-center">
            <p className="text-[34px] font-semibold leading-none text-[#23180e]">
              {normalized}
              <span className="ml-1 text-lg text-[#9a7747]">{suffix}</span>
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#8b7151]">score</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-sm leading-6 text-[#6f5a43]">{subtitle}</p>

      <div className="mt-5 space-y-3">
        {breakdown.map((item) => (
          <div key={item.label} className="dashboard-subtle-card flex items-center justify-between">
            <span className="text-sm text-[#7b6852]">{item.label}</span>
            <span className="text-sm font-semibold text-[#23180e]">{item.value}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
};

export default CircularStatsWidget;
