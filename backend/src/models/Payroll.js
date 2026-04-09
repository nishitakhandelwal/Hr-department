import mongoose from "mongoose";

const payrollLineItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const payrollBankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: "" },
    accountHolderName: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    ifscCode: { type: String, trim: true, default: "" },
    branchName: { type: String, trim: true, default: "" },
    paymentMode: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const payrollAdvanceDeductionSchema = new mongoose.Schema(
  {
    advanceId: { type: mongoose.Schema.Types.ObjectId, ref: "Advance", required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    payrollId: { type: String, required: true, unique: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    employeeCode: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    designation: { type: String, default: "", trim: true },
    joiningDate: { type: Date, default: null },
    location: { type: String, default: "", trim: true },
    bankDetails: { type: payrollBankDetailsSchema, default: () => ({}) },
    month: { type: String, required: true, trim: true },
    monthNumber: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    presentDays: { type: Number, default: 0, min: 0 },
    lateDays: { type: Number, default: 0, min: 0 },
    absentDays: { type: Number, default: 0, min: 0 },
    leaveDays: { type: Number, default: 0, min: 0 },
    overtimeHours: { type: Number, default: 0, min: 0 },
    totalWorkingDays: { type: Number, default: 0, min: 0 },
    payableDays: { type: Number, default: 0, min: 0 },
    fullWages: { type: Number, default: 0, min: 0 },
    earnedWages: { type: Number, default: 0, min: 0 },
    basicSalary: { type: Number, required: true, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    specialAllowance: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    grossSalary: { type: Number, required: true, min: 0 },
    overtimePay: { type: Number, default: 0, min: 0 },
    employerPf: { type: Number, default: 0, min: 0 },
    employerEsi: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0 },
    tax: { type: Number, default: 0, min: 0 },
    fineAmount: { type: Number, default: 0, min: 0 },
    pfEmployee: { type: Number, default: 0, min: 0 },
    esiEmployee: { type: Number, default: 0, min: 0 },
    advanceDeduction: { type: Number, default: 0, min: 0 },
    advanceDeductions: { type: [payrollAdvanceDeductionSchema], default: [] },
    totalDeductions: { type: Number, default: 0, min: 0 },
    attendanceSalary: { type: Number, default: 0, min: 0 },
    netSalary: { type: Number, required: true },
    earnings: { type: [payrollLineItemSchema], default: [] },
    deductionBreakdown: { type: [payrollLineItemSchema], default: [] },
    amountInWords: { type: String, default: "", trim: true },
    status: { type: String, enum: ["processed"], default: "processed" },
  },
  { timestamps: true, versionKey: false }
);

payrollSchema.index({ employeeId: 1, monthNumber: 1, year: 1 }, { unique: true });

export const Payroll = mongoose.model("Payroll", payrollSchema);
