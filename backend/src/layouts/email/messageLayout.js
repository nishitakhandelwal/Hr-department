import { companyName, escapeHtml, renderEmailLayout } from "./baseLayout.js";

export const buildMessageEmailLayout = ({
  subject = `${companyName} - Notification`,
  title = "Notification",
  message = "",
  eyebrow = "HR communication",
  footerText = "This is an automated email from Arihant Dream Infra Project Ltd.",
} = {}) => ({
  subject,
  html: renderEmailLayout({
    preheader: message,
    eyebrow,
    title,
    intro: "",
    bodyHtml: `
      <div style="padding:22px;border:1px solid #e6ddc9;border-radius:22px;background:#fffdf8;">
        <p style="margin:0;font-size:15px;line-height:1.9;color:#4b5563;">${escapeHtml(message)}</p>
      </div>
    `,
    footerText,
  }),
  text: `${companyName}\n\n${title}\n\n${message}`,
});
