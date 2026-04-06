import React, { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, Trash2, UserCheck, BriefcaseBusiness, Send, FileCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CandidateRecord, type CandidateStatus } from "@/services/api";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CandidateDetailsModal from "@/components/candidates/CandidateDetailsModal";
import CandidateStatusBadge from "@/components/candidate/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import { ExportButton } from "@/components/common/ExportButton";
import type { ExportColumn } from "@/utils/export";
import { EmptyState } from "@/components/EmptyState";

type CandidateExportRow = {
  candidateName: string;
  email: string;
  phone: string;
  position: string;
  status: string;
  appliedAt: string;
};

const candidateExportColumns: ExportColumn<CandidateExportRow>[] = [
  { key: "candidateName", label: "Candidate Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "position", label: "Position" },
  { key: "status", label: "Status" },
  { key: "appliedAt", label: "Applied At" },
];

const AdminCandidates: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<CandidateRecord | null>(null);
  const [candidateToMove, setCandidateToMove] = useState<CandidateRecord | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [internshipDialogOpen, setInternshipDialogOpen] = useState(false);
  const [internshipCandidate, setInternshipCandidate] = useState<CandidateRecord | null>(null);
  const [internshipDates, setInternshipDates] = useState({ startDate: "", endDate: "" });
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [offerCandidate, setOfferCandidate] = useState<CandidateRecord | null>(null);
  const [offerDetails, setOfferDetails] = useState({ role: "", salary: "", joiningDate: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.list<CandidateRecord>("candidates");
      setCandidates(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch candidates";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchCandidates();
  }, [fetchCandidates]);

  const handleView = async (id: string) => {
    setModalOpen(true);
    setModalLoading(true);
    setSelectedCandidate(null);
    try {
      const data = await apiService.getCandidateById(id);
      setSelectedCandidate(data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load candidate details",
        variant: "destructive",
      });
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveEvaluation = async (payload: {
    evaluationRemarks: string;
    adminNotes?: string;
    rating: number | null;
    status: CandidateStatus;
    interviewSchedule?: CandidateRecord["interviewSchedule"];
    videoFeedback?: string;
    videoRating?: number | null;
  }) => {
    if (!selectedCandidate) return;
    setModalSaving(true);
    try {
      const updated = await apiService.reviewCandidateByAdmin(selectedCandidate._id, payload);
      setCandidates((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setModalOpen(false);
      setSelectedCandidate(null);
      toast({ title: "Saved", description: "Admin review updated successfully." });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not save admin review",
        variant: "destructive",
      });
    } finally {
      setModalSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiService.deleteCandidate(id);
      setCandidates((prev) => prev.filter((candidate) => candidate._id !== id));
      toast({ title: "Candidate deleted", description: "Candidate removed successfully." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete candidate",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleMoveToEmployee = async (candidate: CandidateRecord) => {
    if (!["Offered", "Joining Form Submitted", "Employee Onboarding", "Accepted"].includes(candidate.status)) return;

    setMovingId(candidate._id);
    try {
      const result = await apiService.acceptOffer(candidate._id);
      setCandidates((prev) =>
        prev.map((item) => (item._id === candidate._id ? result.candidate : item))
      );
      if (selectedCandidate?._id === candidate._id) {
        setSelectedCandidate(result.candidate);
      }
      toast({
        title: "Moved to employee",
        description: `${candidate.fullName} has been moved to employee successfully.`,
      });
    } catch (err) {
      toast({
        title: "Move failed",
        description: err instanceof Error ? err.message : "Could not move candidate to employee",
        variant: "destructive",
      });
    } finally {
      setMovingId(null);
      setCandidateToMove(null);
    }
  };

  const handleAssignInternship = async (candidate: CandidateRecord) => {
    setInternshipCandidate(candidate);
    setInternshipDates({ startDate: "", endDate: "" });
    setInternshipDialogOpen(true);
  };

  const submitInternshipAssignment = async () => {
    if (!internshipCandidate) return;
    if (!internshipDates.startDate || !internshipDates.endDate) {
      toast({ title: "Missing dates", description: "Please select both internship dates.", variant: "destructive" });
      return;
    }

    setActionId(internshipCandidate._id);
    try {
      const result = await apiService.assignInternship(internshipCandidate._id, internshipDates);
      setCandidates((prev) => prev.map((item) => (item._id === internshipCandidate._id ? result.candidate : item)));
      toast({ title: "Internship assigned", description: `${internshipCandidate.fullName} moved to internship stage.` });
      setInternshipDialogOpen(false);
      setInternshipCandidate(null);
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Could not assign internship",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleOpenOfferDialog = (candidate: CandidateRecord) => {
    setOfferCandidate(candidate);
    setOfferDetails({
      role: candidate.positionApplied || "",
      salary: candidate.offerLetter?.salary ? String(candidate.offerLetter.salary) : "",
      joiningDate: candidate.offerLetter?.joiningDate ? String(candidate.offerLetter.joiningDate).slice(0, 10) : "",
    });
    setOfferDialogOpen(true);
  };

  const handleSendOffer = async () => {
    if (!offerCandidate) return;
    if (!offerDetails.role.trim() || !offerDetails.salary.trim() || !offerDetails.joiningDate) {
      toast({
        title: "Missing offer details",
        description: "Role, salary, and joining date are required before sending the offer letter.",
        variant: "destructive",
      });
      return;
    }

    setActionId(offerCandidate._id);
    try {
      const updated = await apiService.sendOfferLetter(offerCandidate._id, {
        role: offerDetails.role.trim(),
        salary: Number(offerDetails.salary),
        joiningDate: offerDetails.joiningDate,
      });
      setCandidates((prev) => prev.map((item) => (item._id === offerCandidate._id ? updated : item)));
      toast({ title: "Offer letter sent", description: `${offerCandidate.fullName} has been notified.` });
      setOfferDialogOpen(false);
      setOfferCandidate(null);
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Could not send offer letter",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleSendJoiningForm = async (candidate: CandidateRecord) => {
    setActionId(candidate._id);
    try {
      const updated = await apiService.sendJoiningForm(candidate._id);
      setCandidates((prev) => prev.map((item) => (item._id === candidate._id ? updated : item)));
      toast({ title: "Joining form sent", description: `${candidate.fullName} can now complete joining form.` });
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Could not send joining form",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const filteredCandidates = candidates.filter((candidate) => {
    const text = `${candidate.fullName} ${candidate.email} ${candidate.positionApplied || ""}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || candidate.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageCandidates = filteredCandidates.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const exportRows: CandidateExportRow[] = filteredCandidates.map((candidate) => ({
    candidateName: candidate.fullName || "-",
    email: candidate.email || "-",
    phone: candidate.phone || "-",
    position: candidate.positionApplied || "-",
    status: candidate.status || "-",
    appliedAt: candidate.createdAt ? new Date(candidate.createdAt).toLocaleString("en-IN") : "-",
  }));
  const fallbackExportRows: CandidateExportRow[] = candidates.map((candidate) => ({
    candidateName: candidate.fullName || "-",
    email: candidate.email || "-",
    phone: candidate.phone || "-",
    position: candidate.positionApplied || "-",
    status: candidate.status || "-",
    appliedAt: candidate.createdAt ? new Date(candidate.createdAt).toLocaleString("en-IN") : "-",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        subtitle="Stage-based workflow with real-time status updates"
        action={
          <ExportButton
            moduleName="candidates"
            rows={exportRows}
            fallbackRows={fallbackExportRows}
            columns={candidateExportColumns}
            filters={{ search, status: statusFilter === "all" ? "" : statusFilter }}
            className="rounded-xl"
            loading={loading}
            emptyMessage="No data to export"
            preferServerExport={false}
          />
        }
      />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Input
          placeholder="Search candidate by name, email, position"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Statuses</option>
          {[...new Set(candidates.map((c) => c.status))].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <div className="text-sm text-muted-foreground md:text-right md:self-center">
          {filteredCandidates.length} candidate{filteredCandidates.length === 1 ? "" : "s"} found
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-sm text-slate-500">
          Loading candidates...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-sm text-rose-700">{error}</div>
      ) : filteredCandidates.length === 0 ? (
        <EmptyState
          title="No candidates available"
          description="No data available for the current search or status filter."
          action={
            <Button variant="outline" className="rounded-xl" onClick={() => void fetchCandidates()}>
              Refresh list
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-left font-medium">Position</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Applied At</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageCandidates.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={7}>
                    No data available.
                  </td>
                </tr>
              ) : (
                pageCandidates.map((candidate) => (
                  <tr key={candidate._id} className="border-t border-border">
                    <td className="px-4 py-3">{candidate.fullName}</td>
                    <td className="px-4 py-3">{candidate.email}</td>
                    <td className="px-4 py-3">{candidate.phone || "-"}</td>
                    <td className="px-4 py-3">{candidate.positionApplied || "-"}</td>
                    <td className="px-4 py-3"><CandidateStatusBadge status={candidate.status} /></td>
                    <td className="px-4 py-3">{new Date(candidate.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="h-9 min-w-[92px] rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                          onClick={() => void handleView(candidate._id)}
                        >
                          Evaluate
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              aria-label={`More actions for ${candidate.fullName}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-2xl border-slate-200 p-2 shadow-lg">
                            {["Offered", "Joining Form Submitted", "Employee Onboarding", "Accepted"].includes(candidate.status) ? (
                              <DropdownMenuItem
                                className="rounded-xl px-3 py-2.5"
                                disabled={movingId === candidate._id}
                                onClick={() => setCandidateToMove(candidate)}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                {movingId === candidate._id ? "Moving..." : "Move to Employee"}
                              </DropdownMenuItem>
                            ) : null}
                            {candidate.status === "Selected" ? (
                              <>
                                <DropdownMenuItem
                                  className="rounded-xl px-3 py-2.5"
                                  disabled={actionId === candidate._id}
                                  onClick={() => void handleAssignInternship(candidate)}
                                >
                                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                                  Assign Internship
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="rounded-xl px-3 py-2.5"
                                  disabled={actionId === candidate._id}
                                  onClick={() => handleOpenOfferDialog(candidate)}
                                >
                                  <Send className="mr-2 h-4 w-4" />
                                  Send Offer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="rounded-xl px-3 py-2.5"
                                  disabled={actionId === candidate._id}
                                  onClick={() => void handleSendJoiningForm(candidate)}
                                >
                                  <FileCheck className="mr-2 h-4 w-4" />
                                  Send Joining Form
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            {candidate.status === "Internship" ? (
                              <DropdownMenuItem
                                className="rounded-xl px-3 py-2.5"
                                disabled={actionId === candidate._id}
                                onClick={() => void handleSendJoiningForm(candidate)}
                              >
                                <FileCheck className="mr-2 h-4 w-4" />
                                Send Joining Form
                              </DropdownMenuItem>
                            ) : null}
                            {(
                              ["Offered", "Joining Form Submitted", "Employee Onboarding", "Accepted"].includes(candidate.status) ||
                              candidate.status === "Selected" ||
                              candidate.status === "Internship"
                            ) ? <DropdownMenuSeparator /> : null}
                            <DropdownMenuItem
                              className="rounded-xl bg-red-600 px-3 py-2.5 text-white focus:bg-red-700 focus:text-white"
                              disabled={deletingId === candidate._id}
                              onClick={() => setCandidateToDelete(candidate)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingId === candidate._id ? "Deleting..." : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Showing {filteredCandidates.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
          {Math.min(currentPage * pageSize, filteredCandidates.length)} of {filteredCandidates.length}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
            Next
          </Button>
        </div>
      </div>

      <CandidateDetailsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        loading={modalLoading}
        saving={modalSaving}
        candidate={selectedCandidate}
        onSave={handleSaveEvaluation}
      />

      <Dialog open={internshipDialogOpen} onOpenChange={setInternshipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Internship</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <DatePicker
                value={internshipDates.startDate}
                onChange={(event) => setInternshipDates((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <DatePicker
                value={internshipDates.endDate}
                onChange={(event) => setInternshipDates((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInternshipDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitInternshipAssignment()}
              disabled={!internshipCandidate || actionId === internshipCandidate?._id}
            >
              {actionId === internshipCandidate?._id ? "Assigning..." : "Assign Internship"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={offerDialogOpen}
        onOpenChange={(open) => {
          setOfferDialogOpen(open);
          if (!open) setOfferCandidate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Offer Letter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input
                value={offerDetails.role}
                onChange={(event) => setOfferDetails((prev) => ({ ...prev, role: event.target.value }))}
                placeholder="Senior Executive"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Salary</Label>
              <Input
                type="number"
                min="1"
                value={offerDetails.salary}
                onChange={(event) => setOfferDetails((prev) => ({ ...prev, salary: event.target.value }))}
                placeholder="25000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Joining Date</Label>
              <DatePicker
                value={offerDetails.joiningDate}
                onChange={(event) => setOfferDetails((prev) => ({ ...prev, joiningDate: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSendOffer()} disabled={!offerCandidate || actionId === offerCandidate?._id}>
              {actionId === offerCandidate?._id ? "Sending..." : "Generate & Send Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={Boolean(candidateToDelete)}
        onOpenChange={(open) => {
          if (!open) setCandidateToDelete(null);
        }}
        title="Delete Candidate"
        description={`Are you sure you want to permanently delete ${candidateToDelete?.fullName || "this candidate"}? This action cannot be undone.`}
        onConfirm={() => {
          if (!candidateToDelete?._id) return;
          void handleDelete(candidateToDelete._id).finally(() => setCandidateToDelete(null));
        }}
        loading={Boolean(candidateToDelete?._id && deletingId === candidateToDelete._id)}
      />
      <DeleteConfirmDialog
        open={Boolean(candidateToMove)}
        onOpenChange={(open) => {
          if (!open) setCandidateToMove(null);
        }}
        title="Move Candidate To Employee"
        description={`Move ${candidateToMove?.fullName || "this candidate"} to Employee? This will continue the onboarding workflow.`}
        confirmLabel="Move"
        onConfirm={() => {
          if (!candidateToMove) return;
          void handleMoveToEmployee(candidateToMove);
        }}
        loading={Boolean(candidateToMove?._id && movingId === candidateToMove._id)}
      />
    </div>
  );
};

export default AdminCandidates;
