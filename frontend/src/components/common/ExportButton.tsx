import React from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { forceBrowserDownload } from "@/lib/download";
import { apiService } from "@/services/api";
import { exportData, ExportColumn, ExportFormat, prepareExportRequest, resolveExportRows } from "@/utils/export";

interface ExportButtonProps<T> {
  moduleName: string;
  filters?: Record<string, unknown>;
  rows?: T[];
  fallbackRows?: T[];
  columns?: ExportColumn<T>[];
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  reportTitle?: string;
  sheetName?: string;
  emptyMessage?: string;
  preferServerExport?: boolean;
}

const serverExportModules = new Set([
  "attendance",
  "employees",
  "payroll",
  "leave",
  "departments",
  "offboarding",
  "candidates",
]);

const exportOptions: Array<{
  type: ExportFormat;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
}> = [
  { type: "csv", label: "CSV", icon: FileSpreadsheet, iconClassName: "text-emerald-600" },
  { type: "excel", label: "Excel", icon: FileSpreadsheet, iconClassName: "text-emerald-700" },
  { type: "pdf", label: "PDF", icon: FileText, iconClassName: "text-rose-600" },
];

export function ExportButton<T>({
  moduleName,
  filters,
  rows,
  fallbackRows,
  columns,
  className,
  disabled = false,
  loading = false,
  reportTitle,
  sheetName,
  emptyMessage = "No data to export",
  preferServerExport = true,
}: ExportButtonProps<T>) {
  const { toast } = useToast();
  const [exportingType, setExportingType] = React.useState<ExportFormat | null>(null);
  const resolvedExportSource = React.useMemo(
    () => resolveExportRows(rows, fallbackRows),
    [fallbackRows, rows]
  );
  const isDisabled = disabled || loading || exportingType !== null || !resolvedExportSource.hasData;
  const shouldUseServerExport = preferServerExport && serverExportModules.has(String(moduleName || "").toLowerCase());

  const handleExport = async (type: ExportFormat) => {
    console.log("[Export] Starting export with type:", type, "moduleName:", moduleName);
    
    if (loading) {
      console.log("[Export] Export blocked - data still loading");
      toast({
        title: "Export unavailable",
        description: "Please wait until the data finishes loading.",
        variant: "destructive",
      });
      return;
    }

    if (!resolvedExportSource.hasData) {
      console.log("[Export] Export blocked - no data available");
      toast({
        title: "Export unavailable",
        description: emptyMessage,
        variant: "destructive",
      });
      return;
    }

    setExportingType(type);
    try {
      console.log("[Export] Using server export:", shouldUseServerExport);
      if (!shouldUseServerExport) {
        console.log("[Export] Using direct browser export");
        const fileName = await exportData(type, moduleName, filters, {
          rows: resolvedExportSource.rows,
          columns,
        });

        const formatLabel = type === "csv" ? "CSV" : type === "excel" ? "Excel" : "PDF";
        toast({
          title: "Export successful",
          description: resolvedExportSource.usedFallback
            ? `${formatLabel} export is downloading as ${fileName} using the full dataset.`
            : `${formatLabel} export is downloading as ${fileName}.`,
        });
        return;
      }

      const exportRequest = prepareExportRequest(moduleName, resolvedExportSource.rows, columns, {
        reportTitle,
        sheetName,
      });
      
      console.log("[Export] Making API request for type:", type, "with filters:", filters);
      const result = await apiService.exportModule({
        moduleName,
        type,
        filters,
            rows: exportRequest.rows,
            columns: exportRequest.columns,
            reportTitle: exportRequest.reportTitle,
            sheetName: exportRequest.sheetName,
      });
      
      console.log("[Export] Received blob:", result.blob?.size, "bytes, fileName:", result.fileName);
      
      const fileName =
        result.fileName ||
        `${String(moduleName || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${type === "excel" ? "xlsx" : type}`;
      
      console.log("[Export] Triggering download for file:", fileName);
      forceBrowserDownload(result.blob, fileName);
      
      const formatLabel = type === "csv" ? "CSV" : type === "excel" ? "Excel" : "PDF";
      toast({
        title: "Export successful",
        description: shouldUseServerExport
          ? `${formatLabel} export is downloading as ${fileName}.`
          : `${formatLabel} export is downloading as ${fileName}.`,
      });
    } catch (error) {
      console.error("[Export] Export failed with error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export data right now.",
        variant: "destructive",
      });
    } finally {
      setExportingType(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={className}
          disabled={isDisabled}
        >
          {exportingType || loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {loading ? "Loading..." : "Export"}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-2xl border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.type}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-950"
              disabled={isDisabled}
              onClick={() => void handleExport(option.type)}
            >
              <Icon className={`mr-2 h-4 w-4 ${option.iconClassName}`} />
              {exportingType === option.type ? `Preparing ${option.label}...` : option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
