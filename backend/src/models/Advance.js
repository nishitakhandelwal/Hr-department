import mongoose from "mongoose";

const advanceDeductionSchema = new mongoose.Schema(
  {
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: "Payroll", default: null },
    monthNumber: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    amount: { type: Number, required: true, min: 0 },
    deductedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const advanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "partially_deducted", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    deductions: { type: [advanceDeductionSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

export const Advance = mongoose.model("Advance", advanceSchema);
