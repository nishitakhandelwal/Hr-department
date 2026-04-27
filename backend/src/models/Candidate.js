import mongoose from "mongoose";

const candidateStatuses = [
  "Draft",
  "Applied",
  "Profile Completed",
  "HR Review",
  "Under Review",
  "Interview",
  "Interview Scheduled",
  "Selected",
  "Internship",
  "Offered",
  "Joining Form Requested",
  "Joining Form Submitted",
  "Joining Form Correction Requested",
  "Joining Form Rejected",
  "Employee Onboarding",
  "Converted to Employee",
  "Accepted",
  "Rejected",
];

const qualificationSchema = new mongoose.Schema(
  {
    degree: { type: String, trim: true, default: "" },
    institute: { type: String, trim: true, default: "" },
    year: { type: String, trim: true, default: "" },
    percentage: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const referenceSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    relationship: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    contact: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const employmentSchema = new mongoose.Schema(
  {
    company: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    from: { type: String, trim: true, default: "" },
    to: { type: String, trim: true, default: "" },
    responsibilities: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const candidateDocumentSchema = new mongoose.Schema(
  {
    documentId: { type: String, trim: true, default: "" },
    fieldId: { type: String, trim: true, default: "" },
    label: { type: String, trim: true, default: "" },
    categoryId: { type: String, trim: true, default: "" },
    categoryLabel: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false }
);

const candidateVideoSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: "" },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    source: { type: String, enum: ["recorded", "uploaded", ""], default: "" },
    uploadedAt: { type: Date, default: null },
    adminFeedback: { type: String, trim: true, default: "" },
    adminRating: { type: Number, min: 1, max: 5, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const candidateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, default: "" },
    profileImage: { type: String, trim: true, default: "" },
    positionApplied: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: candidateStatuses,
      default: "Applied",
    },
    stageCompleted: { type: Number, default: 1 },
    submittedAt: { type: Date, default: Date.now },
    stage2SubmittedAt: { type: Date, default: null },
    lastUpdatedAt: { type: Date, default: Date.now },
    activityTimeline: { type: [timelineSchema], default: [] },
    resumeUrl: { type: String, trim: true, default: "" },
    resumeFileName: { type: String, trim: true, default: "" },
    interviewSchedule: {
      date: { type: String, trim: true, default: "" },
      time: { type: String, trim: true, default: "" },
      meetingLink: { type: String, trim: true, default: "" },
      mode: { type: String, trim: true, default: "" },
      notes: { type: String, trim: true, default: "" },
    },
    documents: {
      resume: { type: candidateDocumentSchema, default: () => ({}) },
      certificates: { type: candidateDocumentSchema, default: () => ({}) },
      uploadedFiles: { type: [candidateDocumentSchema], default: [] },
    },
    videoIntroduction: { type: candidateVideoSchema, default: () => ({}) },
    stage1: {
      personalDetails: {
        dateOfBirth: { type: String, trim: true, default: "" },
        fatherName: { type: String, trim: true, default: "" },
        motherName: { type: String, trim: true, default: "" },
        maritalStatus: { type: String, trim: true, default: "" },
        presentResidentialAccommodation: { type: String, trim: true, default: "" },
        // Legacy field kept for backward compatibility with existing records.
        domicile: { type: String, trim: true, default: "" },
      },
      contactDetails: {
        alternatePhone: { type: String, trim: true, default: "" },
        currentAddress: { type: String, trim: true, default: "" },
        permanentAddress: { type: String, trim: true, default: "" },
      },
      qualificationDetails: {
        highestQualification: { type: String, trim: true, default: "" },
        qualifications: { type: [qualificationSchema], default: [] },
      },
      declarationAccepted: { type: Boolean, required: true, default: false },
      submittedAt: { type: Date, default: Date.now },
    },
    stage2Details: {
      experienceDetails: { type: String, trim: true, default: "" },
      references: { type: [referenceSchema], default: [] },
      employmentHistory: { type: [employmentSchema], default: [] },
      expectedSalary: { type: Number, default: 0 },
      noticePeriod: { type: String, trim: true, default: "" },
      managementAssessment: {
        communication: { type: String, trim: true, default: "" },
        technicalSkill: { type: String, trim: true, default: "" },
        attitude: { type: String, trim: true, default: "" },
        leadership: { type: String, trim: true, default: "" },
      },
      candidateRemarks: { type: String, trim: true, default: "" },
    },
    adminReview: {
      evaluationRemarks: { type: String, trim: true, default: "" },
      adminNotes: { type: String, trim: true, default: "" },
      rating: { type: Number, min: 1, max: 5, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    internship: {
      isAssigned: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["Not Assigned", "Assigned", "In Progress", "Approved", "Rejected", "Extended"],
        default: "Not Assigned",
      },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      extensionDate: { type: Date, default: null },
      remarks: { type: String, trim: true, default: "" },
      updatedAt: { type: Date, default: null },
    },
    joiningForm: {
      isUnlocked: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["Locked", "Requested", "Submitted", "Correction Requested", "Approved", "Rejected"],
        default: "Locked",
      },
      unlockedAt: { type: Date, default: null },
      submittedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    offerLetter: {
      generatedLetterId: { type: mongoose.Schema.Types.ObjectId, ref: "GeneratedLetter", default: null },
      pdfUrl: { type: String, trim: true, default: "" },
      role: { type: String, trim: true, default: "" },
      salary: { type: Number, default: 0 },
      joiningDate: { type: Date, default: null },
      sentAt: { type: Date, default: null },
      emailSentAt: { type: Date, default: null },
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    convertedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
  },
  { timestamps: true, versionKey: false }
);

candidateSchema.pre("save", function saveHook(next) {
  this.lastUpdatedAt = new Date();
  next();
});

candidateSchema.pre("findOneAndUpdate", function updateHook(next) {
  this.set({ lastUpdatedAt: new Date() });
  next();
});

export const Candidate = mongoose.model("Candidate", candidateSchema);
export const CandidateStatuses = candidateStatuses;

// Cleanup legacy unique email index so fresh re-registration can create a new candidate record.
Candidate.on("index", async () => {
  try {
    await Candidate.collection.dropIndex("email_1");
  } catch (error) {
    const message = String(error?.message || "");
    const codeName = String(error?.codeName || "");
    const ignorable =
      error?.code === 27 ||
      codeName === "IndexNotFound" ||
      message.includes("index not found") ||
      message.includes("Operation interrupted because client was closed");
    if (!ignorable) {
      console.warn("[Candidate] Failed dropping legacy email index", { message });
    }
  }
});
