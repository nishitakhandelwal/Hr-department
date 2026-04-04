import mongoose from "mongoose";

const educationSchema = new mongoose.Schema(
  {
    degreeOrDiploma: { type: String, trim: true, default: "" },
    university: { type: String, trim: true, default: "" },
    yearOfPassing: { type: String, trim: true, default: "" },
    percentage: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, default: "" },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    url: { type: String, trim: true, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const joiningFormSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["Requested", "Submitted", "Correction Requested", "Approved", "Rejected"],
      default: "Requested",
      index: true,
    },
    personalInformation: {
      fullName: { type: String, trim: true, default: "" },
      dateOfBirth: { type: String, trim: true, default: "" },
      age: { type: String, trim: true, default: "" },
      maritalStatus: { type: String, trim: true, default: "" },
      placeOfBirth: { type: String, trim: true, default: "" },
      phoneNumber: { type: String, trim: true, default: "" },
      mobileNumber: { type: String, trim: true, default: "" },
      emailAddress: { type: String, trim: true, default: "" },
    },
    familyDetails: {
      fatherName: { type: String, trim: true, default: "" },
      fatherOccupation: { type: String, trim: true, default: "" },
      motherName: { type: String, trim: true, default: "" },
      motherOccupation: { type: String, trim: true, default: "" },
    },
    addressDetails: {
      presentAddress: { type: String, trim: true, default: "" },
      permanentAddress: { type: String, trim: true, default: "" },
    },
    accommodationDetails: { type: String, trim: true, default: "" },
    educationDetails: { type: [educationSchema], default: [] },
    documents: {
      resume: { type: documentSchema, default: () => ({}) },
      photograph: { type: documentSchema, default: () => ({}) },
      certificates: { type: documentSchema, default: () => ({}) },
      idProof: { type: documentSchema, default: () => ({}) },
    },
    declarationAccepted: { type: Boolean, default: false },
    adminRemarks: { type: String, trim: true, default: "" },
    requestedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false }
);

joiningFormSchema.index({ candidateId: 1 }, { unique: true, sparse: true });
joiningFormSchema.index({ userId: 1 }, { unique: true, sparse: true });

export const JoiningForm = mongoose.model("JoiningForm", joiningFormSchema);
