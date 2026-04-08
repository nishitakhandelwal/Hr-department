import mongoose from "mongoose";

const employeeAddressSchema = new mongoose.Schema(
  {
    presentAddress: { type: String, trim: true, default: "" },
    permanentAddress: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const employeeEducationSchema = new mongoose.Schema(
  {
    degreeOrDiploma: { type: String, trim: true, default: "" },
    university: { type: String, trim: true, default: "" },
    yearOfPassing: { type: String, trim: true, default: "" },
    percentage: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const employeeDocumentSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, default: "" },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    url: { type: String, trim: true, default: "" },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: "" },
    accountHolderName: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    ifscCode: { type: String, trim: true, default: "" },
    branchName: { type: String, trim: true, default: "" },
    paymentMode: { type: String, trim: true, default: "Bank Transfer" },
  },
  { _id: false }
);

const salaryStructureSchema = new mongoose.Schema(
  {
    employeeId: { type: String, trim: true, default: "" },
    monthlyGrossSalary: { type: Number, default: 0, min: 0 },
    basicSalaryType: { type: String, enum: ["fixed", "percentage"], default: "percentage" },
    basicSalaryValue: { type: Number, default: 40, min: 0 },
    hraType: { type: String, enum: ["fixed", "percentage"], default: "percentage" },
    hraValue: { type: Number, default: 40, min: 0 },
    specialAllowanceType: { type: String, enum: ["fixed", "percentage", "remainder"], default: "remainder" },
    specialAllowanceValue: { type: Number, default: 0, min: 0 },
    otherAllowance: { type: Number, default: 0, min: 0 },
    basicSalary: { type: Number, default: 0, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    specialAllowance: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    pfEnabled: { type: Boolean, default: false },
    esiEnabled: { type: Boolean, default: false },
    finePerAbsentDay: { type: Number, default: 0, min: 0 },
    finePerLateMark: { type: Number, default: 0, min: 0 },
    overtimeRatePerHour: { type: Number, default: 0, min: 0 },
    isConfigured: { type: Boolean, default: false },
    configuredAt: { type: Date, default: null },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", default: undefined },
    employeeId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    photoUrl: { type: String, trim: true, default: "" },
    profileImage: { type: String, trim: true, default: "" },
    bloodGroup: { type: String, trim: true, default: "" },
    dateOfBirth: { type: Date, default: null },
    department: { type: String, trim: true, default: "" },
    designation: { type: String, required: true, trim: true },
    salary: { type: Number, required: true },
    joiningDate: { type: Date, required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    departmentName: { type: String, trim: true, default: "" },
    address: { type: employeeAddressSchema, default: () => ({}) },
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },
    educationDetails: { type: [employeeEducationSchema], default: [] },
    documents: {
      resume: { type: employeeDocumentSchema, default: () => ({}) },
      photograph: { type: employeeDocumentSchema, default: () => ({}) },
      certificates: { type: employeeDocumentSchema, default: () => ({}) },
      idProof: { type: employeeDocumentSchema, default: () => ({}) },
    },
    salaryStructure: { type: salaryStructureSchema, default: () => ({}) },
    joiningFormCompleted: { type: Boolean, default: false },
    status: { type: String, enum: ["pending_form", "active_employee", "active", "inactive"], default: "pending_form" },
    letters: [{ type: mongoose.Schema.Types.ObjectId, ref: "GeneratedLetter" }],
  },
  { timestamps: true, versionKey: false }
);

employeeSchema.index({ candidateId: 1 }, { sparse: true });

employeeSchema.pre("validate", function syncPhotoFields(next) {
  const normalizedPhotoUrl = String(this.photoUrl || "").trim();
  const normalizedProfileImage = String(this.profileImage || "").trim();

  if (normalizedPhotoUrl && normalizedProfileImage !== normalizedPhotoUrl) {
    this.profileImage = normalizedPhotoUrl;
  } else if (normalizedProfileImage && normalizedPhotoUrl !== normalizedProfileImage) {
    this.photoUrl = normalizedProfileImage;
  }

  next();
});

export const Employee = mongoose.model("Employee", employeeSchema);

// Cleanup legacy unique index that caused duplicate null candidateId errors.
Employee.on("index", async () => {
  try {
    await Employee.collection.dropIndex("candidateId_1");
  } catch (error) {
    const message = String(error?.message || "");
    const codeName = String(error?.codeName || "");
    const ignorable =
      error?.code === 27 ||
      codeName === "IndexNotFound" ||
      message.includes("index not found");
    if (!ignorable) {
      console.warn("[Employee] Failed dropping legacy candidateId index", { message });
    }
  }
});
