export const createDefaultPermissions = (accessRole) => {
  const isSuperAdmin = accessRole === "super_admin";
  const isAdmin = accessRole === "admin";
  const isHr = accessRole === "hr_manager";
  const isRecruiter = accessRole === "recruiter";
  const isEmployee = accessRole === "employee";
  const isCandidate = accessRole === "candidate";
  const isPrivilegedAdmin = isSuperAdmin || isAdmin;
  const candidateModuleAccess = isPrivilegedAdmin || isHr || isRecruiter;
  const lettersModuleAccess = isPrivilegedAdmin || isHr || isEmployee;
  const reportsModuleAccess = isPrivilegedAdmin || isHr;

  return {
    modules: {
      dashboard: true,
      candidates: candidateModuleAccess,
      employees: isPrivilegedAdmin || isHr,
      attendance: !isCandidate,
      payroll: isPrivilegedAdmin || isEmployee,
      letters: lettersModuleAccess,
      departments: isPrivilegedAdmin,
      reports: reportsModuleAccess,
      userManagement: isPrivilegedAdmin,
      settings: isPrivilegedAdmin,
      candidateManagement: candidateModuleAccess,
      jobApplications: candidateModuleAccess,
      interviews: candidateModuleAccess,
      offerLetters: lettersModuleAccess,
      reportsAnalytics: reportsModuleAccess,
    },
    actions: {
      viewCandidates: !isCandidate,
      editCandidateStatus: isPrivilegedAdmin || isHr,
      sendInterviewEmails: candidateModuleAccess,
      uploadOfferLetters: lettersModuleAccess,
      manageUsers: isPrivilegedAdmin,
    },
    pageAccess: isPrivilegedAdmin
      ? [
          "/admin/dashboard",
          "/admin/candidates",
          "/admin/employees",
          "/admin/attendance",
          "/admin/leave",
          "/admin/payroll",
          "/admin/letters",
          "/admin/departments",
          "/admin/offboarding",
          "/admin/users",
        ]
      : isHr
      ? ["/hr/dashboard", "/admin/candidates", "/admin/letters"]
      : isRecruiter
      ? ["/recruiter/dashboard", "/admin/candidates"]
      : isEmployee
      ? ["/employee/dashboard", "/employee/profile", "/employee/attendance", "/employee/leave", "/employee/payroll", "/employee/letters"]
      : ["/candidate/dashboard", "/candidate/stage2", "/apply"],
  };
};

export const normalizePermissions = (accessRole, incomingPermissions) => {
  const base = createDefaultPermissions(accessRole);
  const incoming = incomingPermissions || {};
  const incomingModules = incoming.modules || {};

  // Support legacy keys stored in older records.
  const modulesFromAliases = {
    ...incomingModules,
    candidates:
      typeof incomingModules.candidates === "boolean"
        ? incomingModules.candidates
        : incomingModules.candidateManagement,
    letters:
      typeof incomingModules.letters === "boolean"
        ? incomingModules.letters
        : incomingModules.offerLetters,
    reports:
      typeof incomingModules.reports === "boolean"
        ? incomingModules.reports
        : incomingModules.reportsAnalytics,
    interviews:
      typeof incomingModules.interviews === "boolean"
        ? incomingModules.interviews
        : incomingModules.interviewScheduling,
    offerLetters:
      typeof incomingModules.offerLetters === "boolean"
        ? incomingModules.offerLetters
        : incomingModules.offerLetterGenerator,
  };

  const mappedModules = {
    ...modulesFromAliases,
    candidateManagement:
      typeof modulesFromAliases.candidateManagement === "boolean"
        ? modulesFromAliases.candidateManagement
        : modulesFromAliases.candidates,
    jobApplications:
      typeof modulesFromAliases.jobApplications === "boolean"
        ? modulesFromAliases.jobApplications
        : modulesFromAliases.candidates,
    letters:
      typeof modulesFromAliases.letters === "boolean"
        ? modulesFromAliases.letters
        : modulesFromAliases.offerLetters,
    offerLetters:
      typeof modulesFromAliases.offerLetters === "boolean"
        ? modulesFromAliases.offerLetters
        : modulesFromAliases.letters,
    reports:
      typeof modulesFromAliases.reports === "boolean"
        ? modulesFromAliases.reports
        : modulesFromAliases.reportsAnalytics,
    reportsAnalytics:
      typeof modulesFromAliases.reportsAnalytics === "boolean"
        ? modulesFromAliases.reportsAnalytics
        : modulesFromAliases.reports,
  };

  const pageAccess = Array.isArray(incoming.pageAccess)
    ? incoming.pageAccess.map((item) => String(item).trim()).filter(Boolean)
    : base.pageAccess;

  return {
    modules: { ...base.modules, ...mappedModules },
    actions: { ...base.actions, ...(incoming.actions || {}) },
    pageAccess,
  };
};
