import mongoose from "mongoose";

const letterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    count: { type: Number, default: 0 },
    color: { type: String, default: "bg-primary/10 text-primary" },
  },
  { timestamps: true, versionKey: false }
);

export const Letter = mongoose.model("Letter", letterSchema);
