import * as React from "react";

import { Input } from "@/components/ui/input";

const normalizeDateValue = (value: string | undefined) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export type DatePickerProps = React.ComponentProps<typeof Input>;

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ value, onClick, onFocus, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const openNativePicker = React.useCallback(() => {
      inputRef.current?.showPicker?.();
    }, []);

    return (
      <Input
        {...props}
        ref={inputRef}
        type="date"
        inputMode="numeric"
        pattern="\d{4}-\d{2}-\d{2}"
        value={typeof value === "string" ? normalizeDateValue(value) : value}
        onClick={(event) => {
          openNativePicker();
          onClick?.(event);
        }}
        onFocus={(event) => {
          openNativePicker();
          onFocus?.(event);
        }}
      />
    );
  },
);

DatePicker.displayName = "DatePicker";

export { DatePicker };
