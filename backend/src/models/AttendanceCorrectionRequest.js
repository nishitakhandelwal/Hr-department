import mongoose from "mongoose";

const attendanceCorrectionRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    date: { type: Date, required: true, index: true },
    type: { type: String, enum: ["check-in", "check-out"], required: true },
    time: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    adminRemarks: { type: String, trim: true, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

attendanceCorrectionRequestSchema.index(
  { employeeId: 1, date: 1, type: 1, status: 1 },
  { partialFilterExpression: { status: "pending" } }
);

export const AttendanceCorrectionRequest = mongoose.model(
  "AttendanceCorrectionRequest",
  attendanceCorrectionRequestSchema
);
