import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CandidateRecord, type InternshipRecord } from "@/services/api";

type InternshipDecision = "approve" | "reject" | "extend";
type InternshipActionOption = { key: InternshipDecision; label: string };

const getInternshipActions = (status: InternshipRecord["status"]): InternshipActionOption[] => {
  if (status === "Assigned" || status === "In Progress" || status === "Extended") {
    return [
      { key: "approve", label: "Approve" },
      { key: "extend", label: "Extend" },
      { key: "reject", label: "Reject" },
    ];
  }
  return [];
};

const actionLabelMap: Record<InternshipDecision, string> = {
  approve: "approved",
  reject: "rejected",
  extend: "extended",
};

const AdminInternships: React.FC = () => {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [internships, setInternships] = useState<InternshipRecord[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<InternshipRecord | null>(null);
  const [decisionAction, setDecisionAction] = useState<"approve" | "reject" | "extend" | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionEndDate, setDecisionEndDate] = useState("");
  const [decisionSaving, setDecisionSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [candidateRows, internshipRows] = await Promise.all([
        apiService.list<CandidateRecord>("candidates"),
        apiService.listInternships(),
      ]);
      setCandidates(candidateRows);
      setInternships(internshipRows);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to load internships", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = async () => {
    if (!candidateId || !startDate || !endDate) {
      toast({ title: "Required", description: "Candidate, start date and end date are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiService.createInternship({ candidateId, startDate, endDate, notes });
      toast({ title: "Assigned", description: "Internship assigned successfully." });
      setCandidateId("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      await load();
    } catch (error) {
      toast({ title: "Assignment failed", description: error instanceof Error ? error.message : "Unable to assign internship", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const takeDecision = (record: InternshipRecord, action: InternshipDecision) => {
    setDecisionTarget(record);
    setDecisionAction(action);
    setDecisionNote("");
    setDecisionEndDate("");
    setDecisionDialogOpen(true);
  };

  const submitDecision = async () => {
    if (!decisionTarget || !decisionAction) return;
    if (decisionAction === "extend" && !decisionEndDate) {
      toast({ title: "New end date required", description: "Please select the extended end date.", variant: "destructive" });
      return;
    }

    setDecisionSaving(true);
    try {
      await apiService.decideInternship(decisionTarget._id, {
        action: decisionAction,
        note: decisionNote,
        newEndDate: decisionAction === "extend" ? decisionEndDate : undefined,
      });
      toast({ title: "Updated", description: `Internship ${actionLabelMap[decisionAction]} successfully.` });
      setDecisionDialogOpen(false);
      setDecisionTarget(null);
      await load();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update internship", variant: "destructive" });
    } finally {
      setDecisionSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Internships" subtitle="Assign internship/probation and track completion decisions" />

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Assign Internship</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
          >
            <option value="">Select candidate</option>
            {candidates
              .filter((c) => ["Selected", "Internship", "Offered"].includes(c.status))
              .map((candidate) => (
                <option key={candidate._id} value={candidate._id}>{candidate.fullName} ({candidate.status})</option>
              ))}
          </select>
          <DatePicker value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <DatePicker value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button className="mt-3" onClick={() => void assign()} disabled={saving}>{saving ? "Assigning..." : "Assign Internship"}</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">Candidate</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {internships.map((item) => {
              const candidate = typeof item.candidateId === "object" ? item.candidateId : null;
              return (
                <tr key={item._id} className="border-t border-border">
                  <td className="px-4 py-3">{candidate?.fullName || String(item.candidateId)}</td>
                  <td className="px-4 py-3">{new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const actions = getInternshipActions(item.status);
                      const primaryAction = actions[0];
                      const secondaryActions = actions.slice(1);

                      if (!primaryAction) {
                        return <span className="text-sm text-muted-foreground">No actions</span>;
                      }

                      return (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="h-9 rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                            onClick={() => takeDecision(item, primaryAction.key)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {primaryAction.label}
                          </Button>

                          {secondaryActions.length ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                  aria-label={`More internship actions for ${candidate?.fullName || "candidate"}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 rounded-2xl border-slate-200 p-2 shadow-lg">
                                {secondaryActions.map((action) => (
                                  <DropdownMenuItem
                                    key={action.key}
                                    className="rounded-xl px-3 py-2.5"
                                    onClick={() => takeDecision(item, action.key)}
                                  >
                                    {action.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
            {internships.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted-foreground" colSpan={4}>No internships found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionAction === "extend" ? "Extend Internship" : "Update Internship"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {decisionAction === "extend" ? (
              <div className="space-y-1.5">
                <Label>New End Date</Label>
                <DatePicker value={decisionEndDate} onChange={(e) => setDecisionEndDate(e.target.value)} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>{decisionAction === "extend" ? "Extension Reason" : "Remarks"}</Label>
              <Input value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitDecision()} disabled={!decisionAction || decisionSaving}>
              {decisionSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInternships;
