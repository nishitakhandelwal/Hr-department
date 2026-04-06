import React, { useCallback, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, StatusBadge } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Filter, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/common/ExportButton";
import { apiService } from "@/services/api";
import FilterDrawer from "@/components/common/FilterDrawer";
import { EmptyState } from "@/components/EmptyState";

interface LeaveRequest {
  _id?: string;
  name: string;
  type: string;
  from: string;
  to: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: string;
}

type LeaveApiRow = {
  _id?: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  employeeId?: {
    userId?: {
      name?: string;
    };
  };
};

const leaveExportColumns = [
  { key: "name", label: "Employee" },
  { key: "type", label: "Leave Type" },
  { key: "from", label: "From Date" },
  { key: "to", label: "To Date" },
  { key: "days", label: "Days" },
  { key: "status", label: "Status" },
];

const AdminLeave: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ search: "", status: "", type: "", fromDate: "" });
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "", type: "", fromDate: "" });
  const { toast } = useToast();

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.list<LeaveApiRow>("leave");
      const mapped: LeaveRequest[] = data.map((row) => {
        const fromDate = row.fromDate ? new Date(row.fromDate) : null;
        const toDate = row.toDate ? new Date(row.toDate) : null;
        const days = fromDate && toDate ? Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 3600 * 24)) + 1 : 0;

        return {
          _id: row._id,
          name: row.employeeId?.userId?.name || "",
          type: row.leaveType || "",
          from: fromDate ? fromDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
          to: toDate ? toDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
          fromDate: row.fromDate || "",
          toDate: row.toDate || "",
          days,
          status: row.status ? String(row.status).charAt(0).toUpperCase() + String(row.status).slice(1) : "Pending",
        };
      });
      setLeaves(mapped);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to fetch leave data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  const filtered = leaves.filter((leave) => {
    const term = appliedFilters.search.toLowerCase();
    const matchesSearch =
      !term ||
      leave.name.toLowerCase().includes(term) ||
      leave.type.toLowerCase().includes(term) ||
      leave.from.toLowerCase().includes(term) ||
      leave.to.toLowerCase().includes(term);
    const matchesStatus = !appliedFilters.status || leave.status === appliedFilters.status;
    const matchesType = !appliedFilters.type || leave.type === appliedFilters.type;
    const matchesFromDate =
      !appliedFilters.fromDate ||
      new Date(leave.fromDate).toLocaleDateString("en-CA") === appliedFilters.fromDate;

    return matchesSearch && matchesStatus && matchesType && matchesFromDate;
  });

  const leaveTypes = [...new Set(leaves.map((leave) => leave.type).filter(Boolean))];

  const updateStatus = (index: number, status: string) => {
    void (async () => {
      const leave = leaves[index];
      if (!leave?._id) return;
      try {
        await apiService.update("leave", leave._id, { status: status.toLowerCase() });
        await loadLeaves();
        toast({ title: `Leave ${status}`, description: `${leave.name}'s leave has been ${status.toLowerCase()}.` });
      } catch (error) {
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update status", variant: "destructive" });
      }
    })();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        subtitle="Approve or reject employee leave requests"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl border-slate-200 bg-white/90" onClick={() => setFiltersOpen(true)}>
              <Filter className="w-4 h-4" />
              Filter
            </Button>
            <ExportButton
              moduleName="leave"
              rows={filtered}
              fallbackRows={leaves}
              columns={leaveExportColumns}
              filters={appliedFilters}
              loading={loading}
              emptyMessage="No data to export"
              preferServerExport={false}
            />
          </div>
        }
      />
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading leaves...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No leave requests found"
          description="No data available for the selected filters."
          action={<Button variant="outline" onClick={() => void loadLeaves()}>Refresh list</Button>}
        />
      ) : (
        <DataTable
          columns={[
            { key: "name", label: "Employee" },
            { key: "type", label: "Type" },
            { key: "from", label: "From" },
            { key: "to", label: "To" },
            { key: "days", label: "Days" },
            { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
            {
              key: "actions",
              label: "Actions",
              render: (item) => {
                if (String(item.status) !== "Pending") return <span className="text-xs text-muted-foreground">-</span>;
                const idx = leaves.findIndex((leave) => leave.name === item.name && leave.from === item.from);
                return (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-success"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateStatus(idx, "Approved");
                      }}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateStatus(idx, "Rejected");
                      }}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                );
              },
            },
          ]}
          data={filtered}
        />
      )}

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        values={draftFilters}
        onChange={(key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }))}
        onApply={(values) =>
          setAppliedFilters({
            search: values.search || "",
            status: values.status || "",
            type: values.type || "",
            fromDate: values.fromDate || "",
          })
        }
        onReset={() => {
          const cleared = { search: "", status: "", type: "", fromDate: "" };
          setDraftFilters(cleared);
          setAppliedFilters(cleared);
        }}
        filters={[
          { key: "search", label: "Search", type: "text", placeholder: "Search by employee, type, or date" },
          {
            key: "status",
            label: "Status",
            type: "select",
            placeholder: "All statuses",
            options: [
              { label: "Pending", value: "Pending" },
              { label: "Approved", value: "Approved" },
              { label: "Rejected", value: "Rejected" },
            ],
          },
          {
            key: "type",
            label: "Leave Type",
            type: "select",
            placeholder: "All leave types",
            options: leaveTypes.map((type) => ({ label: type, value: type })),
          },
          { key: "fromDate", label: "From Date", type: "date" },
        ]}
      />
    </div>
  );
};

export default AdminLeave;
