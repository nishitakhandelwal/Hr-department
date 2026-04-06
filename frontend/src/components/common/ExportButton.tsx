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
    if (loading) {
      toast({
        title: "Export unavailable",
        description: "Please wait until the data finishes loading.",
        variant: "destructive",
      });
      return;
    }

    if (!resolvedExportSource.hasData) {
      toast({
        title: "Export unavailable",
        description: emptyMessage,
        variant: "destructive",
      });
      return;
    }

    setExportingType(type);
    try {
      if (!shouldUseServerExport) {
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
      
      const result = await apiService.exportModule({
        moduleName,
        type,
        filters,
            rows: exportRequest.rows,
            columns: exportRequest.columns,
            reportTitle: exportRequest.reportTitle,
            sheetName: exportRequest.sheetName,
      });
      
      const fileName =
        result.fileName ||
        `${String(moduleName || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${type === "excel" ? "xlsx" : type}`;

      forceBrowserDownload(result.blob, fileName);
      
      const formatLabel = type === "csv" ? "CSV" : type === "excel" ? "Excel" : "PDF";
      toast({
        title: "Export successful",
        description: shouldUseServerExport
          ? `${formatLabel} export is downloading as ${fileName}.`
          : `${formatLabel} export is downloading as ${fileName}.`,
      });
    } catch (error) {
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
      <DropdownMenuContent align="end" className="w-48 rounded-2xl border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-2 shadow-[0_18px_45px_rgba(166,124,82,0.22)]">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.type}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-[#E6C7A3] focus:bg-[rgba(230,199,163,0.12)] focus:text-[#F5F5F5]"
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
