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

const attendancePunchSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["check-in", "check-out", "system-auto-close"],
      required: true,
    },
    timestamp: { type: Date, required: true },
    source: {
      type: String,
      enum: ["geo", "manual", "correction", "system"],
      default: "manual",
    },
    location: { type: attendanceLocationSchema, default: undefined },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: Date, required: true },
    dateKey: { type: String, trim: true, default: "" },
    checkIn: { type: String, default: "" },
    checkOut: { type: String, default: "" },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    punchEntries: { type: [attendancePunchSchema], default: [] },
    checkInLocation: { type: attendanceLocationSchema, default: undefined },
    checkOutLocation: { type: attendanceLocationSchema, default: undefined },
    hoursWorked: { type: Number, default: 0 },
    workingMinutes: { type: Number, default: 0, min: 0 },
    overtimeHours: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["present", "late", "half_day", "absent", "leave"], default: "present" },
    isIncomplete: { type: Boolean, default: false },
    statusReason: { type: String, trim: true, default: "" },
    autoClosedAt: { type: Date, default: null },
    policySnapshot: {
      type: new mongoose.Schema(
        {
          standardPunchInTime: { type: String, trim: true, default: "" },
          gracePeriodMinutes: { type: Number, default: 0 },
          halfDayCutoffTime: { type: String, trim: true, default: "" },
          minimumWorkingHours: { type: Number, default: 0 },
          missingPunchOutHandling: { type: String, trim: true, default: "" },
          autoCloseTime: { type: String, trim: true, default: "" },
          timezone: { type: String, trim: true, default: "" },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    isManual: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index(
  { employeeId: 1, dateKey: 1 },
  { unique: true, partialFilterExpression: { dateKey: { $exists: true, $type: "string", $ne: "" } } }
);

export const Attendance = mongoose.model("Attendance", attendanceSchema);
