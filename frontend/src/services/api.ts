import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

const TOKEN_KEY = "hr_auth_token";
const USER_KEY = "hr_auth_user";
const REMEMBER_ME_KEY = "hr_auth_remember";
const AUTH_COOKIE_KEY = "hr_auth_token";

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
});

const inflightGetRequests = new Map<string, Promise<AxiosResponse<unknown>>>();
const stableStringify = (value: unknown): string => {
  if (!value || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
};
const buildGetRequestKey = (url: string, config?: AxiosRequestConfig) =>
  stableStringify({
    baseURL: config?.baseURL || API_BASE_URL,
    url,
    params: config?.params || null,
    responseType: config?.responseType || "json",
  });
const originalGet = api.get.bind(api);

api.get = (<T = unknown, R = AxiosResponse<T>, D = unknown>(url: string, config?: AxiosRequestConfig<D>) => {
  const key = buildGetRequestKey(url, config);
  const existing = inflightGetRequests.get(key);
  if (existing) return existing as Promise<R>;

  const request = originalGet<T, R, D>(url, config).finally(() => {
    inflightGetRequests.delete(key);
  }) as Promise<R>;
  inflightGetRequests.set(key, request as Promise<AxiosResponse<unknown>>);
  return request;
}) as typeof api.get;

export type ApiClientError = Error & {
  status?: number;
};

export const isUnauthorizedError = (error: unknown) => {
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    status === 401 ||
    message.includes("unauthorized") ||
    message.includes("missing token") ||
    message.includes("invalid token") ||
    message.includes("session expired")
  );
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    let message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      (typeof error?.message === "string" ? error.message : "Request failed");

    if (typeof Blob !== "undefined" && error?.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        if (text) {
          try {
            const parsed = JSON.parse(text) as { message?: string; error?: string };
            message = parsed.message || parsed.error || message;
          } catch {
            message = text;
          }
        }
      } catch {
        // Fall back to the original message when the blob cannot be parsed.
      }
    }

    const apiError = new Error(message) as ApiClientError;
    apiError.status = error?.response?.status;
    return Promise.reject(apiError);
  }
);

export const authStorage = {
  tokenKey: TOKEN_KEY,
  userKey: USER_KEY,
  set(token: string, user: unknown, rememberMe = true) {
    const storage = rememberMe ? localStorage : sessionStorage;
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "1" : "0");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
    if (typeof document !== "undefined") {
      const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
      document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    if (typeof document !== "undefined") {
      document.cookie = `${AUTH_COOKIE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }
  },
  getToken() {
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token && typeof document !== "undefined" && !document.cookie.includes(`${AUTH_COOKIE_KEY}=`)) {
      document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    }
    return token;
  },
  getUser<T>() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  getRememberMe() {
    return localStorage.getItem(REMEMBER_ME_KEY) !== "0";
  },
};

const resolveEntityId = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    if (typeof (value as { toHexString?: unknown }).toHexString === "function") {
      return String((value as { toHexString: () => string }).toHexString());
    }
    if (typeof (value as { toString?: unknown }).toString === "function") {
      const directString = String(value);
      if (directString && directString !== "[object Object]") return directString;
    }
    const record = value as { _id?: unknown; id?: unknown };
    if (typeof record._id === "string") return record._id;
    if (typeof record.id === "string") return record.id;
    if (record._id) return resolveEntityId(record._id);
    if (record.id) return resolveEntityId(record.id);
  }
  return "";
};

const normalizeCandidateRecord = (candidate: CandidateRecord): CandidateRecord => {
  const normalizedId = resolveEntityId(candidate._id) || resolveEntityId(candidate.id) || "";
  return {
    ...candidate,
    _id: normalizedId,
    id: candidate.id || normalizedId,
  };
};

const normalizeJoiningFormRecord = (form: JoiningFormRecord): JoiningFormRecord => {
  const normalizedId = resolveEntityId(form._id) || "";
  const normalizedCandidate =
    form.candidateId && typeof form.candidateId === "object"
      ? normalizeCandidateRecord(form.candidateId as CandidateRecord)
      : resolveEntityId(form.candidateId);
  const normalizedUserId =
    form.userId && typeof form.userId === "object"
      ? {
          ...(form.userId as { _id?: string; name?: string; email?: string }),
          _id: resolveEntityId((form.userId as { _id?: unknown })._id) || resolveEntityId(form.userId),
        }
      : resolveEntityId(form.userId);

  return {
    ...form,
    _id: normalizedId,
    candidateId: normalizedCandidate,
    userId: normalizedUserId,
  };
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};
export type ApiServiceResponse<T> = ApiResponse<T>;

export type CandidateStatus =
  | "Draft"
  | "Applied"
  | "Profile Completed"
  | "HR Review"
  | "Under Review"
  | "Interview"
  | "Interview Scheduled"
  | "Selected"
  | "Internship"
  | "Offered"
  | "Joining Form Requested"
  | "Joining Form Submitted"
  | "Joining Form Correction Requested"
  | "Joining Form Rejected"
  | "Employee Onboarding"
  | "Converted to Employee"
  | "Accepted"
  | "Rejected";

export type CandidateWorkflowConfig = {
  statuses: CandidateStatus[];
  transitions: Partial<Record<CandidateStatus, CandidateStatus[]>>;
  legacyStatusMap?: Record<string, CandidateStatus>;
};

export type CandidateRecord = {
  _id: string;
  id?: string;
  userId?: string | null;
  fullName: string;
  email: string;
  phone?: string;
  positionApplied?: string;
  status: CandidateStatus;
  stage1: {
    personalDetails: {
      dateOfBirth?: string;
      fatherName?: string;
      motherName?: string;
      maritalStatus?: string;
      presentResidentialAccommodation?: string;
      domicile?: string;
    };
    contactDetails: {
      alternatePhone?: string;
      currentAddress?: string;
      permanentAddress?: string;
    };
    qualificationDetails: {
      highestQualification?: string;
      qualifications: Array<{
        degree?: string;
        institute?: string;
        year?: string;
        percentage?: string;
      }>;
    };
    declarationAccepted: boolean;
    submittedAt?: string;
  };
  resumeUrl?: string;
  resumeFileName?: string;
  interviewSchedule?: {
    date?: string;
    time?: string;
    meetingLink?: string;
    mode?: string;
    notes?: string;
  };
  documents?: {
    resume?: { documentId?: string; fieldId?: string; label?: string; categoryId?: string; categoryLabel?: string; url?: string; originalName?: string; mimeType?: string; size?: number; uploadedAt?: string | null };
    certificates?: { documentId?: string; fieldId?: string; label?: string; categoryId?: string; categoryLabel?: string; url?: string; originalName?: string; mimeType?: string; size?: number; uploadedAt?: string | null };
    uploadedFiles?: Array<{ documentId?: string; fieldId?: string; label?: string; categoryId?: string; categoryLabel?: string; url?: string; originalName?: string; mimeType?: string; size?: number; uploadedAt?: string | null }>;
  };
  videoIntroduction?: {
    url?: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
    source?: "recorded" | "uploaded" | "";
    uploadedAt?: string | null;
    adminFeedback?: string;
    adminRating?: number | null;
    reviewedAt?: string | null;
  };
  stage2SubmittedAt?: string;
  stage2Details: {
    experienceDetails?: string;
    references: Array<{
      name?: string;
      relationship?: string;
      company?: string;
      contact?: string;
      email?: string;
    }>;
    employmentHistory: Array<{
      company?: string;
      designation?: string;
      from?: string;
      to?: string;
      responsibilities?: string;
    }>;
    expectedSalary?: number;
    noticePeriod?: string;
    managementAssessment: {
      communication?: string;
      technicalSkill?: string;
      attitude?: string;
      leadership?: string;
    };
    candidateRemarks?: string;
  };
  adminReview?: {
    evaluationRemarks?: string;
    adminNotes?: string;
    rating?: number | null;
    reviewedAt?: string;
  };
  internship?: {
    isAssigned?: boolean;
    status?: "Not Assigned" | "Assigned" | "In Progress" | "Approved" | "Rejected" | "Extended";
    startDate?: string | null;
    endDate?: string | null;
    extensionDate?: string | null;
    remarks?: string;
    updatedAt?: string | null;
  };
  joiningForm?: {
    isUnlocked?: boolean;
    status?: "Locked" | "Requested" | "Submitted" | "Correction Requested" | "Approved" | "Rejected";
    unlockedAt?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
  };
  offerLetter?: {
    generatedLetterId?: string | null;
    pdfUrl?: string;
    role?: string;
    salary?: number;
    joiningDate?: string | null;
    sentAt?: string | null;
    emailSentAt?: string | null;
  };
  convertedEmployeeId?: string | null;
  departmentId?: string | null;
  stageCompleted?: number;
  submittedAt?: string;
  lastUpdatedAt?: string;
  activityTimeline?: Array<{
    key: string;
    title: string;
    description: string;
    at: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type NotificationItem = {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export type EventItem = {
  _id: string;
  title: string;
  date: string;
  type: "holiday" | "birthday" | "meeting" | "reminder";
  userId?: string | null;
  createdBy?: string | null;
  timeLabel?: string;
  details?: string;
  source?: "system" | "manual";
  canEdit?: boolean;
  canDelete?: boolean;
};

export type HolidayItem = {
  _id: string;
  title: string;
  date: string;
  country: string;
  type: string;
  isCustom: boolean;
  source: "system" | "api" | "manual";
};

export type OfficeLocationRecord = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt?: string;
  updatedAt?: string;
};

export type GeoFenceValidationLocation = OfficeLocationRecord & {
  distanceMeters: number;
  withinRadius: boolean;
};

export type GeoFenceValidationResult = {
  matched: boolean;
  message: string;
  matchedLocation: GeoFenceValidationLocation | null;
  nearestLocation: GeoFenceValidationLocation | null;
  evaluatedLocations: GeoFenceValidationLocation[];
};

export type AttendanceRecord = {
  _id: string;
  employeeId?:
    | string
    | {
        _id?: string;
        fullName?: string;
        userId?: {
          _id?: string;
          name?: string;
          email?: string;
        };
      };
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status?: string;
  isManual?: boolean;
  checkInLocation?: {
    latitude: number;
    longitude: number;
    officeLocationId?: string | null;
    officeName?: string;
    distanceMeters?: number;
    radiusMeters?: number;
    capturedAt?: string;
  };
  checkOutLocation?: {
    latitude: number;
    longitude: number;
    officeLocationId?: string | null;
    officeName?: string;
    distanceMeters?: number;
    radiusMeters?: number;
    capturedAt?: string;
  };
  updatedBy?: string | { _id?: string; name?: string; email?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AttendanceCorrectionRequestRecord = {
  _id: string;
  userId?: string | { _id?: string; name?: string; email?: string };
  employeeId?:
    | string
    | {
        _id?: string;
        fullName?: string;
        employeeId?: string;
        userId?: { _id?: string; name?: string; email?: string };
      };
  date: string;
  type: "check-in" | "check-out";
  time: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  adminRemarks?: string;
  reviewedBy?: string | { _id?: string; name?: string; email?: string };
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeRecord = {
  _id: string;
  userId: string | {
    _id: string;
    name: string;
    email: string;
    role: "admin" | "employee" | "candidate";
    department?: string;
    isActive?: boolean;
  };
  employeeId: string;
  fullName: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  profileImage?: string;
  bloodGroup?: string;
  dateOfBirth?: string | null;
  department?: string;
  designation: string;
  salary: number;
  joiningDate: string;
  address?: {
    presentAddress?: string;
    permanentAddress?: string;
  };
  bankDetails?: {
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branchName?: string;
    paymentMode?: string;
  };
  educationDetails?: Array<{
    degreeOrDiploma?: string;
    university?: string;
    yearOfPassing?: string;
    percentage?: string;
  }>;
  documents?: {
    photograph?: {
      url?: string;
      originalName?: string;
      uploadedAt?: string | null;
    };
  };
  status?: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type JoiningFormPrefillData = {
  fullName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
  age?: string;
  maritalStatus?: string;
  placeOfBirth?: string;
  fatherName?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherOccupation?: string;
  presentAddress?: string;
  permanentAddress?: string;
  accommodationDetails?: string;
  educationDetails?: Array<{
    degreeOrDiploma?: string;
    university?: string;
    yearOfPassing?: string;
    percentage?: string;
  }>;
};

export type InternshipRecord = {
  _id: string;
  candidateId: string | CandidateRecord;
  startDate: string;
  endDate: string;
  status: "Assigned" | "In Progress" | "Approved" | "Rejected" | "Extended" | "Completed";
  notes?: string;
  extensionReason?: string;
  extendedTill?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JoiningFormRecord = {
  _id: string;
  candidateId: string | CandidateRecord;
  userId?: string | { _id: string; name?: string; email?: string };
  status: "Requested" | "Submitted" | "Correction Requested" | "Approved" | "Rejected";
  personalInformation?: {
    fullName?: string;
    dateOfBirth?: string;
    age?: string;
    maritalStatus?: string;
    placeOfBirth?: string;
    phoneNumber?: string;
    mobileNumber?: string;
    emailAddress?: string;
  };
  familyDetails?: {
    fatherName?: string;
    fatherOccupation?: string;
    motherName?: string;
    motherOccupation?: string;
  };
  addressDetails?: {
    presentAddress?: string;
    permanentAddress?: string;
  };
  accommodationDetails?: string;
  educationDetails?: Array<{
    degreeOrDiploma?: string;
    university?: string;
    yearOfPassing?: string;
    percentage?: string;
  }>;
  documents?: {
    resume?: { url?: string; originalName?: string };
    photograph?: { url?: string; originalName?: string };
    certificates?: { url?: string; originalName?: string };
    idProof?: { url?: string; originalName?: string };
  };
  declarationAccepted?: boolean;
  adminRemarks?: string;
  requestedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PayrollRecord = {
  _id: string;
  employeeId: string | EmployeeRecord;
  payrollId: string;
  employeeName: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  joiningDate?: string | null;
  location?: string;
  bankDetails?: {
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branchName?: string;
    paymentMode?: string;
  };
  month: string;
  monthNumber: number;
  year: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  overtimeHours: number;
  totalWorkingDays: number;
  payableDays: number;
  fullWages: number;
  earnedWages?: number;
  basicSalary: number;
  hra: number;
  allowances: number;
  specialAllowance: number;
  bonus: number;
  grossSalary?: number;
  overtimePay: number;
  employerPf?: number;
  employerEsi?: number;
  deductions: number;
  tax: number;
  fineAmount: number;
  pfEmployee: number;
  esiEmployee: number;
  advanceDeduction?: number;
  advanceDeductions?: Array<{ advanceId: string; amount: number }>;
  totalDeductions: number;
  attendanceSalary?: number;
  netSalary: number;
  earnings?: Array<{ label: string; amount: number }>;
  deductionBreakdown?: Array<{ label: string; amount: number }>;
  amountInWords?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdvanceRecord = {
  _id: string;
  employeeId: string;
  employee: {
    _id: string;
    employeeId: string;
    fullName: string;
    designation?: string;
    department?: string;
  } | null;
  amount: number;
  remainingAmount: number;
  recoveredAmount: number;
  status: "pending" | "partially_deducted" | "completed" | "cancelled";
  notes?: string;
  deductions?: Array<{
    payrollId?: string;
    monthNumber: number;
    year: number;
    amount: number;
    deductedAt?: string | null;
  }>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PayrollSettings = {
  workingDaysMode: "weekdays" | "calendar" | "fixed";
  fixedWorkingDays: number;
  standardDailyHours: number;
  includePaidLeaveInWages: boolean;
  latePenaltyAmount: number;
  absentPenaltyAmount: number;
  overtimeMultiplier: number;
  pf: {
    enabled: boolean;
    employeeRate: number;
    employerRate: number;
    wageLimit: number;
  };
  esi: {
    enabled: boolean;
    employeeRate: number;
    employerRate: number;
    wageLimit: number;
  };
};

type PasswordResetPayload = {
  success: boolean;
  message: string;
  data?: {
    email?: string;
    expiresInSeconds?: number;
    resendCooldownSeconds?: number;
  };
};

type ExportModuleResult = {
  blob: Blob;
  fileName?: string;
};

type ExportModuleRequest = {
  moduleName: string;
  type: "csv" | "excel" | "pdf";
  filters?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
  columns?: string[];
  reportTitle?: string;
  sheetName?: string;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  profilePhotoUrl?: string;
  profileImage?: string;
  role: "admin" | "employee" | "candidate";
  accessRole?: "super_admin" | "admin" | "hr_manager" | "recruiter" | "employee" | "candidate";
  accountStatus?: "active" | "disabled" | "pending";
  department?: string;
  isActive?: boolean;
  isVerified?: boolean;
  permissions?: {
    modules?: Record<string, boolean>;
    actions?: Record<string, boolean>;
    pageAccess?: string[];
  };
  twoFactorEnabled?: boolean;
  forcePasswordReset?: boolean;
};

type AuthPayload = {
  success: boolean;
  token?: string;
  user?: AuthUser;
  requiresTwoFactor?: boolean;
  mustResetPassword?: boolean;
  message?: string;
  attemptsRemaining?: number;
};

export type OtpChannel = "sms" | "email";

type OtpSendPayload = {
  success: boolean;
  message: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  channel: OtpChannel;
  destination: string;
  provider?: string;
};

type RegistrationVerificationPayload = {
  success: boolean;
  message: string;
  data: {
    email: string;
    expiresInSeconds: number;
    resendCooldownSeconds: number;
  };
};

type LetterEmailPayload = {
  letterType: string;
  formData: unknown;
  htmlContent: string;
  employeeEmail: string;
  candidateId?: string;
};

export type UserAccessRole = "super_admin" | "admin" | "hr_manager" | "recruiter" | "employee" | "candidate";
export type UserAccountStatus = "active" | "disabled" | "pending";

export type ManagedUser = {
  _id: string;
  name: string;
  email: string;
  profilePhotoUrl?: string;
  profileImage?: string;
  role: "admin" | "employee" | "candidate";
  accessRole: UserAccessRole;
  department?: string;
  accountStatus: UserAccountStatus;
  lastLoginAt?: string | null;
  forcePasswordReset?: boolean;
  twoFactorEnabled?: boolean;
  permissions?: {
    modules: Record<string, boolean>;
    actions: Record<string, boolean>;
    pageAccess: string[];
  };
  createdAt: string;
  updatedAt?: string;
};

export type DeleteManagedUserResult = {
  user: ManagedUser | Record<string, unknown>;
  deletionSummary: Record<string, number>;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type UserActivityLog = {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
};

export type AuditLogItem = {
  _id: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type SettingsPayload = {
  company: {
    companyName: string;
    companyLogoUrl?: string;
    address: string;
    contactEmail: string;
    contactPhone: string;
    website: string;
    description: string;
  };
  rolePermissions: Record<
    "super_admin" | "admin" | "hr_manager" | "recruiter" | "employee" | "candidate",
    {
      dashboard: boolean;
      candidates: boolean;
      employees: boolean;
      attendance: boolean;
      payroll: boolean;
      letters: boolean;
      departments: boolean;
      reports: boolean;
      userManagement: boolean;
      settings: boolean;
    }
  >;
  security: {
    otpLoginEnabled: boolean;
    twoFactorEnforced: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireNumber: boolean;
      requireSpecial: boolean;
    };
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
  };
  notifications: {
    emailNotificationsEnabled: boolean;
    candidateApplicationAlerts: boolean;
    interviewSchedulingAlerts: boolean;
    offerLetterNotifications: boolean;
    systemAnnouncements: boolean;
  };
  preferences: {
    theme: "light" | "dark";
    defaultDashboardPage: string;
    language: string;
    timezone: string;
    dateFormat: string;
    currencyFormat: string;
  };
  documents: {
    allowedFileTypes: string[];
    maxUploadSizeMb: number;
    storageLocation: string;
    namingFormat: string;
    candidateFields: Array<{
      fieldId: string;
      label: string;
      status: "required" | "optional" | "disabled";
    }>;
    certificateTypes: Array<{
      typeId: string;
      label: string;
    }>;
  };
  audit: {
    loggingEnabled: boolean;
    retentionDays: number;
  };
};

export type PublicSettingsPayload = {
  company: SettingsPayload["company"];
  preferences: SettingsPayload["preferences"];
  security: {
    otpLoginEnabled: boolean;
  };
  documents: Pick<SettingsPayload["documents"], "allowedFileTypes" | "maxUploadSizeMb" | "candidateFields" | "certificateTypes">;
};

export type RuntimePermissionMap = Record<string, Record<string, boolean>>;

export type RuntimeNavigationItem = {
  id: string;
  path: string;
  labelKey: string;
  icon: string;
  featureKey?: string;
  moduleKey?: string;
};

export type RuntimeRouteGuard = {
  enabled: boolean;
  featureKey?: string;
  moduleKey?: string;
  permissionKey?: string;
  roles?: string[];
  accessRoles?: string[];
};

export type RuntimeConfigPayload = {
  company: SettingsPayload["company"];
  preferences: SettingsPayload["preferences"];
  security: PublicSettingsPayload["security"];
  features: Record<string, boolean>;
  labels: Record<string, string>;
  permissions: RuntimePermissionMap;
  theme: {
    primaryColor: string;
    mode: "light" | "dark";
  };
  portalVisibility: Record<string, boolean>;
  navigation: Record<string, RuntimeNavigationItem[]>;
  routes: Record<string, RuntimeRouteGuard>;
};

// Calendar types
export type CalendarEventType = "holiday" | "birthday" | "meeting" | "reminder";

export type CalendarEvent = {
  _id: string;
  title: string;
  date: string;
  type: CalendarEventType;
  time?: string;
  description?: string;
  color?: string;
  source?: "system" | "manual";
  isToday?: boolean;
  isTomorrow?: boolean;
};

export type CalendarMonth = {
  month: number;
  year: number;
  country?: string;
  events: CalendarEvent[];
  totalEvents: number;
};

export type UpcomingEventsDay = {
  date: string;
  isToday?: boolean;
  isTomorrow?: boolean;
  events: CalendarEvent[];
  totalEvents: number;
};

export type UpcomingEventsList = {
  days: number;
  country?: string;
  totalEvents: number;
  upcomingDays: UpcomingEventsDay[];
  allEvents: CalendarEvent[];
};

const uploadProfilePhotoRequest = async (file: File) => {
  const formData = new FormData();
  formData.append("profileImage", file);
  const { data } = await api.post<{ success: boolean; message: string; data: { imageUrl: string; user: AuthUser } }>(
    "/upload-profile",
    formData
  );
  return data.data.user;
};

export const apiService = {
  async login(email: string, password: string, otp?: string) {
    const { data } = await api.post<AuthPayload>("/auth/login", {
      email,
      password,
      otp,
    });
    return data;
  },
  async register(payload: { name: string; email: string; password: string; role: "admin" | "employee" | "candidate" }) {
    const { data } = await api.post<{ success: boolean; user: AuthUser }>("/auth/register", payload);
    return data.user;
  },
  async registerCandidate(payload: { name: string; email: string; password: string }) {
    const { data } = await api.post<RegistrationVerificationPayload>("/auth/register-candidate", payload);
    return data.data;
  },
  async verifyRegistrationOtp(payload: { email: string; otp: string }) {
    const { data } = await api.post<{ success: boolean; message: string }>("/auth/verify-registration-otp", payload);
    return data;
  },
  async resendRegistrationOtp(email: string) {
    const { data } = await api.post<RegistrationVerificationPayload>("/auth/resend-registration-otp", { email });
    return data.data;
  },
  async me() {
    const { data } = await api.get<{ success: boolean; user: AuthUser }>("/auth/me");
    return data.user;
  },
  async uploadMyProfilePhoto(file: File) {
    return uploadProfilePhotoRequest(file);
  },
  async updateMyProfilePhoto(file: File) {
    return uploadProfilePhotoRequest(file);
  },
  async uploadFile(file: File, type?: "profile" | "resume" | "idcard" | "document") {
    const formData = new FormData();
    formData.append("file", file);
    if (type) formData.append("type", type === "document" ? "document" : type);
    const { data } = await api.post<
      ApiResponse<{
        type: string;
        folder: string;
        key: string;
        url: string;
        bucket: string;
        region: string;
        originalName: string;
        mimeType: string;
        size: number;
      }>
    >("/upload", formData);
    return data.data;
  },
  async removeMyProfilePhoto() {
    const { data } = await api.delete<{ success: boolean; message: string; user: AuthUser }>("/auth/remove-profile-image");
    return data.user;
  },
  async updateUserProfileImage(userId: string, file: File) {
    const formData = new FormData();
    formData.append("profilePhoto", file);
    const { data } = await api.put<{ success: boolean; message: string; data: ManagedUser }>(
      `/users/${userId}/profile-image`,
      formData
    );
    return data.data;
  },
  async removeUserProfileImage(userId: string) {
    const { data } = await api.delete<{ success: boolean; message: string; data: ManagedUser }>(`/users/${userId}/profile-image`);
    return data.data;
  },
  async uploadEmployeePhoto(employeeId: string, file: File) {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await api.put<ApiResponse<EmployeeRecord>>(`/employee/${employeeId}/photo`, formData);
    return data.data;
  },
  async removeEmployeePhoto(employeeId: string) {
    const { data } = await api.delete<ApiResponse<EmployeeRecord>>(`/employee/${employeeId}/photo`);
    return data.data;
  },
  async logout() {
    const { data } = await api.post<{ success: boolean; message: string }>("/auth/logout");
    return data;
  },
  async requestPasswordReset(email: string) {
    const { data } = await api.post<PasswordResetPayload>("/auth/forgot-password", { email });
    return data;
  },
  async sendOtp(payload: { phoneNumber?: string; email?: string; channel?: OtpChannel; resend?: boolean }) {
    const { data } = await api.post<OtpSendPayload>("/auth/send-otp", payload);
    return data;
  },
  async verifyOtp(payload: { phoneNumber?: string; email?: string; otp: string; channel?: OtpChannel }) {
    const { data } = await api.post<AuthPayload>("/auth/verify-otp", payload);
    return data;
  },
  async resetPassword(token: string, password: string) {
    const { data } = await api.post<{ success: boolean; message: string }>(
      `/auth/reset-password/${encodeURIComponent(token)}`,
      { password }
    );
    return data;
  },
  async resetPasswordWithOtp(payload: { email: string; otp: string; password: string }) {
    const { data } = await api.post<{ success: boolean; message: string }>("/auth/reset-password", payload);
    return data;
  },
  async resendPasswordResetOtp(email: string) {
    const { data } = await api.post<PasswordResetPayload>("/auth/forgot-password", { email, resend: true });
    return data;
  },
  async list<T>(resource: string) {
    const { data } = await api.get<ApiResponse<T[]>>(`/${resource}`);
    return data.data;
  },
  async getPayroll(params?: { month?: number; year?: number }) {
    const { data } = await api.get<ApiResponse<PayrollRecord[]>>("/payroll", { params });
    return data.data;
  },
  async getPayrollSummary(params?: { month?: number; year?: number }) {
    const { data } = await api.get<
      ApiResponse<{
        totalPayroll: number;
        processedEmployees: number;
        pendingEmployees: number;
        month: string;
        monthNumber: number;
        year: number;
        employeesMissingSalary?: number;
      }>
    >("/payroll/summary", { params });
    return data.data;
  },
  async runPayroll(payload: { month: number; year: number }) {
    const { data } = await api.post<
      ApiResponse<{
        records: PayrollRecord[];
        advances?: AdvanceRecord[];
        summary: {
          totalPayroll: number;
          processedEmployees: number;
          pendingEmployees: number;
          month: string;
          monthNumber: number;
          year: number;
          employeesMissingSalary?: number;
        };
        skippedEmployees?: Array<{ employeeId: string; employeeName: string; reason: string }>;
        skipped?: Array<{ employeeId: string; employeeName: string; reason: string }>;
      }>
    >("/payroll/run", payload);
    return data;
  },
  async listPayrollAdvances(params?: { status?: string }) {
    const { data } = await api.get<ApiResponse<AdvanceRecord[]>>("/payroll/advances", { params });
    return data.data;
  },
  async createPayrollAdvance(payload: { employeeId: string; amount: number; notes?: string }) {
    const { data } = await api.post<ApiResponse<AdvanceRecord>>("/payroll/advances", payload);
    return data.data;
  },
  async updatePayrollAdvance(advanceId: string, payload: { status?: AdvanceRecord["status"]; remainingAmount?: number; notes?: string }) {
    const { data } = await api.patch<ApiResponse<AdvanceRecord>>(`/payroll/advances/${advanceId}`, payload);
    return data.data;
  },
  async getPayrollConfig() {
    const { data } = await api.get<ApiResponse<PayrollSettings>>("/payroll/config");
    return data.data;
  },
  async updatePayrollConfig(payload: PayrollSettings) {
    const { data } = await api.put<ApiResponse<PayrollSettings>>("/payroll/config", payload);
    return data.data;
  },
  async downloadPayrollPayslip(payrollId: string) {
    const response = await api.get(`/payroll/${payrollId}/payslip`, { responseType: "blob" });
    const disposition = String(response.headers["content-disposition"] || "");
    const match = disposition.match(/filename="?([^"]+)"?/i);
    return {
      blob: response.data as Blob,
      fileName: match?.[1],
    };
  },
  async updateEmployeeSalaryStructure(
    employeeId: string,
    payload: {
      monthlyGrossSalary?: number;
      basicSalaryType?: "fixed" | "percentage";
      basicSalaryValue?: number;
      hraType?: "fixed" | "percentage";
      hraValue?: number;
      specialAllowanceType?: "fixed" | "percentage" | "remainder";
      specialAllowanceValue?: number;
      otherAllowance?: number;
      basicSalary: number;
      hra: number;
      allowances: number;
      specialAllowance?: number;
      bonus: number;
      deductions: number;
      tax: number;
      pfEnabled?: boolean;
      esiEnabled?: boolean;
      finePerAbsentDay?: number;
      finePerLateMark?: number;
      overtimeRatePerHour?: number;
    }
  ) {
    const { data } = await api.put<ApiResponse<Record<string, unknown>>>(`/employee/${employeeId}/salary-structure`, payload);
    return data.data;
  },
  async listEmployees() {
    const { data } = await api.get<ApiResponse<EmployeeRecord[]>>("/employee");
    return data.data;
  },
  async getEmployeeById(employeeId: string) {
    const { data } = await api.get<ApiResponse<EmployeeRecord>>(`/employee/${employeeId}`);
    return data.data;
  },
  async createEmployee(payload: unknown) {
    const { data } = await api.post<ApiResponse<EmployeeRecord>>("/employee", payload);
    return data.data;
  },
  async updateEmployee(employeeId: string, payload: unknown) {
    const { data } = await api.put<ApiResponse<EmployeeRecord>>(`/employee/${employeeId}`, payload);
    return data.data;
  },
  async deleteEmployee(employeeId: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/employee/${employeeId}`);
    return data.data;
  },
  async exportModule({
    moduleName,
    type,
    filters,
    rows,
    columns,
    reportTitle,
    sheetName,
  }: ExportModuleRequest): Promise<ExportModuleResult> {
    const hasClientRows = Array.isArray(rows) && rows.length > 0;

    let response;
    if (hasClientRows) {
      response = await api.post("/exports", {
        module: moduleName,
        type,
        filters,
        rows,
        columns,
        reportTitle,
        sheetName,
      }, {
        responseType: "blob",
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
    } else {
      response = await api.get("/exports", {
        params: {
          module: moduleName,
          type,
          filters: filters ? JSON.stringify(filters) : undefined,
        },
        responseType: "blob",
        timeout: 120000,
        maxContentLength: Infinity,
      });
    }

    const disposition = String(response.headers["content-disposition"] || "");
    const match = disposition.match(/filename="?([^"]+)"?/i);

    return {
      blob: response.data as Blob,
      fileName: match?.[1],
    };
  },
  async create<T>(resource: string, payload: unknown) {
    const { data } = await api.post<ApiResponse<T>>(`/${resource}`, payload);
    return data.data;
  },
  async getEvents(params?: { month?: number; year?: number }) {
    const { data } = await api.get<ApiResponse<EventItem[]>>("/events", { params });
    return data.data;
  },
  async createEvent(payload: {
    title: string;
    date: string;
    type: EventItem["type"];
    timeLabel?: string;
    details?: string;
  }) {
    const { data } = await api.post<ApiResponse<EventItem>>("/events", payload);
    return data.data;
  },
  async updateEvent(
    id: string,
    payload: {
      title?: string;
      date?: string;
      type?: EventItem["type"];
      timeLabel?: string;
      details?: string;
    }
  ) {
    const { data } = await api.put<ApiResponse<EventItem>>(`/events/${id}`, payload);
    return data.data;
  },
  async deleteEvent(id: string) {
    const { data } = await api.delete<ApiResponse<{ _id: string }>>(`/events/${id}`);
    return data.data;
  },
  async getHolidays(params?: { month?: number; year?: number; country?: string }) {
    const { data } = await api.get<ApiResponse<HolidayItem[]>>("/holidays", { params });
    return data.data;
  },
  async listOfficeLocations() {
    const { data } = await api.get<ApiResponse<OfficeLocationRecord[]>>("/locations");
    return data.data;
  },
  async createOfficeLocation(payload: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }) {
    const { data } = await api.post<ApiResponse<OfficeLocationRecord>>("/locations", payload);
    return data.data;
  },
  async updateOfficeLocation(
    id: string,
    payload: {
      name: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
    }
  ) {
    const { data } = await api.put<ApiResponse<OfficeLocationRecord>>(`/locations/${id}`, payload);
    return data.data;
  },
  async deleteOfficeLocation(id: string) {
    const { data } = await api.delete<ApiResponse<OfficeLocationRecord>>(`/locations/${id}`);
    return data.data;
  },
  async syncHolidays(payload?: { country?: string; year?: number }) {
    const { data } = await api.post<ApiResponse<HolidayItem[]>>("/holidays/sync", payload || {});
    return data.data;
  },
  async getUpcomingHolidays(params?: { days?: number; country?: string }) {
    const { data } = await api.get<ApiResponse<HolidayItem[]>>("/holidays/upcoming", { params });
    return data.data;
  },
  async addCustomHoliday(payload: { title: string; date: string; country?: string }) {
    const { data } = await api.post<ApiResponse<HolidayItem>>("/holidays/custom", payload);
    return data.data;
  },
  async deleteCustomHoliday(id: string) {
    const { data } = await api.delete<ApiResponse<{ _id: string }>>(`/holidays/custom/${id}`);
    return data.data;
  },
  async update<T>(resource: string, id: string, payload: unknown) {
    const { data } = await api.put<ApiResponse<T>>(`/${resource}/${id}`, payload);
    return data.data;
  },
  async patch<T>(resource: string, id: string, payload: unknown) {
    const { data } = await api.patch<ApiResponse<T>>(`/${resource}/${id}`, payload);
    return data.data;
  },
  async remove(resource: string, id: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/${resource}/${id}`);
    return data.data;
  },
  async submitAttendanceCorrection(payload: {
    date: string;
    type: "check-in" | "check-out";
    time: string;
    reason: string;
  }) {
    const { data } = await api.post<ApiResponse<AttendanceCorrectionRequestRecord>>("/attendance/request-correction", payload);
    return data.data;
  },
  async listAttendanceCorrectionRequests() {
    const { data } = await api.get<ApiResponse<AttendanceCorrectionRequestRecord[]>>("/attendance/correction-requests");
    return data.data;
  },
  async validateAttendanceLocation(payload: { latitude: number; longitude: number }) {
    const { data } = await api.post<ApiResponse<GeoFenceValidationResult>>("/attendance/validate-location", payload);
    return data.data;
  },
  async markAttendance(payload: { action: "check-in" | "check-out"; latitude: number; longitude: number }) {
    const { data } = await api.post<
      ApiResponse<{
        attendance: AttendanceRecord;
        validation: GeoFenceValidationResult;
      }>
    >("/attendance/mark", payload);
    return data.data;
  },
  async reviewAttendanceCorrection(
    id: string,
    payload: {
      action: "approved" | "rejected";
      adminRemarks?: string;
    }
  ) {
    const { data } = await api.patch<ApiResponse<AttendanceCorrectionRequestRecord>>(`/attendance/correction/${id}`, payload);
    return data.data;
  },
  async adminOverrideAttendance(payload: {
    employeeId: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    status?: "present" | "late" | "absent" | "leave";
  }) {
    const { data } = await api.post<ApiResponse<AttendanceRecord>>("/attendance/override", payload);
    return data.data;
  },
  async createCandidateApplication(payload: {
    fullName: string;
    email: string;
    phone: string;
    positionApplied: string;
    personalDetails: {
      dateOfBirth: string;
      fatherName: string;
      motherName: string;
      maritalStatus: string;
      presentResidentialAccommodation: string;
      domicile?: string;
    };
    contactDetails: {
      alternatePhone: string;
      currentAddress: string;
      permanentAddress: string;
    };
    qualificationDetails: {
      highestQualification: string;
      qualifications: Array<{
        degree: string;
        institute: string;
        year: string;
        percentage: string;
      }>;
    };
    declarationAccepted: boolean;
  }): Promise<ApiServiceResponse<CandidateRecord>> {
    const { data } = await api.post<ApiResponse<CandidateRecord>>("/candidate", payload);
    return data;
  },
  async getCandidateById(id: string | { _id?: string; id?: string }) {
    const resolvedId = resolveEntityId(id);
    if (!resolvedId || typeof resolvedId !== "string") {
      throw new Error("Invalid candidate ID");
    }
    const { data } = await api.get<ApiResponse<CandidateRecord>>(`/candidate/${resolvedId}`);
    return normalizeCandidateRecord(data.data);
  },
  async listCandidates() {
    const { data } = await api.get<ApiResponse<CandidateRecord[]>>("/candidate");
    return data.data.map(normalizeCandidateRecord);
  },
  async getMyEmployeeProfile() {
    const { data } = await api.get<ApiResponse<EmployeeRecord>>("/employee/me");
    return data.data;
  },
  async getEmployeeDashboardSummary() {
    const { data } = await api.get<
      ApiResponse<{
        attendanceRows: Array<{ date: string; checkOut?: string; hoursWorked?: number }>;
        leaveRows: Array<{ fromDate?: string; toDate?: string; status?: string }>;
        payrollRows: Array<{ month?: string; netSalary?: number }>;
        approvedLeaveDays: number;
        profile?: EmployeeRecord;
      }>
    >("/employee/dashboard-summary");
    return data.data;
  },
  async getMyCandidateApplication() {
    const { data } = await api.get<ApiResponse<CandidateRecord | null>>("/candidate/me");
    return data.data;
  },
  async updateMyCandidateProfile(payload: {
    fullName: string;
    phone: string;
    positionApplied: string;
    stage1: CandidateRecord["stage1"];
    stage2Details: CandidateRecord["stage2Details"];
  }) {
    const { data } = await api.put<ApiResponse<CandidateRecord>>("/candidate/me/profile", payload);
    return data.data;
  },
  async updateMyCandidateDocuments(payload: {
    documents: Record<string, File | null | undefined>;
    certificateTypeId?: string;
  }) {
    const formData = new FormData();
    Object.entries(payload.documents || {}).forEach(([fieldId, file]) => {
      if (file) formData.append(fieldId, file);
    });
    if (payload.certificateTypeId) {
      formData.append("certificateTypeId", payload.certificateTypeId);
    }
    const { data } = await api.put<ApiResponse<CandidateRecord>>("/candidate/me/documents", formData);
    return data.data;
  },
  async deleteMyCandidateDocument(fieldId: string, options?: { documentId?: string }) {
    const { data } = await api.delete<ApiResponse<CandidateRecord>>(`/candidate/me/documents/${encodeURIComponent(fieldId)}`, {
      params: options?.documentId ? { documentId: options.documentId } : undefined,
    });
    return data.data;
  },
  async submitCandidateStage2(payload: {
    noticePeriod: string;
    experienceDetails: string;
    expectedSalary: number;
    references: Array<{
      name: string;
      relationship: string;
      company: string;
      contact: string;
      email: string;
    }>;
    employmentHistory: Array<{
      company: string;
      designation: string;
      from: string;
      to: string;
      responsibilities: string;
    }>;
    managementAssessment: {
      communication: string;
      technicalSkill: string;
      attitude: string;
      leadership: string;
    };
    candidateRemarks: string;
    resume: File;
    onUploadProgress?: (progress: number) => void;
  }) {
    const formData = new FormData();
    formData.append("noticePeriod", payload.noticePeriod);
    formData.append("experienceDetails", payload.experienceDetails);
    formData.append("expectedSalary", String(payload.expectedSalary || 0));
    formData.append("references", JSON.stringify(payload.references || []));
    formData.append("employmentHistory", JSON.stringify(payload.employmentHistory || []));
    formData.append("managementAssessment", JSON.stringify(payload.managementAssessment || {}));
    formData.append("candidateRemarks", payload.candidateRemarks);
    formData.append("resume", payload.resume);

    const { data } = await api.post<ApiResponse<CandidateRecord>>("/candidate/me/stage2", formData, {
      onUploadProgress: (event) => {
        if (!payload.onUploadProgress) return;
        const total = event.total || 0;
        if (total <= 0) return;
        const percent = Math.round((event.loaded * 100) / total);
        payload.onUploadProgress(percent);
      },
    });
    return data.data;
  },
  async uploadCandidateVideo(payload: {
    video: File;
    source: "recorded" | "uploaded";
    onUploadProgress?: (progress: number) => void;
  }) {
    const formData = new FormData();
    formData.append("video", payload.video);
    formData.append("source", payload.source);

    const { data } = await api.post<ApiResponse<CandidateRecord>>("/upload-video", formData, {
      onUploadProgress: (event) => {
        if (!payload.onUploadProgress) return;
        const total = event.total || 0;
        if (total <= 0) return;
        const percent = Math.round((event.loaded * 100) / total);
        payload.onUploadProgress(percent);
      },
    });
    return data.data;
  },
  async reviewCandidateByAdmin(
    id: string,
    payload: {
      evaluationRemarks: string;
      adminNotes?: string;
      rating: number | null;
      status: CandidateStatus;
      interviewSchedule?: CandidateRecord["interviewSchedule"];
      videoFeedback?: string;
      videoRating?: number | null;
    }
  ) {
    const { data } = await api.put<ApiResponse<CandidateRecord>>(`/candidate/${id}/review`, payload);
    return normalizeCandidateRecord(data.data);
  },
  async getCandidateWorkflowConfig() {
    const { data } = await api.get<ApiResponse<CandidateWorkflowConfig>>("/candidate/workflow-config");
    return data.data;
  },
  async updateCandidateStatus(id: string, status: CandidateStatus) {
    const { data } = await api.patch<ApiResponse<CandidateRecord>>(`/candidate/${id}/status`, { status });
    return data.data;
  },
  async assignInternship(
    candidateId: string,
    payload: {
      startDate: string;
      endDate: string;
      notes?: string;
    }
  ) {
    const { data } = await api.post<ApiResponse<{ candidate: CandidateRecord; internship: InternshipRecord }>>(
      `/candidate/${candidateId}/assign-internship`,
      payload
    );
    return data.data;
  },
  async sendOfferLetter(
    candidateId: string,
    payload: {
      role: string;
      salary: number;
      joiningDate: string;
    }
  ) {
    const { data } = await api.post<ApiResponse<CandidateRecord>>(`/candidate/${candidateId}/send-offer`, payload, {
      timeout: 120000,
    });
    return data.data;
  },
  async sendJoiningForm(candidateId: string) {
    const { data } = await api.post<ApiResponse<CandidateRecord>>(`/candidate/${candidateId}/send-joining-form`);
    return data.data;
  },
  async convertCandidate(
    candidateId: string,
    payload?: { departmentId?: string; designation?: string; salary?: number; joiningDate?: string }
  ) {
    const { data } = await api.post<ApiResponse<{ employee: unknown; candidate: CandidateRecord }>>(
      `/candidate/${candidateId}/convert-to-employee`,
      payload || {}
    );
    return data.data;
  },
  async deleteCandidate(id: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/candidate/${id}`);
    return data.data;
  },
  async sendLetterByEmail(payload: LetterEmailPayload) {
    const token = authStorage.getToken();
    const { data } = await api.post<ApiResponse<CandidateRecord | null>>("/letters/send-email", payload, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return data;
  },
  async generateOfferLetterPdf(payload: { htmlContent: string; fileName?: string }) {
    const response = await api.post("/letters/offer/pdf", payload, { responseType: "blob" });
    return response.data as Blob;
  },
  async acceptOffer(candidateId: string) {
    const { data } = await api.post<ApiResponse<{ employee: unknown; candidate: CandidateRecord }>>(
      `/candidate/accept-offer/${candidateId}`
    );
    return data.data;
  },
  async listNotifications() {
    const { data } = await api.get<ApiResponse<NotificationItem[]>>("/notifications");
    return data.data;
  },
  async markNotificationRead(id: string) {
    const { data } = await api.patch<ApiResponse<NotificationItem>>(`/notifications/${id}/read`);
    return data.data;
  },
  async markAllNotificationsRead() {
    const { data } = await api.patch<ApiResponse<null>>("/notifications/read-all");
    return data.data;
  },
  async deleteNotification(id: string) {
    const { data } = await api.delete<ApiResponse<NotificationItem>>(`/notifications/${id}`);
    return data.data;
  },
  async listInternships(params?: { candidateId?: string; status?: string }) {
    const { data } = await api.get<ApiResponse<InternshipRecord[]>>("/internships", { params });
    return data.data;
  },
  async getInternshipById(id: string) {
    const { data } = await api.get<ApiResponse<InternshipRecord>>(`/internships/${id}`);
    return data.data;
  },
  async createInternship(payload: { candidateId: string; startDate: string; endDate: string; notes?: string }) {
    const { data } = await api.post<ApiResponse<InternshipRecord>>("/internships", payload);
    return data.data;
  },
  async updateInternship(id: string, payload: Partial<InternshipRecord>) {
    const { data } = await api.put<ApiResponse<InternshipRecord>>(`/internships/${id}`, payload);
    return data.data;
  },
  async decideInternship(
    id: string,
    payload: { action: "approve" | "reject" | "extend"; note?: string; newEndDate?: string }
  ) {
    const { data } = await api.patch<ApiResponse<InternshipRecord>>(`/internships/${id}/decision`, payload);
    return data.data;
  },
  async deleteInternship(id: string) {
    const { data } = await api.delete<ApiResponse<InternshipRecord>>(`/internships/${id}`);
    return data.data;
  },
  async listJoiningForms(params?: { status?: string; candidateId?: string }) {
    const { data } = await api.get<ApiResponse<JoiningFormRecord[]>>("/joining-forms", { params });
    return data.data.map(normalizeJoiningFormRecord);
  },
  async getJoiningFormById(id: string) {
    const { data } = await api.get<ApiResponse<JoiningFormRecord>>(`/joining-forms/${id}`);
    return normalizeJoiningFormRecord(data.data);
  },
  async getMyJoiningForm() {
    const { data } = await api.get<ApiResponse<JoiningFormRecord | null>>("/joining-forms/me");
    return data.data ? normalizeJoiningFormRecord(data.data) : null;
  },
  async getMyJoiningFormLoadData() {
    const { data } = await api.get<
      ApiResponse<{
        form: JoiningFormRecord | null;
        prefillData: JoiningFormPrefillData;
      }>
    >("/joining-forms/me");
    return {
      ...data.data,
      form: data.data.form ? normalizeJoiningFormRecord(data.data.form) : null,
    };
  },
  async sendJoiningFormRequest(candidateId: string) {
    const { data } = await api.post<ApiResponse<JoiningFormRecord>>(`/joining-forms/send/${candidateId}`);
    return data.data;
  },
  async submitMyJoiningForm(payload: {
    fullName: string;
    dateOfBirth: string;
    age: string;
    maritalStatus: string;
    placeOfBirth: string;
    fatherName: string;
    fatherOccupation: string;
    motherName: string;
    motherOccupation: string;
    presentAddress: string;
    permanentAddress: string;
    phoneNumber: string;
    mobileNumber: string;
    emailAddress: string;
    accommodationDetails: string;
    educationDetails: Array<{ degreeOrDiploma: string; university: string; yearOfPassing: string; percentage: string }>;
    declarationAccepted: boolean;
    files?: {
      resume?: File | null;
      photograph?: File | null;
      certificates?: File | null;
      idProof?: File | null;
    };
  }) {
    const formData = new FormData();
    formData.append("fullName", payload.fullName);
    formData.append("dateOfBirth", payload.dateOfBirth);
    formData.append("age", payload.age);
    formData.append("maritalStatus", payload.maritalStatus);
    formData.append("placeOfBirth", payload.placeOfBirth);
    formData.append("fatherName", payload.fatherName);
    formData.append("fatherOccupation", payload.fatherOccupation);
    formData.append("motherName", payload.motherName);
    formData.append("motherOccupation", payload.motherOccupation);
    formData.append("presentAddress", payload.presentAddress);
    formData.append("permanentAddress", payload.permanentAddress);
    formData.append("phoneNumber", payload.phoneNumber);
    formData.append("mobileNumber", payload.mobileNumber);
    formData.append("emailAddress", payload.emailAddress);
    formData.append("accommodationDetails", payload.accommodationDetails);
    formData.append("educationDetails", JSON.stringify(payload.educationDetails || []));
    formData.append("declarationAccepted", String(payload.declarationAccepted));
    if (payload.files?.resume) formData.append("resume", payload.files.resume);
    if (payload.files?.photograph) formData.append("photograph", payload.files.photograph);
    if (payload.files?.certificates) formData.append("certificates", payload.files.certificates);
    if (payload.files?.idProof) formData.append("idProof", payload.files.idProof);
    const { data } = await api.post<ApiResponse<JoiningFormRecord>>("/joining-forms/me/submit", formData);
    return normalizeJoiningFormRecord(data.data);
  },
  async reviewJoiningForm(
    id: string,
    payload: {
      action: "approve" | "request_correction" | "reject";
      remarks?: string;
      departmentId?: string;
      designation?: string;
      salary?: number;
      joiningDate?: string;
    }
  ) {
    const { data } = await api.patch<
      ApiResponse<{ joiningForm: JoiningFormRecord; employee?: unknown; candidate?: CandidateRecord }>
    >(`/joining-forms/${id}/review`, payload);
    return data.data;
  },
  async deleteJoiningForm(id: string) {
    const { data } = await api.delete<ApiResponse<JoiningFormRecord>>(`/joining-forms/${id}`);
    return data.data;
  },
  async getManagedUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    department?: string;
    status?: string;
    activity?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const { data } = await api.get<ApiResponse<{ items: ManagedUser[]; pagination: PaginationMeta }>>("/users/management", {
      params,
    });
    return data.data;
  },
  async getUserActivities(params: { page?: number; limit?: number; search?: string }) {
    const { data } = await api.get<ApiResponse<{ items: UserActivityLog[]; pagination: PaginationMeta }>>("/users/activity", {
      params,
    });
    return data.data;
  },
  async getAuditLogs(params: { page?: number; limit?: number; search?: string }) {
    const { data } = await api.get<ApiResponse<{ items: AuditLogItem[]; pagination: PaginationMeta }>>("/users/audit", {
      params,
    });
    return data.data;
  },
  async inviteUser(payload: {
    name: string;
    email: string;
    role: UserAccessRole;
    department: string;
    temporaryPassword: string;
  }) {
    const { data } = await api.post<ApiResponse<ManagedUser>>("/users/invite", payload);
    return data.data;
  },
  async updateUserRole(userId: string, accessRole: UserAccessRole, permissions?: ManagedUser["permissions"]) {
    const token = authStorage.getToken();
    const { data } = await api.put<ApiResponse<ManagedUser>>(
      `/users/${userId}/role`,
      { accessRole, permissions },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return data.data;
  },
  async updateUserStatus(userId: string, accountStatus: UserAccountStatus) {
    const { data } = await api.patch<ApiResponse<ManagedUser>>(`/users/${userId}/status`, { accountStatus });
    return data.data;
  },
  async updateUserSecurity(userId: string, payload: { forcePasswordReset: boolean; twoFactorEnabled: boolean }) {
    const { data } = await api.patch<ApiResponse<ManagedUser>>(`/users/${userId}/security`, payload);
    return data.data;
  },
  async updateUserPermissions(userId: string, permissions: NonNullable<ManagedUser["permissions"]>) {
    const { data } = await api.patch<ApiResponse<ManagedUser>>(`/users/${userId}/permissions`, { permissions });
    return data.data;
  },
  async deleteManagedUser(userId: string) {
    const { data } = await api.delete<ApiResponse<DeleteManagedUserResult>>(`/users/${userId}`);
    return data.data;
  },
  async getSettings() {
    const { data } = await api.get<ApiResponse<{ settings: SettingsPayload; defaults: SettingsPayload; profile: AuthUser }>>("/settings");
    return data.data;
  },
  async getPublicSettings() {
    const { data } = await api.get<ApiResponse<PublicSettingsPayload>>("/settings/public");
    return data.data;
  },
  async getConfig() {
    const { data } = await api.get<ApiResponse<RuntimeConfigPayload>>("/config");
    return data.data;
  },
  async updateConfig(payload: Partial<RuntimeConfigPayload>) {
    const { data } = await api.put<ApiResponse<RuntimeConfigPayload>>("/config", payload);
    return data.data;
  },
  async downloadProtectedFile(fileUrl: string) {
    const normalizedUrl = String(fileUrl || "").trim();
    if (!normalizedUrl) {
      throw new Error("File URL is missing.");
    }

    try {
      const parsedUrl = new URL(normalizedUrl);
      if (parsedUrl.origin && parsedUrl.origin !== API_ORIGIN) {
        const response = await fetch(parsedUrl.toString(), {
          method: "GET",
          credentials: "omit",
        });
        if (!response.ok) {
          throw new Error(`Unable to open file (${response.status}).`);
        }
        return await response.blob();
      }
    } catch {
      // Relative URL or invalid absolute URL: fall back to the API client.
    }

    const response = await api.get<Blob>(normalizedUrl, { responseType: "blob" });
    return response.data;
  },
  async getAdminDashboardSummary() {
    const { data } = await api.get<
      ApiResponse<{
        activeEmployeesCount: number;
        applicationsUnderReview: number;
        pendingHrReviews: number;
        pendingLeavesCount: number;
        totalPayrollValue: number;
        departmentsCovered: number;
        totalCandidates: number;
        totalEmployees: number;
        recentEmployees: EmployeeRecord[];
        events: Array<{
          id: string;
          title: string;
          date: string;
          type: "meeting" | "holiday" | "reminder" | "birthday";
          time?: string;
          note?: string;
        }>;
      }>
    >("/users/dashboard-summary");
    return data.data;
  },
  async updateSettings(payload: Partial<SettingsPayload>, companyLogo?: File) {
    const formData = new FormData();
    if (payload.company) formData.append("company", JSON.stringify(payload.company));
    if (payload.rolePermissions) formData.append("rolePermissions", JSON.stringify(payload.rolePermissions));
    if (payload.security) formData.append("security", JSON.stringify(payload.security));
    if (payload.notifications) formData.append("notifications", JSON.stringify(payload.notifications));
    if (payload.preferences) formData.append("preferences", JSON.stringify(payload.preferences));
    if (payload.documents) formData.append("documents", JSON.stringify(payload.documents));
    if (payload.audit) formData.append("audit", JSON.stringify(payload.audit));
    if (companyLogo) formData.append("companyLogo", companyLogo);
    const { data } = await api.put<ApiResponse<SettingsPayload>>("/settings", formData);
    return data.data;
  },
  async updateCompanySettings(payload: Partial<SettingsPayload["company"]>, companyLogo?: File) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });
    if (companyLogo) formData.append("companyLogo", companyLogo);
    const { data } = await api.put<ApiResponse<SettingsPayload["company"]>>("/settings/company", formData);
    return data.data;
  },
  async updateRbacSettings(rolePermissions: SettingsPayload["rolePermissions"]) {
    const { data } = await api.put<ApiResponse<SettingsPayload["rolePermissions"]>>("/settings/rbac", { rolePermissions });
    return data.data;
  },
  async updateSecuritySettings(security: Partial<SettingsPayload["security"]>) {
    const { data } = await api.put<ApiResponse<SettingsPayload["security"]>>("/settings/security", { security });
    return data.data;
  },
  async updateNotificationSettings(notifications: Partial<SettingsPayload["notifications"]>) {
    const { data } = await api.put<ApiResponse<SettingsPayload["notifications"]>>("/settings/notifications", { notifications });
    return data.data;
  },
  async updatePreferenceSettings(preferences: Partial<SettingsPayload["preferences"]>) {
    const { data } = await api.put<ApiResponse<SettingsPayload["preferences"]>>("/settings/preferences", { preferences });
    return data.data;
  },
  async updateDocumentSettings(documents: Partial<SettingsPayload["documents"]>) {
    const { data } = await api.put<ApiResponse<SettingsPayload["documents"]>>("/settings/documents", { documents });
    return data.data;
  },
  async updateAuditSettings(audit: Partial<SettingsPayload["audit"]>) {
    const { data } = await api.put<ApiResponse<SettingsPayload["audit"]>>("/settings/audit", { audit });
    return data.data;
  },
  async resetSettingsToDefaults() {
    const { data } = await api.post<ApiResponse<SettingsPayload>>("/settings/reset-defaults");
    return data.data;
  },
  async exportAuditLogs() {
    const response = await api.get("/settings/audit/export", { responseType: "blob" });
    return response.data as Blob;
  },
  async updateProfile(payload: { name: string; email: string; phone?: string }, profilePhoto?: File) {
    const formData = new FormData();
    formData.append("name", payload.name);
    formData.append("email", payload.email);
    formData.append("phone", payload.phone || "");
    if (profilePhoto) formData.append("profilePhoto", profilePhoto);
    const { data } = await api.put<ApiResponse<AuthUser>>("/settings/profile", formData);
    return data.data;
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const { data } = await api.put<{ success: boolean; message: string }>("/settings/change-password", payload);
    return data;
  },
  // Calendar methods
  async getCalendarEvents(params?: { month?: number; year?: number; country?: string }) {
    const { data } = await api.get("/calendar/events", { params });
    return data.data;
  },
  async getEventsByDate(date: string, params?: { country?: string }) {
    const { data } = await api.get(`/calendar/events-by-date/${date}`, { params });
    return data.data;
  },
  async getUpcomingCalendarEvents(params?: { days?: number; country?: string }) {
    const { data } = await api.get("/calendar/upcoming", { params });
    return data.data;
  },
  async getCalendarHolidays(params?: { year?: number; country?: string }) {
    const { data } = await api.get("/calendar/holidays", { params });
    return data.data;
  },
  async getSupportedCalendarCountries() {
    const { data } = await api.get("/calendar/supported-countries");
    return data.data;
  },
};
