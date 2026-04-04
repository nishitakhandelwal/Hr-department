const normalizeSegment = (segment) =>
  String(segment || "")
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => encodeURIComponent(part));

export const buildUploadsPublicPath = (...segments) => {
  const safeSegments = segments.flatMap((segment) => normalizeSegment(segment));
  return `/${["uploads", ...safeSegments].join("/")}`;
};

export const buildUploadsPublicUrl = (req, ...segments) => `${req.protocol}://${req.get("host")}${buildUploadsPublicPath(...segments)}`;
