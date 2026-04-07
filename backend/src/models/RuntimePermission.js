import mongoose from "mongoose";

const runtimePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["super_admin", "admin", "hr_manager", "recruiter", "employee", "candidate"],
      required: true,
      trim: true,
    },
    action: { type: String, required: true, trim: true },
    allowed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "runtime_permissions",
  }
);

runtimePermissionSchema.index({ role: 1, action: 1 }, { unique: true });

export const RuntimePermission = mongoose.model("RuntimePermission", runtimePermissionSchema);
