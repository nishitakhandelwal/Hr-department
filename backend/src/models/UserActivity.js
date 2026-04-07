import mongoose from "mongoose";

const userActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, trim: true, default: "" },
    userEmail: { type: String, trim: true, default: "" },
    userRole: { type: String, trim: true, default: "" },
    action: { type: String, trim: true, required: true },
    details: { type: String, trim: true, default: "" },
    ipAddress: { type: String, trim: true, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

userActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const UserActivity = mongoose.model("UserActivity", userActivitySchema);
