import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MoreHorizontal, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { destructiveButtonClass } from "@/lib/destructive";
import { apiService, type CandidateRecord, type InternshipRecord } from "@/services/api";

type InternshipAction = NonNullable<InternshipRecord["availableActions"]>[number];

const resolveCandidateId = (candidate?: CandidateRecord | null) => candidate?._id || "";
const resolveCandidate = (candidateId: InternshipRecord["candidateId"]) =>
  candidateId && typeof candidateId === "object" ? candidateId : null;

const isEligibleForInternship = (candidate: CandidateRecord) =>
  ["Selected", "Internship", "Offered"].includes(String(candidate.status || "").trim());

const statusClassMap: Record<string, string> = {
  Active: "text-slate-700",
  Completed: "text-slate-700",
  Cancelled: "text-rose-600",
  "Converted to Employee": "text-violet-700",
};

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      })
    : "-";

const normalizeStatus = (status?: string) => status || "Active";

const AdminInternships: React.FC = () => {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [internships, setInternships] = useState<InternshipRecord[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<InternshipRecord | null>(null);
  const [selectedAction, setSelectedAction] = useState<InternshipAction | null>(null);
  const [actionForm, setActionForm] = useState({
    note: "",
    reason: "",
    newEndDate: "",
    joiningDate: "",
    designation: "",
    salary: "",
    departmentId: "",
  });
  const [actionSaving, setActionSaving] = useState(false);
  const [deletingInternshipId, setDeletingInternshipId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [candidateRows, internshipRows] = await Promise.all([
        apiService.listCandidates(),
        apiService.listInternships(),
      ]);
      setCandidates(candidateRows);
      setInternships(internshipRows);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load internships",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const eligibleCandidates = useMemo(() => candidates.filter(isEligibleForInternship), [candidates]);

  const assign = async () => {
    if (!candidateId || !startDate || !endDate) {
      toast({
        title: "Required",
        description: "Candidate, start date and end date are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const created = await apiService.createInternship({ candidateId, startDate, endDate, notes });
      setInternships((current) => [created, ...current]);
      toast({ title: "Assigned", description: "Internship assigned successfully." });
      setCandidateId("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      await load();
    } catch (error) {
      toast({
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Unable to assign internship",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openActionDialog = (record: InternshipRecord, action: InternshipAction) => {
    setActionTarget(record);
    setSelectedAction(action);
    setActionForm({
      note: "",
      reason: "",
      newEndDate: "",
      joiningDate: "",
      designation: "",
      salary: "",
      departmentId: "",
    });
    setActionDialogOpen(true);
  };

  const closeActionDialog = () => {
    setActionDialogOpen(false);
    setActionTarget(null);
    setSelectedAction(null);
    setActionForm({
      note: "",
      reason: "",
      newEndDate: "",
      joiningDate: "",
      designation: "",
      salary: "",
      departmentId: "",
    });
  };

  const submitAction = async () => {
    if (!actionTarget || !selectedAction) return;

    if (selectedAction.requiresEndDate && !actionForm.newEndDate) {
      toast({
        title: "New end date required",
        description: "Please select the updated internship end date.",
        variant: "destructive",
      });
      return;
    }

    if (selectedAction.requiresReason && !actionForm.reason.trim()) {
      toast({
        title: "Cancellation reason required",
        description: "Please provide the cancellation reason before proceeding.",
        variant: "destructive",
      });
      return;
    }

    setActionSaving(true);
    try {
      const updated = await apiService.performInternshipAction(actionTarget._id, {
        action: selectedAction.key,
        note: actionForm.note.trim() || undefined,
        reason: actionForm.reason.trim() || undefined,
        newEndDate: actionForm.newEndDate || undefined,
        joiningDate: actionForm.joiningDate || undefined,
        designation: actionForm.designation.trim() || undefined,
        departmentId: actionForm.departmentId || undefined,
        salary: actionForm.salary ? Number(actionForm.salary) : undefined,
      });

      setInternships((current) => current.map((item) => (item._id === updated._id ? updated : item)));
      toast({ title: "Updated", description: `${selectedAction.label} applied successfully.` });
      closeActionDialog();
      await load();
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Unable to update internship",
        variant: "destructive",
      });
    } finally {
      setActionSaving(false);
    }
  };

  const handleDeleteInternship = async (internshipId: string) => {
    setDeletingInternshipId(internshipId);
    try {
      await apiService.deleteInternship(internshipId);
      setInternships((current) => current.filter((item) => item._id !== internshipId));
      toast({ title: "Deleted", description: "Internship record removed successfully." });
      await load();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete internship",
        variant: "destructive",
      });
    } finally {
      setDeletingInternshipId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internships"
        subtitle="Assign internship/probation and track completion decisions"
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Assign Internship</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
          >
            <option value="">{eligibleCandidates.length ? "Select candidate" : "No eligible candidates available"}</option>
            {eligibleCandidates.map((candidate) => {
              const id = resolveCandidateId(candidate);
              if (!id) return null;
              return (
                <option key={id} value={id}>
                  {candidate.fullName} ({candidate.status})
                </option>
              );
            })}
          </select>
          <DatePicker value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <DatePicker value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <Input placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {eligibleCandidates.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No candidates are currently eligible for internship assignment. Use the Applicants workflow to move a candidate into `Selected`, `Internship`, or `Offered`.
          </p>
        ) : null}
        <Button className="mt-3" onClick={() => void assign()} disabled={saving || eligibleCandidates.length === 0}>
          {saving ? "Assigning..." : "Assign Internship"}
        </Button>
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
              const candidate = resolveCandidate(item.candidateId);
              const availableActions = item.availableActions || [];
              const status = normalizeStatus(item.status);
              const extendAction = availableActions.find((action) => action.key === "extend") || null;
              const cancelAction = availableActions.find((action) => action.key === "cancel") || null;
              const convertAction = availableActions.find((action) => action.key === "convert_to_employee") || null;

              return (
                <tr key={item._id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{candidate?.fullName || String(item.candidateId)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatDate(item.startDate)} - {formatDate(item.endDate)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${statusClassMap[status] || "text-slate-700"}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {extendAction ? (
                        <Button
                          className="h-8 rounded-xl bg-slate-800 px-4 text-white hover:bg-slate-900"
                          onClick={() => openActionDialog(item, extendAction)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Extend
                        </Button>
                      ) : null}
                      {cancelAction || convertAction || deletingInternshipId === item._id || !extendAction ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                              aria-label={`More internship actions for ${candidate?.fullName || "candidate"}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-2xl border-slate-200 p-2 shadow-lg">
                            {extendAction ? (
                              <DropdownMenuItem className="rounded-xl px-3 py-2.5" onClick={() => openActionDialog(item, extendAction)}>
                                Extend Internship
                              </DropdownMenuItem>
                            ) : null}
                            {convertAction ? (
                              <DropdownMenuItem className="rounded-xl px-3 py-2.5" onClick={() => openActionDialog(item, convertAction)}>
                                Convert to Employee
                              </DropdownMenuItem>
                            ) : null}
                            {cancelAction ? (
                              <DropdownMenuItem
                                className={`rounded-xl px-3 py-2.5 ${destructiveButtonClass}`}
                                onClick={() => openActionDialog(item, cancelAction)}
                              >
                                Cancel Internship
                              </DropdownMenuItem>
                            ) : null}
                            {(extendAction || cancelAction || convertAction) ? <DropdownMenuSeparator /> : null}
                            <DropdownMenuItem
                              className={`${destructiveButtonClass} rounded-xl px-3 py-2.5 focus:bg-[#9f1239] focus:text-white`}
                              disabled={deletingInternshipId === item._id}
                              onClick={() => void handleDeleteInternship(item._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingInternshipId === item._id ? "Deleting..." : "Delete Record"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                      {!extendAction && !cancelAction && !convertAction ? (
                        <span className="text-sm text-muted-foreground">No actions</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {internships.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted-foreground" colSpan={4}>
                  No internships found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog
        open={actionDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeActionDialog();
            return;
          }
          setActionDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAction?.confirmTitle || "Internship Action"}</DialogTitle>
            <DialogDescription>{selectedAction?.confirmDescription || "Review the action details before proceeding."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedAction?.requiresEndDate ? (
              <div className="space-y-1.5">
                <Label>New End Date</Label>
                <DatePicker value={actionForm.newEndDate} onChange={(event) => setActionForm((current) => ({ ...current, newEndDate: event.target.value }))} />
              </div>
            ) : null}

            {selectedAction?.key === "convert_to_employee" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Joining Date</Label>
                  <DatePicker value={actionForm.joiningDate} onChange={(event) => setActionForm((current) => ({ ...current, joiningDate: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Salary</Label>
                  <Input
                    type="number"
                    min="0"
                    value={actionForm.salary}
                    onChange={(event) => setActionForm((current) => ({ ...current, salary: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Designation</Label>
                  <Input
                    value={actionForm.designation}
                    onChange={(event) => setActionForm((current) => ({ ...current, designation: event.target.value }))}
                    placeholder="Optional override, otherwise candidate role will be used"
                  />
                </div>
              </div>
            ) : null}

            {selectedAction?.key === "cancel" ? (
              <div className="space-y-1.5">
                <Label>Cancellation Reason</Label>
                <Textarea
                  value={actionForm.reason}
                  onChange={(event) => setActionForm((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Optional reason to store with the cancellation record."
                  rows={4}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>{selectedAction?.key === "cancel" ? "Additional Notes" : "Notes"}</Label>
              <Textarea
                value={actionForm.note}
                onChange={(event) => setActionForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Optional remarks for the audit trail."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>
              Close
            </Button>
            <Button onClick={() => void submitAction()} disabled={!selectedAction || actionSaving}>
              {actionSaving ? "Saving..." : selectedAction?.label || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInternships;
