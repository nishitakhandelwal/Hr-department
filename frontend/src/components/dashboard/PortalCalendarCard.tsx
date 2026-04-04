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
  meeting: "bg-[#dbe9ff] text-[#456a9b]",
  holiday: "bg-[#e8f0df] text-[#557249]",
  birthday: "bg-[#f8e0db] text-[#9a6258]",
  reminder: "bg-[#efe4cf] text-[#967242]",
} as const;

const dotStyles = {
  meeting: "bg-[#7ca7db]",
  holiday: "bg-[#8dae70]",
  birthday: "bg-[#d39f92]",
  reminder: "bg-[#c6a05d]",
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
          <h3 className="mt-2 text-[24px] font-semibold text-[#24190f]">{title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f5a43]">{subtitle}</p>
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
            <p className="text-lg font-semibold text-[#24190f]">{format(visibleMonth, "MMMM yyyy")}</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfcfb4] bg-white/70 px-3 py-1 text-xs text-[#826746]">
              <CalendarDays className="h-3.5 w-3.5" />
              Events
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#977b57]">
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
                    sameMonth ? "border-[#e7dbc8] bg-white/70 text-[#2c2116]" : "border-[#efe7da] bg-[#fbf6ef] text-[#b09d83]",
                    active && "border-[#c89e63] bg-[linear-gradient(180deg,#fff6e9_0%,#f6ead7_100%)] shadow-[0_16px_32px_rgba(191,154,93,0.14)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{format(day, "d")}</span>
                    {isSameDay(day, today) ? <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b18346]">Now</span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className={cn("h-2.5 w-2.5 rounded-full", dotStyles[event.type])} />
                    ))}
                  </div>
                  {dayEvents[0] ? <p className="mt-3 truncate text-[11px] font-medium text-[#7b6852]">{dayEvents[0].title}</p> : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="dashboard-subtle-card">
            <p className="dashboard-label">Selected Day</p>
            <h4 className="mt-2 text-lg font-semibold text-[#24190f]">{format(selectedDate, "EEEE, d MMMM")}</h4>
            <div className="mt-4 space-y-3">
              {selectedEvents.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#decdb1] bg-white/60 px-4 py-5 text-sm text-[#8a7353]">
                  No scheduled items for this date.
                </div>
              ) : (
                selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-[18px] border border-[#e3d4bc] bg-white/72 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#24190f]">{event.title}</p>
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", typeStyles[event.type])}>{event.type}</span>
                    </div>
                    {event.time ? <p className="mt-1 text-xs text-[#8b7151]">{event.time}</p> : null}
                    {event.note ? <p className="mt-2 text-xs leading-5 text-[#6f5a43]">{event.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-subtle-card">
            <p className="dashboard-label">Upcoming</p>
            <div className="mt-4 space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#e3d4bc] bg-white/72 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#24190f]">{event.title}</p>
                    <p className="mt-1 text-xs text-[#8b7151]">{format(event.parsedDate, "dd MMM")} {event.time ? `• ${event.time}` : ""}</p>
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
