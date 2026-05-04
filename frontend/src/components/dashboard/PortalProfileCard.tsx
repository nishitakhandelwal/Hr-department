import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import ProfileAvatar from "@/components/common/ProfileAvatar";

type ProfileMetaItem = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "success" | "process" | "finance" | "pending" | "teal";
};

type PortalProfileCardProps = {
  name: string;
  roleLabel: string;
  subtitle: string;
  imageUrl?: string;
  meta: ProfileMetaItem[];
};

const toneClassMap = {
  success: "border border-[#16a34a]/20 bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.16)]",
  process: "border border-[#2563eb]/20 bg-[#2563eb] text-white shadow-[0_8px_18px_rgba(37,99,235,0.16)]",
  finance: "border border-[#7c3aed]/20 bg-[#7c3aed] text-white shadow-[0_8px_18px_rgba(124,58,237,0.16)]",
  pending: "border border-[#e11d48]/20 bg-[#e11d48] text-white shadow-[0_8px_18px_rgba(225,29,72,0.16)]",
  teal: "border border-[#0f766e]/20 bg-[#0f766e] text-white shadow-[0_8px_18px_rgba(15,118,110,0.16)]",
};

const PortalProfileCard: React.FC<PortalProfileCardProps> = ({ name, roleLabel, subtitle, imageUrl, meta }) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="dashboard-panel relative overflow-hidden"
    >
      <div className="relative">
        <div className="mb-5 flex items-center gap-4">
          <ProfileAvatar
            name={name}
            imageUrl={imageUrl}
            className="h-16 w-16 border border-white/70 bg-white shadow-[0_16px_36px_rgba(var(--portal-primary-rgb),0.16)]"
            fallbackClassName="bg-[rgba(var(--portal-primary-rgb),0.12)] text-sm text-[var(--portal-primary-text)]"
          />
          <div>
            <p className="dashboard-label">Profile Snapshot</p>
            <h3 className="portal-heading mt-1 text-[24px] font-semibold">{name}</h3>
            <p className="portal-muted mt-1 text-sm">{roleLabel}</p>
          </div>
        </div>

        <p className="rounded-[20px] border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] px-4 py-3 text-sm leading-6 portal-copy">
          {subtitle}
        </p>

        <div className="mt-5 grid gap-3">
          {meta.map((item) => (
            <div key={item.label} className="dashboard-subtle-card flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-[18px] border ${toneClassMap[item.tone || "process"]}`}>
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="dashboard-label">{item.label}</p>
                <p className="portal-heading mt-1 text-sm font-medium">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export default PortalProfileCard;
