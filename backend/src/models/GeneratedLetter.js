import mongoose from "mongoose";

const letterAuditSchema = new mongoose.Schema(
  {
    action: { type: String, trim: true, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const generatedLetterSchema = new mongoose.Schema(
  {
    letterNumber: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, required: true, trim: true, lowercase: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", default: null },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "LetterTemplate", required: true },
    generatedContent: { type: String, required: true, default: "" },
    status: {
      type: String,
      enum: ["Generated", "Sent", "Viewed", "Accepted", "Rejected", "Signed"],
      default: "Generated",
    },
    pdfUrl: { type: String, trim: true, default: "" },
    issuedDate: { type: Date, default: Date.now },
    sentAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: Number, default: 1 },
    approvalStatus: {
      type: String,
      enum: ["Draft", "Pending Director Approval", "Approved", "Rejected"],
      default: "Approved",
    },
    auditHistory: { type: [letterAuditSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

generatedLetterSchema.index({ type: 1, issuedDate: -1 });
generatedLetterSchema.index({ employeeId: 1, candidateId: 1, issuedDate: -1 });

export const GeneratedLetter = mongoose.model("GeneratedLetter", generatedLetterSchema);
