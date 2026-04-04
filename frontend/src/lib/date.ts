import { format, isValid, parseISO } from "date-fns";

const DATE_FIELD_KEY_PATTERN = /(date|joined|joining|from|to|month|paidon|lastday|lastworking|effective)/i;

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return isValid(parsed) ? parsed : null;
  }

  if (typeof value !== "string") return null;

  const source = value.trim();
  if (!source) return null;

  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(source)) {
    const parsedIso = parseISO(source);
    return isValid(parsedIso) ? parsedIso : null;
  }

  const parsedNative = new Date(source);
  return isValid(parsedNative) ? parsedNative : null;
};

export const formatDate = (value: unknown, fallback = "-"): string => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = toDate(value);
  if (!parsed) return String(value);
  return format(parsed, "dd MMM yyyy");
};

export const formatDateValueByKey = (key: string, value: unknown): string => {
  if (!DATE_FIELD_KEY_PATTERN.test(key)) return String(value ?? "");
  return formatDate(value, "-");
};

