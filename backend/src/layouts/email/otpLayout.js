import { companyName, escapeHtml, renderEmailLayout } from "./baseLayout.js";

export const buildOtpEmailLayout = ({
  otp,
  expiresInMinutes = 5,
  heading = "Login Verification Code",
  purpose = "verification code",
} = {}) => {
  const safeOtp = escapeHtml(otp);
  const safePurpose = escapeHtml(purpose);
  const preheader = `Your ${purpose} is ${otp}. It expires in ${expiresInMinutes} minutes.`;

  return {
    subject: `${companyName} - ${heading}`,
    html: renderEmailLayout({
      preheader,
      eyebrow: "Secure access",
      title: heading,
      intro: "Use the one-time verification code below to complete your secure sign in.",
      bodyHtml: `
        <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${safePurpose}</div>
        <div style="margin-top:22px;padding:24px;border:1px solid #e6ddc9;border-radius:22px;background:linear-gradient(180deg,#f9fbff 0%,#f4f7ff 100%);text-align:center;">
          <div style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#4f46e5;">Verification Code</div>
          <div style="margin-top:14px;font-size:42px;line-height:1.1;font-weight:800;letter-spacing:0.28em;color:#1f2937;">${safeOtp}</div>
        </div>
        <div style="margin-top:22px;padding:18px 20px;border:1px solid #efe4cf;border-radius:18px;background:#fffaf1;">
          <p style="margin:0;font-size:14px;line-height:1.8;color:#6b7280;">
            This code expires in <strong style="color:#1d2433;">${expiresInMinutes} minutes</strong>. If you did not request this, you can safely ignore this email.
          </p>
        </div>
      `,
      footerText: "This is an automated security email.",
    }),
    text: `${companyName}\n\nYour ${purpose} is ${otp}. It expires in ${expiresInMinutes} minutes.\n\nIf you did not request this, you can safely ignore this email.`,
  };
};
