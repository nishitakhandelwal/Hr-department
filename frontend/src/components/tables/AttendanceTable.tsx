import React from "react";
import { DataTable, DataTableColumn, StatusBadge } from "@/components/DataTable";
import { ExportColumn, createExportColumnsFromTable } from "@/utils/export";

export interface AttendanceRow {
  name: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: string;
}

export const attendanceTableColumns: DataTableColumn<AttendanceRow>[] = [
  { key: "name", label: "Employee" },
  { key: "date", label: "Date" },
  { key: "checkIn", label: "Check In" },
  { key: "checkOut", label: "Check Out" },
  { key: "hours", label: "Hours" },
  { key: "status", label: "Status", render: (item) => <StatusBadge status={String(item.status)} /> },
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
