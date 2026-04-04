import mongoose from "mongoose";

const internshipHistorySchema = new mongoose.Schema(
  {
    action: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const internshipSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Assigned", "In Progress", "Approved", "Rejected", "Extended", "Completed"],
      default: "Assigned",
    },
    notes: { type: String, trim: true, default: "" },
    extensionReason: { type: String, trim: true, default: "" },
    extendedTill: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: { type: [internshipHistorySchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

export const Internship = mongoose.model("Internship", internshipSchema);
