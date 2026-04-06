import { companyName, escapeHtml, renderEmailLayout } from "./baseLayout.js";

export const buildInvitationEmailLayout = ({
  name = "",
  role = "",
  email = "",
  temporaryPassword = "",
  loginUrl = "",
} = {}) => ({
  subject: `${companyName} - Login Invitation`,
  html: renderEmailLayout({
    preheader: `You have been invited to ${companyName}.`,
    eyebrow: "Account invitation",
    title: "You're invited to Arihant Dream Infra Project Ltd.",
    intro: `Hello ${name || "there"}, your access has been created successfully.`,
    bodyHtml: `
      <div style="padding:22px;border:1px solid #e6ddc9;border-radius:22px;background:#fffdf8;">
        <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4b5563;"><strong>Role:</strong> ${escapeHtml(role)}</p>
        <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4b5563;"><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#4b5563;"><strong>Temporary Password:</strong> ${escapeHtml(temporaryPassword)}</p>
        <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:14px 22px;border-radius:16px;background:linear-gradient(135deg,#b48a4f 0%,#d5b27a 48%,#f0dfbd 100%);color:#2c1d0d;text-decoration:none;font-weight:700;">Open Login</a>
      </div>
      <div style="margin-top:22px;padding:18px 20px;border:1px solid #efe4cf;border-radius:18px;background:#fffaf1;">
        <p style="margin:0;font-size:14px;line-height:1.8;color:#6b7280;">
          Please sign in and change your password immediately after your first login.
        </p>
      </div>
    `,
    footerText: "Use your company-issued credentials responsibly.",
  }),
  text: `You have been invited to ${companyName}. Role: ${role}. Email: ${email}. Temporary Password: ${temporaryPassword}. Login: ${loginUrl}`,
});
