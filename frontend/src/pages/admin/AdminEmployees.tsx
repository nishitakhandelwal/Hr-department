import React, { useCallback, useState } from "react";
import { CreditCard, Filter, Loader2, Plus } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import FilterDrawer from "@/components/common/FilterDrawer";
import EmployeeTable, { employeeExportColumns } from "@/components/tables/EmployeeTable";
import { ExportButton } from "@/components/common/ExportButton";
import { apiService, type EmployeeRecord } from "@/services/api";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import EmployeeIdCardModal from "@/components/employees/EmployeeIdCardModal";
import ProfileImageManager from "@/components/profile/ProfileImageManager";

type SalaryStructure = {
  employeeId?: string;
  monthlyGrossSalary: number;
  basicSalaryType: "fixed" | "percentage";
  basicSalaryValue: number;
  hraType: "fixed" | "percentage";
  hraValue: number;
  specialAllowanceType: "fixed" | "percentage" | "remainder";
  specialAllowanceValue: number;
  otherAllowance: number;
  bonus: number;
  deductions: number;
  tax: number;
  pfEnabled: boolean;
  esiEnabled: boolean;
  finePerAbsentDay: number;
  finePerLateMark: number;
  overtimeRatePerHour: number;
  isConfigured?: boolean;
};

type BankDetails = {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  paymentMode: string;
};

interface Employee {
  _id?: string;
  userId?: { _id: string; name?: string; email?: string; department?: string } | string;
  employeeId?: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  profileImage?: string;
  bloodGroup?: string;
  dateOfBirth?: string;
  department: string;
  designation: string;
  joined: string;
  joiningDate: string;
  status: string;
  salary?: number;
  password?: string;
  salaryStructure?: SalaryStructure;
  compensationStatus?: string;
  bankDetails: BankDetails;
}

type EmployeeApiRow = {
  _id: string;
  userId?: { _id: string; name?: string; email?: string; department?: string } | string;
  employeeId?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  profileImage?: string;
  bloodGroup?: string;
  dateOfBirth?: string | null;
  department?: string;
  departmentName?: string;
  designation?: string;
  joiningDate?: string;
  status?: string;
  salary?: number;
  salaryStructure?: SalaryStructure;
  bankDetails?: Partial<BankDetails>;
  documents?: EmployeeRecord["documents"];
};

const isUserRef = (
  value: EmployeeApiRow["userId"]
): value is { _id: string; name?: string; email?: string; department?: string } =>
  Boolean(value && typeof value === "object" && "_id" in value);

const emptyBankDetails: BankDetails = {
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  branchName: "",
  paymentMode: "Bank Transfer",
};

const emptyEmployee: Employee = {
  name: "",
  email: "",
  phone: "",
  photoUrl: "",
  profileImage: "",
  bloodGroup: "",
  dateOfBirth: "",
  department: "",
  designation: "",
  joined: "",
  joiningDate: "",
  status: "Active",
  password: "",
  bankDetails: emptyBankDetails,
};

const emptySalary: SalaryStructure = {
  monthlyGrossSalary: 0,
  basicSalaryType: "percentage",
  basicSalaryValue: 40,
  hraType: "percentage",
  hraValue: 40,
  specialAllowanceType: "remainder",
  specialAllowanceValue: 0,
  otherAllowance: 0,
  bonus: 0,
  deductions: 0,
  tax: 0,
  pfEnabled: true,
  esiEnabled: false,
  finePerAbsentDay: 0,
  finePerLateMark: 0,
  overtimeRatePerHour: 0,
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const formLabelClassName = "text-[#8E6B4C]";

const mapEmployeeRow = (row: EmployeeApiRow): Employee => ({
  _id: row._id,
  userId: row.userId,
  employeeId: row.employeeId,
  name: isUserRef(row.userId) ? row.userId.name || row.fullName || row.name || "" : row.fullName || row.name || "",
  email: isUserRef(row.userId) ? row.userId.email || row.email || "" : row.email || "",
  phone: row.phone || "",
  photoUrl: row.photoUrl || row.profileImage || row.documents?.photograph?.url || "",
  profileImage: row.profileImage || row.photoUrl || row.documents?.photograph?.url || "",
  bloodGroup: row.bloodGroup || "",
  dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth).toISOString().slice(0, 10) : "",
  department: isUserRef(row.userId)
    ? row.userId.department || row.department || row.departmentName || ""
    : row.department || row.departmentName || "",
  designation: row.designation || "",
  joiningDate: row.joiningDate ? new Date(row.joiningDate).toISOString().slice(0, 10) : "",
  joined: row.joiningDate ? new Date(row.joiningDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "",
  status: row.status === "active" ? "Active" : "Inactive",
  salary: row.salary,
  salaryStructure: row.salaryStructure,
  compensationStatus: row.salaryStructure?.isConfigured ? "Configured" : "Pending",
  bankDetails: {
    ...emptyBankDetails,
    ...(row.bankDetails || {}),
  },
});

const AdminEmployees: React.FC = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ search: "", department: "", status: "" });
  const [appliedFilters, setAppliedFilters] = useState({ search: "", department: "", status: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form, setForm] = useState<Employee>(emptyEmployee);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryIndex, setSalaryIndex] = useState<number | null>(null);
  const [salaryForm, setSalaryForm] = useState<SalaryStructure>(emptySalary);
  const [salarySaving, setSalarySaving] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [selectedIdCardEmployee, setSelectedIdCardEmployee] = useState<EmployeeRecord | null>(null);
  const [selectedIdCardEmployeeIndex, setSelectedIdCardEmployeeIndex] = useState<number | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.listEmployees();
      const mapped: Employee[] = data.map((row) => mapEmployeeRow(row));
      setEmployees(mapped);
    } catch (error) {
      toast({
        title: "Unable to load employees",
        description: error instanceof Error ? error.message : "Employee data could not be loaded.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const departments = [...new Set(employees.map((employee) => employee.department).filter(Boolean))];

  const filtered = employees.filter((employee) => {
    const term = appliedFilters.search.toLowerCase();
    const matchSearch =
      employee.name.toLowerCase().includes(term) ||
      employee.email.toLowerCase().includes(term) ||
      employee.department.toLowerCase().includes(term) ||
      String(employee.employeeId || "").toLowerCase().includes(term);
    const matchDept = !appliedFilters.department || employee.department === appliedFilters.department;
    const matchStatus = !appliedFilters.status || employee.status === appliedFilters.status;
    return matchSearch && matchDept && matchStatus;
  });

  const openAdd = () => {
    setForm({
      ...emptyEmployee,
      joiningDate: new Date().toISOString().slice(0, 10),
      joined: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      bankDetails: { ...emptyBankDetails },
    });
    setEditIndex(null);
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    setForm({
      ...employees[index],
      photoUrl: employees[index].photoUrl || employees[index].profileImage || "",
      profileImage: employees[index].profileImage || employees[index].photoUrl || "",
      bankDetails: { ...emptyBankDetails, ...employees[index].bankDetails },
    });
    setEditIndex(index);
    setDialogOpen(true);
  };

  const openCompensation = (index: number) => {
    const employee = employees[index];
    setSalaryIndex(index);
    setSalaryForm({
      employeeId: employee.employeeId,
      monthlyGrossSalary: Number(employee.salaryStructure?.monthlyGrossSalary || employee.salary || 0),
      basicSalaryType: employee.salaryStructure?.basicSalaryType || "percentage",
      basicSalaryValue: Number(employee.salaryStructure?.basicSalaryValue || 40),
      hraType: employee.salaryStructure?.hraType || "percentage",
      hraValue: Number(employee.salaryStructure?.hraValue || 40),
      specialAllowanceType: employee.salaryStructure?.specialAllowanceType || "remainder",
      specialAllowanceValue: Number(employee.salaryStructure?.specialAllowanceValue || 0),
      otherAllowance: Number(employee.salaryStructure?.otherAllowance || 0),
      bonus: Number(employee.salaryStructure?.bonus || 0),
      deductions: Number(employee.salaryStructure?.deductions || 0),
      tax: Number(employee.salaryStructure?.tax || 0),
      pfEnabled: Boolean(employee.salaryStructure?.pfEnabled),
      esiEnabled: Boolean(employee.salaryStructure?.esiEnabled),
      finePerAbsentDay: Number(employee.salaryStructure?.finePerAbsentDay || 0),
      finePerLateMark: Number(employee.salaryStructure?.finePerLateMark || 0),
      overtimeRatePerHour: Number(employee.salaryStructure?.overtimeRatePerHour || 0),
      isConfigured: employee.salaryStructure?.isConfigured,
    });
    setSalaryDialogOpen(true);
  };

  const openIdCard = (index: number) => {
    const employee = employees[index];
    if (!employee?._id) return;

    void (async () => {
      setIdCardOpen(true);
      setIdCardLoading(true);
      setSelectedIdCardEmployeeIndex(index);
      try {
        const details = await apiService.getEmployeeById(employee._id);
        setSelectedIdCardEmployee(details);
      } catch (error) {
        setIdCardOpen(false);
        toast({
          title: "Unable to load ID card",
          description: error instanceof Error ? error.message : "Employee details could not be loaded.",
          variant: "destructive",
        });
      } finally {
        setIdCardLoading(false);
      }
    })();
  };

  const syncEmployeePhotoState = (updatedEmployee: EmployeeRecord) => {
    const normalized = mapEmployeeRow(updatedEmployee as EmployeeApiRow);
    setEmployees((current) =>
      current.map((item) =>
        item._id === normalized._id
          ? {
              ...item,
              ...normalized,
              photoUrl: normalized.photoUrl || normalized.profileImage || "",
              profileImage: normalized.profileImage || normalized.photoUrl || "",
            }
          : item
      )
    );
    setSelectedIdCardEmployee((current) => (current?._id === updatedEmployee._id ? updatedEmployee : current));
    setForm((current) =>
      current._id === updatedEmployee._id
        ? {
            ...current,
            photoUrl: updatedEmployee.photoUrl || updatedEmployee.profileImage || "",
            profileImage: updatedEmployee.profileImage || updatedEmployee.photoUrl || "",
          }
        : current
    );
  };

  const handleEmployeePhotoUpload = async (file: File) => {
    if (!form._id) {
      throw new Error("Save the employee first, then upload a photo.");
    }

    const updatedEmployee = await apiService.uploadEmployeePhoto(form._id, file);
    syncEmployeePhotoState(updatedEmployee);
  };

  const handleEmployeePhotoRemove = async () => {
    if (!form._id) {
      throw new Error("Save the employee first, then manage the photo.");
    }

    const updatedEmployee = await apiService.removeEmployeePhoto(form._id);
    syncEmployeePhotoState(updatedEmployee);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim() || !form.department.trim() || !form.designation.trim()) {
      toast({ title: "Missing details", description: "Please fill all required employee fields.", variant: "destructive" });
      return;
    }
    if (editIndex === null && (!form.password || form.password.length < 6)) {
      toast({ title: "Invalid password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    void (async () => {
      setSavingEmployee(true);
      try {
        if (editIndex !== null && employees[editIndex]?._id) {
          const employee = employees[editIndex];
          const updated = await apiService.updateEmployee(employee._id!, {
            designation: form.designation,
            phone: form.phone,
            bloodGroup: form.bloodGroup,
            dateOfBirth: form.dateOfBirth || null,
            joiningDate: form.joiningDate || new Date().toISOString(),
            bankDetails: form.bankDetails,
            status: form.status.toLowerCase(),
          });
          if (employee.userId && typeof employee.userId !== "string") {
            await apiService.update("users", employee.userId._id, {
              name: form.name,
              email: form.email,
              department: form.department,
              isActive: form.status === "Active",
            });
          }
          setEmployees((current) =>
            current.map((item, index) =>
              index === editIndex
                ? {
                    ...item,
                    ...mapEmployeeRow(updated as EmployeeApiRow),
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    bloodGroup: form.bloodGroup,
                    dateOfBirth: form.dateOfBirth,
                    photoUrl: form.photoUrl,
                    profileImage: form.profileImage,
                    department: form.department,
                    designation: form.designation,
                    status: form.status,
                    bankDetails: form.bankDetails,
                  }
                : item
            )
          );
          if (selectedIdCardEmployeeIndex === editIndex && employee._id) {
            const refreshedEmployee = await apiService.getEmployeeById(employee._id);
            setSelectedIdCardEmployee(refreshedEmployee);
          }
        } else {
          const created = await apiService.createEmployee({
            name: form.name,
            email: form.email,
            phone: form.phone,
            bloodGroup: form.bloodGroup,
            dateOfBirth: form.dateOfBirth || null,
            password: form.password,
            department: form.department,
            departmentName: form.department,
            fullName: form.name,
            designation: form.designation,
            salary: 0,
            joiningDate: form.joiningDate || new Date().toISOString(),
            bankDetails: form.bankDetails,
            accountStatus: form.status === "Active" ? "active" : "disabled",
          });
          const nextEmployee = {
            ...mapEmployeeRow(created as EmployeeApiRow),
            name: form.name,
            email: form.email,
            phone: form.phone,
            bloodGroup: form.bloodGroup,
            dateOfBirth: form.dateOfBirth,
            photoUrl: form.photoUrl,
            profileImage: form.profileImage,
            department: form.department,
            designation: form.designation,
            status: form.status,
            bankDetails: form.bankDetails,
          };
          setDraftFilters({ search: "", department: "", status: "" });
          setAppliedFilters({ search: "", department: "", status: "" });
          setEmployees((current) => {
            const filteredCurrent = current.filter((item) => item._id !== nextEmployee._id && item.email !== nextEmployee.email);
            return [nextEmployee, ...filteredCurrent];
          });
        }
        setForm(emptyEmployee);
        setDialogOpen(false);
        await loadEmployees();
        toast({
          title: editIndex !== null ? "Employee updated" : "Employee created",
          description: "Employee data has been saved successfully.",
        });
      } catch (error) {
        toast({
          title: "Save failed",
          description: error instanceof Error ? error.message : "Unable to save employee details.",
          variant: "destructive",
        });
      } finally {
        setSavingEmployee(false);
      }
    })();
  };

  const handleDelete = () => {
    void (async () => {
      if (deleteIndex === null) return;
      try {
        const employee = employees[deleteIndex];
        if (employee._id) await apiService.deleteEmployee(employee._id);
        if (employee.userId && typeof employee.userId !== "string") await apiService.remove("users", employee.userId._id);
        setDeleteIndex(null);
        await loadEmployees();
        toast({ title: "Employee deleted", description: "The employee record has been removed." });
      } catch (error) {
        toast({
          title: "Delete failed",
          description: error instanceof Error ? error.message : "Unable to delete the employee record.",
          variant: "destructive",
        });
      }
    })();
  };

  const handleSalarySave = async () => {
    if (salaryIndex === null) return;
    const employee = employees[salaryIndex];
    if (!employee._id) return;

    setSalarySaving(true);
    try {
      const monthlyGrossSalary = Number(salaryForm.monthlyGrossSalary || 0);
      const basicSalary =
        salaryForm.basicSalaryType === "fixed"
          ? Number(salaryForm.basicSalaryValue || 0)
          : (monthlyGrossSalary * Number(salaryForm.basicSalaryValue || 0)) / 100;
      const hra =
        salaryForm.hraType === "fixed"
          ? Number(salaryForm.hraValue || 0)
          : (basicSalary * Number(salaryForm.hraValue || 0)) / 100;
      const specialAllowance =
        salaryForm.specialAllowanceType === "fixed"
          ? Number(salaryForm.specialAllowanceValue || 0)
          : salaryForm.specialAllowanceType === "percentage"
            ? (monthlyGrossSalary * Number(salaryForm.specialAllowanceValue || 0)) / 100
            : Math.max(0, monthlyGrossSalary - basicSalary - hra);

      await apiService.updateEmployeeSalaryStructure(employee._id, {
        monthlyGrossSalary,
        basicSalaryType: salaryForm.basicSalaryType,
        basicSalaryValue: Number(salaryForm.basicSalaryValue || 0),
        hraType: salaryForm.hraType,
        hraValue: Number(salaryForm.hraValue || 0),
        specialAllowanceType: salaryForm.specialAllowanceType,
        specialAllowanceValue: Number(salaryForm.specialAllowanceValue || 0),
        otherAllowance: Number(salaryForm.otherAllowance || 0),
        basicSalary: Number(basicSalary || 0),
        hra: Number(hra || 0),
        allowances: Number(salaryForm.otherAllowance || 0),
        specialAllowance: Number(specialAllowance || 0),
        bonus: Number(salaryForm.bonus || 0),
        deductions: Number(salaryForm.deductions || 0),
        tax: Number(salaryForm.tax || 0),
        pfEnabled: salaryForm.pfEnabled,
        esiEnabled: salaryForm.esiEnabled,
        finePerAbsentDay: Number(salaryForm.finePerAbsentDay || 0),
        finePerLateMark: Number(salaryForm.finePerLateMark || 0),
        overtimeRatePerHour: Number(salaryForm.overtimeRatePerHour || 0),
      });
      setSalaryDialogOpen(false);
      await loadEmployees();
      toast({ title: "Compensation saved", description: "Payroll configuration has been updated." });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save payroll configuration.",
        variant: "destructive",
      });
    } finally {
      setSalarySaving(false);
    }
  };

  const grossPreview = Number(salaryForm.monthlyGrossSalary || 0) + Number(salaryForm.bonus || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle="Manage your workforce, bank details, joining information, and payroll-ready compensation setup."
        action={<Button onClick={openAdd} className="gradient-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Add Employee</Button>}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" className="gap-2 rounded-xl border-slate-200 bg-white/90" onClick={() => setFiltersOpen(true)}><Filter className="w-4 h-4" />Filter</Button>
        <ExportButton
          moduleName="employees"
          rows={filtered}
          fallbackRows={employees}
          columns={employeeExportColumns}
          filters={appliedFilters}
          loading={loading}
          emptyMessage="No data to export"
          preferServerExport={false}
        />
        <p className="text-sm text-muted-foreground">{filtered.length} employee{filtered.length === 1 ? "" : "s"} visible</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading employees...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No employees found"
          description="No data available for the selected filters."
          action={<Button variant="outline" onClick={() => void loadEmployees()}>Refresh list</Button>}
        />
      ) : (
        <EmployeeTable
          data={filtered}
          onEdit={(email) => {
            const index = employees.findIndex((employee) => employee.email === email);
            if (index >= 0) openEdit(index);
          }}
          onDelete={(email) => {
            const index = employees.findIndex((employee) => employee.email === email);
            if (index >= 0) setDeleteIndex(index);
          }}
          onCompensation={(email) => {
            const index = employees.findIndex((employee) => employee.email === email);
            if (index >= 0) openCompensation(index);
          }}
          onGenerateIdCard={(email) => {
            const index = employees.findIndex((employee) => employee.email === email);
            if (index >= 0) openIdCard(index);
          }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] sm:max-w-3xl rounded-[28px] border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-0 shadow-[0_28px_80px_rgba(166,124,82,0.22)]">
          <DialogHeader className="sticky top-0 z-10 border-b border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-6 py-5">
            <DialogTitle className="text-[#F5F5F5]">{editIndex !== null ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(92vh-140px)] overflow-y-auto px-6 py-4">
          <div className="mb-5">
            <ProfileImageManager
              name={form.name || "Employee"}
              imageUrl={form.photoUrl || form.profileImage || ""}
              onUpload={handleEmployeePhotoUpload}
              onRemove={handleEmployeePhotoRemove}
              disabled={savingEmployee || editIndex === null}
            />
            {editIndex === null ? (
              <p className="mt-2 text-xs font-medium text-[#8E6B4C]">Create the employee first, then upload the photo for the ID card.</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Full Name *</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Email *</Label>
              <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="john@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Phone</Label>
              <Input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 9876543210" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Department *</Label>
              <Input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Engineering" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Designation *</Label>
              <Input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} placeholder="Software Engineer" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Date of Birth</Label>
              <Input type="date" value={form.dateOfBirth || ""} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Blood Group</Label>
              <Input value={form.bloodGroup || ""} onChange={(event) => setForm({ ...form, bloodGroup: event.target.value.toUpperCase() })} placeholder="O+" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Joining Date</Label>
              <Input type="date" value={form.joiningDate || ""} onChange={(event) => setForm({ ...form, joiningDate: event.target.value })} />
            </div>
            {editIndex === null ? (
              <div className="space-y-1.5">
                <Label className={formLabelClassName}>Password *</Label>
                <Input
                  type="password"
                  value={form.password || ""}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="At least 6 characters"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Bank Name</Label>
              <Input value={form.bankDetails.bankName} onChange={(event) => setForm({ ...form, bankDetails: { ...form.bankDetails, bankName: event.target.value } })} placeholder="HDFC Bank" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Account Holder</Label>
              <Input value={form.bankDetails.accountHolderName} onChange={(event) => setForm({ ...form, bankDetails: { ...form.bankDetails, accountHolderName: event.target.value } })} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Account Number</Label>
              <Input value={form.bankDetails.accountNumber} onChange={(event) => setForm({ ...form, bankDetails: { ...form.bankDetails, accountNumber: event.target.value } })} placeholder="000012345678" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>IFSC Code</Label>
              <Input value={form.bankDetails.ifscCode} onChange={(event) => setForm({ ...form, bankDetails: { ...form.bankDetails, ifscCode: event.target.value.toUpperCase() } })} placeholder="HDFC0001234" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Branch Name</Label>
              <Input value={form.bankDetails.branchName} onChange={(event) => setForm({ ...form, bankDetails: { ...form.bankDetails, branchName: event.target.value } })} placeholder="Jaipur Main" />
            </div>
            <div className="space-y-1.5">
              <Label className={formLabelClassName}>Payment Mode</Label>
              <Input value={form.bankDetails.paymentMode} onChange={(event) => setForm({ ...form, bankDetails: { ...form.bankDetails, paymentMode: event.target.value } })} placeholder="Bank Transfer" />
            </div>
          </div>
          </div>
          <DialogFooter className="sticky bottom-0 gap-2 border-t border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-6 py-4">
            <DialogClose asChild><Button variant="outline" disabled={savingEmployee}>Cancel</Button></DialogClose>
            <Button
              onClick={handleSave}
              disabled={savingEmployee}
              className="gap-2 rounded-xl border border-[#2A2623] bg-[linear-gradient(135deg,#A67C52,#E6C7A3)] px-5 text-[#1A1816] shadow-[0_18px_40px_rgba(166,124,82,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(166,124,82,0.4)]"
            >
              {savingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {savingEmployee ? (editIndex !== null ? "Updating..." : "Adding...") : editIndex !== null ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent className="max-h-[92vh] sm:max-w-3xl rounded-[28px] border border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-0 shadow-[0_28px_80px_rgba(166,124,82,0.22)]">
          <DialogHeader className="sticky top-0 z-10 border-b border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-6 py-5">
            <DialogTitle className="text-[#F5F5F5]">Payroll Configuration</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(92vh-140px)] overflow-y-auto px-6 py-4">
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-[#2A2623] bg-[rgba(35,32,29,0.72)] p-4 text-sm">
              <div className="font-medium text-[#F5F5F5]">{salaryIndex !== null ? employees[salaryIndex]?.name : "Employee"}</div>
              <div className="text-[#A1A1AA]">{salaryIndex !== null ? employees[salaryIndex]?.employeeId : ""}</div>
              <div className="mt-2 text-[#F5F5F5]">Gross Salary Preview: <span className="font-semibold text-[#E6C7A3]">{currency.format(grossPreview)}</span></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Monthly Gross Salary</Label>
                <Input type="number" min="0" value={salaryForm.monthlyGrossSalary} onChange={(event) => setSalaryForm({ ...salaryForm, monthlyGrossSalary: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Basic Salary Rule</Label>
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <Select value={salaryForm.basicSalaryType} onValueChange={(value) => setSalaryForm({ ...salaryForm, basicSalaryType: value as SalaryStructure["basicSalaryType"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" value={salaryForm.basicSalaryValue} onChange={(event) => setSalaryForm({ ...salaryForm, basicSalaryValue: Number(event.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>HRA Rule</Label>
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <Select value={salaryForm.hraType} onValueChange={(value) => setSalaryForm({ ...salaryForm, hraType: value as SalaryStructure["hraType"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" value={salaryForm.hraValue} onChange={(event) => setSalaryForm({ ...salaryForm, hraValue: Number(event.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Special Allowance Rule</Label>
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <Select value={salaryForm.specialAllowanceType} onValueChange={(value) => setSalaryForm({ ...salaryForm, specialAllowanceType: value as SalaryStructure["specialAllowanceType"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remainder">Remainder</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" value={salaryForm.specialAllowanceValue} onChange={(event) => setSalaryForm({ ...salaryForm, specialAllowanceValue: Number(event.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Other Allowance</Label>
                <Input type="number" min="0" value={salaryForm.otherAllowance} onChange={(event) => setSalaryForm({ ...salaryForm, otherAllowance: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Bonus</Label>
                <Input type="number" min="0" value={salaryForm.bonus} onChange={(event) => setSalaryForm({ ...salaryForm, bonus: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Other Deductions</Label>
                <Input type="number" min="0" value={salaryForm.deductions} onChange={(event) => setSalaryForm({ ...salaryForm, deductions: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tax</Label>
                <Input type="number" min="0" value={salaryForm.tax} onChange={(event) => setSalaryForm({ ...salaryForm, tax: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fine Per Absent Day</Label>
                <Input type="number" min="0" value={salaryForm.finePerAbsentDay} onChange={(event) => setSalaryForm({ ...salaryForm, finePerAbsentDay: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fine Per Late Mark</Label>
                <Input type="number" min="0" value={salaryForm.finePerLateMark} onChange={(event) => setSalaryForm({ ...salaryForm, finePerLateMark: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Overtime Rate Per Hour</Label>
                <Input type="number" min="0" value={salaryForm.overtimeRatePerHour} onChange={(event) => setSalaryForm({ ...salaryForm, overtimeRatePerHour: Number(event.target.value) })} />
              </div>
              <div className="rounded-xl border border-[#2A2623] bg-[rgba(35,32,29,0.72)] p-4 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F5F5F5]">PF Deduction</p>
                    <p className="text-xs text-[#A1A1AA]">Apply PF during payroll calculation</p>
                  </div>
                  <input type="checkbox" checked={salaryForm.pfEnabled} onChange={(event) => setSalaryForm({ ...salaryForm, pfEnabled: event.target.checked })} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F5F5F5]">ESI Deduction</p>
                    <p className="text-xs text-[#A1A1AA]">Apply ESI when payroll rules allow it</p>
                  </div>
                  <input type="checkbox" checked={salaryForm.esiEnabled} onChange={(event) => setSalaryForm({ ...salaryForm, esiEnabled: event.target.checked })} />
                </div>
              </div>
            </div>
          </div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-6 py-4">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => void handleSalarySave()} disabled={salarySaving} className="gradient-primary text-primary-foreground">
              {salarySaving ? "Saving..." : "Save Compensation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}
        title="Delete Employee"
        description={`Are you sure you want to remove ${deleteIndex !== null ? employees[deleteIndex]?.name : "this employee"}? This action cannot be undone.`}
        onConfirm={handleDelete}
      />

      <EmployeeIdCardModal
        open={idCardOpen}
        onOpenChange={(open) => {
          setIdCardOpen(open);
          if (!open) {
            setSelectedIdCardEmployee(null);
            setIdCardLoading(false);
            setSelectedIdCardEmployeeIndex(null);
          }
        }}
        employee={selectedIdCardEmployee}
        loading={idCardLoading}
        onEdit={
          selectedIdCardEmployeeIndex !== null
            ? () => {
                setIdCardOpen(false);
                openEdit(selectedIdCardEmployeeIndex);
              }
            : undefined
        }
      />

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        values={draftFilters}
        onChange={(key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }))}
        onApply={(values) => setAppliedFilters({
          search: values.search || "",
          department: values.department || "",
          status: values.status || "",
        })}
        onReset={() => {
          const cleared = { search: "", department: "", status: "" };
          setDraftFilters(cleared);
          setAppliedFilters(cleared);
        }}
        filters={[
          { key: "search", label: "Search", type: "text", placeholder: "Search by name, email, or employee ID" },
          {
            key: "department",
            label: "Department",
            type: "select",
            placeholder: "All departments",
            options: departments.map((department) => ({ label: department, value: department })),
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            placeholder: "All statuses",
            options: [
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" },
            ],
          },
        ]}
      />
    </div>
  );
};

export default AdminEmployees;
