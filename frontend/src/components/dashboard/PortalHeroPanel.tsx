import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type HeroHighlight = {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: "success" | "process" | "finance" | "pending" | "teal";
};

type PortalHeroPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: HeroHighlight[];
};

const toneClassMap = {
  success: "border border-[#16a34a]/20 bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.16)]",
  process: "border border-[#2563eb]/20 bg-[#2563eb] text-white shadow-[0_8px_18px_rgba(37,99,235,0.16)]",
  finance: "border border-[#7c3aed]/20 bg-[#7c3aed] text-white shadow-[0_8px_18px_rgba(124,58,237,0.16)]",
  pending: "border border-[#e11d48]/20 bg-[#e11d48] text-white shadow-[0_8px_18px_rgba(225,29,72,0.16)]",
  teal: "border border-[#0f766e]/20 bg-[#0f766e] text-white shadow-[0_8px_18px_rgba(15,118,110,0.16)]",
};

const PortalHeroPanel: React.FC<PortalHeroPanelProps> = ({ eyebrow, title, description, highlights }) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="dashboard-panel relative overflow-hidden p-7"
    >
      <div className="relative">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="portal-kicker gap-2 px-3.5 py-1.5">
              {eyebrow}
            </div>
            <h2 className="portal-heading mt-4 max-w-3xl text-[32px] font-semibold leading-tight tracking-[-0.04em] lg:text-[40px]">
              {title}
            </h2>
            <p className="portal-copy mt-4 max-w-2xl text-sm leading-7 lg:text-[15px]">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.label} className="dashboard-subtle-card group">
              <div className="flex items-center justify-between gap-3">
                <p className="dashboard-label">{item.label}</p>
                <div className={`flex h-10 w-10 items-center justify-center rounded-[16px] border transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 ${toneClassMap[item.tone || "process"]}`}>
                  <item.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="portal-heading mt-3 text-[28px] font-semibold leading-none lg:text-[30px]">{item.value}</p>
              <p className="portal-muted mt-2 text-sm leading-6">{item.note}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export default PortalHeroPanel;
