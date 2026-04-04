const PDF_MIME_TYPE = "application/pdf";

const sanitizePart = (value: string) => {
  const normalized = value
    .trim()
    .replace(/['"`]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "Document";
};

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const toPdfBlob = (title: string, lines: string[]) => {
  const safeLines = [title, ...lines].map(escapePdfText);
  const streamLines = safeLines.map((line, index) =>
    index === 0 ? `50 780 Td (${line}) Tj` : `0 -18 Td (${line}) Tj`
  );
  const stream = `BT
/F1 12 Tf
${streamLines.join("\n")}
ET`;

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj`,
  ];

  const header = "%PDF-1.4\n";
  const chunks: string[] = [header];
  const offsets: number[] = [0];
  let pointer = header.length;

  for (const object of objects) {
    offsets.push(pointer);
    const chunk = `${object}\n`;
    chunks.push(chunk);
    pointer += chunk.length;
  }

  const xrefStart = pointer;
  const xref =
    `xref
0 ${objects.length + 1}
0000000000 65535 f 
${offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
  .join("\n")}
trailer << /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefStart}
%%EOF`;

  chunks.push(xref);
  return new Blob(chunks, { type: PDF_MIME_TYPE });
};

export const forceBrowserDownload = (blob: Blob, fileName: string) => {
  const downloadLink = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  downloadLink.href = objectUrl;
  downloadLink.download = fileName;
  downloadLink.rel = "noopener";
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
};

export const buildPdfFileName = (...parts: string[]) => {
  const fileName = parts.map(sanitizePart).join("_");
  return `${fileName}.pdf`;
};

export const downloadPdf = (title: string, lines: string[], fileName: string) => {
  const blob = toPdfBlob(title, lines);
  forceBrowserDownload(blob, fileName);
};
