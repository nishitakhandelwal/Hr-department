/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { BadgeIndianRupee, Edit2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumn, StatusBadge } from "@/components/DataTable";
import { ExportColumn, createExportColumnsFromTable } from "@/utils/export";
import { destructiveIconButtonClass } from "@/lib/destructive";

export interface EmployeeRow {
  employeeId?: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  joined: string;
  status: string;
  compensationStatus?: string;
}

const employeeBaseColumns: DataTableColumn<EmployeeRow>[] = [
  { key: "name", label: "Employee" },
  { key: "department", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "joined", label: "Joined" },
  { key: "compensationStatus", label: "Compensation" },
  { key: "status", label: "Status" },
];

export const employeeExportColumns: ExportColumn<EmployeeRow>[] = [
  { key: "name", label: "Employee Name" },
  { key: "email", label: "Email" },
  ...createExportColumnsFromTable(employeeBaseColumns, {
    name: "Employee Name",
  }).filter((column) => column.key !== "name"),
];

interface EmployeeTableProps {
  data: EmployeeRow[];
  onEdit: (email: string) => void;
  onDelete: (email: string) => void;
  onCompensation: (email: string) => void;
}

const EmployeeTable: React.FC<EmployeeTableProps> = ({ data, onEdit, onDelete, onCompensation }) => {
  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: "name",
      label: "Employee",
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="gradient-primary text-primary-foreground text-xs">
              {String(item.name).split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-card-foreground">{String(item.name)}</p>
            <p className="text-xs text-muted-foreground">{String(item.email)}</p>
          </div>
        </div>
      ),
    },
    { key: "department", label: "Department" },
    { key: "designation", label: "Designation" },
    { key: "joined", label: "Joined" },
    { key: "compensationStatus", label: "Compensation", render: (item) => <StatusBadge status={String(item.compensationStatus || "Pending")} /> },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
    {
      key: "actions",
      label: "Actions",
      exportable: false,
      render: (item) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onEdit(String(item.email)); }}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary" onClick={(e) => { e.stopPropagation(); onCompensation(String(item.email)); }}>
            <BadgeIndianRupee className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" className={`h-7 w-7 p-0 ${destructiveIconButtonClass}`} onClick={(e) => { e.stopPropagation(); onDelete(String(item.email)); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={data} />;
};

export default EmployeeTable;
