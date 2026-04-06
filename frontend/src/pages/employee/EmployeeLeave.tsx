import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, StatusBadge } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/StatCard";
import { CalendarDays, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { apiService } from "@/services/api";

interface LeaveEntry {
  [key: string]: string | number;
  _id: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: string;
}

type LeaveApiEntry = {
  _id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  status: string;
};

const EmployeeLeave: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [form, setForm] = useState({ type: "Vacation", from: "", to: "", days: 1, reason: "" });

  const loadLeaves = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const leaveRows = await apiService.list<LeaveApiEntry>("leave");
      const mine = leaveRows.map((entry) => {
        const from = new Date(entry.fromDate);
        const to = new Date(entry.toDate);
        return {
          _id: entry._id,
          type: entry.leaveType,
          from: from.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          to: to.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          days: Math.ceil((to.getTime() - from.getTime()) / (1000 * 3600 * 24)) + 1,
          status: `${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`,
        };
      });
      setLeaves(mine);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load leave data";
      setErrorMessage(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  const usedDays = useMemo(() => leaves.reduce((sum, row) => sum + row.days, 0), [leaves]);
  const pendingRequests = useMemo(() => leaves.filter((row) => row.status.toLowerCase() === "pending").length, [leaves]);
  const approvedRequests = useMemo(() => leaves.filter((row) => row.status.toLowerCase() === "approved").length, [leaves]);

  const handleApply = async () => {
    if (!form.from.trim() || !form.to.trim()) {
      toast({ title: "Validation Error", description: "Please fill all date fields.", variant: "destructive" });
      return;
    }
    try {
      await apiService.create("leave", {
        leaveType: form.type,
        fromDate: new Date(form.from).toISOString(),
        toDate: new Date(form.to).toISOString(),
        reason: form.reason,
        status: "pending",
      });
      toast({ title: "Leave Applied", description: `Your ${form.type} request has been submitted.` });
      setApplyOpen(false);
      setForm({ type: "Vacation", from: "", to: "", days: 1, reason: "" });
      await loadLeaves();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to apply leave", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Leave"
        subtitle="Apply and track your leave requests"
        action={<Button onClick={() => setApplyOpen(true)} className="gradient-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Apply Leave</Button>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Approved Requests" value={approvedRequests} change="Approved by admin" icon={CalendarDays} color="primary" />
        <StatCard title="Used" value={`${usedDays} days`} change="Across submitted requests" icon={CalendarDays} color="warning" delay={1} />
        <StatCard title="Pending" value={pendingRequests} change="Awaiting action" icon={CalendarDays} color="success" delay={2} />
      </div>
      {errorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</div> : null}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading leave data...</div>
      ) : (
        <DataTable
          columns={[
            { key: "type", label: "Type" },
            { key: "from", label: "From" },
            { key: "to", label: "To" },
            { key: "days", label: "Days" },
            { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
          ]}
          data={leaves}
        />
      )}

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label>Leave Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vacation">Vacation</SelectItem>
                  <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Maternity">Maternity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>From *</Label><DatePicker value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>To *</Label><DatePicker value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Reason</Label><Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Optional reason" /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => void handleApply()} className="gradient-primary text-primary-foreground">Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeLeave;
