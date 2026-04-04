import mongoose from "mongoose";

const roleModuleSchema = new mongoose.Schema(
  {
    dashboard: { type: Boolean, default: true },
    candidates: { type: Boolean, default: true },
    employees: { type: Boolean, default: true },
    attendance: { type: Boolean, default: true },
    payroll: { type: Boolean, default: true },
    letters: { type: Boolean, default: true },
    departments: { type: Boolean, default: true },
    reports: { type: Boolean, default: true },
    userManagement: { type: Boolean, default: true },
    settings: { type: Boolean, default: true },
  },
  { _id: false }
);

const payrollPercentageRuleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    employeeRate: { type: Number, default: 0, min: 0 },
    employerRate: { type: Number, default: 0, min: 0 },
    wageLimit: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const payrollSettingsSchema = new mongoose.Schema(
  {
    workingDaysMode: {
      type: String,
      enum: ["weekdays", "calendar", "fixed"],
      default: "weekdays",
    },
    fixedWorkingDays: { type: Number, default: 26, min: 1, max: 31 },
    standardDailyHours: { type: Number, default: 8, min: 1, max: 24 },
    includePaidLeaveInWages: { type: Boolean, default: true },
    latePenaltyAmount: { type: Number, default: 0, min: 0 },
    absentPenaltyAmount: { type: Number, default: 0, min: 0 },
    overtimeMultiplier: { type: Number, default: 1, min: 0 },
    pf: { type: payrollPercentageRuleSchema, default: () => ({ enabled: true, employeeRate: 12, employerRate: 12, wageLimit: 15000 }) },
    esi: { type: payrollPercentageRuleSchema, default: () => ({ enabled: false, employeeRate: 0.75, employerRate: 3.25, wageLimit: 21000 }) },
  },
  { _id: false }
);

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, default: "global" },
    company: {
      companyName: { type: String, trim: true, default: "" },
      companyLogoUrl: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
      contactEmail: { type: String, trim: true, default: "" },
      contactPhone: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, default: "" },
    },
    rolePermissions: {
      super_admin: { type: roleModuleSchema, default: () => ({}) },
      admin: { type: roleModuleSchema, default: () => ({}) },
      hr_manager: { type: roleModuleSchema, default: () => ({}) },
      recruiter: { type: roleModuleSchema, default: () => ({}) },
      employee: { type: roleModuleSchema, default: () => ({}) },
      candidate: { type: roleModuleSchema, default: () => ({}) },
    },
    security: {
      otpLoginEnabled: { type: Boolean, default: true },
      twoFactorEnforced: { type: Boolean, default: false },
      passwordPolicy: {
        minLength: { type: Number, default: 8 },
        requireUppercase: { type: Boolean, default: true },
        requireNumber: { type: Boolean, default: true },
        requireSpecial: { type: Boolean, default: false },
      },
      sessionTimeoutMinutes: { type: Number, default: 60 },
      maxLoginAttempts: { type: Number, default: 5 },
    },
    notifications: {
      emailNotificationsEnabled: { type: Boolean, default: true },
      candidateApplicationAlerts: { type: Boolean, default: true },
      interviewSchedulingAlerts: { type: Boolean, default: true },
      offerLetterNotifications: { type: Boolean, default: true },
      systemAnnouncements: { type: Boolean, default: true },
    },
    preferences: {
      theme: { type: String, enum: ["light", "dark"], default: "light" },
      defaultDashboardPage: { type: String, trim: true, default: "/admin/dashboard" },
      language: { type: String, trim: true, default: "en" },
      timezone: { type: String, trim: true, default: "Asia/Kolkata" },
      dateFormat: { type: String, trim: true, default: "DD/MM/YYYY" },
      currencyFormat: { type: String, trim: true, default: "INR" },
    },
    documents: {
      allowedFileTypes: {
        type: [String],
        default: ["application/pdf", "image/jpeg", "image/png"],
        validate: {
          validator: (value) => Array.isArray(value) && value.length > 0,
          message: "At least one allowed file type is required.",
        },
      },
      maxUploadSizeMb: { type: Number, min: 1, max: 100, default: 10 },
      storageLocation: { type: String, trim: true, default: "uploads" },
      namingFormat: { type: String, trim: true, default: "{timestamp}-{original}" },
    },
    audit: {
      loggingEnabled: { type: Boolean, default: true },
      retentionDays: { type: Number, min: 1, max: 3650, default: 180 },
    },
    payroll: {
      type: payrollSettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "system_settings",
    strict: "throw",
  }
);

systemSettingsSchema.index({ key: 1 }, { unique: true });

export const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
