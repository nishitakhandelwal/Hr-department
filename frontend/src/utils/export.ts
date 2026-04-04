import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";

import { forceBrowserDownload } from "@/lib/download";

export type ExportFormat = "csv" | "excel" | "pdf";

type TableLikeColumn<T> = {
  key: string;
  label?: string;
  exportable?: boolean;
  value?: (row: T) => unknown;
};

export interface ExportColumn<T> {
  key: string;
  label?: string;
  value?: (row: T) => unknown;
}

type Html2PdfInstance = {
  set: (options: Record<string, unknown>) => Html2PdfInstance;
  from: (element: HTMLElement) => Html2PdfInstance;
  save: () => Promise<void>;
};

const createHtml2Pdf = () => html2pdf() as unknown as Html2PdfInstance;

interface ExportDataOptions<T> {
  rows?: T[];
  columns?: ExportColumn<T>[];
}

interface ExportRequestOverrides {
  reportTitle?: string;
  sheetName?: string;
}

export interface PreparedExportRequest {
  moduleName: string;
  reportTitle: string;
  sheetName: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

const EXPORT_COMPANY = {
  name: "Arihant Dream Infra Project Ltd.",
  certification: "An ISO 9001:2008 Certified Company",
  address: "2nd Floor,Class of Pearl,Income Tax Colony, Tonk Road, Jaipur",
  legal: "CIN: U70101RJ2011PLC035322 | GST: 08AAJCA5226A1Z3",
  contact: "Tel.: 0141-2970900 | Email: info@arihantgroupjaipur.com | URL: www.arihantgroupjaipur.com",
  logoSrc: "/logo.png",
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const cleanHeaderLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const createExportColumnsFromTable = <T>(
  columns: Array<TableLikeColumn<T>>,
  labelOverrides: Record<string, string> = {}
): Array<ExportColumn<T>> =>
  columns
    .filter((column) => column.exportable !== false)
    .map((column) => ({
      key: column.key,
      label: labelOverrides[column.key] || column.label || cleanHeaderLabel(column.key),
      value: column.value,
    }));

const buildFallbackFileName = (moduleName: string, format: ExportFormat) => {
  const normalizedModule = String(moduleName || "report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "report";
  const extension = format === "excel" ? "xlsx" : format;
  return `${normalizedModule}.${extension}`;
};

export const resolveExportRows = <T>(preferredRows?: T[], fallbackRows?: T[]) => {
  const safePreferredRows = Array.isArray(preferredRows) ? preferredRows : [];
  if (safePreferredRows.length > 0) {
    return {
      rows: safePreferredRows,
      usedFallback: false,
      hasData: true,
    };
  }

  const safeFallbackRows = Array.isArray(fallbackRows) ? fallbackRows : [];
  return {
    rows: safeFallbackRows,
    usedFallback: safeFallbackRows.length > 0,
    hasData: safeFallbackRows.length > 0,
  };
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getResolvedColumns = <T>(rows: T[], columns?: ExportColumn<T>[]) => {
  if (columns?.length) return columns;
  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== "object") return [];

  return Object.keys(firstRow as Record<string, unknown>).map((key) => ({
    key,
    label: cleanHeaderLabel(key),
  }));
};

const getCellValue = <T,>(row: T, column: ExportColumn<T>) => {
  const rawValue = column.value ? column.value(row) : (row as Record<string, unknown>)?.[column.key];
  if (rawValue === null || rawValue === undefined || rawValue === "") return "-";
  return rawValue;
};

const normalizeExportRows = <T>(rows: T[], columns?: ExportColumn<T>[]) => {
  const resolvedColumns = getResolvedColumns(rows, columns);
  const labels = resolvedColumns.map((column) => column.label || cleanHeaderLabel(column.key));
  const normalizedRows = rows.map((row) =>
    Object.fromEntries(
      resolvedColumns.map((column, index) => [labels[index], getCellValue(row, column)])
    )
  );

  return {
    resolvedColumns,
    labels,
    normalizedRows,
  };
};

export const prepareExportRequest = <T>(
  moduleName: string,
  rows: T[],
  columns?: ExportColumn<T>[],
  overrides?: ExportRequestOverrides
): PreparedExportRequest => {
  const normalizedModuleName = cleanHeaderLabel(moduleName);
  const { labels, normalizedRows } = normalizeExportRows(rows, columns);

  return {
    moduleName,
    reportTitle: overrides?.reportTitle || `${normalizedModuleName} Report`,
    sheetName: (overrides?.sheetName || normalizedModuleName || "Export").slice(0, 31),
    columns: labels,
    rows: normalizedRows,
  };
};

const ensureExportRows = <T>(moduleName: string, rows?: T[], columns?: ExportColumn<T>[]) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeRows || safeRows.length === 0) {
    throw new Error(`No ${cleanHeaderLabel(moduleName)} data available to export.`);
  }

  return normalizeExportRows(safeRows, columns);
};

const formatExportedAt = (value = new Date()) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const buildTableHtml = (headers: string[], rows: Array<Record<string, unknown>>) => {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${headers
          .map((header) => `<td>${escapeHtml(row[header] ?? "-")}</td>`)
          .join("")}</tr>`
    )
    .join("");

  return `
    <table class="export-table">
      <thead>
        <tr>${head}</tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
};

const buildPdfTemplate = (title: string, headers: string[], rows: Array<Record<string, unknown>>) => `
  <div data-export-root="true" class="export-page">
    <div class="export-shell">
      <header class="export-header">
        <div class="export-header-copy">
          <div class="company-name">${escapeHtml(EXPORT_COMPANY.name)}</div>
          <div>${escapeHtml(EXPORT_COMPANY.certification)}</div>
          <div>${escapeHtml(EXPORT_COMPANY.address)}</div>
          <div>${escapeHtml(EXPORT_COMPANY.legal)}</div>
          <div>${escapeHtml(EXPORT_COMPANY.contact)}</div>
        </div>
        <div class="export-logo-wrap">
          <img src="${escapeHtml(EXPORT_COMPANY.logoSrc)}" alt="Company Logo" class="export-logo" />
        </div>
      </header>

      <section class="export-meta">
        <h1>${escapeHtml(title)}</h1>
        <p>Exported on ${escapeHtml(formatExportedAt())}</p>
      </section>

      <section class="export-content">
        ${buildTableHtml(headers, rows)}
      </section>

      <footer class="export-footer">
        <div>${escapeHtml(EXPORT_COMPANY.name)}</div>
        <div>${escapeHtml(EXPORT_COMPANY.address)}</div>
        <div>${escapeHtml(EXPORT_COMPANY.contact)}</div>
        <div>${escapeHtml(EXPORT_COMPANY.legal)}</div>
      </footer>
    </div>
  </div>
`;

const createPdfContainer = (title: string, headers: string[], rows: Array<Record<string, unknown>>) => {
  const logoSrc =
    typeof window !== "undefined" ? `${window.location.origin}${EXPORT_COMPANY.logoSrc}` : EXPORT_COMPANY.logoSrc;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.background = "#ffffff";
  container.style.zIndex = "-1";
  container.innerHTML = `
    <style>
      .export-page {
        width: 210mm;
        min-height: 297mm;
        background: #ffffff;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
      }
      .export-shell {
        min-height: 297mm;
        display: flex;
        flex-direction: column;
        padding: 14mm 14mm 12mm;
      }
      .export-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 16px;
      }
      .export-header-copy {
        flex: 1;
        min-width: 0;
        color: #374151;
        font-size: 11px;
        line-height: 1.65;
      }
      .company-name {
        font-size: 20px;
        font-weight: 700;
        color: #111827;
      }
      .export-logo-wrap {
        width: 140px;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        flex-shrink: 0;
      }
      .export-logo {
        width: 100px;
        height: auto;
        object-fit: contain;
        opacity: 0.95;
        object-position: right top;
        display: block;
      }
      .export-meta {
        margin-top: 20px;
        text-align: center;
      }
      .export-meta h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #111827;
      }
      .export-meta p {
        margin: 6px 0 0;
        font-size: 11px;
        color: #6b7280;
      }
      .export-content {
        margin-top: 20px;
        flex: 1 1 auto;
      }
      .export-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: auto;
      }
      .export-table thead {
        display: table-header-group;
      }
      .export-table tr {
        page-break-inside: avoid;
      }
      .export-table th,
      .export-table td {
        border: 1px solid #d1d5db;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
        word-break: break-word;
        font-size: 11px;
      }
        .export-table th:last-child,
        .export-table td:last-child {
         min-width: 100px;
         white-space: nowrap;
        text-align: center;
      }
      .export-table th {
        background: #f3f4f6;
        color: #111827;
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .export-table tbody tr:nth-child(even) {
        background: #f9fafb;
      }
      .export-footer {
        margin-top: auto;
        border-top: 1px solid #d1d5db;
        padding-top: 14px;
        text-align: center;
        color: #4b5563;
        font-size: 11px;
        line-height: 1.65;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .export-footer div:first-child {
        font-weight: 700;
        color: #111827;
      }
    </style>
    ${buildPdfTemplate(title, headers, rows).replace(EXPORT_COMPANY.logoSrc, logoSrc)}
  `;
  return container;
};

const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }

          const finish = () => resolve();
          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
        })
    )
  );
};

const exportToPDF = async <T>(moduleName: string, rows: T[], columns?: ExportColumn<T>[]) => {
  const title = `${cleanHeaderLabel(moduleName)} Report`;
  const fileName = buildFallbackFileName(moduleName, "pdf");
  const { labels, normalizedRows } = ensureExportRows(moduleName, rows, columns);
  const container = createPdfContainer(title, labels, normalizedRows);

  document.body.appendChild(container);

  try {
    await wait(300);
    const target = container.querySelector("[data-export-root='true']") as HTMLElement | null;

    if (!target) {
      console.error("No data to export");
      throw new Error("Unable to prepare the PDF document.");
    }

    const styles = window.getComputedStyle(target);
    if (styles.display === "none" || styles.visibility === "hidden" || !target.innerHTML.trim()) {
      console.error("No data to export");
      throw new Error("The PDF export content is empty.");
    }

    await waitForImages(target);
    await wait(150);

    await createHtml2Pdf()
      .set({
        filename: fileName,
        margin: [0, 0, 0, 0],
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: [".export-header", ".export-footer", "tr"],
        },
      })
      .from(target)
      .save();

    return fileName;
  } finally {
    container.remove();
  }
};

const exportToCSV = async <T>(moduleName: string, rows: T[], columns?: ExportColumn<T>[]) => {
  const fileName = buildFallbackFileName(moduleName, "csv");
  const { labels, normalizedRows } = ensureExportRows(moduleName, rows, columns);
  const worksheet = XLSX.utils.aoa_to_sheet([
    labels,
    ...normalizedRows.map((row) => labels.map((label) => row[label] ?? "")),
  ]);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  forceBrowserDownload(blob, fileName);
  return fileName;
};

const exportToExcel = async <T>(moduleName: string, rows: T[], columns?: ExportColumn<T>[]) => {
  const title = `${cleanHeaderLabel(moduleName)} Report`;
  const fileName = buildFallbackFileName(moduleName, "excel");
  const { labels, normalizedRows } = ensureExportRows(moduleName, rows, columns);

  const workbook = XLSX.utils.book_new();
  const worksheetData: Array<Array<string | number>> = [
    [EXPORT_COMPANY.name],
    [EXPORT_COMPANY.certification],
    [EXPORT_COMPANY.address],
    [EXPORT_COMPANY.legal],
    [EXPORT_COMPANY.contact],
    [],
    [title],
    [`Exported on ${formatExportedAt()}`],
    [],
    labels,
    ...normalizedRows.map((row) => labels.map((label) => String(row[label] ?? ""))),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(labels.length - 1, 0) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(labels.length - 1, 0) } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(labels.length - 1, 0) } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: Math.max(labels.length - 1, 0) } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: Math.max(labels.length - 1, 0) } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: Math.max(labels.length - 1, 0) } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: Math.max(labels.length - 1, 0) } },
  ];
  worksheet["!cols"] = labels.map((label) => {
    const maxLength = Math.max(
      label.length,
      ...normalizedRows.map((row) => String(row[label] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLength + 4, 16), 36) };
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, cleanHeaderLabel(moduleName).slice(0, 31) || "Export");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  forceBrowserDownload(blob, fileName);
  return fileName;
};

export const exportData = async <T>(
  type: ExportFormat,
  moduleName: string,
  _filters?: Record<string, unknown>,
  options?: ExportDataOptions<T>
) => {
  const rows = options?.rows || [];
  const columns = options?.columns;

  if (type === "pdf") {
    return exportToPDF(moduleName, rows, columns);
  }

  if (type === "excel") {
    return exportToExcel(moduleName, rows, columns);
  }

  return exportToCSV(moduleName, rows, columns);
};

export { exportToPDF, exportToCSV, exportToExcel };
