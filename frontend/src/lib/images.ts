const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const API_ORIGIN = rawApiUrl.replace(/\/api\/?$/i, "");
export const DEFAULT_LOGO_SRC = "/company-logo.png";

type ResolveImageUrlOptions = {
  fallbackSrc?: string;
  folder?: string;
  allowTemporary?: boolean;
};

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

const normalizePathValue = (value: string) => value.replace(/\\/g, "/").trim();

const isTemporaryImageUrl = (value: string) => value.startsWith("blob:") || value.startsWith("data:image/");

export const resolveImageUrl = (
  value?: string | null,
  { fallbackSrc = "", folder = "settings", allowTemporary = false }: ResolveImageUrlOptions = {},
) => {
  const trimmedValue = normalizePathValue(String(value || ""));
  if (!trimmedValue) return fallbackSrc;

  if (isTemporaryImageUrl(trimmedValue)) {
    return allowTemporary ? trimmedValue : fallbackSrc;
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmedValue)) {
    try {
      const parsedUrl = new URL(trimmedValue);
      if (parsedUrl.pathname.startsWith("/uploads/")) {
        return `${API_ORIGIN}${parsedUrl.pathname}${parsedUrl.search}`;
      }
      return trimmedValue;
    } catch {
      return fallbackSrc;
    }
  }

  if (trimmedValue.startsWith("/uploads/")) return trimmedValue;
  if (trimmedValue.startsWith("uploads/")) return `/${trimmedValue}`;
  if (trimmedValue.startsWith("/")) return trimmedValue;

  return `/uploads/${folder}/${encodeURIComponent(trimmedValue)}`;
};

export const resolveCompanyLogoUrl = (value?: string | null) =>
  resolveImageUrl(value, { fallbackSrc: DEFAULT_LOGO_SRC, folder: "settings" });

export const resolveProfileImageUrl = (value?: string | null, options?: Pick<ResolveImageUrlOptions, "allowTemporary">) =>
  resolveImageUrl(value, { fallbackSrc: "", folder: "settings", allowTemporary: options?.allowTemporary });
