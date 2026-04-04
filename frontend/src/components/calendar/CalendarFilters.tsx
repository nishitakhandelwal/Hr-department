import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILTER_TYPES = [
  {
    id: "holiday",
    label: "Holiday",
    color: "emerald",
    bgGradient: "from-emerald-50 to-emerald-50/50",
    borderColor: "border-emerald-200/60",
    textColor: "text-emerald-700",
    dotColor: "bg-emerald-500",
  },
  {
    id: "birthday",
    label: "Birthday",
    color: "violet",
    bgGradient: "from-violet-50 to-violet-50/50",
    borderColor: "border-violet-200/60",
    textColor: "text-violet-700",
    dotColor: "bg-violet-500",
  },
  {
    id: "meeting",
    label: "Meeting",
    color: "sky",
    bgGradient: "from-sky-50 to-sky-50/50",
    borderColor: "border-sky-200/60",
    textColor: "text-sky-700",
    dotColor: "bg-sky-500",
  },
  {
    id: "reminder",
    label: "Reminder",
    color: "amber",
    bgGradient: "from-amber-50 to-amber-50/50",
    borderColor: "border-amber-200/60",
    textColor: "text-amber-700",
    dotColor: "bg-amber-500",
  },
];

export interface CalendarFiltersProps {
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
  onClearFilters: () => void;
  isAllActive: boolean;
}

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  activeFilters,
  onToggleFilter,
  onClearFilters,
  isAllActive,
}) => {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-white to-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-br dark:from-slate-900/50 dark:via-slate-900/40 dark:to-slate-900/30">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Event Filter
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            Show/Hide Event Types
          </h3>
        </div>
        {!isAllActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="gap-2"
          >
            <X className="h-3.5 w-3.5" />
            Show All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FILTER_TYPES.map((filter) => {
          const isActive = activeFilters.has(filter.id);

          return (
            <motion.button
              key={filter.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onToggleFilter(filter.id)}
              className={cn(
                "group relative overflow-hidden rounded-[20px] border-2 px-4 py-3 text-center transition-all duration-300",
                isActive
                  ? cn(
                      "bg-" +
                        filter.color +
                        "-100 border-" +
                        filter.color +
                        "-300 shadow-md"
                    )
                  : "border-transparent bg-white/50 opacity-50 hover:opacity-70 dark:bg-slate-800/30"
              )}
            >
              {/* Background glow effect */}
              <div
                className={cn(
                  "absolute inset-0 opacity-0 transition-opacity duration-300",
                  isActive && `bg-gradient-to-br ${filter.bgGradient}`
                )}
              />

              {/* Content */}
              <div className="relative flex items-center justify-center gap-2">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-transform",
                    filter.dotColor,
                    isActive ? "scale-100" : "scale-75"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-semibold transition-colors",
                    isActive && filter.textColor
                  )}
                >
                  {filter.label}
                </span>
              </div>

              {/* Check icon */}
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-end pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <svg
                    className="h-4 w-4 text-current"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        💡 Tip: Click on event type badges to toggle visibility. When filtered, only active event types will appear on
        the calendar.
      </p>
    </div>
  );
};

export default CalendarFilters;
