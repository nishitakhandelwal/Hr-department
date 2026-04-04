import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import ProfileAvatar from "@/components/common/ProfileAvatar";

type ProfileMetaItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type PortalProfileCardProps = {
  name: string;
  roleLabel: string;
  subtitle: string;
  imageUrl?: string;
  meta: ProfileMetaItem[];
};

const PortalProfileCard: React.FC<PortalProfileCardProps> = ({ name, roleLabel, subtitle, imageUrl, meta }) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="dashboard-panel relative overflow-hidden"
    >
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(213,182,130,0.28),transparent_72%)] blur-2xl" />
      <div className="relative">
        <div className="mb-5 flex items-center gap-4">
          <ProfileAvatar
            name={name}
            imageUrl={imageUrl}
            className="h-16 w-16 border border-[#d7c1a0]/70 bg-white shadow-[0_16px_36px_rgba(161,126,77,0.16)]"
            fallbackClassName="bg-[#f4e8d2] text-sm text-[#8d6736]"
          />
          <div>
            <p className="dashboard-label">Profile Snapshot</p>
            <h3 className="mt-1 text-[24px] font-semibold text-[#24190f]">{name}</h3>
            <p className="mt-1 text-sm text-[#7b6852]">{roleLabel}</p>
          </div>
        </div>

        <p className="rounded-[20px] border border-[#e5d7be] bg-white/70 px-4 py-3 text-sm leading-6 text-[#6f5a43]">
          {subtitle}
        </p>

        <div className="mt-5 grid gap-3">
          {meta.map((item) => (
            <div key={item.label} className="dashboard-subtle-card flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#1b2234_0%,#28334b_100%)] text-[#f3dcc0] shadow-[0_12px_28px_rgba(20,22,34,0.22)]">
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="dashboard-label">{item.label}</p>
                <p className="mt-1 text-sm font-medium text-[#2e2215]">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export default PortalProfileCard;
