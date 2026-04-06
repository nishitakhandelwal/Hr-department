import React from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PortalCalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: "meeting" | "holiday" | "birthday" | "reminder";
  time?: string;
  note?: string;
};

type PortalCalendarCardProps = {
  title: string;
  subtitle: string;
  events: PortalCalendarEvent[];
};

const typeStyles = {
  meeting: "bg-[rgba(var(--portal-primary-rgb),0.12)] text-[var(--portal-primary-text)]",
  holiday: "bg-[#e8f0df] text-[#557249] dark:bg-[rgba(34,197,94,0.12)] dark:text-[#b6ecc0]",
  birthday: "bg-[#f8e0db] text-[#9a6258] dark:bg-[rgba(251,113,133,0.12)] dark:text-[#ffc6ce]",
  reminder: "bg-[#efe4cf] text-[#967242] dark:bg-[rgba(230,199,163,0.12)] dark:text-[#E6C7A3]",
} as const;

const dotStyles = {
  meeting: "bg-primary",
  holiday: "bg-[#8dae70]",
  birthday: "bg-[#d39f92]",
  reminder: "bg-[#c6a05d] dark:bg-[#E6C7A3]",
} as const;

const PortalCalendarCard: React.FC<PortalCalendarCardProps> = ({ title, subtitle, events }) => {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const [visibleMonth, setVisibleMonth] = React.useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = React.useState(() => today);

  const normalizedEvents = React.useMemo(
    () =>
      events
        .map((event) => ({ ...event, parsedDate: parseISO(event.date) }))
        .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime()),
    [events]
  );

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, PortalCalendarEvent[]>();
    for (const event of normalizedEvents) {
      const key = format(event.parsedDate, "yyyy-MM-dd");
      map.set(key, [...(map.get(key) || []), event]);
    }
    return map;
  }, [normalizedEvents]);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const selectedEvents = eventsByDay.get(selectedKey) || [];
  const upcomingEvents = normalizedEvents.filter((event) => event.parsedDate >= today).slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="dashboard-panel"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="dashboard-label">Calendar</p>
          <h3 className="portal-heading mt-2 text-[24px] font-semibold">{title}</h3>
          <p className="portal-copy mt-2 max-w-xl text-sm leading-6">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))} className="h-10 w-10 rounded-2xl">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setVisibleMonth(startOfMonth(today)); setSelectedDate(today); }} className="rounded-2xl">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} className="h-10 w-10 rounded-2xl">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="dashboard-subtle-card">
          <div className="mb-4 flex items-center justify-between">
            <p className="portal-heading text-lg font-semibold">{format(visibleMonth, "MMMM yyyy")}</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] px-3 py-1 text-xs text-primary">
              <CalendarDays className="h-3.5 w-3.5" />
              Events
            </div>
          </div>

          <div className="portal-muted grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(key) || [];
              const active = isSameDay(day, selectedDate);
              const sameMonth = isSameMonth(day, visibleMonth);

              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.003 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "min-h-[88px] rounded-[20px] border p-3 text-left transition-all duration-300",
                    sameMonth ? "border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] portal-heading dark:bg-[#1F1D1B]" : "border-[var(--portal-surface-border)] bg-[var(--portal-primary-faint)] text-[var(--portal-muted-color)] dark:bg-[#171513]",
                    active && "border-[rgba(var(--portal-primary-rgb),0.28)] bg-[linear-gradient(180deg,rgba(var(--portal-primary-rgb),0.09)_0%,rgba(255,255,255,0.86)_100%)] shadow-[0_16px_32px_rgba(var(--portal-primary-rgb),0.14)] dark:border-transparent dark:bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] dark:text-black dark:shadow-[0_10px_30px_rgba(166,124,82,0.35)]",
                    !active && "dark:hover:bg-[#2A2623]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{format(day, "d")}</span>
                    {isSameDay(day, today) ? <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Now</span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className={cn("h-2.5 w-2.5 rounded-full", dotStyles[event.type])} />
                    ))}
                  </div>
                  {dayEvents[0] ? <p className="portal-muted mt-3 truncate text-[11px] font-medium">{dayEvents[0].title}</p> : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="dashboard-subtle-card">
            <p className="dashboard-label">Selected Day</p>
            <h4 className="portal-heading mt-2 text-lg font-semibold">{format(selectedDate, "EEEE, d MMMM")}</h4>
            <div className="mt-4 space-y-3">
              {selectedEvents.length === 0 ? (
                <div className="portal-muted rounded-[18px] border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] px-4 py-5 text-sm">
                  No scheduled items for this date.
                </div>
              ) : (
                selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-[18px] border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="portal-heading text-sm font-semibold">{event.title}</p>
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", typeStyles[event.type])}>{event.type}</span>
                    </div>
                    {event.time ? <p className="portal-muted mt-1 text-xs">{event.time}</p> : null}
                    {event.note ? <p className="portal-copy mt-2 text-xs leading-5">{event.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-subtle-card">
            <p className="dashboard-label">Upcoming</p>
            <div className="mt-4 space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] px-4 py-3">
                  <div>
                    <p className="portal-heading text-sm font-semibold">{event.title}</p>
                    <p className="portal-muted mt-1 text-xs">{format(event.parsedDate, "dd MMM")} {event.time ? `• ${event.time}` : ""}</p>
                  </div>
                  <span className={cn("h-2.5 w-2.5 rounded-full", dotStyles[event.type])} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default PortalCalendarCard;
