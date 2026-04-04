import { formatDate } from "@/lib/date";

export type CorporateLetterType =
  | "Offer Letter"
  | "Salary Approval Letter"
  | "Termination Letter"
  | "Early Salary Release Letter"
  | "PF Deduction Request Letter"
  | "SOP Work Timing Notice"
  | "Full & Final Settlement Letter"
  | "Joining Letter"
  | "CUG SIM Acknowledgment Letter";

export interface CorporateLetterData {
  employeeName: string;
  employeeEmail: string;
  designation: string;
  department: string;
  salary: string;
  joiningDate: string;
  lastWorkingDate: string;
  showLastWorkingDate: boolean;
  employeeId: string;
  companyName: string;
  companyAddress: string;
  CIN: string;
  GST: string;
  companyLegalName: string;
  companyContact: string;
  isoLine: string;
  recipientCompanyName: string;
  officeAddress: string;
  employmentType: string;
  ctc: string;
  effectiveDate: string;
  letterDate: string;
  authorizedSignatoryName: string;
  authorizedSignatoryDesignation: string;
}

interface LetterTemplate {
  title: string;
  subject: string;
  bodyParagraphs: string[];
  includeDetails: boolean;
  includeLastWorkingDate: boolean;
}

const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

const fill = (value: string, data: CorporateLetterData): string =>
  value.replace(PLACEHOLDER_REGEX, (_, key: keyof CorporateLetterData) => String(data[key] || ""));

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, String.fromCharCode(34))
    .replace(/'/g, "&#39;");
};

const sanitize = (value: string, data: CorporateLetterData): string => escapeHtml(fill(value, data));

export const corporateLetterTypes: CorporateLetterType[] = [
  "Offer Letter",
  "Salary Approval Letter",
  "Termination Letter",
  "Early Salary Release Letter",
  "PF Deduction Request Letter",
  "SOP Work Timing Notice",
  "Full & Final Settlement Letter",
  "Joining Letter",
  "CUG SIM Acknowledgment Letter",
];

const templates: Record<CorporateLetterType, LetterTemplate> = {
  "Offer Letter": {
    title: "OFFER LETTER",
    subject: "Subject: Offer of Employment - {{designation}}",
    bodyParagraphs: [
      "With reference to your application and subsequent discussions, we are pleased to offer you the position of {{designation}} in the {{department}} department of {{companyName}}.",
      "Your employment shall be on {{employmentType}} basis, with date of joining on {{joiningDate}}. The annual Cost to Company (CTC) offered is INR {{ctc}}, with applicable monthly salary and statutory deductions as per company policy.",
      "You are requested to confirm acceptance of this offer and complete onboarding formalities on or before the joining date. This offer is subject to verification of documents, background checks, and compliance with internal policies.",
    ],
    includeDetails: true,
    includeLastWorkingDate: false,
  },
  "Salary Approval Letter": {
    title: "SALARY APPROVAL LETTER",
    subject: "Subject: Approval of Revised Salary for Employee ID {{employeeId}}",
    bodyParagraphs: [
      "This is to formally confirm that the salary revision of {{employeeName}} (Employee ID: {{employeeId}}), designated as {{designation}} in the {{department}} department, has been reviewed and approved by the management.",
      "With effect from {{effectiveDate}}, the approved monthly salary shall be INR {{salary}}, and the annual Cost to Company (CTC) shall be INR {{ctc}}. This approval is made in accordance with company policy and the employee's performance review outcomes.",
      "All concerned teams are instructed to ensure this revision is incorporated in payroll and statutory records within the current processing cycle.",
    ],
    includeDetails: true,
    includeLastWorkingDate: false,
  },
  "Termination Letter": {
    title: "TERMINATION LETTER",
    subject: "Subject: Notice of Termination of Employment",
    bodyParagraphs: [
      "This letter serves as formal notice that your employment with {{companyName}} in the capacity of {{designation}} (Employee ID: {{employeeId}}), {{department}} department, stands terminated with effect from {{lastWorkingDate}}.",
      "The decision has been taken after due review in alignment with the terms of employment and applicable company policies. You are advised to complete all handover formalities and return company assets before your last working day.",
      "Final settlement dues, if any, shall be processed as per policy and statutory timelines after completion of clearance formalities.",
    ],
    includeDetails: true,
    includeLastWorkingDate: true,
  },
  "Early Salary Release Letter": {
    title: "EARLY SALARY RELEASE LETTER",
    subject: "Subject: Approval for Early Salary Disbursement",
    bodyParagraphs: [
      "With reference to your request, this is to confirm that early release of salary has been approved for {{employeeName}} (Employee ID: {{employeeId}}), {{designation}}, {{department}} department.",
      "An amount of INR {{salary}} has been approved for early disbursement, subject to standard accounting deductions and compliance checks.",
      "Finance and Payroll teams are hereby instructed to process the approved amount on priority and ensure proper recording in payroll statements.",
    ],
    includeDetails: true,
    includeLastWorkingDate: false,
  },
  "PF Deduction Request Letter": {
    title: "PF DEDUCTION REQUEST LETTER",
    subject: "Subject: Provident Fund Deduction Authorization",
    bodyParagraphs: [
      "This is to acknowledge and approve the request submitted by {{employeeName}} (Employee ID: {{employeeId}}), currently serving as {{designation}} in the {{department}} department, for Provident Fund deduction.",
      "Accordingly, PF deduction shall be applied to monthly salary as per statutory rules, with effect from {{effectiveDate}}. The payroll team shall ensure compliance with applicable EPF regulations.",
      "This authorization is issued for official records and implementation by HR and Payroll departments.",
    ],
    includeDetails: true,
    includeLastWorkingDate: false,
  },
  "SOP Work Timing Notice": {
    title: "SOP WORK TIMING NOTICE",
    subject: "Subject: Standard Operating Procedure - Office Work Timings",
    bodyParagraphs: [
      "This notice is issued to formally communicate standard work timing expectations for all employees. {{employeeName}} (Employee ID: {{employeeId}}), {{designation}}, {{department}} department, is required to adhere to prescribed attendance and reporting timings.",
      "All employees are expected to maintain punctuality, comply with attendance logging protocols, and seek prior approval for any deviations from standard schedule.",
      "This SOP shall be effective from {{effectiveDate}} and remains applicable until further written communication.",
    ],
    includeDetails: false,
    includeLastWorkingDate: false,
  },
  "Full & Final Settlement Letter": {
    title: "FULL & FINAL SETTLEMENT LETTER",
    subject: "Subject: Full and Final Settlement Intimation",
    bodyParagraphs: [
      "This is to confirm that Full and Final Settlement processing has been initiated for {{employeeName}} (Employee ID: {{employeeId}}), formerly {{designation}} in the {{department}} department, with last working date {{lastWorkingDate}}.",
      "The settlement amount shall be computed considering eligible salary components, leave encashment, statutory dues, and recoveries, in accordance with company policy and legal requirements.",
      "Payment of admissible dues shall be released post completion of all exit clearances and approval formalities.",
    ],
    includeDetails: true,
    includeLastWorkingDate: true,
  },
  "Joining Letter": {
    title: "JOINING LETTER",
    subject: "Subject: Appointment and Joining Confirmation",
    bodyParagraphs: [
      "We are pleased to confirm your joining with {{companyName}} as {{designation}} in the {{department}} department, with effect from {{joiningDate}}.",
      "Your employment type shall be {{employmentType}}, with a CTC of INR {{ctc}} per annum and monthly salary as per company payroll structure.",
      "You are requested to comply with all organizational policies, confidentiality requirements, and statutory obligations applicable to your role.",
    ],
    includeDetails: true,
    includeLastWorkingDate: false,
  },
  "CUG SIM Acknowledgment Letter": {
    title: "CUG SIM ACKNOWLEDGMENT LETTER",
    subject: "Subject: Corporate CUG SIM Issuance Acknowledgment",
    bodyParagraphs: [
      "This is to formally acknowledge that a Corporate CUG SIM has been issued to {{employeeName}} (Employee ID: {{employeeId}}), {{designation}}, {{department}} department, for official business communication.",
      "The SIM connection is company property and must be used strictly for authorized professional purposes in compliance with IT and communication policies.",
      "In case of separation from service or role transition, the employee shall return or transfer all company communication assets as directed by the administration team.",
    ],
    includeDetails: true,
    includeLastWorkingDate: false,
  },
};

const getDetailsRows = (data: CorporateLetterData, showLastWorkingDate: boolean): [string, string][] => {
  const rows: [string, string][] = [
    ["Employee Name", data.employeeName],
    ["Employee ID", data.employeeId],
    ["Designation", data.designation],
    ["Department", data.department],
    ["Employment Type", data.employmentType],
    ["Monthly Salary", data.salary],
    ["CTC", data.ctc],
    ["Joining Date", data.joiningDate],
    ["Effective Date", data.effectiveDate],
  ];
  
  if (showLastWorkingDate) {
    rows.splice(8, 0, ["Last Working Date", data.lastWorkingDate]);
  }
  
  return rows;
};

export const buildCorporateLetterHtml = (
  letterType: CorporateLetterType,
  data: CorporateLetterData,
  logoUrl: string,
): string => {
  const template = templates[letterType];
  const showLastWorkingDate = data.showLastWorkingDate && template.includeLastWorkingDate;
  
  const normalizedData: CorporateLetterData = {
    ...data,
    joiningDate: formatDate(data.joiningDate),
    lastWorkingDate: formatDate(data.lastWorkingDate),
    effectiveDate: formatDate(data.effectiveDate),
    letterDate: formatDate(data.letterDate),
  };

  const detailRows = getDetailsRows(normalizedData, showLastWorkingDate);

  return `
    <article class="letter-page">
      <header class="letter-header">
        <img src="${escapeHtml(logoUrl)}" alt="Company Logo" class="letter-logo" />
        <div>
          <h1 class="company-name">${sanitize("{{companyName}}", normalizedData)}</h1>
          <p class="company-meta">${sanitize("{{isoLine}}", normalizedData)}</p>
          <p class="company-meta">${sanitize("{{companyAddress}}", normalizedData)}</p>
          <p class="company-meta">CIN: ${sanitize("{{CIN}}", normalizedData)} | GST: ${sanitize("{{GST}}", normalizedData)}</p>
          <p class="company-meta">${sanitize("{{companyContact}}", normalizedData)}</p>
        </div>
      </header>

      <h2 class="letter-title">${escapeHtml(template.title)}</h2>

      <p class="letter-date"><strong>Date:</strong> ${sanitize("{{letterDate}}", normalizedData)}</p>

      <section class="recipient-block">
        <p><strong>To,</strong></p>
        <p>${sanitize("{{employeeName}}", normalizedData)}</p>
        <p>${sanitize("{{designation}}", normalizedData)}</p>
        <p>${sanitize("{{department}}", normalizedData)} Department</p>
        <p>${sanitize("{{recipientCompanyName}}", normalizedData)}</p>
        <p>${sanitize("{{officeAddress}}", normalizedData)}</p>
      </section>

      <p class="subject-line">${sanitize(template.subject, normalizedData)}</p>

      <section class="body-block">
        ${template.bodyParagraphs.map((paragraph) => `<p>${sanitize(paragraph, normalizedData)}</p>`).join("")}
      </section>

      ${
        template.includeDetails
          ? `
        <p class="details-title">Employee Details:</p>
        <table class="details-table">
          <tbody>
            ${detailRows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}
          </tbody>
        </table>
      `
          : ""
      }

      <section class="signature-block">
        <p>Yours sincerely,</p>
        <p>For ${sanitize("{{companyName}}", normalizedData)}</p>
        <p class="signature-space">______________________________</p>
        <p>${sanitize("{{authorizedSignatoryName}}", normalizedData)}</p>
        <p>${sanitize("{{authorizedSignatoryDesignation}}", normalizedData)}</p>
      </section>

      <hr class="footer-divider" />
      <footer class="footer-block">
        <p><strong>${sanitize("{{companyLegalName}}", normalizedData)}</strong></p>
        <p>${sanitize("{{companyAddress}}", normalizedData)}</p>
        <p>${sanitize("{{companyContact}}", normalizedData)}</p>
        <p>CIN: ${sanitize("{{CIN}}", normalizedData)} | GST: ${sanitize("{{GST}}", normalizedData)}</p>
      </footer>
    </article>
  `;
};

export const defaultCorporateLetterData: CorporateLetterData = {
  employeeName: "Employee Name",
  employeeEmail: "",
  designation: "Designation",
  department: "Department",
  salary: "75,000",
  joiningDate: "2024-04-01",
  lastWorkingDate: "2026-03-31",
  showLastWorkingDate: false,
  employeeId: "EMP-0001",
  companyName: "Arihant Dream Infra Project Ltd.",
  companyAddress: "2nd Floor,Class of Pearl,Income Tax Colony, Tonk Road, Jaipur",
  CIN: "U70101RJ2011PLC035322",
  GST: "08AAJCA5226A1Z3",
  companyLegalName: "Arihant Dream Infra Project Ltd.",
  companyContact: "Tel.: 0141-2970900 | Email: info@arihantgroupjaipur.com |URL: www.arihantgroupjaipur.com",
  isoLine: "An ISO 9001:2008 Certified Company",
  recipientCompanyName: "Arihant Dream Infra Project Ltd.",
  officeAddress: "2nd Floor,Class of Pearl,Income Tax Colony, Tonk Road, Jaipur",
  employmentType: "Full-Time",
  ctc: "9,00,000",
  effectiveDate: "2026-04-01",
  letterDate: new Date().toISOString().slice(0, 10),
  authorizedSignatoryName: "Amit Verma",
  authorizedSignatoryDesignation: "Head - Human Resources",
};
