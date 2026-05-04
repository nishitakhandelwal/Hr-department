import mongoose from "mongoose";

const internshipHistorySchema = new mongoose.Schema(
  {
    action: { type: String, trim: true, default: "" },
    label: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    statusFrom: { type: String, trim: true, default: "" },
    statusTo: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const internshipExtensionSchema = new mongoose.Schema(
  {
    previousEndDate: { type: Date, required: true },
    newEndDate: { type: Date, required: true },
    reason: { type: String, trim: true, default: "" },
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
      enum: ["Assigned", "In Progress", "Approved", "Rejected", "Extended", "Completed", "Active", "Cancelled", "Converted to Employee"],
      default: "Active",
    },
    notes: { type: String, trim: true, default: "" },
    extensionReason: { type: String, trim: true, default: "" },
    extendedTill: { type: Date, default: null },
    extensionHistory: { type: [internshipExtensionSchema], default: [] },
    completion: {
      type: new mongoose.Schema(
        {
          completedAt: { type: Date, default: null },
          completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          note: { type: String, trim: true, default: "" },
        },
        { _id: false }
      ),
      default: () => ({ completedAt: null, completedBy: null, note: "" }),
    },
    cancellation: {
      type: new mongoose.Schema(
        {
          cancelledAt: { type: Date, default: null },
          cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          reason: { type: String, trim: true, default: "" },
          note: { type: String, trim: true, default: "" },
        },
        { _id: false }
      ),
      default: () => ({ cancelledAt: null, cancelledBy: null, reason: "", note: "" }),
    },
    conversion: {
      type: new mongoose.Schema(
        {
          convertedAt: { type: Date, default: null },
          convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
          note: { type: String, trim: true, default: "" },
        },
        { _id: false }
      ),
      default: () => ({ convertedAt: null, convertedBy: null, employeeId: null, note: "" }),
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: { type: [internshipHistorySchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

export const Internship = mongoose.model("Internship", internshipSchema);
