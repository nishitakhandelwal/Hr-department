import { buildExportPayload } from "../services/export/exportGenerators.js";
import { getExportLogoDataUri, getExportModuleDefinition } from "../services/export/exportRegistry.js";

const parseFilters = (rawFilters) => {
  if (!rawFilters) return {};
  if (typeof rawFilters === "object") return rawFilters;

  try {
    const parsed = JSON.parse(String(rawFilters));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const exportModuleData = async (req, res) => {
  console.log("[EXPORT] Request received:", {
    method: req.method,
    module: req.method === "GET" ? req.query.module : req.body?.module,
    type: req.method === "GET" ? req.query.type : req.body?.type,
    hasRows: req.method === "POST" && Array.isArray(req.body?.rows),
  });

  const isClientDrivenExport = Array.isArray(req.body?.rows);
  const moduleName = String((isClientDrivenExport ? req.body?.module : req.query.module) || "").trim().toLowerCase();
  const type = String((isClientDrivenExport ? req.body?.type : req.query.type) || "csv").trim().toLowerCase();
  const filters = parseFilters(isClientDrivenExport ? req.body?.filters : req.query.filters);

  console.log("[EXPORT] Parsed parameters:", { moduleName, type, isClientDrivenExport });

  if (!moduleName) {
    const error = new Error("module is required.");
    error.statusCode = 400;
    console.error("[EXPORT] Error: module is required");
    throw error;
  }

  if (!["csv", "excel", "pdf"].includes(type)) {
    const error = new Error("type must be csv, excel, or pdf.");
    error.statusCode = 400;
    console.error("[EXPORT] Error: invalid type", type);
    throw error;
  }

  const moduleDefinition = getExportModuleDefinition(moduleName);
  if (!moduleDefinition && !isClientDrivenExport) {
    const error = new Error(`Unsupported module: ${moduleName}`);
    error.statusCode = 400;
    console.error("[EXPORT] Error: unsupported module", moduleName);
    throw error;
  }

  const rows = isClientDrivenExport
    ? req.body.rows
        .filter((row) => row && typeof row === "object" && !Array.isArray(row))
        .map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [String(key), value ?? ""])
          )
        )
    : await moduleDefinition.getRows(filters, req.user);

  console.log("[EXPORT] Retrieved rows:", rows.length);

  if (!rows.length) {
    const error = new Error("No data available to export.");
    error.statusCode = 400;
    console.error("[EXPORT] Error: no data to export");
    throw error;
  }

  const reportTitle = isClientDrivenExport
    ? String(req.body?.reportTitle || moduleDefinition?.reportTitle || `${moduleName} Report`).trim()
    : moduleDefinition.reportTitle;
  const sheetName = isClientDrivenExport
    ? String(req.body?.sheetName || moduleDefinition?.sheetName || moduleName || "Export").trim()
    : moduleDefinition.sheetName;
  const columns =
    isClientDrivenExport && Array.isArray(req.body?.columns)
      ? req.body.columns.map((column) => String(column || "").trim()).filter(Boolean)
      : moduleDefinition.columns || [];
  const logoDataUri = ["pdf", "excel"].includes(type) ? await getExportLogoDataUri() : "";

  console.log("[EXPORT] Building export payload:", { type, reportTitle, columnsCount: columns.length });

  const payload = await buildExportPayload({
    moduleName,
    type,
    reportTitle,
    sheetName,
    rows,
    columns,
    logoDataUri,
  });

  console.log("[EXPORT] Payload built successfully:", {
    contentType: payload.contentType,
    fileName: payload.fileName,
    bufferSize: Buffer.isBuffer(payload.buffer) ? payload.buffer.length : payload.buffer.length,
  });

  res.setHeader("Content-Type", payload.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${payload.fileName}"`);
  res.send(Buffer.isBuffer(payload.buffer) ? payload.buffer : Buffer.from(payload.buffer));

  console.log("[EXPORT] Export completed successfully");
};
