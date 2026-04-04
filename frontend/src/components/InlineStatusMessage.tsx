import React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type InlineStatusMessageProps = {
  type: "error" | "success" | "loading";
  message: string;
  className?: string;
};

const styles: Record<InlineStatusMessageProps["type"], string> = {
  error: "text-destructive",
  success: "text-emerald-700",
  loading: "text-muted-foreground",
};

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  loading: Loader2,
};

const InlineStatusMessage: React.FC<InlineStatusMessageProps> = ({ type, message, className = "" }) => {
  const Icon = icons[type];

  return (
    <div className={`flex items-start gap-2 text-sm ${styles[type]} ${className}`.trim()}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${type === "loading" ? "animate-spin" : ""}`} />
      <span>{message}</span>
    </div>
  );
};

export default InlineStatusMessage;
