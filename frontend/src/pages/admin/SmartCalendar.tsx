import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  compareAsc,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiService, type CalendarEvent, type CalendarMonth, type UpcomingEventsList } from "@/services/api";

const EVENT_COLOR_CLASSES = {
  holiday: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  meeting: "border-[#D8B58E] bg-[linear-gradient(135deg,#FAE8CF_0%,#F3DFC2_100%)] text-[#6E4A27] dark:border-[#2A2623] dark:bg-[rgba(230,199,163,0.2)] dark:text-[#E6C7A3]",
  birthday: "border-[#D7C3A4] bg-[linear-gradient(135deg,#F7EBD9_0%,#F1E2CC_100%)] text-[#725332] dark:border-[#2A2623] dark:bg-[rgba(230,199,163,0.2)] dark:text-[#E6C7A3]",
  reminder: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
} as const;

const DARK_PANEL =
  "dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#1A1816,#2A211B)] dark:shadow-[0_22px_60px_rgba(166,124,82,0.4)]";

const EVENT_DOT_CLASSES = {
  holiday: "bg-emerald-500",
  meeting: "bg-[#B87A3B]",
  birthday: "bg-[#B88952]",
  reminder: "bg-amber-500",
} as const;

const EMPTY_EVENT_FORM = {
  title: "",
  type: "meeting" as const,
  time: "",
  description: "",
};

type SmartCalendarProps = {
  embedded?: boolean;
};

const toDateKey = (value: Date | string) =>
  typeof value === "string" ? format(parseISO(value), "yyyy-MM-dd") : format(value, "yyyy-MM-dd");

const toMonthKey = (value: Date) => format(value, "yyyy-MM");
const filterCalendarEvents = (events: CalendarEvent[], hideHolidays: boolean) =>
  hideHolidays ? events.filter((event) => event.type !== "holiday") : events;

const SmartCalendar: React.FC<SmartCalendarProps> = ({ embedded = false }) => {
  const { toast } = useToast();
  const hideHolidayEvents = embedded;

  const today = useMemo(() => startOfDay(new Date()), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(() => today);
  const [country, setCountry] = useState("IN");
  const [supportedCountries, setSupportedCountries] = useState<string[]>([]);

  const [calendarData, setCalendarData] = useState<CalendarMonth | null>(null);
  const [upcomingData, setUpcomingData] = useState<UpcomingEventsList | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([]);

  const [loading, setLoading] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventForm, setNewEventForm] = useState({
    ...EMPTY_EVENT_FORM,
    date: toDateKey(today),
  });

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const visibleMonthKey = useMemo(() => toMonthKey(visibleMonth), [visibleMonth]);

  useEffect(() => {
    setNewEventForm((prev) => ({
      ...prev,
      date: selectedDateKey,
    }));
  }, [selectedDateKey]);

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const result = await apiService.getSupportedCalendarCountries();
        setSupportedCountries(result.countries);
      } catch (error) {
        toast({
          title: "Countries unavailable",
          description: error instanceof Error ? error.message : "Failed to load supported countries.",
          variant: "destructive",
        });
      }
    };

    void loadCountries();
  }, [toast]);

  const loadSelectedDateEvents = useCallback(
    async (dateKey: string) => {
      const selectedDateRes = await apiService.getEventsByDate(dateKey, { country });
      setSelectedDateEvents(filterCalendarEvents(selectedDateRes.events, hideHolidayEvents));
    },
    [country, hideHolidayEvents]
  );

  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const [calendarRes, upcomingRes] = await Promise.all([
        apiService.getCalendarEvents({
          month: visibleMonth.getMonth() + 1,
          year: visibleMonth.getFullYear(),
          country,
        }),
        apiService.getUpcomingCalendarEvents({ days: 30, country }),
      ]);

      const filteredCalendarEvents = filterCalendarEvents(calendarRes.events, hideHolidayEvents);
      const filteredUpcomingEvents = filterCalendarEvents(upcomingRes.allEvents, hideHolidayEvents);

      setCalendarData({
        ...calendarRes,
        events: filteredCalendarEvents,
        totalEvents: filteredCalendarEvents.length,
      });
      setUpcomingData({
        ...upcomingRes,
        allEvents: filteredUpcomingEvents,
        upcomingDays: upcomingRes.upcomingDays
          .map((day) => {
            const filteredDayEvents = filterCalendarEvents(day.events, hideHolidayEvents);
            return {
              ...day,
              events: filteredDayEvents,
              totalEvents: filteredDayEvents.length,
            };
          })
          .filter((day) => day.events.length > 0),
        totalEvents: filteredUpcomingEvents.length,
      });
      await loadSelectedDateEvents(selectedDateKey);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load calendar data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [country, hideHolidayEvents, loadSelectedDateEvents, selectedDateKey, toast, visibleMonth]);

  useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  const visibleMonthEvents = useMemo(() => {
    if (!calendarData) return [];
    return calendarData.events.filter((event) => event.date.startsWith(visibleMonthKey));
  }, [calendarData, visibleMonthKey]);

  const eventsByDate = useMemo(() => {
    return visibleMonthEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      if (!acc[event.date]) {
        acc[event.date] = [];
      }
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [visibleMonthEvents]);

  const calendarDays = useMemo(() => {
    const rangeStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const rangeEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  }, [visibleMonth]);

  const upcomingDays = useMemo(() => {
    if (!upcomingData?.upcomingDays) return [];

    return upcomingData.upcomingDays
      .map((day) => ({
        ...day,
        parsedDate: parseISO(day.date),
      }))
      .filter((day) => !isBefore(day.parsedDate, today))
      .sort((a, b) => compareAsc(a.parsedDate, b.parsedDate));
  }, [today, upcomingData]);

  const changeVisibleMonth = useCallback((nextMonth: Date) => {
    const normalizedMonth = startOfMonth(nextMonth);
    setVisibleMonth(normalizedMonth);

    setSelectedDate((prev) => {
      if (isSameMonth(prev, normalizedMonth)) {
        return prev;
      }
      return isSameMonth(today, normalizedMonth) ? today : normalizedMonth;
    });
  }, [today]);

  const handleDateClick = useCallback(
    async (date: Date) => {
      const normalizedDate = startOfDay(date);
      const nextDateKey = toDateKey(normalizedDate);

      setSelectedDate(normalizedDate);
      if (!isSameMonth(normalizedDate, visibleMonth)) {
        setVisibleMonth(startOfMonth(normalizedDate));
      }

      try {
        await loadSelectedDateEvents(nextDateKey);
      } catch (error) {
        toast({
          title: "Date events unavailable",
          description: error instanceof Error ? error.message : "Failed to load events for this date.",
          variant: "destructive",
        });
      }
    },
    [loadSelectedDateEvents, toast, visibleMonth]
  );

  const handleTodayClick = useCallback(async () => {
    setVisibleMonth(startOfMonth(today));
    setSelectedDate(today);

    try {
      await loadSelectedDateEvents(toDateKey(today));
    } catch (error) {
      toast({
        title: "Today events unavailable",
        description: error instanceof Error ? error.message : "Failed to load today's events.",
        variant: "destructive",
      });
    }
  }, [loadSelectedDateEvents, toast, today]);

  const handleAddEvent = async () => {
    if (!newEventForm.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an event title",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiService.createEvent({
        title: newEventForm.title.trim(),
        date: newEventForm.date,
        type: newEventForm.type,
        timeLabel: newEventForm.time,
        details: newEventForm.description,
      });

      toast({
        title: "Success",
        description: "Event created successfully",
      });

      setShowEventModal(false);
      setNewEventForm({
        ...EMPTY_EVENT_FORM,
        date: selectedDateKey,
      });

      await loadCalendarData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create event",
        variant: "destructive",
      });
    }
  };

  if (loading && !calendarData) {
    return (
      <div className={cn("flex items-center justify-center", embedded ? "min-h-[420px]" : "h-screen")}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const monthLabel = format(visibleMonth, "MMMM yyyy");
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div
        className={cn(
          "flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-lg backdrop-blur-xl dark:text-white",
          DARK_PANEL,
          !embedded && "sm:flex-row sm:items-start sm:justify-between",
          embedded && "sm:flex-row sm:items-center sm:justify-between"
        )}
      >
        <div>
          {embedded ? (
            <h2 className="text-2xl font-semibold text-foreground">Smart Workforce Calendar</h2>
          ) : (
            <h1 className="text-3xl font-bold text-foreground">Smart Workforce Calendar</h1>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            Dynamic monthly scheduling with exact date matching, upcoming alerts, and shared event visibility.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-32 border-white/15 bg-white/80 text-foreground dark:border-white/15 dark:bg-white/5 dark:text-white">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              {supportedCountries.map((supportedCountry) => (
                <SelectItem key={supportedCountry} value={supportedCountry}>
                  {supportedCountry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => setShowEventModal(true)}
            className="border border-primary/30 bg-[linear-gradient(135deg,#7c6cff_0%,#3bb8ff_100%)] text-white shadow-[0_12px_30px_rgba(87,102,255,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(87,102,255,0.45)]"
          >
            <Plus className="mr-2 h-4 w-4 [stroke-width:2.6]" />
            Add Event
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className={cn(
            "overflow-hidden rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-lg backdrop-blur-xl dark:text-white",
            DARK_PANEL
          )}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{monthLabel}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Live month view driven by system date and exact event keys.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => changeVisibleMonth(subMonths(visibleMonth, 1))}
                className="border border-white/10 bg-white/55 text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/80 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5 [stroke-width:2.6]" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleTodayClick()}
                className="border-white/15 bg-white/70 text-foreground dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => changeVisibleMonth(addMonths(visibleMonth, 1))}
                className="border border-white/10 bg-white/55 text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/80 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5 [stroke-width:2.6]" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="mb-2 grid grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <div key={day} className="py-2 text-center text-xs font-semibold uppercase text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((date) => {
                const dateKey = toDateKey(date);
                const dayEvents = eventsByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(date, visibleMonth);
                const isTodayDate = isSameDay(date, today);
                const isSelectedDate = isSameDay(date, selectedDate);

                return (
                  <motion.button
                    key={dateKey}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: 0.01 }}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => void handleDateClick(date)}
                    className={cn(
                      "relative min-h-[112px] rounded-[20px] border p-3 text-left transition-all duration-300",
                      !isCurrentMonth && "border-white/8 bg-white/[0.03] text-muted-foreground dark:text-slate-500",
                      isCurrentMonth && "border-border bg-background/70 hover:bg-accent/50 dark:border-white/8 dark:bg-white/[0.035] dark:hover:bg-white/[0.08]",
                      isTodayDate && "border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(230,199,163,0.2),0_12px_30px_rgba(166,124,82,0.4)] dark:bg-primary/10 dark:shadow-[0_0_0_1px_rgba(230,199,163,0.2),0_16px_34px_rgba(166,124,82,0.4)]",
                      isSelectedDate && "border-primary bg-primary/10 dark:bg-primary/12"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{format(date, "d")}</span>
                      {isTodayDate ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                          Today
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event._id}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-2 py-1 text-xs font-medium shadow-[0_10px_22px_rgba(166,124,82,0.18)] dark:shadow-none",
                            EVENT_COLOR_CLASSES[event.type]
                          )}
                        >
                          <span className={cn("h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]", EVENT_DOT_CLASSES[event.type])} />
                          <span className="truncate">{event.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 2 ? (
                        <div className="text-xs font-medium text-muted-foreground">+{dayEvents.length - 2} more</div>
                      ) : null}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={cn(
              "overflow-hidden rounded-[24px] border border-white/70 bg-white/75 p-5 shadow-lg dark:text-white",
              DARK_PANEL
            )}
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">{format(selectedDate, "EEEE, MMM d, yyyy")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Exact match for <span className="font-medium">{selectedDateKey}</span>
              </p>
            </div>

            <div className="max-h-72 space-y-3 overflow-y-auto">
              {selectedDateEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-6 text-center text-sm text-muted-foreground">
                  No events scheduled for this day.
                </div>
              ) : (
                selectedDateEvents.map((event) => (
                  <motion.div
                    key={event._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ x: 3, scale: 1.01 }}
                    transition={{ duration: 0.22 }}
                    className={cn("rounded-[18px] border p-3", EVENT_COLOR_CLASSES[event.type])}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{event.title}</div>
                        {event.description ? <div className="mt-1 text-xs opacity-80">{event.description}</div> : null}
                      </div>
                      <span className={cn("mt-0.5 h-3 w-3 rounded-full shadow-[0_0_14px_currentColor]", EVENT_DOT_CLASSES[event.type])} />
                    </div>
                    {event.time ? (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs opacity-80">
                        <Clock3 className="h-3.5 w-3.5 [stroke-width:2.5]" />
                        {event.time}
                      </div>
                    ) : null}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.48, ease: "easeOut" }}
            className={cn(
              "overflow-hidden rounded-[24px] border border-white/70 bg-white/75 p-5 shadow-lg dark:text-white",
              DARK_PANEL
            )}
          >
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary [stroke-width:2.5] drop-shadow-[0_0_14px_rgba(166,124,82,0.4)]" />
              <h3 className="text-lg font-semibold text-foreground">Upcoming Events</h3>
            </div>

            <div className="max-h-96 space-y-3 overflow-y-auto">
              {upcomingDays.length > 0 ? (
                upcomingDays.map((day) => (
                  <div key={day.date} className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {day.isToday ? "Today" : day.isTomorrow ? "Tomorrow" : format(day.parsedDate, "MMM d, yyyy")}
                    </div>

                    {day.events.map((event) => (
                      <motion.div
                        key={event._id}
                        whileHover={{ x: 4, scale: 1.01 }}
                        transition={{ duration: 0.22 }}
                        className={cn("rounded-[16px] border p-2.5 text-xs", EVENT_COLOR_CLASSES[event.type])}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{event.title}</div>
                          <span className={cn("h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]", EVENT_DOT_CLASSES[event.type])} />
                        </div>
                        {event.time ? <div className="mt-1 opacity-75">{event.time}</div> : null}
                      </motion.div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">No upcoming events.</div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>Create a new event using the strict YYYY-MM-DD date format.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Event Title*</Label>
              <Input
                id="title"
                value={newEventForm.title}
                onChange={(e) => setNewEventForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title..."
              />
            </div>

            <div>
              <Label htmlFor="date">Date*</Label>
              <Input
                id="date"
                type="date"
                value={newEventForm.date}
                onChange={(e) => setNewEventForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="type">Event Type*</Label>
              <Select
                value={newEventForm.type}
                onValueChange={(value) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    type: value as "meeting" | "birthday" | "reminder",
                  }))
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="birthday">Birthday</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="time">Time (optional)</Label>
              <Input
                id="time"
                type="time"
                value={newEventForm.time}
                onChange={(e) => setNewEventForm((prev) => ({ ...prev, time: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newEventForm.description}
                onChange={(e) => setNewEventForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Add event details..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowEventModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddEvent()}>Create Event</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default SmartCalendar;
