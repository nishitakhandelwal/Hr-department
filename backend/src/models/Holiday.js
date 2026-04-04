import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    country: { type: String, default: "IN", trim: true, index: true },
    type: { type: String, default: "public", trim: true }, // public, optional, bank
    isCustom: { type: Boolean, default: false },
    source: { type: String, enum: ["system", "api", "manual"], default: "system" },
    externalId: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

holidaySchema.index({ country: 1, date: 1 });
holidaySchema.index({ date: 1 });

export const Holiday = mongoose.model("Holiday", holidaySchema);
