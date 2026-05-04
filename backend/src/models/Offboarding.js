import mongoose from "mongoose";

const STATUS_VALUES = ["pending", "approved", "completed", "rejected"];
const EXIT_TYPES = ["resignation", "termination", "absconding"];
const REHIRE_VALUES = ["eligible", "not_eligible", "under_review"];
const REQUEST_STATUS_VALUES = ["pending", "approved", "rejected"];

const documentSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false }
);

const clearanceSchema = new mongoose.Schema(
  {
    hr: { type: String, enum: STATUS_VALUES, default: "pending" },
    it: { type: String, enum: STATUS_VALUES, default: "pending" },
    finance: { type: String, enum: STATUS_VALUES, default: "pending" },
  },
  { _id: false }
);

const employeeChecklistSchema = new mongoose.Schema(
  {
    exitFormSubmitted: { type: Boolean, default: false },
    exitInterviewCompleted: { type: Boolean, default: false },
    assetsReturned: { type: Boolean, default: false },
    documentsAcknowledged: { type: Boolean, default: false },
  },
  { _id: false }
);

const resignationRequestSchema = new mongoose.Schema(
  {
    status: { type: String, enum: REQUEST_STATUS_VALUES, default: "pending" },
    reason: { type: String, trim: true, default: "" },
    comments: { type: String, trim: true, default: "" },
    noticePeriod: { type: String, trim: true, default: "" },
    lastWorkingDay: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedByName: { type: String, trim: true, default: "" },
    reviewComments: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const offboardingSchema = new mongoose.Schema(
  {
    employeeRef: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null, index: true },
    employeeCode: { type: String, trim: true, default: "" },
    employeeName: { type: String, trim: true, default: "" },
    employeeEmail: { type: String, trim: true, lowercase: true, default: "" },
    department: { type: String, trim: true, default: "" },
    managerName: { type: String, trim: true, default: "" },
    joiningDate: { type: Date, default: null },
    exitType: { type: String, enum: EXIT_TYPES, default: "resignation" },
    noticePeriod: { type: String, trim: true, default: "" },
    lastWorkingDay: { type: Date, default: null },
    actualLastWorkingDay: { type: Date, default: null },
    exitInterviewStatus: { type: String, enum: STATUS_VALUES, default: "pending" },
    clearanceStatus: { type: clearanceSchema, default: () => ({}) },
    assetsReturnStatus: { type: String, enum: STATUS_VALUES, default: "pending" },
    fnfStatus: { type: String, enum: STATUS_VALUES, default: "pending" },
    rehireEligibility: { type: String, enum: REHIRE_VALUES, default: "under_review" },
    status: { type: String, enum: STATUS_VALUES, default: "pending" },
    remarks: { type: String, trim: true, default: "" },
    employeeRemarks: { type: String, trim: true, default: "" },
    documents: {
      relievingLetter: { type: documentSchema, default: () => ({}) },
      experienceLetter: { type: documentSchema, default: () => ({}) },
      clearanceForm: { type: documentSchema, default: () => ({}) },
      exitForm: { type: documentSchema, default: () => ({}) },
    },
    employeeChecklist: { type: employeeChecklistSchema, default: () => ({}) },
    resignationRequest: { type: resignationRequestSchema, default: null },
    offboardingStartedAt: { type: Date, default: null },

    // Legacy compatibility fields retained so existing screens/exports do not break.
    name: { type: String, trim: true, default: "" },
    reason: { type: String, trim: true, default: "" },
    lastDay: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

offboardingSchema.pre("validate", function syncLegacyFields(next) {
  this.name = String(this.employeeName || this.name || "").trim();
  this.reason = String(this.exitType || this.reason || "").trim();
  this.lastDay = this.lastWorkingDay || this.lastDay || null;

  if (this.employeeChecklist?.exitFormSubmitted && !this.documents?.exitForm?.uploadedAt) {
    this.employeeChecklist.exitFormSubmitted = false;
  }
  if (this.exitInterviewStatus === "completed") {
    this.employeeChecklist.exitInterviewCompleted = true;
  }
  if (this.assetsReturnStatus === "completed") {
    this.employeeChecklist.assetsReturned = true;
  }
  if (this.resignationRequest?.status === "approved" && !this.offboardingStartedAt) {
    this.offboardingStartedAt = new Date();
  }
  next();
});

export const Offboarding = mongoose.model("Offboarding", offboardingSchema);
