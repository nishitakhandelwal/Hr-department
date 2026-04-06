import React, { useCallback, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, StatusBadge } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/DatePicker";
import { Plus, CheckCircle, XCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/common/ExportButton";
import { apiService } from "@/services/api";

const CUSTOM_REASON_VALUE = "__other__";

interface OffboardEntry {
  _id?: string;
  name: string;
  department: string;
  reason: string;
  lastDay: string;
  status: string;
}

type OffboardingApiRow = {
  _id?: string;
  name?: string;
  department?: string;
  reason?: string;
  lastDay?: string;
  status?: string;
};

const offboardingExportColumns = [
  { key: "name", label: "Employee" },
  { key: "department", label: "Department" },
  { key: "reason", label: "Reason" },
  { key: "lastDay", label: "Last Working Day" },
  { key: "status", label: "Status" },
];

const AdminOffboarding: React.FC = () => {
  const [data, setData] = useState<OffboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<OffboardEntry>({ name: "", department: "", reason: "Resignation", lastDay: "", status: "Pending" });
  const [reasonSelection, setReasonSelection] = useState("Resignation");
  const [customReason, setCustomReason] = useState("");
  const { toast } = useToast();

  const loadOffboarding = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiService.list<OffboardingApiRow>("offboarding");
      const mapped = rows.map((row) => ({
        _id: row._id,
        name: row.name || "",
        department: row.department || "",
        reason: row.reason || "",
        lastDay: row.lastDay ? new Date(row.lastDay).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
        status: row.status ? `${row.status.charAt(0).toUpperCase()}${row.status.slice(1)}` : "Pending",
      }));
      setData(mapped);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to fetch offboarding", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadOffboarding();
  }, [loadOffboarding]);

  const updateStatus = (idx: number, status: string) => {
    void (async () => {
      const row = data[idx];
      if (!row?._id) return;
      try {
        await apiService.update("offboarding", row._id, { status: status.toLowerCase() });
        await loadOffboarding();
        toast({ title: `Offboarding ${status}`, description: `${row.name}'s offboarding ${status.toLowerCase()}.` });
      } catch (error) {
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update offboarding", variant: "destructive" });
      }
    })();
  };

  const handleAdd = () => {
    const resolvedReason = reasonSelection === CUSTOM_REASON_VALUE ? customReason.trim() : form.reason;

    if (!form.name.trim() || !form.department.trim() || !form.lastDay.trim()) {
      toast({ title: "Validation Error", description: "Please fill all fields.", variant: "destructive" });
      return;
    }
    if (!resolvedReason.trim()) {
      toast({ title: "Validation Error", description: "Please provide a reason for offboarding.", variant: "destructive" });
      return;
    }
    void (async () => {
      try {
        await apiService.create("offboarding", {
          name: form.name,
          department: form.department,
          reason: resolvedReason,
          lastDay: new Date(form.lastDay).toISOString(),
          status: form.status.toLowerCase(),
        });
        toast({ title: "Added", description: `${form.name} added to offboarding.` });
        setAddOpen(false);
        setForm({ name: "", department: "", reason: "Resignation", lastDay: "", status: "Pending" });
        setReasonSelection("Resignation");
        setCustomReason("");
        await loadOffboarding();
      } catch (error) {
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to add offboarding", variant: "destructive" });
      }
    })();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offboarding"
        subtitle="Manage employee exits and offboarding process"
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setForm({ name: "", department: "", reason: "Resignation", lastDay: "", status: "Pending" });
                setReasonSelection("Resignation");
                setCustomReason("");
                setAddOpen(true);
              }}
              className="gradient-primary text-primary-foreground gap-2"
            ><Plus className="w-4 h-4" />Add Offboarding</Button>
            <ExportButton
              moduleName="offboarding"
              rows={data}
              fallbackRows={data}
              columns={offboardingExportColumns}
              loading={loading}
              emptyMessage="No data to export"
              preferServerExport={false}
            />
          </div>
        }
      />
      {loading ? <div className="text-sm text-muted-foreground">Loading offboarding...</div> : <DataTable
        columns={[
          { key: "name", label: "Employee" },
          { key: "department", label: "Department" },
          { key: "reason", label: "Reason" },
          { key: "lastDay", label: "Last Working Day" },
          { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
          {
            key: "actions", label: "Actions",
            render: (item) => {
              if (String(item.status) !== "Pending") return <span className="text-xs text-muted-foreground">—</span>;
              const idx = data.findIndex(d => d.name === item.name);
              return (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-success" onClick={(e) => { e.stopPropagation(); updateStatus(idx, "Approved"); }}>
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-destructive" onClick={(e) => { e.stopPropagation(); updateStatus(idx, "Rejected"); }}>
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              );
            },
          },
        ]}
        data={data}
      />}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Offboarding</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Employee Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Department *</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select
                value={reasonSelection}
                onValueChange={(value) => {
                  setReasonSelection(value);
                  if (value !== CUSTOM_REASON_VALUE) {
                    setForm({ ...form, reason: value });
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Resignation">Resignation</SelectItem>
                  <SelectItem value="Termination">Termination</SelectItem>
                  <SelectItem value="Contract End">Contract End</SelectItem>
                  <SelectItem value="Retirement">Retirement</SelectItem>
                  <SelectItem value={CUSTOM_REASON_VALUE}>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reasonSelection === CUSTOM_REASON_VALUE ? (
              <div className="space-y-1.5">
                <Label>Custom Reason *</Label>
                <Input
                  value={customReason}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomReason(value);
                    setForm({ ...form, reason: value });
                  }}
                  placeholder="Enter offboarding reason"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Last Working Day *</Label>
              <DatePicker
                value={form.lastDay}
                onChange={(e) => setForm({ ...form, lastDay: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleAdd} className="gradient-primary text-primary-foreground">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOffboarding;
