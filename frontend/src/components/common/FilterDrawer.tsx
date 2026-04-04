import React from "react";
import { Filter, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FilterOption = {
  label: string;
  value: string;
};

type BaseField = {
  key: string;
  label: string;
  placeholder?: string;
};

type TextField = BaseField & {
  type: "text";
};

type SelectField = BaseField & {
  type: "select";
  options: FilterOption[];
};

type DateField = BaseField & {
  type: "date";
};

export type FilterFieldConfig = TextField | SelectField | DateField;

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters?: FilterFieldConfig[];
  values?: Record<string, string>;
  onChange?: (key: string, value: string) => void;
  onApply?: (values: Record<string, string>) => void;
  onReset?: () => void;
}

const inputClassName =
  "mt-2 h-11 rounded-xl border-border bg-white text-sm shadow-sm transition-colors focus-visible:border-primary/60 focus-visible:ring-primary/30";

const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters = [],
  values = {},
  onChange,
  onApply,
  onReset,
}) => {
  const handleApply = () => {
    onApply?.(values);
    onClose();
  };

  const handleReset = () => {
    onReset?.();
  };

  const renderField = (field: FilterFieldConfig) => {
    const value = values[field.key] || "";

    if (field.type === "select") {
      return (
        <select
          id={field.key}
          className={`w-full px-3 ${inputClassName}`}
          value={value}
          onChange={(event) => onChange?.(field.key, event.target.value)}
        >
          <option value="">{field.placeholder || `All ${field.label}`}</option>
          {field.options.map((option) => (
            <option key={`${field.key}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "date") {
      return (
        <Input
          id={field.key}
          type="date"
          value={value}
          onChange={(event) => onChange?.(field.key, event.target.value)}
          className={inputClassName}
        />
      );
    }

    return (
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={field.key}
          value={value}
          onChange={(event) => onChange?.(field.key, event.target.value)}
          placeholder={field.placeholder}
          className={`pl-10 ${inputClassName}`}
        />
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        side="right"
        className="w-full border-l border-border bg-white p-0 sm:max-w-[340px]"
        overlayClassName="bg-slate-950/25"
      >
        <SheetHeader className="border-b border-border px-5 py-5 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="gradient-primary-soft flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 shadow-sm">
                <Filter className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle>Filters</SheetTitle>
                <p className="text-sm text-muted-foreground">Refine this module with consistent filter controls.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {filters.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="text-sm font-medium text-slate-700">
                  {field.label}
                </Label>
                {renderField(field)}
              </div>
            ))}
          </div>

          <div className="border-t border-border px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={handleApply}>
                Apply
              </Button>
              <Button variant="outline" className="flex-1 gap-2 rounded-xl" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FilterDrawer;
