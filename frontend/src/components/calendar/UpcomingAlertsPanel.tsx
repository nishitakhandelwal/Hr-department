import React, { useEffect, useState } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import { AlertCircle, BellRing, Calendar, Loader2 } from "lucide-react";
import { apiService, type EventItem } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const EVENT_META = {
  holiday: {
    label: "Holiday",
    dot: "bg-emerald-500",
    surface: "border-emerald-500/20 bg-emerald-500/10",
    icon: "🇮🇳",
  },
  birthday: {
    label: "Birthday",
    dot: "bg-violet-500",
    surface: "border-violet-500/20 bg-violet-500/10",
    icon: "🎂",
  },
  meeting: {
    label: "Meeting",
    dot: "bg-sky-500",
    surface: "border-sky-500/20 bg-sky-500/10",
    icon: "📅",
  },
  reminder: {
    label: "Reminder",
    dot: "bg-amber-500",
    surface: "border-amber-500/20 bg-amber-500/10",
    icon: "⏰",
  },
};

interface UpcomingAlertsPanelProps {
  role: "admin" | "employee";
  days?: number;
}

export const UpcomingAlertsPanel: React.FC<UpcomingAlertsPanelProps> = ({
  role,
  days = 14,
}) => {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const today = startOfDay(new Date());

  useEffect(() => {
    const loadUpcomingEvents = async () => {
      setLoading(true);
      try {
        const data = await apiService.getEvents({
          month: today.getMonth() + 1,
          year: today.getFullYear(),
        });

        // Filter events for next N days
        const upcomingEvents = data
          .filter((event) => {
            const eventDate = new Date(event.date);
            const diffTime = eventDate.getTime() - today.getTime();
            const diffDays = Math.ceil(
              diffTime / (1000 * 60 * 60 * 24)
            );
            return diffDays >= 0 && diffDays <= days;
          })
          .sort(
            (a, b) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          );

        setEvents(upcomingEvents);
      } catch (error) {
        toast({
          title: "Error loading upcoming events",
          description:
            error instanceof Error
              ? error.message
              : "Failed to fetch upcoming events",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadUpcomingEvents();
  }, [days, toast]);

  const groupedEvents = events.reduce(
    (acc, event) => {
      const eventDate = format(new Date(event.date), "yyyy-MM-dd");
      if (!acc[eventDate]) {
        acc[eventDate] = [];
      }
      acc[eventDate].push(event);
      return acc;
    },
    {} as Record<string, EventItem[]>
  );

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-[30px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.82))] p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))]"
    >
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
              Upcoming Alerts
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Next {days} days of events and important dates
            </p>
          </div>
        </div>
        <div className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/55 px-6 py-12 text-center">
          <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No upcoming events scheduled for the next {days} days.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((dateKey) => {
            const dateEvents = groupedEvents[dateKey];
            const eventDate = new Date(dateKey);
            const daysUntil = Math.floor(
              (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );
            const isToday = daysUntil === 0;
            const isTomorrow = daysUntil === 1;

            return (
              <motion.div
                key={dateKey}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-[20px] border border-white/70 bg-white/50 p-4 dark:border-white/5 dark:bg-white/5"
              >
                {/* Date header */}
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          Today
                        </span>
                      )}
                      {isTomorrow && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Tomorrow
                        </span>
                      )}
                      <p className="text-sm font-semibold text-foreground">
                        {format(eventDate, "EEEE, MMM d")}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {daysUntil} day{daysUntil === 1 ? "" : "s"} away
                  </span>
                </div>

                {/* Events list */}
                <div className="space-y-2.5">
                  {dateEvents.map((event) => (
                    <div
                      key={event._id}
                      className={cn(
                        "flex items-start gap-3 rounded-[16px] border px-4 py-3 transition-colors",
                        EVENT_META[event.type].surface
                      )}
                    >
                      <div className="mt-0.5 flex-shrink-0 text-lg">
                        {
                          EVENT_META[
                            event.type as keyof typeof EVENT_META
                          ].icon
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">
                          {event.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-block rounded-full border border-border/50 bg-background/50 px-2 py-0.5">
                            {
                              EVENT_META[
                                event.type as keyof typeof EVENT_META
                              ].label
                            }
                          </span>
                          {event.timeLabel && (
                            <span className="inline-block">
                              🕐 {event.timeLabel}
                            </span>
                          )}
                          {event.details && (
                            <span className="line-clamp-1">
                              {event.details}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-6 flex items-start gap-2.5 rounded-[16px] border border-blue-200/50 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          💌 Notifications are sent daily at 8 AM for events happening tomorrow. Make sure your email notifications are enabled in settings.
        </p>
      </div>
    </motion.div>
  );
};

export default UpcomingAlertsPanel;
