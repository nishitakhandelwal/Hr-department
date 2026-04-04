import React from "react";

import ImageWithFallback from "@/components/common/ImageWithFallback";
import { useSystemSettings } from "@/context/SystemSettingsContext";
import { resolveCompanyLogoUrl } from "@/lib/images";

interface AuthShellProps {
  title: string;
  subtitle: string;
  badge?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({ title, subtitle, badge, footer, children }) => {
  const { publicSettings } = useSystemSettings();
  const companyLogo = resolveCompanyLogoUrl(publicSettings?.company?.companyLogoUrl);
  const companyName = publicSettings?.company?.companyName || "Arihant Dream Infra Project Ltd.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.1),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_22%)]" />
        <div className="w-full max-w-[1100px]">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_460px] lg:gap-16">
            <div className="hidden lg:block">
              <div className="max-w-xl">
                <div className="mb-6 inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
                  HR Workspace
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
                    <ImageWithFallback src={companyLogo} alt="Company logo" className="h-12 w-12 rounded-xl object-cover" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-foreground">{companyName}</p>
                    <p className="text-sm text-muted-foreground">Secure access for payroll, attendance, and people operations.</p>
                  </div>
                </div>
                <h1 className="mt-10 text-5xl font-bold leading-[1.02] tracking-tight text-foreground">
                  Modern HR access, designed to feel calm and clear.
                </h1>
                <p className="mt-5 max-w-lg text-base leading-8 text-muted-foreground">
                  Sign in to your workspace and manage day-to-day operations with a cleaner, more focused experience.
                </p>
              </div>
            </div>

            <div className="relative w-full max-w-md justify-self-center">
              <div className="relative rounded-[32px] border border-border bg-card p-6 text-card-foreground shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_24px_70px_rgba(2,6,23,0.42)] sm:p-8">
                <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-muted/45 px-4 py-3 shadow-sm lg:hidden">
                  <ImageWithFallback src={companyLogo} alt="Company logo" className="h-10 w-10 rounded-xl object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{companyName}</p>
                    <p className="text-xs text-muted-foreground">Simple, secure HR workspace access</p>
                  </div>
                </div>

                {badge ? (
                  <div className="mb-5 inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {badge}
                  </div>
                ) : null}
                <div>
                  <h2 className="text-[30px] font-bold tracking-tight text-foreground">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
                </div>

                <div className="mt-8">{children}</div>

                {footer ? <div className="mt-7">{footer}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
