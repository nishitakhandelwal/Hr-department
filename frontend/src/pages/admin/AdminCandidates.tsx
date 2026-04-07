import React, { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, Trash2, UserCheck, BriefcaseBusiness, Send, FileCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { apiService, type CandidateRecord, type CandidateStatus, type CandidateWorkflowConfig } from "@/services/api";
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
import { useLabel } from "@/context/SystemSettingsContext";

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

const formatCandidateDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("en-IN");
};

type CandidateEvaluationPayload = {
  candidateId: string;
  evaluationRemarks: string;
  adminNotes?: string;
  rating: number | null;
  status: CandidateStatus;
  interviewSchedule?: CandidateRecord["interviewSchedule"];
  videoFeedback?: string;
  videoRating?: number | null;
};

const resolveCandidateId = (candidate?: CandidateRecord | null) => candidate?.id || candidate?._id || "";

const normalizeCandidateState = (candidate: CandidateRecord): CandidateRecord => {
  const normalizedId = resolveCandidateId(candidate);
  return {
    ...candidate,
    _id: normalizedId,
    id: normalizedId,
  };
};

const AdminCandidates: React.FC = () => {
  const { toast } = useToast();
  const pageTitle = useLabel("admin.candidates.title");
  const pageSubtitle = useLabel("admin.candidates.subtitle");
  const searchPlaceholder = useLabel("admin.candidates.search");
  const allStatusesLabel = useLabel("admin.candidates.filter.all");
  const foundLabel = useLabel("admin.candidates.found");
  const nameLabel = useLabel("admin.candidates.table.name");
  const emailLabel = useLabel("admin.candidates.table.email");
  const phoneLabel = useLabel("admin.candidates.table.phone");
  const positionLabel = useLabel("admin.candidates.table.position");
  const statusLabel = useLabel("admin.candidates.table.status");
  const appliedAtLabel = useLabel("admin.candidates.table.appliedAt");
  const actionsLabel = useLabel("admin.candidates.table.actions");
  const evaluateLabel = useLabel("admin.candidates.action.evaluate");
  const moveToEmployeeLabel = useLabel("admin.candidates.action.moveToEmployee");
  const assignInternshipLabel = useLabel("admin.candidates.action.assignInternship");
  const sendOfferLabel = useLabel("admin.candidates.action.sendOffer");
  const sendJoiningFormLabel = useLabel("admin.candidates.action.sendJoiningForm");
  const deleteLabel = useLabel("admin.candidates.action.delete");
  const emptyTitle = useLabel("admin.candidates.empty.title");
  const emptyDescription = useLabel("admin.candidates.empty.description");
  const refreshListLabel = useLabel("admin.candidates.empty.refresh");
  const loadingLabel = useLabel("admin.candidates.loading");
  const emptyTableLabel = useLabel("admin.candidates.empty.table");
  const showingLabel = useLabel("admin.candidates.pagination.showing");
  const ofLabel = useLabel("admin.candidates.pagination.of");
  const previousLabel = useLabel("admin.candidates.pagination.previous");
  const nextLabel = useLabel("admin.candidates.pagination.next");
  const moreActionsLabel = useLabel("admin.candidates.action.more");
  const movingLabel = useLabel("admin.candidates.action.moving");
  const deletingLabel = useLabel("admin.candidates.action.deleting");
  const internshipTitle = useLabel("admin.candidates.internship.title");
  const internshipStartDateLabel = useLabel("admin.candidates.internship.startDate");
  const internshipEndDateLabel = useLabel("admin.candidates.internship.endDate");
  const assigningLabel = useLabel("admin.candidates.internship.assigning");
  const offerTitle = useLabel("admin.candidates.offer.title");
  const offerRoleLabel = useLabel("admin.candidates.offer.role");
  const offerSalaryLabel = useLabel("admin.candidates.offer.salary");
  const offerJoiningDateLabel = useLabel("admin.candidates.offer.joiningDate");
  const offerRolePlaceholder = useLabel("admin.candidates.offer.placeholder.role");
  const offerSalaryPlaceholder = useLabel("admin.candidates.offer.placeholder.salary");
  const sendingLabel = useLabel("admin.candidates.offer.sending");
  const generateOfferLabel = useLabel("admin.candidates.offer.generate");
  const deleteDialogTitle = useLabel("admin.candidates.delete.title");
  const moveDialogTitle = useLabel("admin.candidates.move.title");
  const moveDialogConfirmLabel = useLabel("admin.candidates.move.confirm");
  const cancelLabel = useLabel("common.cancel");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [workflowConfig, setWorkflowConfig] = useState<CandidateWorkflowConfig | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
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
      const data = await apiService.listCandidates();
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

  const fetchWorkflowConfig = useCallback(async () => {
    try {
      const data = await apiService.getCandidateWorkflowConfig();
      setWorkflowConfig(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load candidate workflow";
      toast({ title: "Workflow unavailable", description: message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    void fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    void fetchWorkflowConfig();
  }, [fetchWorkflowConfig]);

  const handleView = async (candidateId: string, candidate?: CandidateRecord) => {
    if (!candidateId || typeof candidateId !== "string") {
      console.error("Invalid candidate ID:", candidateId);
      toast({
        title: "Invalid candidate",
        description: "Candidate details could not be opened because the candidate ID is invalid.",
        variant: "destructive",
      });
      return;
    }

    setModalOpen(true);
    setModalLoading(true);
    setSelectedCandidateId(candidateId);
    setSelectedCandidate(candidate ? normalizeCandidateState(candidate) : null);
    try {
      const data = await Promise.race([
        apiService.getCandidateById(candidateId),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Candidate details request timed out")), 8000);
        }),
      ]);
      setSelectedCandidate(normalizeCandidateState(data));
    } catch (error) {
      console.error("Evaluation error:", error);
      toast({
        title: "Details unavailable",
        description:
          error instanceof Error
            ? `${error.message}. Showing available candidate data.`
            : "Failed to load full candidate details",
        variant: "destructive",
      });
    } finally {
      setModalLoading(false);
    }
  };

  
  const handleSaveEvaluation = async (payload: CandidateEvaluationPayload) => {
    console.log("Received payload:", payload);

    const candidateToSave =
      selectedCandidate ||
      candidates.find((item) => resolveCandidateId(item) === selectedCandidateId) ||
      null;
    const candidateId =
      payload.candidateId ||
      resolveCandidateId(candidateToSave) ||
      selectedCandidateId;

    if (!candidateId) {
      console.error("Candidate ID missing");
      toast({
        title: "Update failed",
        description: "Candidate ID is missing, so the review could not be saved.",
        variant: "destructive",
      });
      return;
    }

    if (!payload.status) {
      toast({
        title: "Status required",
        description: "Please choose a candidate status before saving the review.",
        variant: "destructive",
      });
      return;
    }

    try {
      setModalSaving(true);
      const updated = normalizeCandidateState(await apiService.reviewCandidateByAdmin(candidateId, payload));

      setCandidates((prev) =>
        prev.map((item) => (resolveCandidateId(item) === candidateId ? updated : item))
      );
      setSelectedCandidate(updated);
      await fetchCandidates();
      setModalOpen(false);
      setSelectedCandidate(null);
      setSelectedCandidateId("");

      toast({
        title: "Review saved",
        description: "Candidate review and status were updated successfully.",
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not save the candidate review.",
        variant: "destructive",
      });
    } finally {
      setModalSaving(false);
    }
  };

  const handleDelete = async (candidateId: string) => {
    if (!candidateId) return;

    setDeletingId(candidateId);
    try {
      await apiService.deleteCandidate(candidateId);
      setCandidates((prev) => prev.filter((candidate) => resolveCandidateId(candidate) !== candidateId));
      if (resolveCandidateId(selectedCandidate) === candidateId) {
        setSelectedCandidate(null);
        setSelectedCandidateId("");
        setModalOpen(false);
      }
      toast({
        title: "Candidate deleted",
        description: "The candidate record has been removed successfully.",
      });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Could not delete the candidate.",
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
  const modalCandidate =
    selectedCandidate ||
    candidates.find((candidate) => resolveCandidateId(candidate) === selectedCandidateId) ||
    null;
  const availableStatuses = workflowConfig?.statuses || (modalCandidate ? [modalCandidate.status] : []);
  const filterStatuses = workflowConfig?.statuses || [...new Set(candidates.map((c) => c.status))];
  const exportRows: CandidateExportRow[] = filteredCandidates.map((candidate) => ({
    candidateName: candidate.fullName || "-",
    email: candidate.email || "-",
    phone: candidate.phone || "-",
    position: candidate.positionApplied || "-",
    status: candidate.status || "-",
    appliedAt: formatCandidateDate(candidate.submittedAt || candidate.createdAt),
  }));
  const fallbackExportRows: CandidateExportRow[] = candidates.map((candidate) => ({
    candidateName: candidate.fullName || "-",
    email: candidate.email || "-",
    phone: candidate.phone || "-",
    position: candidate.positionApplied || "-",
    status: candidate.status || "-",
    appliedAt: formatCandidateDate(candidate.submittedAt || candidate.createdAt),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        action={
          <ExportButton
            moduleName="candidates"
            rows={exportRows}
            fallbackRows={fallbackExportRows}
            columns={candidateExportColumns}
            filters={{ search, status: statusFilter === "all" ? "" : statusFilter }}
            className="rounded-xl"
            loading={loading}
            emptyMessage={emptyTableLabel}
            preferServerExport={false}
          />
        }
      />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Input
          placeholder={searchPlaceholder}
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
          <option value="all">{allStatusesLabel}</option>
          {filterStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <div className="text-sm text-muted-foreground md:text-right md:self-center">
          {filteredCandidates.length} {foundLabel}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-sm text-slate-500">
          {loadingLabel}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-sm text-rose-700">{error}</div>
      ) : filteredCandidates.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button variant="outline" className="rounded-xl" onClick={() => void fetchCandidates()}>
              {refreshListLabel}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{nameLabel}</th>
                <th className="px-4 py-3 text-left font-medium">{emailLabel}</th>
                <th className="px-4 py-3 text-left font-medium">{phoneLabel}</th>
                <th className="px-4 py-3 text-left font-medium">{positionLabel}</th>
                <th className="px-4 py-3 text-left font-medium">{statusLabel}</th>
                <th className="px-4 py-3 text-left font-medium">{appliedAtLabel}</th>
                <th className="px-4 py-3 text-right font-medium">{actionsLabel}</th>
              </tr>
            </thead>
            <tbody>
              {pageCandidates.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={7}>
                    {emptyTableLabel}
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
                    <td className="px-4 py-3">{formatCandidateDate(candidate.submittedAt || candidate.createdAt)}</td>
                    <td className="px-4 py-3 min-w-[150px]">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 min-w-[92px] rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                          onClick={() => void handleView(candidate._id || candidate.id || "", candidate)}
                        >
                          {evaluateLabel}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              aria-label={`${moreActionsLabel}: ${candidate.fullName}`}
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
                                {movingId === candidate._id ? movingLabel : moveToEmployeeLabel}
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
                                  {assignInternshipLabel}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="rounded-xl px-3 py-2.5"
                                  disabled={actionId === candidate._id}
                                  onClick={() => handleOpenOfferDialog(candidate)}
                                >
                                  <Send className="mr-2 h-4 w-4" />
                                  {sendOfferLabel}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="rounded-xl px-3 py-2.5"
                                  disabled={actionId === candidate._id}
                                  onClick={() => void handleSendJoiningForm(candidate)}
                                >
                                  <FileCheck className="mr-2 h-4 w-4" />
                                  {sendJoiningFormLabel}
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
                                {sendJoiningFormLabel}
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
                              {deletingId === candidate._id ? deletingLabel : deleteLabel}
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
          {showingLabel} {filteredCandidates.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
          {Math.min(currentPage * pageSize, filteredCandidates.length)} {ofLabel} {filteredCandidates.length}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
            {previousLabel}
          </Button>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
            {nextLabel}
          </Button>
        </div>
      </div>

      <CandidateDetailsModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setSelectedCandidate(null);
            setSelectedCandidateId("");
            setModalLoading(false);
          }
        }}
        loading={modalLoading}
        saving={modalSaving}
        candidate={modalCandidate}
        availableStatuses={availableStatuses}
        onSave={handleSaveEvaluation}
      />

      <Dialog open={internshipDialogOpen} onOpenChange={setInternshipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{internshipTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{internshipStartDateLabel}</Label>
              <DatePicker
                value={internshipDates.startDate}
                onChange={(event) => setInternshipDates((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{internshipEndDateLabel}</Label>
              <DatePicker
                value={internshipDates.endDate}
                onChange={(event) => setInternshipDates((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInternshipDialogOpen(false)}>
              {cancelLabel}
            </Button>
            <Button
              onClick={() => void submitInternshipAssignment()}
              disabled={!internshipCandidate || actionId === internshipCandidate?._id}
            >
              {actionId === internshipCandidate?._id ? assigningLabel : assignInternshipLabel}
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
            <DialogTitle>{offerTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{offerRoleLabel}</Label>
              <Input
                value={offerDetails.role}
                onChange={(event) => setOfferDetails((prev) => ({ ...prev, role: event.target.value }))}
                placeholder={offerRolePlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{offerSalaryLabel}</Label>
              <Input
                type="number"
                min="1"
                value={offerDetails.salary}
                onChange={(event) => setOfferDetails((prev) => ({ ...prev, salary: event.target.value }))}
                placeholder={offerSalaryPlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{offerJoiningDateLabel}</Label>
              <DatePicker
                value={offerDetails.joiningDate}
                onChange={(event) => setOfferDetails((prev) => ({ ...prev, joiningDate: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialogOpen(false)}>
              {cancelLabel}
            </Button>
            <Button onClick={() => void handleSendOffer()} disabled={!offerCandidate || actionId === offerCandidate?._id}>
              {actionId === offerCandidate?._id ? sendingLabel : generateOfferLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={Boolean(candidateToDelete)}
        onOpenChange={(open) => {
          if (!open) setCandidateToDelete(null);
        }}
        title={deleteDialogTitle}
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
        title={moveDialogTitle}
        description={`Move ${candidateToMove?.fullName || "this candidate"} to Employee? This will continue the onboarding workflow.`}
        confirmLabel={moveDialogConfirmLabel}
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
