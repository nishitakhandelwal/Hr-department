import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true, default: "general" },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export const Notification = mongoose.model("Notification", notificationSchema);
