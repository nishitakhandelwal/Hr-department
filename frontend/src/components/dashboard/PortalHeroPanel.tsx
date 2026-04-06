import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type HeroHighlight = {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
};

type PortalHeroPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: HeroHighlight[];
};

const PortalHeroPanel: React.FC<PortalHeroPanelProps> = ({ eyebrow, title, description, highlights }) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="dashboard-panel relative overflow-hidden p-7"
    >
      <div className="portal-orb pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full blur-3xl" />
      <div className="portal-orb-soft pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.16),transparent_28%,transparent_72%,rgba(var(--portal-primary-rgb),0.08))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.46),transparent_68%)]" />

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
                <div className="portal-accent-icon flex h-10 w-10 items-center justify-center rounded-[16px] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
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
