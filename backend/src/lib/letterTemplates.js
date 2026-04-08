import { LOGO_URL } from '../utils/logo.js';

const COMPANY_NAME = 'Arihant Dream Infra Project Ltd.';
const COMPANY_LEGAL = 'Arihant Dream Infra Project Ltd.';
const COMPANY_ADDRESS = '2nd Floor, Class of Pearl, Income Tax Colony, Tonk Road, Jaipur';
const COMPANY_CONTACT = 'Tel.: 0141-2970900 | Email: info@arihantgroupjaipur.com | URL: www.arihantgroupjaipur.com';
const CIN = 'U70101RJ2011PLC035322';
const GST = '08AAJCA5226A1Z3';
const ISO_LINE = 'An ISO 9001:2008 Certified Company';

const buildLetterDocument = ({ title, companyName, headerContent, footerContent, bodyContent }) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .letter-shell {
      position: relative;
      min-height: 100%;
      padding: 44mm 0 24mm;
    }
    .fixed-letter-header,
    .fixed-letter-footer {
      position: fixed;
      left: 0;
      right: 0;
      background: #fff;
      z-index: 2;
    }
    .fixed-letter-header {
      top: 0;
      padding: 0 0 8mm;
    }
    .fixed-letter-footer {
      bottom: 0;
      padding: 6mm 0 0;
    }
    .header-line,
    .footer-line {
      border: none;
      border-top: 1px solid #d4d4d8;
      margin: 0 0 8px;
    }
    .footer-line {
      margin: 0 0 6px;
    }
    .letter-page { max-width: 210mm; margin: 0 auto; }
    .letter-header { text-align: center; }
    .letter-logo { width: 80px; height: auto; margin-bottom: 10px; }
    .company-name { font-size: 18pt; font-weight: bold; margin: 0 0 5px 0; }
    .company-meta { font-size: 10pt; margin: 2px 0; color: #555; }
    .letter-title { text-align: center; font-size: 16pt; font-weight: bold; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 1px; }
    .letter-date { text-align: right; margin-bottom: 20px; font-weight: bold; }
    .recipient-block p { margin: 0 0 3px 0; }
    .subject-line { font-weight: bold; margin: 20px 0 15px 0; padding-left: 20px; border-left: 4px solid #4a5568; }
    .body-block p { text-align: justify; margin-bottom: 12px; }
    .signature-block { margin-top: 40px; text-align: right; }
    .signature-space { height: 40px; border-bottom: 1px solid #333; margin: 10px 0; }
    .footer-block { text-align: center; font-size: 10pt; color: #666; }
  </style>
</head>
<body>
  <div class="fixed-letter-header">
    <div class="letter-page">
      ${headerContent}
      <hr class="header-line" />
    </div>
  </div>
  <div class="fixed-letter-footer">
    <div class="letter-page">
      <hr class="footer-line" />
      ${footerContent}
    </div>
  </div>
  <div class="letter-shell">
    <div class="letter-page">
      <h2 class="letter-title">${title}</h2>
      ${bodyContent}
    </div>
  </div>
</body>
</html>`;

const generateOfferLetterHtml = (data) => {
  const {
    candidateName = 'Candidate Name',
    position = 'Position',
    joiningDate = new Date().toLocaleDateString('en-GB'),
    salary = '',
    stipend = '',
    hrName = 'Amit Verma',
    hrDesignation = 'Head - Human Resources',
    date = new Date().toLocaleDateString('en-GB'),
    companyName = COMPANY_NAME,
    address = ''
  } = data;

  const headerContent = `
    <header class="letter-header">
      <img src="${LOGO_URL}" alt="Company Logo" class="letter-logo" />
      <div class="company-name">${companyName}</div>
      <div class="company-meta">${ISO_LINE}</div>
      <div class="company-meta">${COMPANY_ADDRESS}</div>
      <div class="company-meta">CIN: ${CIN} | GST: ${GST}</div>
      <div class="company-meta">${COMPANY_CONTACT}</div>
    </header>
  `;

  const footerContent = `
    <footer class="footer-block">
      <p><strong>${COMPANY_LEGAL}</strong></p>
      <p>${COMPANY_ADDRESS}</p>
      <p>${COMPANY_CONTACT}</p>
      <p>CIN: ${CIN} | GST: ${GST}</p>
    </footer>
  `;

  const bodyContent = `
    <div class="letter-date">Date: ${date}</div>

    <section class="recipient-block">
      <p><strong>To,</strong></p>
      <p>${candidateName}</p>
      <p>${position}</p>
      <p>${address || COMPANY_ADDRESS}</p>
    </section>

    <div class="subject-line">Subject: Offer of Employment - ${position}</div>

    <section class="body-block">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <p>We are pleased to extend this formal offer of employment for the position of <strong>${position}</strong> at ${companyName}.</p>
      <p>Your anticipated joining date is <strong>${joiningDate}</strong>. The offered ${salary ? 'monthly salary' : 'stipend'} is INR <strong>${salary || stipend}</strong>.</p>
      <p>Please confirm your acceptance by replying to this email and completing the necessary documentation prior to your joining date.</p>
      <p>This offer is contingent upon successful background verification and reference checks.</p>
    </section>

    <section class="signature-block">
      <p>Yours sincerely,</p>
      <p>For ${companyName}</p>
      <div class="signature-space"></div>
      <p>${hrName}</p>
      <p>${hrDesignation}</p>
    </section>
  `;

  return buildLetterDocument({
    title: "OFFER LETTER",
    companyName,
    headerContent,
    footerContent,
    bodyContent,
  });
};

const generateInternshipLetterHtml = (data) => {
  const {
    candidateName = 'Candidate Name',
    position = 'Internship Position',
    startDate = new Date().toLocaleDateString('en-GB'),
    endDate = '',
    stipend = '',
    hrName = 'Amit Verma',
    hrDesignation = 'Head - Human Resources',
    date = new Date().toLocaleDateString('en-GB'),
    companyName = COMPANY_NAME,
    address = ''
  } = data;

  const headerContent = `
    <header class="letter-header">
      <img src="${LOGO_URL}" alt="Company Logo" class="letter-logo" />
      <div class="company-name">${companyName}</div>
      <div class="company-meta">${ISO_LINE}</div>
      <div class="company-meta">${COMPANY_ADDRESS}</div>
      <div class="company-meta">CIN: ${CIN} | GST: ${GST}</div>
      <div class="company-meta">${COMPANY_CONTACT}</div>
    </header>
  `;

  const footerContent = `
    <footer class="footer-block">
      <p><strong>${COMPANY_LEGAL}</strong></p>
      <p>${COMPANY_ADDRESS}</p>
      <p>${COMPANY_CONTACT}</p>
      <p>CIN: ${CIN} | GST: ${GST}</p>
    </footer>
  `;

  const bodyContent = `
    <div class="letter-date">Date: ${date}</div>

    <section class="recipient-block">
      <p><strong>To,</strong></p>
      <p>${candidateName}</p>
      <p>${position}</p>
      <p>${address || COMPANY_ADDRESS}</p>
    </section>

    <div class="subject-line">Subject: Internship Offer - ${position}</div>

    <section class="body-block">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <p>We are delighted to offer you an internship opportunity for the position of <strong>${position}</strong> at ${companyName}.</p>
      <p>Your internship will commence on <strong>${startDate}</strong>${endDate ? ` and conclude on <strong>${endDate}</strong>` : ''}. During this period, you will receive a stipend of INR <strong>${stipend}</strong>.</p>
      <p>This internship provides valuable hands-on experience and we look forward to your contribution to our team.</p>
      <p>Please confirm your acceptance at your earliest convenience.</p>
    </section>

    <section class="signature-block">
      <p>Yours sincerely,</p>
      <p>For ${companyName}</p>
      <div class="signature-space"></div>
      <p>${hrName}</p>
      <p>${hrDesignation}</p>
    </section>
  `;

  return buildLetterDocument({
    title: "INTERNSHIP OFFER LETTER",
    companyName,
    headerContent,
    footerContent,
    bodyContent,
  });
};

export { generateOfferLetterHtml, generateInternshipLetterHtml };
