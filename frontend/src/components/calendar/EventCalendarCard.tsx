import React from "react";
import { format, isSameMonth, parseISO, startOfDay, differenceInCalendarDays } from "date-fns";
import type { DayContentProps } from "react-day-picker";
import { motion } from "framer-motion";
import { BellRing, CalendarPlus2, Gift, Landmark, Loader2, Pencil, Trash2, Users } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import InlineStatusMessage from "@/components/InlineStatusMessage";
import { useToast } from "@/hooks/use-toast";
import { apiService, type EventItem } from "@/services/api";
import { cn } from "@/lib/utils";

type EventCalendarCardProps = {
  role: "admin" | "employee";
  title: string;
  subtitle: string;
};

type EventFormState = {
  title: string;
  date: string;
  type: EventItem["type"];
  timeLabel: string;
  details: string;
};

const EVENT_META: Record<EventItem["type"], { label: string; dot: string; badge: string; surface: string; icon: React.ReactNode }> = {
  holiday: {
    label: "Holiday",
    dot: "bg-emerald-500",
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    surface: "border-emerald-500/20 bg-emerald-500/10",
    icon: <Landmark className="h-3.5 w-3.5" />,
  },
  birthday: {
    label: "Birthday",
    dot: "bg-[#E6C7A3]",
    badge: "border-[#2A2623] bg-[rgba(230,199,163,0.2)] text-[#E6C7A3] dark:text-[#E6C7A3]",
    surface: "border-[#2A2623] bg-[rgba(230,199,163,0.2)]",
    icon: <Gift className="h-3.5 w-3.5" />,
  },
  meeting: {
    label: "Meeting",
    dot: "bg-[#A67C52]",
    badge: "border-[#2A2623] bg-[rgba(230,199,163,0.2)] text-[#E6C7A3] dark:text-[#E6C7A3]",
    surface: "border-[#2A2623] bg-[rgba(230,199,163,0.2)]",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  reminder: {
    label: "Reminder",
    dot: "bg-amber-500",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    surface: "border-amber-500/20 bg-amber-500/10",
    icon: <BellRing className="h-3.5 w-3.5" />,
  },
};

const EVENT_ORDER: EventItem["type"][] = ["holiday", "birthday", "meeting", "reminder"];

const emptyForm = (date: Date, role: EventCalendarCardProps["role"]): EventFormState => ({
  title: "",
  date: format(date, "yyyy-MM-dd"),
  type: role === "employee" ? "reminder" : "meeting",
  timeLabel: "",
  details: "",
});

const toDate = (value: string | Date) => (value instanceof Date ? value : parseISO(value));
const toDateKey = (value: string | Date) => format(toDate(value), "yyyy-MM-dd");

const sortEvents = (items: EventItem[]) =>
  [...items].sort((left, right) => {
    const dayDiff = toDate(left.date).getTime() - toDate(right.date).getTime();
    if (dayDiff !== 0) return dayDiff;
    return EVENT_ORDER.indexOf(left.type) - EVENT_ORDER.indexOf(right.type);
  });

const getNotificationMessage = (event: EventItem, today: Date) => {
  const eventDate = startOfDay(toDate(event.date));
  const delta = differenceInCalendarDays(eventDate, today);

  if (delta === 1 && event.type === "birthday") {
    return `Tomorrow is ${event.title} 🎂`;
  }
  if (delta === 0 && event.type === "meeting" && event.timeLabel) {
    return `${event.title} at ${event.timeLabel}`;
  }
  if (delta === 0 && event.type === "reminder") {
    return `Reminder today: ${event.title}`;
  }
  if (delta === 1) {
    return `Tomorrow: ${event.title}`;
  }
  return `${event.title} on ${format(eventDate, "dd MMM")}`;
};

export const EventCalendarCard: React.FC<EventCalendarCardProps> = ({ role, title, subtitle }) => {
  const { toast } = useToast();
  const [month, setMonth] = React.useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = React.useState(() => startOfDay(new Date()));
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingEvent, setEditingEvent] = React.useState<EventItem | null>(null);
  const [form, setForm] = React.useState<EventFormState>(() => emptyForm(new Date(), role));
  const [inlineError, setInlineError] = React.useState("");

  const loadEvents = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getEvents({
        month: month.getMonth() + 1,
        year: month.getFullYear(),
      });
      setEvents(sortEvents(data));
    } catch (error) {
      toast({
        title: "Calendar unavailable",
        description: error instanceof Error ? error.message : "Failed to load events.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [month, toast]);

  React.useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  React.useEffect(() => {
    const today = startOfDay(new Date());
    const upcoming = events.filter((event) => {
      const diff = differenceInCalendarDays(startOfDay(toDate(event.date)), today);
      return diff >= 0 && diff <= 1;
    });

    for (const event of upcoming) {
      const key = `event-toast:${event._id}:${toDateKey(event.date)}`;
      if (sessionStorage.getItem(key) === "1") continue;
      sessionStorage.setItem(key, "1");
      toast({ title: "Upcoming event", description: getNotificationMessage(event, today) });
    }
  }, [events, toast]);

  const groupedEvents = React.useMemo(() => {
    const grouped = new Map<string, EventItem[]>();
    for (const event of events) {
      const key = toDateKey(event.date);
      const list = grouped.get(key) || [];
      list.push(event);
      grouped.set(key, sortEvents(list));
    }
    return grouped;
  }, [events]);

  const selectedEvents = React.useMemo(() => groupedEvents.get(toDateKey(selectedDate)) || [], [groupedEvents, selectedDate]);

  const upcomingEvents = React.useMemo(() => {
    const today = startOfDay(new Date());
    return sortEvents(
      events.filter((event) => {
        const diff = differenceInCalendarDays(startOfDay(toDate(event.date)), today);
        return diff >= 0 && diff <= 7;
      })
    ).slice(0, 6);
  }, [events]);

  const openCreateDialog = () => {
    setEditingEvent(null);
    setInlineError("");
    setForm(emptyForm(selectedDate, role));
    setDialogOpen(true);
  };

  const openEditDialog = (event: EventItem) => {
    setEditingEvent(event);
    setInlineError("");
    setForm({
      title: event.title,
      date: format(toDate(event.date), "yyyy-MM-dd"),
      type: role === "employee" ? "reminder" : event.type,
      timeLabel: event.timeLabel || "",
      details: event.details || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.date) {
      setInlineError("Title and date are required.");
      return;
    }

    setSaving(true);
    setInlineError("");
    try {
      if (editingEvent) {
        await apiService.updateEvent(editingEvent._id, form);
        toast({ title: "Event updated", description: "Calendar entry saved successfully." });
      } else {
        await apiService.createEvent(form);
        toast({ title: role === "employee" ? "Reminder added" : "Event added", description: "Calendar entry created successfully." });
      }

      setDialogOpen(false);
      await loadEvents();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save event.";
      setInlineError(message);
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: EventItem) => {
    setDeletingId(event._id);
    try {
      await apiService.deleteEvent(event._id);
      toast({ title: "Event deleted", description: "Calendar entry removed successfully." });
      await loadEvents();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete event.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const eventTypeOptions: EventItem["type"][] = role === "admin" ? ["holiday", "birthday", "meeting", "reminder"] : ["reminder"];

  const DayContent = ({ date }: DayContentProps) => {
    const dayEvents = groupedEvents.get(toDateKey(date)) || [];
    const uniqueTypes = [...new Set(dayEvents.map((event) => event.type))].sort(
      (left, right) => EVENT_ORDER.indexOf(left) - EVENT_ORDER.indexOf(right)
    );
    const dominantType = uniqueTypes[0] || "reminder";

    return (
      <Tooltip delayDuration={120}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition-all",
              dayEvents.length > 0 && EVENT_META[dominantType].surface
            )}
            title={dayEvents.map((event) => event.title).join(", ")}
          >
            <span className={cn("text-sm font-semibold", !isSameMonth(date, month) && "opacity-45")}>{format(date, "d")}</span>
            <span className="flex items-center justify-center gap-1">
              {uniqueTypes.slice(0, 4).map((type) => (
                <span key={type} className={cn("h-1.5 w-1.5 rounded-full", EVENT_META[type].dot)} />
              ))}
            </span>
          </div>
        </TooltipTrigger>
        {dayEvents.length > 0 ? (
          <TooltipContent className="max-w-[220px] rounded-2xl border-border/80 bg-popover/95 p-3 shadow-card">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{format(date, "dd MMM yyyy")}</p>
              {dayEvents.slice(0, 4).map((event) => (
                <div key={event._id} className="text-sm text-popover-foreground">
                  <div className="font-medium">{event.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {EVENT_META[event.type].label}
                    {event.timeLabel ? ` • ${event.timeLabel}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </TooltipContent>
        ) : null}
      </Tooltip>
    );
  };

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-[30px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.82))] p-6 shadow-card backdrop-blur-xl dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#1A1816,#2A211B)]"
      >
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              <CalendarPlus2 className="h-3.5 w-3.5" />
              Smart Calendar
            </div>
            <h3 className="text-[24px] font-semibold tracking-[-0.03em] text-foreground">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {EVENT_ORDER.map((type) => (
              <span key={type} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", EVENT_META[type].badge)}>
                <span className={cn("h-2 w-2 rounded-full", EVENT_META[type].dot)} />
                {EVENT_META[type].label}
              </span>
            ))}
            <Button onClick={openCreateDialog} className="gap-2">
              <CalendarPlus2 className="h-4 w-4" />
              {role === "admin" ? "Add Event" : "Add Reminder"}
            </Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(230,199,163,0.12),rgba(255,255,255,0.78))] p-4 shadow-soft dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#1A1816,#2A211B)]">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading calendar...
              </div>
            ) : (
              <Calendar
                mode="single"
                month={month}
                onMonthChange={setMonth}
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                className="rounded-[24px] p-0"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-5",
                  caption: "flex items-center justify-center pt-2",
                  caption_label: "text-base font-semibold text-foreground",
                  head_row: "grid grid-cols-7",
                  head_cell: "w-full text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground",
                  row: "mt-2 grid grid-cols-7 gap-2",
                  cell: "h-auto w-full p-0",
                  day: "h-14 w-full rounded-2xl p-0 text-foreground hover:bg-primary/5",
                  day_selected: "bg-primary/10 text-foreground ring-2 ring-primary/35 hover:bg-primary/10",
                  day_today: "bg-accent text-accent-foreground",
                  day_outside: "text-muted-foreground/50 opacity-100",
                }}
                components={{ DayContent }}
              />
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-soft dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected Day</p>
                  <h4 className="mt-1 text-lg font-semibold text-foreground">{format(selectedDate, "EEEE, dd MMM yyyy")}</h4>
                </div>
                <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                  {selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {selectedEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background/55 px-4 py-5 text-sm text-muted-foreground">
                    No events on this date yet.
                  </div>
                ) : (
                  selectedEvents.map((event) => (
                    <div key={event._id} className={cn("rounded-2xl border px-4 py-3 shadow-soft", EVENT_META[event.type].surface)}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", EVENT_META[event.type].badge)}>
                            {EVENT_META[event.type].icon}
                            {EVENT_META[event.type].label}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">{event.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.timeLabel ? `${event.timeLabel} • ` : ""}
                            {event.userId ? "Personal event" : "Shared event"}
                          </p>
                          {event.details ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.details}</p> : null}
                        </div>
                        {(event.canEdit || event.canDelete) && event.source !== "system" ? (
                          <div className="flex items-center gap-1">
                            {event.canEdit ? (
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openEditDialog(event)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {event.canDelete ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl text-destructive hover:text-destructive"
                                onClick={() => void handleDelete(event)}
                                disabled={deletingId === event._id}
                              >
                                {deletingId === event._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-soft dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <BellRing className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Upcoming Alerts</h4>
                  <p className="text-sm text-muted-foreground">Next 7 days of holidays, birthdays, meetings, and reminders.</p>
                </div>
              </div>
              <div className="space-y-3">
                {upcomingEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background/55 px-4 py-5 text-sm text-muted-foreground">
                    No upcoming events scheduled.
                  </div>
                ) : (
                  upcomingEvents.map((event) => (
                    <div key={`upcoming-${event._id}`} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                      <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", EVENT_META[event.type].dot)} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{getNotificationMessage(event, startOfDay(new Date()))}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(toDate(event.date), "EEE, dd MMM")}
                          {event.timeLabel ? ` • ${event.timeLabel}` : ""}
                          {event.details ? ` • ${event.details}` : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-0 dark:bg-[linear-gradient(135deg,#1A1816,#2A211B)]">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader>
              <DialogTitle>{editingEvent ? "Edit Event" : role === "admin" ? "Create Event" : "Create Reminder"}</DialogTitle>
              <DialogDescription>
                {role === "admin"
                  ? "Add holidays, birthdays, meetings, or reminders to the shared calendar."
                  : "Create a personal reminder that only you can manage."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="calendar-title">Title</Label>
              <Input
                id="calendar-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={role === "admin" ? "Quarterly townhall" : "Send reimbursement mail"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="calendar-date">Date</Label>
                <Input
                  id="calendar-date"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value as EventItem["type"] }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {EVENT_META[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-time">Time / Label</Label>
              <Input
                id="calendar-time"
                value={form.timeLabel}
                onChange={(event) => setForm((current) => ({ ...current, timeLabel: event.target.value }))}
                placeholder="3:00 PM"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-details">Notes</Label>
              <Textarea
                id="calendar-details"
                value={form.details}
                onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
                placeholder="Add meeting room, wish note, or reminder details..."
                className="min-h-[110px]"
              />
            </div>

            {inlineError ? <InlineStatusMessage type="error" message={inlineError} /> : null}
          </div>

          <DialogFooter className="border-t border-border/70 px-6 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : editingEvent ? "Save Changes" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EventCalendarCard;
