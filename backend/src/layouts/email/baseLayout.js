import { env } from "../../config/env.js";

const companyName = String(env.company?.name || "Arihant Dream Infra Project Ltd.").trim();
const companyLogoUrl = String(process.env.COMPANY_LOGO_URL || env.company?.logoUrl || "").trim();
const supportEmail = String(env.company?.supportEmail || env.brevo.senderEmail || "").trim();

console.log("Logo URL:", process.env.COMPANY_LOGO_URL || "(empty)");
console.log("[email.baseLayout] Using logo URL:", companyLogoUrl || "(empty)");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderHeader = () => {
  return `
    <img
      src="${escapeHtml(companyLogoUrl || "https://i.postimg.cc/CMmJLmG3/new-image-removebg-preview.png")}"
      width="48"
      height="48"
      alt="${escapeHtml(companyName)} logo"
      style="display:block;"
    />
  `;
};

export const renderEmailLayout = ({
  preheader = "",
  eyebrow = "Professional communication",
  title = "",
  intro = "",
  bodyHtml = "",
  footerText = "",
} = {}) => `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <div style="margin:0;background:#f7f1e6;padding:32px 16px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;">
      <tr>
        <td>
          <div style="background:linear-gradient(180deg,#fffaf1 0%,#fffdf8 100%);border:1px solid #eadfc8;border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(128,84,23,0.10);">
            <div style="padding:32px 32px 24px;background:linear-gradient(135deg,rgba(184,137,70,0.10),rgba(232,210,166,0.22));border-bottom:1px solid #efe4cf;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:80px;vertical-align:middle;">${renderHeader()}</td>
                  <td style="vertical-align:middle;padding-left:16px;">
                    <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#a16d2e;font-weight:700;">${escapeHtml(eyebrow)}</div>
                    <div style="margin-top:8px;font-size:30px;line-height:1.2;font-weight:800;color:#1d2433;">${escapeHtml(companyName)}</div>
                    <div style="margin-top:8px;font-size:16px;line-height:1.6;color:#6b7280;">Professional HR communication, delivered with clarity.</div>
                  </td>
                </tr>
              </table>
            </div>

            <div style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:34px;line-height:1.2;color:#1d2433;font-weight:800;">${escapeHtml(title)}</h1>
              ${intro ? `<p style="margin:0 0 22px;font-size:16px;line-height:1.8;color:#4b5563;">${escapeHtml(intro)}</p>` : ""}
              ${bodyHtml}
            </div>

            <div style="padding:22px 32px 28px;border-top:1px solid #efe4cf;background:#fffdf9;">
              <div style="font-size:12px;line-height:1.8;color:#8b7355;">
                ${escapeHtml(companyName)}<br/>
                ${supportEmail ? `Support: ${escapeHtml(supportEmail)}` : ""}
                ${footerText ? `<br/>${escapeHtml(footerText)}` : ""}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
`;

export { companyName, supportEmail, escapeHtml };
