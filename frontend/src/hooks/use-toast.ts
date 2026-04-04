import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, "id">;

const silentResult = {
  id: "silent-toast",
  dismiss: () => undefined,
  update: (_props: ToasterToast) => undefined,
};

const toLogText = (value: React.ReactNode) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

function toast(props: Toast) {
  if (props.variant === "destructive") {
    const title = toLogText(props.title);
    const description = toLogText(props.description);
    console.error([title, description].filter(Boolean).join(": ") || "An unexpected UI error occurred.");
  }

  return silentResult;
}

function useToast() {
  return {
    toasts: [] as ToasterToast[],
    toast,
    dismiss: (_toastId?: string) => undefined,
  };
}

export { useToast, toast };
