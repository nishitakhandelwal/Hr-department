import fs from "fs";
import path from "path";
import { LetterTemplate } from "../models/LetterTemplate.js";
import { GeneratedLetter } from "../models/GeneratedLetter.js";
import { Employee } from "../models/Employee.js";
import { Candidate } from "../models/Candidate.js";
import { uploadsDir } from "../utils/paths.js";
import { sendBrevoEmail } from "../services/brevoEmailService.js";
import { getSystemSettings } from "../services/systemSettingsService.js";
import { maybeSendEmailBySettings } from "../services/runtimeBehaviorService.js";
import { createNotificationForCandidate } from "../services/recruitmentWorkflowService.js";
import { ensureEmployeeProfileForUser } from "../services/employeeProfileService.js";
import { LOGO_URL } from "../utils/logo.js";
import { generateOfferLetterHtml, generateInternshipLetterHtml } from "../lib/letterTemplates.js";

const LETTER_FOLDER = path.join(uploadsDir, "letters");
if (!fs.existsSync(LETTER_FOLDER)) {
  fs.mkdirSync(LETTER_FOLDER, { recursive: true });
}

const COMPANY_CODE = "AG";
const COMPANY_NAME = "Arihant Dream Infra Project Ltd.";
const COMPANY_META = {
  iso: "An ISO 9001:2008 Certified Company",
  cin: "U70101RJ2011PLC035322",
  gst: "08AAJCA5226A1Z3",
  address: "2nd Floor, Class of Pearl, Income Tax Colony, Tonk Road, Jaipur",
  email: "info@arihantgroupjaipur.com",
  website: "www.arihantgroupjaipur.com",
  phone: "0141-2970900",
};

const templateCatalog = [
  { name: "Appointment Letter", type: "appointment", category: "recruitment" },
  { name: "Joining Letter", type: "joining", category: "recruitment" },
  { name: "Salary Approval Letter", type: "salary-approval", category: "payroll" },
  { name: "Early Salary Release Letter", type: "early-salary-release", category: "payroll" },
  { name: "Termination Letter", type: "termination", category: "exit" },
  { name: "Full & Final Settlement Letter", type: "full-final-settlement", category: "exit" },
  { name: "PF Deduction Request Letter", type: "pf-deduction-request", category: "policy" },
  { name: "SOP Work Timing Policy", type: "sop-work-timing", category: "policy" },
  { name: "CUG SIM Acknowledgement", type: "cug-sim-ack", category: "policy" },
  { name: "Offer Letter", type: "offer", category: "recruitment" },
];

const defaultVariables = [
  "employeeName",
  "designation",
  "department",
  "joiningDate",
  "salary",
  "noticePeriod",
  "date",
  "companyName",
  "effectiveDate",
  "subject",
  "address",
  "signatoryName",
  "signatoryDesignation",
];

const toString = (v) => String(v ?? "").trim();
const toLowerEmail = (value) => String(value ?? "").toLowerCase().trim();
const sanitizeTypeCode = (value) => toString(value).toUpperCase().replace(/[^A-Z0-9]+/g, "-");
const sanitizeFilename = (value, fallback = "offer-letter.pdf") => {
  const file = toString(value).replace(/[^a-zA-Z0-9._-]/g, "-");
  const name = file || fallback;
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
};

const generatePdfBufferFromHtml = async (htmlContent) => {
  let browser;
  try {
    let puppeteerModule;
    try {
      puppeteerModule = await import("puppeteer");
    } catch (error) {
      if (error?.code === "ERR_MODULE_NOT_FOUND") {
        const moduleError = new Error("PDF engine is not installed. Install `puppeteer` in backend dependencies.");
        moduleError.statusCode = 503;
        moduleError.code = "PDF_ENGINE_MISSING";
        throw moduleError;
      }
      throw error;
    }

    browser = await puppeteerModule.default.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfRaw = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "12mm", bottom: "16mm", left: "12mm" },
    });

    const pdfBuffer = Buffer.isBuffer(pdfRaw) ? pdfRaw : Buffer.from(pdfRaw);
    console.log(`[letters] PDF buffer size: ${pdfBuffer.length} bytes`);
    if (!pdfBuffer.length) {
      const error = new Error("Generated PDF buffer is empty.");
      error.statusCode = 500;
      throw error;
    }
    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
};

const defaultHeaderHtml = `
<div style="text-align:center; font-family: Georgia, 'Times New Roman', serif; margin-bottom: 10px;">
  <img src="${LOGO_URL}" style="width:120px;height:auto;display:block;margin:0 auto 10px auto;" alt="Company Logo" />
  <div style="font-size:22px; font-weight:700;">${COMPANY_NAME}</div>
  <div style="font-size:11px; margin-top:2px;">${COMPANY_META.iso}</div>
  <div style="font-size:11px;">${COMPANY_META.cin} | ${COMPANY_META.gst}</div>
  <div style="font-size:11px;">${COMPANY_META.address}</div>
  <div style="font-size:11px;">${COMPANY_META.email} | ${COMPANY_META.website} | ${COMPANY_META.phone}</div>
  <hr style="margin-top:10px; border:none; border-top:1px solid #222;" />
</div>`;

const defaultFooterHtml = `
<div style="font-size:10px; text-align:center; border-top:1px solid #444; padding-top:8px; color:#333;">
  ${COMPANY_META.cin} | ${COMPANY_META.gst} | ${COMPANY_META.address}<br/>
  ${COMPANY_META.email} | ${COMPANY_META.website} | ${COMPANY_META.phone}
</div>`;

const defaultBody = (title) => `
<p style="text-align:right;"><strong>Date:</strong> {{date}}</p>
<p>To,<br/>Mr./Ms. {{employeeName}}<br/>{{designation}}<br/>{{department}}<br/>{{address}}</p>
<p><strong>Subject:</strong> {{subject}}</p>
<p>Dear Mr./Ms. {{employeeName}},</p>
<p>This letter is issued in reference to your employment terms with {{companyName}}.</p>
<ol>
  <li>Your effective date of appointment is {{effectiveDate}}.</li>
  <li>Your monthly compensation structure is INR {{salary}}.</li>
  <li>Applicable notice period is {{noticePeriod}}.</li>
</ol>
<p>Please comply with all organizational policies and statutory obligations.</p>
<p>Yours Sincerely,<br/>For {{companyName}}</p>
<p><strong>Authorized Signatory</strong><br/>{{signatoryName}}<br/>{{signatoryDesignation}}</p>
<p style="margin-top:20px; border-top:1px solid #777; padding-top:8px;">
I agree to accept employment on the above terms.<br/>
Name: ____________<br/>
Signature: ____________<br/>
Date: ____________ &nbsp;&nbsp; Place: ____________
</p>`;

const renderVariables = (template, values) => {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const value = values[key];
    return value === undefined || value === null || value === "" ? `{{${key}}}` : String(value);
  });
};

const wrapPrintableHtml = ({ title, headerHtml, bodyHtml, footerHtml }) => `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: A4; margin: 24mm 16mm 24mm 16mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 0; }
  .page { width: 100%; }
  .letter-title { text-align: center; font-weight: 700; font-size: 20px; letter-spacing: 0.7px; margin: 12px 0 18px; }
  .content { font-size: 13px; line-height: 1.6; }
  .content p { margin: 0 0 10px; }
  .content ol { margin: 0 0 12px 18px; }
  .header, .footer { width: 100%; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">${headerHtml}</div>
    <div class="letter-title">${title.toUpperCase()}</div>
    <div class="content">${bodyHtml}</div>
    <div class="footer">${footerHtml}</div>
  </div>
</body>
</html>`;

const getVariableContext = async ({ employeeId, candidateId, customValues = {} }) => {
  const settings = await getSystemSettings({ lean: true });
  const company = settings.company || {};
  let employee = null;
  let candidate = null;

  if (employeeId) {
    employee = await Employee.findById(employeeId).populate("userId", "name email department");
  }

  if (candidateId) {
    candidate = await Candidate.findById(candidateId);
  }

  const personName = employee?.userId?.name || candidate?.fullName || "";
  const department = employee?.userId?.department || candidate?.positionApplied || "";

  return {
    employeeName: personName,
    designation: employee?.designation || candidate?.positionApplied || "",
    department,
    joiningDate: employee?.joiningDate ? new Date(employee.joiningDate).toLocaleDateString("en-GB") : "",
    salary: employee?.salary || candidate?.stage2Details?.expectedSalary || "",
    noticePeriod: candidate?.stage2Details?.noticePeriod || "30 days",
    date: new Date().toLocaleDateString("en-GB"),
    companyName: company.companyName || COMPANY_NAME,
    effectiveDate: customValues.effectiveDate || new Date().toLocaleDateString("en-GB"),
    subject: customValues.subject || "Official Communication",
    address: customValues.address || candidate?.stage1?.contactDetails?.currentAddress || "",
    signatoryName: customValues.signatoryName || "HR Department",
    signatoryDesignation: customValues.signatoryDesignation || "Authorized Signatory",
    ...customValues,
  };
};

const generateLetterNumber = async (type) => {
  const year = new Date().getFullYear();
  const code = sanitizeTypeCode(type).replace(/-/g, "");
  const prefix = `${COMPANY_CODE}/${year}/${code}`;
  const count = await GeneratedLetter.countDocuments({ letterNumber: { $regex: `^${prefix}/` } });
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}/${seq}`;
};

const writeHtmlAndPdf = async ({ html, letterNumber }) => {
  const safe = letterNumber.replace(/[^A-Za-z0-9_-]/g, "_");
  const htmlName = `${safe}.html`;
  const htmlPath = path.join(LETTER_FOLDER, htmlName);
  fs.writeFileSync(htmlPath, html, "utf8");

  let pdfUrl = `/uploads/letters/${htmlName}`;

  try {
    const puppeteerModule = await import("puppeteer");
    const browser = await puppeteerModule.default.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfName = `${safe}.pdf`;
    const pdfPath = path.join(LETTER_FOLDER, pdfName);
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true, margin: { top: "16mm", right: "12mm", bottom: "16mm", left: "12mm" } });
    await browser.close();
    pdfUrl = `/uploads/letters/${pdfName}`;
  } catch {
    // Fallback to HTML output if puppeteer is not installed.
  }

  return pdfUrl;
};

const toCsv = (rows) => {
  const headers = ["letterNumber", "type", "category", "status", "issuedDate"];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push([
      row.letterNumber,
      row.type,
      row.category,
      row.status,
      row.issuedDate ? new Date(row.issuedDate).toISOString() : "",
    ].map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
};

export const seedDefaultTemplates = async (req, res) => {
  const existing = await LetterTemplate.countDocuments();
  if (existing > 0) {
    return res.json({ success: true, message: "Templates already exist", data: null });
  }

  const created = await Promise.all(
    templateCatalog.map((item) =>
      LetterTemplate.create({
        name: item.name,
        type: item.type,
        category: item.category,
        title: item.name,
        content: defaultBody(item.name),
        headerHtml: defaultHeaderHtml,
        footerHtml: defaultFooterHtml,
        variables: defaultVariables,
        version: 1,
        isActive: true,
        createdBy: req.user._id,
        auditHistory: [{ action: "seed", userId: req.user._id, notes: "Default template seeded" }],
      })
    )
  );

  return res.status(201).json({ success: true, message: "Default templates created", data: created });
};

export const listTemplates = async (req, res) => {
  const { category = "", type = "", active = "" } = req.query;
  const filter = {};
  if (category) filter.category = String(category).toLowerCase();
  if (type) filter.type = String(type).toLowerCase();
  if (active !== "") filter.isActive = active === "true";

  const data = await LetterTemplate.find(filter).sort({ updatedAt: -1 });
  return res.json({ success: true, message: "Fetched templates", data });
};

export const getTemplateById = async (req, res) => {
  const data = await LetterTemplate.findById(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: "Template not found" });
  return res.json({ success: true, message: "Fetched template", data });
};

export const createTemplate = async (req, res) => {
  const payload = req.body || {};
  const created = await LetterTemplate.create({
    name: toString(payload.name),
    type: toString(payload.type).toLowerCase(),
    category: toString(payload.category).toLowerCase(),
    title: toString(payload.title || payload.name),
    content: toString(payload.content),
    headerHtml: toString(payload.headerHtml || defaultHeaderHtml),
    footerHtml: toString(payload.footerHtml || defaultFooterHtml),
    variables: Array.isArray(payload.variables) ? payload.variables.map((v) => toString(v)).filter(Boolean) : defaultVariables,
    version: Number(payload.version || 1),
    isActive: payload.isActive !== false,
    createdBy: req.user._id,
    auditHistory: [{ action: "create", userId: req.user._id, notes: "Template created" }],
  });

  return res.status(201).json({ success: true, message: "Template created", data: created });
};

export const updateTemplate = async (req, res) => {
  const template = await LetterTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ success: false, message: "Template not found" });

  const payload = req.body || {};
  template.name = toString(payload.name || template.name);
  template.type = toString(payload.type || template.type).toLowerCase();
  template.category = toString(payload.category || template.category).toLowerCase();
  template.title = toString(payload.title || template.title);
  template.content = toString(payload.content || template.content);
  template.variables = Array.isArray(payload.variables) ? payload.variables.map((v) => toString(v)).filter(Boolean) : template.variables;
  template.isActive = payload.isActive === undefined ? template.isActive : Boolean(payload.isActive);
  template.version = Number(template.version || 1) + 1;
  template.auditHistory.push({ action: "update", userId: req.user._id, notes: "Template updated" });

  await template.save();
  return res.json({ success: true, message: "Template updated", data: template });
};

export const duplicateTemplate = async (req, res) => {
  const source = await LetterTemplate.findById(req.params.id);
  if (!source) return res.status(404).json({ success: false, message: "Template not found" });

  const duplicate = await LetterTemplate.create({
    name: `${source.name} (Copy)`,
    type: source.type,
    category: source.category,
    title: source.title,
    content: source.content,
    headerHtml: source.headerHtml,
    footerHtml: source.footerHtml,
    variables: source.variables,
    version: 1,
    isActive: false,
    createdBy: req.user._id,
    parentTemplateId: source._id,
    auditHistory: [{ action: "duplicate", userId: req.user._id, notes: `Duplicated from ${source._id}` }],
  });

  return res.status(201).json({ success: true, message: "Template duplicated", data: duplicate });
};

export const toggleTemplateActive = async (req, res) => {
  const template = await LetterTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ success: false, message: "Template not found" });
  template.isActive = !template.isActive;
  template.auditHistory.push({ action: template.isActive ? "activate" : "deactivate", userId: req.user._id, notes: "Template status changed" });
  await template.save();
  return res.json({ success: true, message: "Template status updated", data: template });
};

export const listTemplateVersions = async (req, res) => {
  const template = await LetterTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ success: false, message: "Template not found" });

  const data = await LetterTemplate.find({ $or: [{ _id: template._id }, { parentTemplateId: template._id }, { _id: template.parentTemplateId }] }).sort({ createdAt: -1 });
  return res.json({ success: true, message: "Fetched template versions", data });
};

export const generateLetter = async (req, res) => {
  const {
    templateId,
    employeeId = null,
    candidateId = null,
    subject = "Official Communication",
    customValues = {},
    contentOverride = "",
    approvalRequired = false,
    sendEmail = false,
  } = req.body;

  if (!templateId || (!employeeId && !candidateId)) {
    return res.status(400).json({ success: false, message: "Template and recipient are required" });
  }

  const template = await LetterTemplate.findById(templateId);
  if (!template) return res.status(404).json({ success: false, message: "Template not found" });

  const variableContext = await getVariableContext({ employeeId, candidateId, customValues: { ...customValues, subject } });
  const bodyHtml = renderVariables(contentOverride || template.content, variableContext);
  const headerHtml = renderVariables(template.headerHtml || defaultHeaderHtml, variableContext);
  const footerHtml = renderVariables(template.footerHtml || defaultFooterHtml, variableContext);
  const finalHtml = wrapPrintableHtml({ title: template.title || template.name, headerHtml, bodyHtml, footerHtml });

  const letterNumber = await generateLetterNumber(template.type);
  const pdfUrl = await writeHtmlAndPdf({ html: finalHtml, letterNumber });

  const letter = await GeneratedLetter.create({
    letterNumber,
    type: template.type,
    category: template.category,
    employeeId,
    candidateId,
    templateId: template._id,
    generatedContent: finalHtml,
    status: sendEmail ? "Sent" : "Generated",
    pdfUrl,
    issuedDate: new Date(),
    createdBy: req.user._id,
    version: template.version,
    approvalStatus: approvalRequired ? "Pending Director Approval" : "Approved",
    sentAt: sendEmail ? new Date() : null,
    auditHistory: [{ action: "generate", userId: req.user._id, notes: "Letter generated" }],
  });

  if (employeeId) {
    await Employee.findByIdAndUpdate(employeeId, { $addToSet: { letters: letter._id } });
  }

  return res.status(201).json({ success: true, message: "Letter generated", data: letter });
};

export const listGeneratedLetters = async (req, res) => {
  const { type = "", employeeId = "", dateFrom = "", dateTo = "", category = "" } = req.query;
  const filter = {};
  if (type) filter.type = String(type).toLowerCase();
  if (category) filter.category = String(category).toLowerCase();
  if (employeeId) filter.employeeId = employeeId;
  if (dateFrom || dateTo) {
    filter.issuedDate = {};
    if (dateFrom) filter.issuedDate.$gte = new Date(dateFrom);
    if (dateTo) filter.issuedDate.$lte = new Date(dateTo);
  }

  const data = await GeneratedLetter.find(filter)
    .populate("templateId", "name type category")
    .populate({ path: "employeeId", populate: { path: "userId", select: "name email" } })
    .populate("candidateId", "fullName email")
    .sort({ createdAt: -1 });

  return res.json({ success: true, message: "Fetched generated letters", data });
};

export const getGeneratedLetterById = async (req, res) => {
  const data = await GeneratedLetter.findById(req.params.id)
    .populate("templateId", "name type category")
    .populate({ path: "employeeId", populate: { path: "userId", select: "name email" } })
    .populate("candidateId", "fullName email");
  if (!data) return res.status(404).json({ success: false, message: "Letter not found" });
  return res.json({ success: true, message: "Fetched letter", data });
};

export const markLetterSent = async (req, res) => {
  const letter = await GeneratedLetter.findById(req.params.id);
  if (!letter) return res.status(404).json({ success: false, message: "Letter not found" });
  letter.status = "Sent";
  letter.sentAt = new Date();
  letter.auditHistory.push({ action: "sent", userId: req.user._id, notes: "Marked as sent" });
  await letter.save();
  return res.json({ success: true, message: "Letter marked as sent", data: letter });
};

const canAccessLetter = async (user, letter) => {
  if (user.role === "admin") return true;
  if (user.role === "employee" && letter.employeeId) {
    const employee = await ensureEmployeeProfileForUser(user);
    return employee && String(employee._id) === String(letter.employeeId);
  }
  if (user.role === "candidate" && letter.candidateId) {
    const candidate = await Candidate.findOne({ userId: user._id });
    return candidate && String(candidate._id) === String(letter.candidateId);
  }
  return false;
};

export const listMyLetters = async (req, res) => {
  const user = req.user;
  let filter = { _id: null };

  if (user.role === "admin") {
    filter = {};
  }

  if (user.role === "employee") {
    const employee = await ensureEmployeeProfileForUser(user);
    filter = employee ? { employeeId: employee._id } : { _id: null };
  }

  if (user.role === "candidate") {
    const candidate = await Candidate.findOne({ userId: user._id });
    filter = candidate ? { candidateId: candidate._id } : { _id: null };
  }

  const data = await GeneratedLetter.find(filter).sort({ issuedDate: -1 });
  return res.json({ success: true, message: "Fetched my letters", data });
};

export const respondToLetter = async (req, res) => {
  const letter = await GeneratedLetter.findById(req.params.id);
  if (!letter) return res.status(404).json({ success: false, message: "Letter not found" });

  const access = await canAccessLetter(req.user, letter);
  if (!access) return res.status(403).json({ success: false, message: "Forbidden" });

  const { action } = req.body;
  if (!["Accepted", "Rejected", "Signed", "Viewed"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action" });
  }

  letter.status = action;
  letter.respondedAt = new Date();
  if (action === "Viewed") {
    letter.viewedAt = new Date();
  }
  letter.auditHistory.push({ action: action.toLowerCase(), userId: req.user._id, notes: `Letter ${action.toLowerCase()}` });
  await letter.save();

  return res.json({ success: true, message: `Letter ${action.toLowerCase()}`, data: letter });
};

export const downloadLetter = async (req, res) => {
  const letter = await GeneratedLetter.findById(req.params.id);
  if (!letter) return res.status(404).json({ success: false, message: "Letter not found" });

  const access = await canAccessLetter(req.user, letter);
  if (!access) return res.status(403).json({ success: false, message: "Forbidden" });

  // If PDF exists, send it directly
  if (letter.pdfUrl && letter.pdfUrl.endsWith('.pdf')) {
    const pdfPath = path.join(LETTER_FOLDER, path.basename(letter.pdfUrl));
    if (fs.existsSync(pdfPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="letter-${letter.letterNumber}.pdf"`);
      return res.sendFile(pdfPath);
    }
  }

  // Fallback: If no PDF, send HTML content
  if (letter.generatedContent) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="letter-${letter.letterNumber}.html"`);
    return res.send(letter.generatedContent);
  }

  return res.status(404).json({ success: false, message: "File not available" });
};

export const getLetterAnalytics = async (_req, res) => {
  const monthly = await GeneratedLetter.aggregate([
    {
      $group: {
        _id: {
          y: { $year: "$issuedDate" },
          m: { $month: "$issuedDate" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1 } },
  ]);

  const activeTemplates = await LetterTemplate.countDocuments({ isActive: true });
  const lastGenerated = await GeneratedLetter.findOne().sort({ createdAt: -1 });

  return res.json({
    success: true,
    message: "Fetched analytics",
    data: {
      activeTemplates,
      lastGenerated,
      monthly,
    },
  });
};

export const exportLettersCsv = async (_req, res) => {
  const rows = await GeneratedLetter.find().sort({ issuedDate: -1 });
  const csv = toCsv(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=letters-export.csv");
  return res.send(csv);
};

export const deleteGeneratedLetter = async (req, res) => {
  const deleted = await GeneratedLetter.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Letter not found" });
  return res.json({ success: true, message: "Letter deleted", data: deleted });
};

export const generateOfferLetterPdf = async (req, res) => {
  const { htmlContent, fileName = "offer-letter.pdf" } = req.body || {};

  if (!toString(htmlContent)) {
    return res.status(400).json({ success: false, message: "Letter HTML content is required." });
  }

  try {
    const pdfBuffer = await generatePdfBufferFromHtml(htmlContent);
    const safeFilename = sanitizeFilename(fileName, "offer-letter.pdf");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${safeFilename}`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("Offer PDF generation error:", error);
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate offer letter PDF.",
    });
  }
};

// New function to send letter via email
export const sendLetterByEmail = async (req, res) => {
  const { letterType, formData = {}, htmlContent, employeeEmail, candidateId = null } = req.body;
  const normalizedEmployeeEmail = toLowerEmail(employeeEmail);
  const normalizedFormData = typeof formData === "object" && formData !== null ? formData : {};
  const letterTypeLower = toString(letterType).toLowerCase();
  let resolvedHtmlContent = toString(htmlContent);

  if (!normalizedEmployeeEmail) {
    return res.status(400).json({ success: false, message: "Employee email is required" });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmployeeEmail)) {
    return res.status(400).json({ success: false, message: "Please provide a valid employee email address." });
  }

  if (!resolvedHtmlContent && !letterTypeLower) {
    return res.status(400).json({ success: false, message: "Letter HTML content is required" });
  }

  try {
    if (letterTypeLower.includes('offer')) {
      resolvedHtmlContent = generateOfferLetterHtml({
        candidateName: normalizedFormData.candidateName || normalizedFormData.employeeName || 'Candidate',
        position: normalizedFormData.position || normalizedFormData.designation || 'Position',
        joiningDate: normalizedFormData.joiningDate || normalizedFormData.effectiveDate,
        salary: normalizedFormData.salary || normalizedFormData.ctc || '',
        hrName: normalizedFormData.authorizedSignatoryName || 'Amit Verma',
        hrDesignation: normalizedFormData.authorizedSignatoryDesignation || 'Head - Human Resources',
        date: new Date().toLocaleDateString('en-GB'),
        companyName: normalizedFormData.companyName || COMPANY_NAME,
        address: normalizedFormData.address || normalizedFormData.officeAddress || ''
      });
    } else if (letterTypeLower.includes('internship')) {
      resolvedHtmlContent = generateInternshipLetterHtml({
        candidateName: normalizedFormData.candidateName || normalizedFormData.employeeName || 'Candidate',
        position: normalizedFormData.position || normalizedFormData.designation || 'Internship Position',
        startDate: normalizedFormData.startDate || normalizedFormData.joiningDate,
        endDate: normalizedFormData.endDate,
        stipend: normalizedFormData.stipend || normalizedFormData.salary || '',
        hrName: normalizedFormData.authorizedSignatoryName || 'Amit Verma',
        hrDesignation: normalizedFormData.authorizedSignatoryDesignation || 'Head - Human Resources',
        date: new Date().toLocaleDateString('en-GB'),
        companyName: normalizedFormData.companyName || COMPANY_NAME,
        address: normalizedFormData.address || normalizedFormData.officeAddress || ''
      });
    }

    if (!resolvedHtmlContent) {
      return res.status(400).json({ success: false, message: "Unable to generate letter HTML content." });
    }

    const pdfBuffer = await generatePdfBufferFromHtml(resolvedHtmlContent);

    const subject = `${letterType || "Official Letter"} - ${normalizedFormData.employeeName || normalizedFormData.candidateName || "Recipient"}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Dear ${normalizedFormData.employeeName || normalizedFormData.candidateName || "Recipient"},</h2>
        <p>Please find attached your official ${letterTypeLower.includes('offer') ? 'offer' : letterTypeLower.includes('internship') ? 'internship offer' : 'letter'} from ${normalizedFormData.companyName || COMPANY_NAME}.</p>
        <p>Please review the details and confirm your acceptance.</p>
        <p>If you have any questions, please contact the HR department.</p>
        <br/>
        <p>Best Regards,</p>
        <p>${normalizedFormData.authorizedSignatoryName || "HR Department"}</p>
        <p>${normalizedFormData.authorizedSignatoryDesignation || ""}</p>
      </div>
    `;

    const emailResult = await maybeSendEmailBySettings(() =>
      sendBrevoEmail({
        to: normalizedEmployeeEmail,
        subject: subject,
        html: emailHtml,
        attachments: [
          {
            name: sanitizeFilename(`${letterTypeLower || "letter"}-${normalizedFormData.employeeName || normalizedFormData.candidateName || "recipient"}.pdf`),
            content: pdfBuffer.toString("base64")
          }
        ],
      })
    );


    if (emailResult.skipped) {
      return res.status(409).json({ success: false, message: emailResult.message });
    }

    if (!emailResult.success) {
      return res.status(502).json({
        success: false,
        message: "Email delivery failed. Check SMTP credentials or Gmail app password.",
        error: emailResult.error || "Unknown email transport error.",
        code: emailResult.code || "EMAIL_SEND_FAILED",
      });
    }

    const normalizedType = toString(letterType).toLowerCase();
    if (normalizedType.includes("offer")) {
      const candidate = candidateId ? await Candidate.findById(candidateId) : null;

      if (!candidate) {
        return res.json({
          success: true,
          message: `Letter sent to ${normalizedEmployeeEmail} successfully`,
        });
      }

      if (!["Selected", "Offered"].includes(candidate.status)) {
        return res.status(400).json({
          success: false,
          message: `Offer can only be sent to candidates in Selected/Offered state. Current state: ${candidate.status}`,
        });
      }

      candidate.status = "Offered";
      candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 4);
      candidate.activityTimeline = Array.isArray(candidate.activityTimeline) ? candidate.activityTimeline : [];
      if (!candidate.activityTimeline.some((item) => item.key === "offer_sent")) {
        candidate.activityTimeline.push({
          key: "offer_sent",
          title: "Offer Letter Sent",
          description: "Offer letter has been sent to candidate.",
          at: new Date(),
        });
      }
      await candidate.save();
      const settings = await getSystemSettings({ lean: true });
      if (settings.notifications?.offerLetterNotifications !== false) {
        await createNotificationForCandidate({
          candidate,
          title: "Offer Letter Sent",
          message: "Your offer letter has been sent. Please review the next steps in your portal.",
          type: "offer-letter",
        });
      }

      return res.json({
        success: true,
        message: `Offer letter sent to ${normalizedEmployeeEmail} and candidate status updated to Offered.`,
        data: candidate,
      });
    } else {
      return res.json({
        success: true,
        message: `Letter sent to ${normalizedEmployeeEmail} successfully`,
      });
    }
  } catch (error) {
    console.error("[letters] sendLetterByEmail failed:", {
      userId: req.user?._id,
      letterType,
      employeeEmail: normalizedEmployeeEmail,
      candidateId,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send letter. Please try again.",
    });
  }
};
