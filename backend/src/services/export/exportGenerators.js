import ExcelJS from "exceljs";
import { parse as jsonToCsv } from "json2csv";
import { EXPORT_COMPANY } from "./exportConstants.js";
import { getSharedPdfBrowser } from "../../utils/pdfBrowser.js";
const EXCEL_FAST_MODE_ROW_THRESHOLD = 400;
const PDF_FAST_MODE_ROW_THRESHOLD = 250;

const formatExportedAt = (date = new Date()) =>
  date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const sanitizeModuleName = (value) =>
  String(value || "report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "report";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildExportFileBase = (moduleName) => sanitizeModuleName(moduleName);

const getColumns = (rows, preferredColumns = []) => {
  if (preferredColumns.length) return preferredColumns;
  const [firstRow] = rows;
  return firstRow ? Object.keys(firstRow) : [];
};

const buildColumnWidths = (rows, columns) =>
  columns.map((column) => {
    const maxLength = Math.max(
      column.length,
      ...rows.map((row) => String(row[column] ?? "").length)
    );
    return Math.min(Math.max(maxLength + 4, 14), 36);
  });

const buildCsvHeaderRows = (reportTitle) => [
  EXPORT_COMPANY.name,
  EXPORT_COMPANY.certification,
  EXPORT_COMPANY.address,
  EXPORT_COMPANY.legal,
  `Tel.: ${EXPORT_COMPANY.phone} | Email: ${EXPORT_COMPANY.email} | URL: ${EXPORT_COMPANY.website}`,
  reportTitle,
  `Exported on ${formatExportedAt()}`,
  "",
];

const addExcelLogo = async (worksheet, logoDataUri, totalColumns) => {
  if (!logoDataUri?.startsWith("data:image/")) return;

  const extensionMatch = logoDataUri.match(/^data:image\/(png|jpeg|jpg);base64,/i);
  const base64 = logoDataUri.split(",")[1];
  if (!extensionMatch || !base64) return;

  const extension = extensionMatch[1].toLowerCase() === "jpg" ? "jpeg" : extensionMatch[1].toLowerCase();
  const imageId = worksheet.workbook.addImage({ base64, extension });

  worksheet.addImage(imageId, {
    tl: { col: Math.max(totalColumns - 1.2, 0), row: 0.2 },
    ext: { width: 92, height: 92 },
    editAs: "oneCell",
  });
};

export const exportCSV = ({ rows, columns, reportTitle }) => {
  const resolvedColumns = getColumns(rows, columns);
  const csv = jsonToCsv(rows, {
    fields: resolvedColumns,
    withBOM: true,
  });

  return Buffer.from(`${buildCsvHeaderRows(reportTitle).join("\n")}\n${csv}`, "utf-8");
};

export const exportExcel = async ({ rows, sheetName, columns, reportTitle, logoDataUri }) => {
  const resolvedColumns = getColumns(rows, columns);
  const columnWidths = buildColumnWidths(rows, resolvedColumns);
  const useFastMode = rows.length >= EXCEL_FAST_MODE_ROW_THRESHOLD;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = EXPORT_COMPANY.name;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName || "Export", {
    views: [{ state: "frozen", ySplit: 10 }],
  });

  worksheet.columns = resolvedColumns.map((column, index) => ({
    key: column,
    width: columnWidths[index],
  }));

  const lastColumn = Math.max(resolvedColumns.length, 1);
  [1, 2, 3, 4, 5, 6, 7].forEach((rowNumber) => {
    worksheet.mergeCells(rowNumber, 1, rowNumber, lastColumn);
  });

  worksheet.getCell("A1").value = EXPORT_COMPANY.name;
  worksheet.getCell("A2").value = EXPORT_COMPANY.certification;
  worksheet.getCell("A3").value = EXPORT_COMPANY.address;
  worksheet.getCell("A4").value = EXPORT_COMPANY.legal;
  worksheet.getCell("A5").value = `Tel.: ${EXPORT_COMPANY.phone} | Email: ${EXPORT_COMPANY.email} | URL: ${EXPORT_COMPANY.website}`;
  worksheet.getCell("A6").value = reportTitle;
  worksheet.getCell("A7").value = `Exported on ${formatExportedAt()}`;

  worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  worksheet.getCell("A2").font = { size: 11, color: { argb: "FF334155" } };
  worksheet.getCell("A3").font = { size: 10, color: { argb: "FF475569" } };
  worksheet.getCell("A4").font = { size: 10, color: { argb: "FF475569" } };
  worksheet.getCell("A5").font = { size: 10, color: { argb: "FF475569" } };
  worksheet.getCell("A6").font = { bold: true, size: 13, color: { argb: "FF0F172A" } };
  worksheet.getCell("A7").font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 18;
  worksheet.getRow(5).height = 18;
  worksheet.getRow(6).height = 22;
  worksheet.getRow(7).height = 18;
  worksheet.getRow(8).height = 8;

  if (!useFastMode) {
    await addExcelLogo(worksheet, logoDataUri, lastColumn);
  }

  const headerRow = worksheet.getRow(10);
  headerRow.values = resolvedColumns;
  headerRow.font = { bold: true, color: { argb: "FF0F172A" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  headerRow.border = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  worksheet.addRows(rows.map((row) => resolvedColumns.map((column) => row[column] ?? "")));

  if (useFastMode) {
    const firstDataRowNumber = 11;
    for (let rowNumber = firstDataRowNumber; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      row.alignment = { vertical: "top", horizontal: "left" };
    }
  } else {
    for (let rowNumber = 11; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      row.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      row.height = 20;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    }
  }

  return workbook.xlsx.writeBuffer();
};

const buildHeaderTemplate = (logoDataUri) => `
  <div style="width:100%; padding:10px 34px 0; font-family: Arial, sans-serif; font-size:10px; color:#0f172a;">
    <div style="border-bottom:1px solid #cbd5e1; padding-bottom:10px; display:flex; align-items:flex-start; gap:14px;">
      ${
        logoDataUri
          ? `<img src="${logoDataUri}" style="width:56px; height:56px; object-fit:contain;" />`
          : ""
      }
      <div style="flex:1;">
        <div style="font-size:14px; font-weight:700;">${escapeHtml(EXPORT_COMPANY.name)}</div>
        <div style="margin-top:2px;">${escapeHtml(EXPORT_COMPANY.certification)}</div>
        <div style="margin-top:4px;">${escapeHtml(EXPORT_COMPANY.address)}</div>
        <div style="margin-top:2px;">${escapeHtml(EXPORT_COMPANY.legal)}</div>
        <div style="margin-top:2px;">Tel.: ${escapeHtml(EXPORT_COMPANY.phone)} | Email: ${escapeHtml(EXPORT_COMPANY.email)} | URL: ${escapeHtml(EXPORT_COMPANY.website)}</div>
      </div>
    </div>
  </div>
`;

const buildFooterTemplate = () => `
  <div style="width:100%; padding:0 34px 12px; font-family: Arial, sans-serif; font-size:9px; color:#334155;">
    <div style="border-top:1px solid #cbd5e1; padding-top:8px;">
      <div style="font-weight:700; margin-bottom:3px;">${escapeHtml(EXPORT_COMPANY.name)}</div>
      <div>${escapeHtml(EXPORT_COMPANY.address)}</div>
      <div>Tel.: ${escapeHtml(EXPORT_COMPANY.phone)} | Email: ${escapeHtml(EXPORT_COMPANY.email)} | URL: ${escapeHtml(EXPORT_COMPANY.website)}</div>
      <div>${escapeHtml(EXPORT_COMPANY.legal)}</div>
      <div style="margin-top:6px; display:flex; justify-content:space-between;">
        <span>Generated on ${escapeHtml(formatExportedAt())}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    </div>
  </div>
`;

const buildPdfHtml = ({ reportTitle, rows, columns }) => {
  const resolvedColumns = getColumns(rows, columns);
  const tableHeader = resolvedColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const tableRows = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${resolvedColumns
              .map((column) => `<td>${escapeHtml(row[column])}</td>`)
              .join("")}</tr>`
        )
        .join("")
    : `<tr><td colspan="${Math.max(resolvedColumns.length, 1)}" class="empty">No records found for the selected filters.</td></tr>`;

  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(reportTitle)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            color: #0f172a;
            font-size: 11px;
            background: #ffffff;
          }
          .report {
            width: 100%;
          }
          .meta {
            margin: 0 0 18px;
            text-align: center;
          }
          .meta h1 {
            margin: 0;
            font-size: 19px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .meta p {
            margin: 8px 0 0;
            color: #475569;
            font-size: 11px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 7px 8px;
            vertical-align: top;
            text-align: left;
            word-break: break-word;
          }
          th {
            background: #e2e8f0;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          tbody tr:nth-child(even) {
            background: #f8fafc;
          }
          .empty {
            text-align: center;
            padding: 18px 12px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="report">
          <div class="meta">
            <h1>${escapeHtml(reportTitle)}</h1>
            <p>Exported on ${escapeHtml(formatExportedAt())}</p>
          </div>
          <table>
            <thead>
              <tr>${tableHeader}</tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </body>
    </html>`;
};

export const exportPDF = async ({ reportTitle, rows, columns, logoDataUri }) => {
  const useFastMode = rows.length >= PDF_FAST_MODE_ROW_THRESHOLD;
  const browser = await getSharedPdfBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(buildPdfHtml({ reportTitle, rows, columns }), {
      waitUntil: "domcontentloaded",
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: !useFastMode,
      margin: {
        top: useFastMode ? "28px" : "165px",
        right: "28px",
        bottom: useFastMode ? "28px" : "120px",
        left: "28px",
      },
      headerTemplate: useFastMode ? "<div></div>" : buildHeaderTemplate(logoDataUri),
      footerTemplate: useFastMode ? "<div></div>" : buildFooterTemplate(),
    });
  } finally {
    await page.close();
  }
};

export const buildExportPayload = async ({ moduleName, type, reportTitle, sheetName, rows, columns, logoDataUri }) => {
  const fileBaseName = buildExportFileBase(moduleName);
  const shouldUseLogo = rows.length < EXCEL_FAST_MODE_ROW_THRESHOLD && rows.length < PDF_FAST_MODE_ROW_THRESHOLD;
  const optimizedLogoDataUri = shouldUseLogo ? logoDataUri : "";

  if (type === "csv") {
    return {
      buffer: exportCSV({ rows, columns, reportTitle }),
      fileName: `${fileBaseName}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  if (type === "excel") {
    return {
      buffer: await exportExcel({ rows, sheetName, columns, reportTitle, logoDataUri: optimizedLogoDataUri }),
      fileName: `${fileBaseName}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  return {
    buffer: await exportPDF({ reportTitle, rows, columns, logoDataUri: optimizedLogoDataUri }),
    fileName: `${fileBaseName}.pdf`,
    contentType: "application/pdf",
  };
};
