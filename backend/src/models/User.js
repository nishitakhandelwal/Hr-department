import mongoose from "mongoose";

const modulePermissionSchema = new mongoose.Schema(
  {
    dashboard: { type: Boolean, default: true },
    candidates: { type: Boolean, default: true },
    employees: { type: Boolean, default: false },
    attendance: { type: Boolean, default: true },
    letters: { type: Boolean, default: false },
    departments: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    settings: { type: Boolean, default: false },
    candidateManagement: { type: Boolean, default: true },
    jobApplications: { type: Boolean, default: true },
    interviews: { type: Boolean, default: true },
    offerLetters: { type: Boolean, default: true },
    reportsAnalytics: { type: Boolean, default: true },
    payroll: { type: Boolean, default: false },
    userManagement: { type: Boolean, default: false },
  },
  { _id: false }
);

const actionPermissionSchema = new mongoose.Schema(
  {
    viewCandidates: { type: Boolean, default: true },
    editCandidateStatus: { type: Boolean, default: false },
    sendInterviewEmails: { type: Boolean, default: false },
    uploadOfferLetters: { type: Boolean, default: false },
    manageUsers: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    phoneNumber: { type: String, trim: true, default: "", index: true },
    profilePhotoUrl: { type: String, trim: true, default: "" },
    profileImage: { type: String, trim: true, default: "" },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "employee", "candidate"], required: true },
    accessRole: {
      type: String,
      enum: ["super_admin", "admin", "hr_manager", "recruiter", "employee", "candidate"],
      default: function accessRoleDefault() {
        if (this.role === "admin") return "admin";
        if (this.role === "candidate") return "candidate";
        return "employee";
      },
    },
    department: { type: String, trim: true, default: "" },
    accountStatus: { type: String, enum: ["active", "disabled", "pending"], default: "active" },
    joiningFormCompleted: { type: Boolean, default: false },
    status: { type: String, enum: ["pending_form", "active_employee"], default: "pending_form" },
    lastLoginAt: { type: Date, default: null },
    forcePasswordReset: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    passwordResetToken: { type: String, default: "" },
    passwordResetTokenExpires: { type: Date, default: null },
    passwordResetOtpHash: { type: String, default: "" },
    passwordResetOtpExpiresAt: { type: Date, default: null },
    passwordResetOtpAttempts: { type: Number, default: 0 },
    passwordResetOtpSentAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String, default: "" },
    otpExpiry: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
    otpLastSentAt: { type: Date, default: null },
    otpChannel: { type: String, enum: ["sms", "email"], default: "sms" },
    emailVerificationOtpHash: { type: String, default: "" },
    emailVerificationOtpExpiresAt: { type: Date, default: null },
    emailVerificationOtpAttempts: { type: Number, default: 0 },
    emailVerificationOtpSentAt: { type: Date, default: null },
    twoFactorCodeHash: { type: String, default: "" },
    twoFactorCodeExpiresAt: { type: Date, default: null },
    permissions: {
      modules: { type: modulePermissionSchema, default: () => ({}) },
      actions: { type: actionPermissionSchema, default: () => ({}) },
      pageAccess: { type: [String], default: [] },
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

userSchema.pre("save", function saveHook(next) {
  this.updatedAt = new Date();
  this.isActive = this.accountStatus !== "disabled";
  if (this.role !== "employee" && !this.status) {
    this.status = "active_employee";
  }
  if (this.role !== "employee" && this.joiningFormCompleted === false) {
    this.joiningFormCompleted = true;
  }
  if (this.role === "employee" && this.status === "active_employee") {
    this.joiningFormCompleted = true;
  }
  if (this.role === "employee" && this.joiningFormCompleted) {
    this.status = "active_employee";
  }
  const normalizedPhone = String(this.phone || "").trim();
  const normalizedPhoneNumber = String(this.phoneNumber || "").trim();
  const normalizedProfilePhotoUrl = String(this.profilePhotoUrl || "").trim();
  const normalizedProfileImage = String(this.profileImage || "").trim();
  if (!normalizedPhoneNumber && normalizedPhone) {
    this.phoneNumber = normalizedPhone;
  }
  if (!normalizedPhone && normalizedPhoneNumber) {
    this.phone = normalizedPhoneNumber;
  }
  if (!normalizedProfileImage && normalizedProfilePhotoUrl) {
    this.profileImage = normalizedProfilePhotoUrl;
  }
  if (!normalizedProfilePhotoUrl && normalizedProfileImage) {
    this.profilePhotoUrl = normalizedProfileImage;
  }
  next();
});

userSchema.pre("findOneAndUpdate", function updateHook(next) {
  const update = this.getUpdate() || {};
  const nextStatus = update.accountStatus ?? update.$set?.accountStatus;
  const setPayload = { ...(update.$set || {}), updatedAt: new Date() };
  const nextPhone = typeof setPayload.phone === "string" ? setPayload.phone.trim() : undefined;
  const nextPhoneNumber = typeof setPayload.phoneNumber === "string" ? setPayload.phoneNumber.trim() : undefined;
  const nextProfilePhotoUrl = typeof setPayload.profilePhotoUrl === "string" ? setPayload.profilePhotoUrl.trim() : undefined;
  const nextProfileImage = typeof setPayload.profileImage === "string" ? setPayload.profileImage.trim() : undefined;
  if (nextStatus) {
    setPayload.isActive = nextStatus !== "disabled";
  }
  const nextRole = update.role ?? update.$set?.role;
  const nextEmployeeStatus = update.status ?? update.$set?.status;
  const nextJoiningFormCompleted = update.joiningFormCompleted ?? update.$set?.joiningFormCompleted;
  if (nextRole && nextRole !== "employee") {
    setPayload.status = "active_employee";
    setPayload.joiningFormCompleted = true;
  }
  if (nextEmployeeStatus === "active_employee") {
    setPayload.joiningFormCompleted = true;
  }
  if (nextJoiningFormCompleted === true) {
    setPayload.status = "active_employee";
  }
  if (typeof nextPhone === "string" && !nextPhoneNumber) {
    setPayload.phone = nextPhone;
    setPayload.phoneNumber = nextPhone;
  }
  if (typeof nextPhoneNumber === "string" && !nextPhone) {
    setPayload.phoneNumber = nextPhoneNumber;
    setPayload.phone = nextPhoneNumber;
  }
  if (typeof nextProfilePhotoUrl === "string" && !nextProfileImage) {
    setPayload.profilePhotoUrl = nextProfilePhotoUrl;
    setPayload.profileImage = nextProfilePhotoUrl;
  }
  if (typeof nextProfileImage === "string" && !nextProfilePhotoUrl) {
    setPayload.profileImage = nextProfileImage;
    setPayload.profilePhotoUrl = nextProfileImage;
  }
  this.setUpdate({ ...update, $set: setPayload });
  next();
});

export const User = mongoose.model("User", userSchema);
