import React, { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { EventCalendarCard } from "@/components/calendar/EventCalendarCard";
import { UpcomingAlertsPanel } from "@/components/calendar/UpcomingAlertsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const AdminCalendar = () => {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(["holiday", "birthday", "meeting", "reminder"])
  );

  const toggleFilter = useCallback((type: string) => {
    setActiveFilters((prev) => {
      const newFilters = new Set(prev);
      if (newFilters.has(type)) {
        newFilters.delete(type);
      } else {
        newFilters.add(type);
      }
      return newFilters;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters(new Set(["holiday", "birthday", "meeting", "reminder"]));
  }, []);

  const allFiltersActive = useMemo(
    () =>
      activeFilters.has("holiday") &&
      activeFilters.has("birthday") &&
      activeFilters.has("meeting") &&
      activeFilters.has("reminder"),
    [activeFilters]
  );

  const FILTER_TYPES = [
    { id: "holiday", label: "Holiday", dotColor: "bg-emerald-500" },
    { id: "birthday", label: "Birthday", dotColor: "bg-violet-500" },
    { id: "meeting", label: "Meeting", dotColor: "bg-sky-500" },
    { id: "reminder", label: "Reminder", dotColor: "bg-amber-500" },
  ];

  return (
    <>
      <PageHeader
        title="Smart Workforce Calendar"
        subtitle="Manage holidays, birthdays, meetings, and reminders with automatic notifications"
      />

      <div className="space-y-6">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-soft dark:border-white/10 dark:bg-white/5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Event Filter
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">
                Show/Hide Event Types
              </h3>
            </div>
            {!allFiltersActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="gap-2"
              >
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
                  onClick={() => toggleFilter(filter.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-[20px] border-2 px-4 py-3 text-center transition-all duration-300",
                    isActive
                      ? "border-emerald-300 bg-emerald-100 shadow-md"
                      : "border-transparent bg-white/50 opacity-50 hover:opacity-70 dark:bg-slate-800/30"
                  )}
                >
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
                        isActive && "text-emerald-700"
                      )}
                    >
                      {filter.label}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Calendar Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <EventCalendarCard
            role="admin"
            title="Smart Calendar System"
            subtitle="View and manage all events including public holidays, employee birthdays, meetings, and personal reminders."
          />
        </motion.div>

        {/* Upcoming Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <UpcomingAlertsPanel role="admin" />
        </motion.div>
      </div>
    </>
  );
};

export default AdminCalendar;
