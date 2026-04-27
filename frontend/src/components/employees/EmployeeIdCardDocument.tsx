import React from "react";

import { resolveCompanyLogoUrl, resolveProfileImageUrl } from "@/lib/images";
import type { EmployeeRecord } from "@/services/api";

const ID_CARD_FONT = '"Poppins", ui-sans-serif, sans-serif';

const getCompanyDisplayLines = (companyName: string) => {
  const normalized = companyName.replace(/\./g, "").trim().toUpperCase();

  if (normalized.includes("ARIHANT DREAM INFRA")) {
    return {
      line1: "ARIHANT DREAM INFRA",
      line2: "PROJECTS LIMITED",
    };
  }

  const parts = normalized.split(/(?<=\bINFRA\b)\s+/i);

  return {
    line1: parts[0] || normalized,
    line2: parts[1] || "",
  };
};

type EmployeeIdCardDocumentProps = {
  employee: EmployeeRecord;
  companyName: string;
  companyLogoUrl?: string;
  companyAddress?: string;
  companyWebsite?: string;
  companyEmail?: string;
  companyPhone?: string;
  className?: string;
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
};

const PhotoFallbackAvatar: React.FC = () => (
  <div className="relative h-full w-full bg-[radial-gradient(circle_at_top,#F6EBDD_0%,#E6D5C4_100%)]">
    <div className="absolute left-1/2 top-[24%] h-[44px] w-[44px] -translate-x-1/2 rounded-full bg-[#A98567]" />
    <div className="absolute bottom-[16%] left-1/2 h-[66px] w-[92px] -translate-x-1/2 rounded-t-[999px] bg-[#A98567]" />
  </div>
);

const resolveEmployeePhoto = (employee: EmployeeRecord) =>
  resolveProfileImageUrl(employee.photoUrl || employee.profileImage || employee.documents?.photograph?.url || "", { allowTemporary: true });

const SideRail: React.FC<{ label: string }> = ({ label }) => (
  <div className="absolute bottom-0 left-0 top-[292px] flex w-[56px] items-center justify-center rounded-tr-[28px] bg-[#C81422]">
    <span
      className="-rotate-90 whitespace-nowrap text-[15px] font-extrabold tracking-[0.01em] text-white"
      style={{ fontFamily: ID_CARD_FONT }}
    >
      {label}
    </span>
  </div>
);

const BrandHeader: React.FC<{
  companyName: string;
  companyLogoUrl?: string;
  subtitle?: string;
  centered?: boolean;
  largeLogo?: boolean;
  frontVariant?: boolean;
}> = ({
  companyName,
  companyLogoUrl,
  subtitle,
  centered = false,
  largeLogo = false,
  frontVariant = false,
}) => {
  const logoSrc = resolveCompanyLogoUrl(companyLogoUrl || "");
  const sanitizedName = companyName.replace(/\.+$/, "").trim();
  const lines = getCompanyDisplayLines(sanitizedName);

  return (
    <div className={frontVariant ? "relative z-10 px-[34px] pt-[30px]" : centered ? "relative z-10 flex items-center justify-center gap-[12px] px-[20px] pt-[26px]" : "relative z-10 flex items-start gap-[10px] pl-[40px] pr-[22px] pt-[24px]"}>
      {frontVariant ? (
        <>
          <div className="flex items-start gap-[12px]">
            <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center">
              <img src={logoSrc} alt={companyName} className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex-1 pt-[4px] text-left">
              <h2 className="whitespace-nowrap text-[16px] font-extrabold uppercase leading-[1.02] tracking-[-0.01em] text-[#C9222A]" style={{ fontFamily: ID_CARD_FONT }}>
                {lines.line1}
              </h2>
              <h3 className="mt-[5px] text-[15px] font-extrabold uppercase leading-[1.04] tracking-[-0.01em] text-[#676767]" style={{ fontFamily: ID_CARD_FONT }}>
                {lines.line2}
              </h3>
            </div>
          </div>
          {subtitle ? (
            <p className="mt-[10px] text-center text-[10px] font-semibold text-[#111111]" style={{ fontFamily: ID_CARD_FONT }}>
              {subtitle}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className={largeLogo ? "flex h-[68px] w-[68px] shrink-0 items-center justify-center" : "flex h-[60px] w-[60px] shrink-0 items-center justify-center"}>
            <img src={logoSrc} alt={companyName} className="max-h-full max-w-full object-contain" />
          </div>
          <div className={centered ? "max-w-[246px] pt-[2px] text-left" : "flex-1 pt-[3px]"}>
            <h2
              className={centered ? "text-[17px] font-extrabold uppercase leading-[1.02] tracking-[-0.01em] text-[#C9222A]" : "text-[18px] font-extrabold uppercase leading-[1.02] tracking-[-0.01em] text-[#C9222A]"}
              style={{ fontFamily: ID_CARD_FONT }}
            >
              {lines.line1}
            </h2>
            <h3
              className={centered ? "mt-[4px] text-[15px] font-extrabold uppercase leading-[1.05] tracking-[-0.01em] text-[#676767]" : "mt-[4px] text-[16px] font-extrabold uppercase leading-[1.04] tracking-[-0.01em] text-[#676767]"}
              style={{ fontFamily: ID_CARD_FONT }}
            >
              {lines.line2}
            </h3>
            {subtitle ? (
              <p className="mt-[8px] text-center text-[11px] font-semibold text-[#111111]" style={{ fontFamily: ID_CARD_FONT }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

const DetailsRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="grid grid-cols-[118px_minmax(0,1fr)] items-start gap-x-[10px]">
    <p className="text-[10px] font-semibold uppercase leading-[1.35] text-[#27211F]" style={{ fontFamily: ID_CARD_FONT }}>
      {label}
    </p>
    <p className="whitespace-nowrap text-[9px] font-semibold uppercase leading-[1.35] text-[#27211F]" style={{ fontFamily: ID_CARD_FONT }}>
      {value || "-"}
    </p>
  </div>
);

const SignatureBlock: React.FC<{ label: string; value: string; align?: "left" | "center" | "right"; compact?: boolean }> = ({
  label,
  value,
  align = "center",
  compact = false,
}) => (
  <div className={align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center"}>
    {value ? (
      <div
        className={compact ? "text-[32px] font-semibold italic leading-none text-[#2F315A]" : "text-[54px] font-semibold italic leading-none text-[#2F315A]"}
        style={{ fontFamily: "cursive" }}
      >
        {value}
      </div>
    ) : (
      <div className={compact ? "h-[34px]" : "h-[54px]"} />
    )}
    <p className="-mt-1 text-[10px] font-semibold text-black" style={{ fontFamily: ID_CARD_FONT }}>
      {label}
    </p>
  </div>
);

const cardBaseClass =
  "relative mx-auto h-[530px] w-[336px] overflow-hidden rounded-[22px] border border-[#DDD8D1] bg-[linear-gradient(180deg,#F8F4EE_0%,#F2EFEA_48%,#ECE8E2_100%)] shadow-[0_18px_44px_rgba(0,0,0,0.12)]";

const EmployeeIdCardDocument = React.forwardRef<HTMLDivElement, EmployeeIdCardDocumentProps>(
  (
    {
      employee,
      companyName,
      companyLogoUrl,
      companyAddress,
      companyWebsite,
      companyEmail,
      companyPhone,
      className,
    },
    ref,
  ) => {
    const photoUrl = resolveEmployeePhoto(employee);
    const stripLabel = "Arihant Group Jaipur";
    const employeeName = employee.fullName || "Employee Name";
    const employeeCode = employee.employeeId || employee._id || "-";
    const designation = employee.designation || employee.department || "-";
    const departmentLabel = employee.department || "MDO TEAM";
    const joiningDate = formatDateLabel(employee.joiningDate);
    const birthDate = formatDateLabel(employee.dateOfBirth);
    const bloodGroup = employee.bloodGroup || "-";
    const contactLine = employee.phone || "-";
    const addressText =
      companyAddress ||
      "2nd Floor, Class of Pearl, Tonk Rd, Income Tax Colony, Durgapura, Jaipur, Rajasthan 302018";
    const websiteText = companyWebsite || "www.arihantgroupjaipur.com";
    const emailText = companyEmail || "Info@arihantgroupjaipur.com";
    const phoneText = companyPhone || "0141-2940-606";
    const emergencyText = contactLine !== "-" ? contactLine : "9529601365";

    return (
      <div ref={ref} className={className}>
        <div className="flex flex-col items-center gap-8">
          <section className={cardBaseClass}>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#F7F2EB_0%,#F2EEE8_52%,#EBE7E1_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_14%,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0)_38%)]" />
            <div className="absolute bottom-0 right-0 h-[170px] w-[150px] bg-[radial-gradient(circle_at_bottom_right,rgba(189,182,174,0.08)_0%,rgba(189,182,174,0.03)_38%,rgba(189,182,174,0)_72%)]" />
            <SideRail label={stripLabel} />

            <div className="relative z-10 flex h-full w-full flex-col pb-[34px]" style={{ fontFamily: ID_CARD_FONT }}>
              <BrandHeader
                companyName={companyName}
                companyLogoUrl={companyLogoUrl}
                subtitle="An ISO 9001-2008 Certified Company"
                frontVariant
              />

              <div className="mt-[14px] flex flex-col items-center px-6">
                <div className="flex h-[168px] w-[168px] items-center justify-center overflow-hidden rounded-full border-[7px] border-[#C79B79] bg-[#EDE5DF]">
                  {photoUrl ? (
                    <img src={photoUrl} alt={employeeName} className="h-full w-full object-cover object-top" />
                  ) : (
                    <PhotoFallbackAvatar />
                  )}
                </div>

                <div className="-mt-[12px] min-w-[214px] max-w-[214px] rounded-[10px] bg-[#6B5A4E] px-4 py-[6px] text-center shadow-[0_6px_14px_rgba(0,0,0,0.08)]">
                  <p className="text-[10px] font-extrabold uppercase leading-tight tracking-[0] text-white">{employeeName}</p>
                </div>
                <div className="mt-[6px] text-center">
                  <p className="text-[9px] font-semibold uppercase italic tracking-[0.05em] text-[#6C5A4F]">
                    {departmentLabel}
                  </p>
                  {!photoUrl ? (
                    <p className="mt-[4px] text-[8px] font-semibold uppercase tracking-[0.08em] text-[#A67C52]">
                      Default avatar in use
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-[14px] space-y-[8px] px-[82px]">
                <DetailsRow label="EMP.CODE:" value={employeeCode} />
                <DetailsRow label="DESIGNATION:" value={designation} />
                <DetailsRow label="DATE OF JOINING:" value={joiningDate} />
                <DetailsRow label="BLOOD GROUP:" value={bloodGroup} />
                <DetailsRow label="BIRTH DATE:" value={birthDate} />
              </div>

              <div className="mt-auto px-[74px] pb-[18px]">
                <SignatureBlock label="Authority Signature" value="" />
              </div>
            </div>
          </section>

          <section className={cardBaseClass}>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#F8F4EE_0%,#F1EEE8_56%,#EBE8E2_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(255,255,255,0.56)_0%,rgba(255,255,255,0)_38%)]" />
            <SideRail label={stripLabel} />

            <div className="relative z-10 flex h-full w-full flex-col pb-8" style={{ fontFamily: ID_CARD_FONT }}>
              <BrandHeader companyName={companyName} companyLogoUrl={companyLogoUrl} centered largeLogo />

              <div className="mt-[18px] px-[22px] text-center">
                <h3 className="text-[17px] font-bold text-black">Office Address:</h3>
                <p className="mt-[16px] text-[10px] leading-[1.45] text-black">
                  {addressText}
                </p>

                <div className="mt-[14px] space-y-[7px] text-[9px] leading-[1.35] text-black">
                  <p>Website: {websiteText}</p>
                  <p>E-mail: {emailText}</p>
                  <p>Telephone: {phoneText} Lines</p>
                  <p>Emergency No.: {emergencyText}</p>
                </div>
              </div>

              <div className="mt-[12px] px-[34px] pl-[68px]">
                <h3 className="text-center text-[17px] font-bold text-black">Instructions:</h3>
                <ol className="mt-[10px] space-y-[11px] text-[7.8px] leading-[1.48] text-black">
                  <li>1.This card is not transferable.</li>
                  <li>
                    2.This cardholder must wear this ID card while on duty and produce the same on demand by
                    security staff or any Authorised official of the company.
                  </li>
                  <li>3. Its Loss / Theft should be reported immediately to the head of the Department.</li>
                  <li>4.This card is for identification purpose only and cannot be used for any other reason.</li>
                </ol>
              </div>

              <div className="mt-auto px-[74px] pt-[2px]">
                <SignatureBlock label="Holder's Signature" value="" compact />
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  },
);

EmployeeIdCardDocument.displayName = "EmployeeIdCardDocument";

export default EmployeeIdCardDocument;
