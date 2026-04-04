import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ["holiday", "birthday", "meeting", "reminder"],
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    timeLabel: { type: String, trim: true, default: "" },
    details: { type: String, trim: true, default: "" },
  },
  { timestamps: true, versionKey: false }
);

eventSchema.index({ type: 1, date: 1 });

export const Event = mongoose.model("Event", eventSchema);
