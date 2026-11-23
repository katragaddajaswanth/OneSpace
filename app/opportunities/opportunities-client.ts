export type Role =
  | "STUDENT"
  | "ALUMNI"
  | "INDUSTRY_REPRESENTATIVE"
  | "ADMINISTRATOR";

export type OpportunityType =
  | "Job"
  | "Internship"
  | "Referral"
  | "Freelance"
  | "Collaboration"
  | "Live Project"
  | "Challenge"
  | "Research";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";

export type ApplicationStatus =
  | "APPLIED"
  | "UNDER_REVIEW"
  | "SHORTLISTED"
  | "INTERVIEW"
  | "SELECTED"
  | "REJECTED"
  | "WITHDRAWN";

export type Opportunity = {
  id: string;
  title: string;
  organization: string;
  description: string;
  type: OpportunityType;
  submittedBy?: string;
  submitterRole?: "ALUMNI" | "INDUSTRY_REPRESENTATIVE";
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  location: string;
  workMode: string;
  eligibility: string;
  skills: string;
  deadline: string;
  createdAt: string;
  compensationType?: string;
  applicationUrl?: string | null;
  publishedAt?: string | null;
};

export type OpportunityForm = {
  title: string;
  organization: string;
  type: OpportunityType;
  description: string;
  location: string;
  workMode: string;
  compensationType: string;
  compensationAmount: string;
  eligibility: string;
  skills: string;
  deadline: string;
  applicationUrl: string;
};

export type SubmissionApiRecord = DiscoveryApiOpportunity & {
  submitterRole: "ALUMNI" | "INDUSTRY_REPRESENTATIVE";
  status: ApprovalStatus;
  submitter?: { fullName: string };
  approvalHistory: Array<{
    decision: "APPROVED" | "REJECTED";
    reason: string | null;
    reviewedAt: string;
  }>;
};

export type SubmissionRecord = Opportunity & {
  review: SubmissionApiRecord["approvalHistory"][number] | null;
};

export type DiscoveryApiOpportunity = {
  id: string;
  title: string;
  organization: string;
  description: string;
  type: string;
  compensationType: string;
  location: string | null;
  workMode: string;
  eligibility: string;
  requiredSkills: string | null;
  applicationDeadline: string;
  applicationUrl: string | null;
  createdAt: string;
  publishedAt: string | null;
};

export type SavedApiOpportunity = {
  savedAt: string;
  opportunity: DiscoveryApiOpportunity;
};

export type ApiPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Application = {
  id: string;
  opportunityId: string;
  appliedAt: string;
  status: ApplicationStatus;
  opportunity: {
    id: string;
    title: string;
    organization: string;
    type: string;
    location: string | null;
    workMode: string;
    applicationDeadline: string;
  };
};

// Retained for the not-yet-integrated submitter and administrator views only.
export const initialNonStudentOpportunities: Opportunity[] = [
  {
    id: "opp-1",
    title: "Frontend Developer Intern",
    organization: "TechNova Solutions",
    description:
      "Work with a product team to build responsive web interfaces using React and modern frontend technologies.",
    type: "Internship",
    approvalStatus: "APPROVED",
    location: "Hyderabad, India",
    workMode: "Hybrid",
    eligibility: "B.Tech students, preferably 2nd or 3rd year",
    skills: "React, JavaScript, HTML, CSS",
    deadline: "2027-01-15",
    createdAt: "2026-11-10",
  },
  {
    id: "opp-2",
    title: "Cybersecurity Analyst",
    organization: "SecureNet Technologies",
    description:
      "Assist the security team with vulnerability assessment, security monitoring and basic penetration-testing tasks.",
    type: "Job",
    submitterRole: "INDUSTRY_REPRESENTATIVE",
    approvalStatus: "APPROVED",
    location: "Bengaluru, India",
    workMode: "On-site",
    eligibility: "Final-year students and recent graduates",
    skills: "Networking, Linux, Python, Security Fundamentals",
    deadline: "2027-02-01",
    createdAt: "2026-11-11",
  },
  {
    id: "opp-3",
    title: "Campus Innovation Challenge",
    organization: "Innovation Labs",
    description:
      "Build a practical solution to a real-world problem. Selected teams will receive expert guidance.",
    type: "Challenge",
    submitterRole: "INDUSTRY_REPRESENTATIVE",
    approvalStatus: "APPROVED",
    location: "Online",
    workMode: "Remote",
    eligibility: "Open to all university students",
    skills: "Problem Solving, Innovation, Teamwork",
    deadline: "2027-01-20",
    createdAt: "2026-11-12",
  },
  {
    id: "opp-4",
    title: "Research Assistant – AI",
    organization: "Applied AI Research Group",
    description:
      "Contribute to an academic research project involving machine learning and data analysis.",
    type: "Research",
    approvalStatus: "APPROVED",
    location: "Remote",
    workMode: "Remote",
    eligibility: "Students with basic Python and mathematics knowledge",
    skills: "Python, Machine Learning, Statistics",
    deadline: "2027-01-30",
    createdAt: "2026-11-13",
  },
];

export const categories: OpportunityType[] = [
  "Job",
  "Internship",
  "Referral",
  "Freelance",
  "Collaboration",
  "Live Project",
  "Challenge",
  "Research",
];

export const emptyForm = {
  title: "",
  organization: "",
  type: "Internship" as OpportunityType,
  description: "",
  location: "",
  workMode: "Remote",
  compensationType: "NOT_SPECIFIED",
  compensationAmount: "",
  eligibility: "",
  skills: "",
  deadline: "",
  applicationUrl: "",
};

export function formatDate(date: string) {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const opportunityTypeApiValues: Record<string, string> = {
  Job: "JOB",
  Internship: "INTERNSHIP",
  Referral: "REFERRAL",
  Freelance: "FREELANCE",
  Collaboration: "COLLABORATION",
  "Live Project": "LIVE_PROJECT",
  Challenge: "CHALLENGE",
  Research: "RESEARCH",
};

export const opportunityTypeLabels: Record<string, string> = Object.fromEntries(
  Object.entries(opportunityTypeApiValues).map(([label, value]) => [value, label])
);

export const workModeLabels: Record<string, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ON_SITE: "On-site",
};

export const compensationTypeLabels: Record<string, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
  NOT_SPECIFIED: "Not specified",
};

export type OpportunitySubmissionPayload = {
  title: string;
  organization: string;
  description: string;
  type: string;
  compensationType: string;
  location: string | null;
  workMode: string;
  eligibility: string;
  requiredSkills: string | null;
  applicationDeadline: string;
  applicationUrl: string | null;
};

export function validateOpportunitySubmission(form: OpportunityForm): {
  payload?: OpportunitySubmissionPayload;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const fields: Array<[keyof OpportunityForm, string, number]> = [
    ["title", "title", 200],
    ["organization", "organization", 200],
    ["description", "description", 10_000],
    ["eligibility", "eligibility", 5_000],
  ];
  for (const [formKey, field, maxLength] of fields) {
    const value = form[formKey].trim();
    if (!value) errors[field] = "This field is required.";
    else if (value.length > maxLength) errors[field] = `Must be no more than ${maxLength} characters.`;
  }
  if (form.location.trim().length > 200) errors.location = "Must be no more than 200 characters.";
  if (form.skills.trim().length > 2_000) errors.requiredSkills = "Must be no more than 2000 characters.";

  const type = opportunityTypeApiValues[form.type];
  if (!type) errors.type = "Select a valid opportunity type.";
  const workModes: Record<string, string> = { Remote: "REMOTE", Hybrid: "HYBRID", "On-site": "ON_SITE" };
  const workMode = workModes[form.workMode];
  if (!workMode) errors.workMode = "Select a valid work mode.";
  if (!(form.compensationType in compensationTypeLabels)) {
    errors.compensationType = "Select a valid compensation type.";
  }

  const deadline = form.deadline;
  const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    ? new Date(`${deadline}T23:59:59.999Z`)
    : new Date(Number.NaN);
  if (
    Number.isNaN(deadlineDate.getTime()) ||
    deadlineDate.toISOString().slice(0, 10) !== deadline
  ) {
    errors.applicationDeadline = "Enter a valid deadline.";
  } else if (deadlineDate.getTime() <= Date.now()) {
    errors.applicationDeadline = "The application deadline must be in the future.";
  }

  const applicationUrl = form.applicationUrl.trim();
  if (applicationUrl.length > 2_048) {
    errors.applicationUrl = "Must be no more than 2048 characters.";
  } else if (applicationUrl) {
    try {
      const url = new URL(applicationUrl);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
        errors.applicationUrl = "Enter a valid HTTP or HTTPS URL.";
      }
    } catch {
      errors.applicationUrl = "Enter a valid HTTP or HTTPS URL.";
    }
  }

  const compensationAmount = form.compensationAmount.trim();
  if (compensationAmount) {
    if (form.compensationType !== "PAID") {
      errors.compensationAmount = "Enter an amount only for paid opportunities.";
    } else if (
      compensationAmount.length > 120 ||
      !/^(?=.*\d)[A-Za-z0-9\s.,/()_-]+$/.test(compensationAmount)
    ) {
      errors.compensationAmount = "Enter a valid amount and currency, such as INR 50,000 per month.";
    }
  }

  const description = compensationAmount
    ? `${form.description.trim()}\n\nCompensation amount: ${compensationAmount}`
    : form.description.trim();
  if (description.length > 10_000) {
    errors.description = "Description and compensation details must total no more than 10000 characters.";
  }

  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    payload: {
      title: form.title.trim(),
      organization: form.organization.trim(),
      // The current API/schema has no dedicated amount column, so keep the amount
      // with the opportunity details rather than sending an unsupported field.
      description,
      type,
      compensationType: form.compensationType,
      location: form.location.trim() || null,
      workMode,
      eligibility: form.eligibility.trim(),
      requiredSkills: form.skills.trim() || null,
      applicationDeadline: deadline,
      applicationUrl: applicationUrl || null,
    },
  };
}

export function canSubmitOpportunity(
  primaryRole: string,
  secondaryRoles: string[],
  universityId: string | null | undefined
): boolean {
  return Boolean(universityId) && (
    primaryRole === "ALUMNI" || secondaryRoles.includes("INDUSTRY_REPRESENTATIVE")
  );
}

export function fromApiOpportunity(item: DiscoveryApiOpportunity): Opportunity {
  return {
    id: item.id,
    title: item.title,
    organization: item.organization,
    description: item.description,
    type: (opportunityTypeLabels[item.type] ?? item.type) as OpportunityType,
    approvalStatus: "APPROVED",
    location: item.location ?? "Not specified",
    workMode: workModeLabels[item.workMode] ?? item.workMode,
    eligibility: item.eligibility,
    skills: item.requiredSkills ?? "",
    deadline: item.applicationDeadline,
    createdAt: item.createdAt,
    compensationType: compensationTypeLabels[item.compensationType] ?? item.compensationType,
    applicationUrl: item.applicationUrl,
    publishedAt: item.publishedAt,
  };
}

export function fromSubmissionApiRecord(item: SubmissionApiRecord): SubmissionRecord {
  const opportunity = fromApiOpportunity(item);
  return {
    ...opportunity,
    submittedBy: item.submitter?.fullName,
    submitterRole: item.submitterRole,
    approvalStatus: item.status,
    rejectionReason: item.approvalHistory[0]?.decision === "REJECTED"
      ? item.approvalHistory[0].reason ?? undefined
      : undefined,
    review: item.approvalHistory[0] ?? null,
  };
}

export function buildDiscoveryUrl(options: {
  page: number;
  search: string;
  category: string;
  workMode: string;
  compensation: string;
}): string {
  const params = new URLSearchParams({ page: String(options.page), limit: "12" });
  if (options.search.trim()) params.set("search", options.search.trim());
  if (options.category !== "All") params.set("type", opportunityTypeApiValues[options.category]);
  if (options.workMode !== "All") params.set("workMode", options.workMode);
  if (options.compensation !== "All") params.set("compensationType", options.compensation);
  return `/api/opportunities?${params.toString()}`;
}

export function discoveryViewState(
  loading: boolean,
  error: string,
  opportunities: readonly Opportunity[]
): "loading" | "error" | "empty" | "results" {
  if (loading) return "loading";
  if (error) return "error";
  return opportunities.length ? "results" : "empty";
}

export type OpportunityApiDiagnostic = {
  endpoint: string;
  stage: string;
  errorName: string;
  errorCode?: string;
  message: string;
};

export type OpportunityApiFailure = {
  message: string;
  diagnostic: OpportunityApiDiagnostic | null;
};

export async function readOpportunityApiFailure(
  response: Response,
  fallbackMessage: string,
  allowDevelopmentDiagnostics = process.env.NODE_ENV === "development"
): Promise<OpportunityApiFailure> {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // Keep the caller's safe fallback when the response is not valid JSON.
  }

  const rawDiagnostic = body.diagnostic;
  let diagnostic: OpportunityApiDiagnostic | null = null;
  if (
    allowDevelopmentDiagnostics &&
    rawDiagnostic &&
    typeof rawDiagnostic === "object" &&
    !Array.isArray(rawDiagnostic)
  ) {
    const candidate = rawDiagnostic as Record<string, unknown>;
    if (
      typeof candidate.endpoint === "string" &&
      typeof candidate.stage === "string" &&
      typeof candidate.errorName === "string" &&
      typeof candidate.message === "string"
    ) {
      diagnostic = {
        endpoint: candidate.endpoint,
        stage: candidate.stage,
        errorName: candidate.errorName,
        ...(typeof candidate.errorCode === "string" ? { errorCode: candidate.errorCode } : {}),
        message: candidate.message,
      };
    }
  }

  return {
    message: typeof body.message === "string" ? body.message : fallbackMessage,
    diagnostic,
  };
}

export class OpportunityApiRequestError extends Error {
  constructor(message: string, readonly diagnostic: OpportunityApiDiagnostic | null) {
    super(message);
    this.name = "OpportunityApiRequestError";
  }
}

export async function requireApiSuccess(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;
  const failure = await readOpportunityApiFailure(response, fallbackMessage);
  throw new OpportunityApiRequestError(failure.message, failure.diagnostic);
}

export async function updateSavedOpportunity(
  id: string,
  shouldSave: boolean,
  fetcher: typeof fetch = fetch
): Promise<"saved" | "unsaved" | "already-saved"> {
  const response = await fetcher(`/api/opportunities/${encodeURIComponent(id)}/save`, {
    method: shouldSave ? "POST" : "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 409 && shouldSave) return "already-saved";
  if (!response.ok) throw new Error("Could not update saved opportunities.");
  return shouldSave ? "saved" : "unsaved";
}

export type ApplicationSubmissionResult =
  | { kind: "success"; application: Application }
  | { kind: "validation-error"; message: string }
  | { kind: "duplicate" }
  | { kind: "server-error" };

export async function submitApplication(
  opportunityId: string,
  rawMessage: string,
  fetcher: typeof fetch = fetch
): Promise<ApplicationSubmissionResult> {
  if (rawMessage.length > 5_000) {
    return { kind: "validation-error", message: "Application message must be no more than 5000 characters." };
  }

  const response = await fetcher(
    `/api/opportunities/${encodeURIComponent(opportunityId)}/apply`,
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: rawMessage.trim() || null }),
    }
  );

  if (response.status === 409) return { kind: "duplicate" };
  if (response.status === 400) {
    let message = "Please review your application details and try again.";
    try {
      const data = await response.json();
      const errors = data.errors && Object.values(data.errors).filter(
        (value): value is string => typeof value === "string"
      );
      if (errors?.length) message = errors.join(" ");
      else if (typeof data.message === "string") message = data.message;
    } catch {
      // Use the generic validation message for non-JSON responses.
    }
    return { kind: "validation-error", message };
  }
  if (!response.ok) return { kind: "server-error" };

  const data = await response.json();
  return { kind: "success", application: data.application as Application };
}

export type ReviewDecision = "APPROVE" | "REJECT";
export type ReviewClientResult =
  | { kind: "success"; approval: unknown }
  | { kind: "conflict" }
  | { kind: "forbidden" }
  | { kind: "validation-error"; message: string }
  | { kind: "server-error" };

export async function sendOpportunityReview(
  opportunityId: string,
  decision: ReviewDecision,
  reason?: string,
  fetcher: typeof fetch = fetch
): Promise<ReviewClientResult> {
  const response = await fetcher(
    `/api/opportunities/${encodeURIComponent(opportunityId)}/approval`,
    {
      method: "PATCH",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
    }
  );

  if (response.status === 409) return { kind: "conflict" };
  if (response.status === 401 || response.status === 403) return { kind: "forbidden" };
  if (response.status === 400) {
    let message = "Please correct the review details.";
    try {
      const data = await response.json();
      if (data.errors?.reason) message = data.errors.reason;
      else if (typeof data.message === "string") message = data.message;
    } catch {
      // Use the generic validation message for non-JSON responses.
    }
    return { kind: "validation-error", message };
  }
  if (!response.ok) return { kind: "server-error" };

  const data = await response.json();
  return { kind: "success", approval: data.approval };
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

