import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    leaveType: { type: String, required: true, trim: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    reason: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true, versionKey: false }
);

export const Leave = mongoose.model("Leave", leaveSchema);
