import mongoose from "mongoose";

const attendanceLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    officeLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "OfficeLocation", default: null },
    officeName: { type: String, trim: true, default: "" },
    distanceMeters: { type: Number, default: 0 },
    radiusMeters: { type: Number, default: 0 },
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: Date, required: true },
    checkIn: { type: String, default: "" },
    checkOut: { type: String, default: "" },
    checkInLocation: { type: attendanceLocationSchema, default: undefined },
    checkOutLocation: { type: attendanceLocationSchema, default: undefined },
    hoursWorked: { type: Number, default: 0 },
    status: { type: String, enum: ["present", "late", "absent", "leave"], default: "present" },
    isManual: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
