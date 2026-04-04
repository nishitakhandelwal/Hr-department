import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, trim: true, default: "" },
    actorEmail: { type: String, trim: true, default: "" },
    action: { type: String, trim: true, required: true },
    targetType: { type: String, trim: true, default: "" },
    targetId: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
