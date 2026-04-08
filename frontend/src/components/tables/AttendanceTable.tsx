/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { DataTable, DataTableColumn, StatusBadge } from "@/components/DataTable";
import { ExportColumn, createExportColumnsFromTable } from "@/utils/export";

export interface AttendanceRow {
  _id?: string;
  name: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: string;
  entryType?: string;
  actions?: React.ReactNode;
}

export const attendanceTableColumns: DataTableColumn<AttendanceRow>[] = [
  { key: "name", label: "Employee" },
  { key: "date", label: "Date" },
  { key: "checkIn", label: "Check In" },
  { key: "checkOut", label: "Check Out" },
  { key: "hours", label: "Hours" },
  { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
  {
    key: "entryType",
    label: "Entry",
    render: (item) =>
      item.entryType ? (
        <span className="inline-flex items-center rounded-full border border-[rgba(230,199,163,0.22)] bg-[rgba(230,199,163,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E6C7A3]">
          {item.entryType}
        </span>
      ) : (
        "-"
      ),
  },
  { key: "actions", label: "Actions", render: (item) => item.actions ?? "-", exportable: false },
];

export const attendanceExportColumns: ExportColumn<AttendanceRow>[] = createExportColumnsFromTable(
  attendanceTableColumns,
  {
    name: "Employee Name",
    hours: "Working Hours",
  }
);

interface AttendanceTableProps {
  data: AttendanceRow[];
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ data }) => {
  return <DataTable columns={attendanceTableColumns} data={data} />;
};

export default AttendanceTable;
