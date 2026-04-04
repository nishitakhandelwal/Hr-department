import mongoose from "mongoose";

const templateAuditSchema = new mongoose.Schema(
  {
    action: { type: String, trim: true, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const letterTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, required: true, trim: true, lowercase: true },
    title: { type: String, trim: true, default: "" },
    content: { type: String, required: true, default: "" },
    headerHtml: { type: String, required: true, default: "" },
    footerHtml: { type: String, required: true, default: "" },
    variables: { type: [String], default: [] },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parentTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "LetterTemplate", default: null },
    auditHistory: { type: [templateAuditSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

letterTemplateSchema.index({ name: 1, version: 1 }, { unique: true });
letterTemplateSchema.index({ type: 1, category: 1, isActive: 1 });

export const LetterTemplate = mongoose.model("LetterTemplate", letterTemplateSchema);
