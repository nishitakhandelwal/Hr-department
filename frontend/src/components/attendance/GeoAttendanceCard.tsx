import React from "react";
import { LocateFixed, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AttendanceRecord, GeoFenceValidationResult } from "@/services/api";

type GeoAttendanceCardProps = {
  loading: boolean;
  locating: boolean;
  checkedIn: boolean;
  statusMessage: string;
  locationError: string;
  validation: GeoFenceValidationResult | null;
  todayAttendance: AttendanceRecord | null;
  onRefreshLocation: () => Promise<void>;
  onToggleAttendance: () => Promise<void>;
};

const formatDistance = (value?: number) => {
  const distance = Number(value || 0);
  if (distance >= 1000) return `${(distance / 1000).toFixed(2)} km`;
  return `${Math.round(distance)} m`;
};

const formatTimestamp = (value?: string) => {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const GeoAttendanceCard: React.FC<GeoAttendanceCardProps> = ({
  loading,
  locating,
  checkedIn,
  statusMessage,
  locationError,
  validation,
  todayAttendance,
  onRefreshLocation,
  onToggleAttendance,
}) => {
  const activeOffice = validation?.matchedLocation || validation?.nearestLocation;
  const lastCheckInOffice = todayAttendance?.checkInLocation?.officeName || "Not checked in yet";
  const lastCheckOutOffice = todayAttendance?.checkOutLocation?.officeName || "Not checked out yet";

  return (
    <section className="rounded-[28px] border bg-white p-5 shadow-card sm:p-6 dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#111111,#1A1816)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">Geo Attendance</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-[#F5F5F5]">
              Mark attendance only when you are inside an approved office zone.
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-[#2A2623] dark:bg-black/30">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Check-in office</p>
              <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-[#F5F5F5]">{lastCheckInOffice}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(todayAttendance?.checkInLocation?.capturedAt)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-[#2A2623] dark:bg-black/30">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Check-out office</p>
              <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-[#F5F5F5]">{lastCheckOutOffice}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(todayAttendance?.checkOutLocation?.capturedAt)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-[#2A2623] dark:bg-black/30">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current office status</p>
              <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-[#F5F5F5]">
                {validation?.matched ? "Inside approved zone" : "Validation required"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {statusMessage || "Refresh your location before marking attendance."}
              </p>
            </div>
          </div>

          <div
            className={`rounded-2xl border px-4 py-4 text-sm ${
              locationError
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                : validation?.matched
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {locationError ? (
                <TriangleAlert className="mt-0.5 h-4 w-4" />
              ) : validation?.matched ? (
                <ShieldCheck className="mt-0.5 h-4 w-4" />
              ) : (
                <MapPin className="mt-0.5 h-4 w-4" />
              )}
              <div className="space-y-1">
                <p className="font-medium">
                  {locationError || statusMessage || "Your current location has not been verified yet."}
                </p>
                {activeOffice ? (
                  <p>
                    {validation?.matched ? "Matched office" : "Nearest office"}: {activeOffice.name}
                    {" | "}Distance: {formatDistance(activeOffice.distanceMeters)}
                    {" | "}Allowed radius: {formatDistance(activeOffice.radiusMeters)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-[240px] flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onRefreshLocation()}
            disabled={locating || loading}
            className="gap-2 rounded-2xl"
          >
            <LocateFixed className="h-4 w-4" />
            {locating ? "Fetching location..." : "Refresh My Location"}
          </Button>
          <Button
            type="button"
            onClick={() => void onToggleAttendance()}
            disabled={locating || loading}
            className="rounded-2xl"
          >
            {loading ? "Saving attendance..." : checkedIn ? "Check Out with Geo-fence" : "Check In with Geo-fence"}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default GeoAttendanceCard;
