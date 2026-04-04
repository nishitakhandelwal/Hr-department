import mongoose from "mongoose";

const offboardingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: "" },
    reason: { type: String, trim: true, default: "" },
    lastDay: { type: Date, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true, versionKey: false }
);

export const Offboarding = mongoose.model("Offboarding", offboardingSchema);
