
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Role,
  OpportunityType,
  ApprovalStatus,
  Opportunity,
  OpportunityForm,
  SubmissionRecord,
  SavedApiOpportunity,
  ApiPagination,
  Application,
  initialNonStudentOpportunities,
  categories,
  emptyForm,
  formatDate,
  validateOpportunitySubmission,
  canSubmitOpportunity,
  fromApiOpportunity,
  fromSubmissionApiRecord,
  buildDiscoveryUrl,
  discoveryViewState,
  OpportunityApiDiagnostic,
  OpportunityApiRequestError,
  requireApiSuccess,
  updateSavedOpportunity,
  submitApplication,
  sendOpportunityReview,
  statusLabel,
} from "./opportunities-client";

export default function OpportunitiesPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authRetry, setAuthRetry] = useState(0);

  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialNonStudentOpportunities);
  const [discoveryOpportunities, setDiscoveryOpportunities] = useState<Opportunity[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryDiagnostic, setDiscoveryDiagnostic] = useState<OpportunityApiDiagnostic | null>(null);
  const [discoveryRetry, setDiscoveryRetry] = useState(0);
  const [discoveryPagination, setDiscoveryPagination] = useState<ApiPagination>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState("");
  const [applicationsDiagnostic, setApplicationsDiagnostic] = useState<OpportunityApiDiagnostic | null>(null);
  const [applicationsRetry, setApplicationsRetry] = useState(0);
  const [applicationsPage, setApplicationsPage] = useState(1);
  const [applicationsPagination, setApplicationsPagination] = useState<ApiPagination>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [mySubmissions, setMySubmissions] = useState<SubmissionRecord[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState("");
  const [submissionsRetry, setSubmissionsRetry] = useState(0);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsPagination, setSubmissionsPagination] = useState<ApiPagination>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [adminPending, setAdminPending] = useState<SubmissionRecord[]>([]);
  const [adminPublished, setAdminPublished] = useState<SubmissionRecord[]>([]);
  const [adminRejected, setAdminRejected] = useState<SubmissionRecord[]>([]);
  const [adminQueueLoading, setAdminQueueLoading] = useState(false);
  const [adminQueueError, setAdminQueueError] = useState("");
  const [adminQueueRetry, setAdminQueueRetry] = useState(0);
  const [adminQueuePage, setAdminQueuePage] = useState(1);
  const [adminPublishedPage, setAdminPublishedPage] = useState(1);
  const [adminRejectedPage, setAdminRejectedPage] = useState(1);
  const [adminQueuePagination, setAdminQueuePagination] = useState<ApiPagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [adminPublishedPagination, setAdminPublishedPagination] = useState<ApiPagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [adminRejectedPagination, setAdminRejectedPagination] = useState<ApiPagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<Opportunity[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");
  const [savedDiagnostic, setSavedDiagnostic] = useState<OpportunityApiDiagnostic | null>(null);
  const [savedRetry, setSavedRetry] = useState(0);
  const [savingIds, setSavingIds] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState("Discover");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [workModeFilter, setWorkModeFilter] = useState("All");
  const [compensationFilter, setCompensationFilter] = useState("All");
  const [discoveryPage, setDiscoveryPage] = useState(1);

  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);

  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submissionErrors, setSubmissionErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState("");
  const [submittingOpportunity, setSubmittingOpportunity] = useState(false);
  const submissionRequestActive = useRef(false);

  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [applicationFeedback, setApplicationFeedback] = useState("");
  const [submittingApplication, setSubmittingApplication] = useState(false);

  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [notification, setNotification] = useState("");

  useEffect(() => {
    let cancelled = false;
    setUserLoaded(false);
    setAuthError("");
    setCanSubmit(false);

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          if (!cancelled) {
            setRole(null);
            setCanSubmit(false);
          }
          return;
        }
        if (!response.ok) throw new Error("Your session could not be verified.");

        const data = await response.json();
        const authenticatedUser = data.user;
        if (!authenticatedUser) throw new Error("Your session could not be verified.");

        const secondaryRoles: string[] = (authenticatedUser.secondaryRoles ?? []).map(
          (item: string | { role: string }) => typeof item === "string" ? item : item.role
        );
        const actualRole: Role | null = secondaryRoles.includes("ADMINISTRATOR") && Boolean(authenticatedUser.university?.id)
          ? "ADMINISTRATOR"
          : authenticatedUser.primaryRole === "ALUMNI"
            ? "ALUMNI"
            : secondaryRoles.includes("INDUSTRY_REPRESENTATIVE")
              ? "INDUSTRY_REPRESENTATIVE"
              : authenticatedUser.primaryRole === "STUDENT"
                ? "STUDENT"
                : null;

        if (!cancelled) {
          setRole(actualRole);
          setCanSubmit(
            canSubmitOpportunity(
              authenticatedUser.primaryRole,
              secondaryRoles,
              authenticatedUser.university?.id
            )
          );
        }
      } catch {
        if (!cancelled) {
          setRole(null);
          setCanSubmit(false);
          setAuthError("We could not verify your session.");
        }
      } finally {
        if (!cancelled) setUserLoaded(true);
      }
    }

    void loadUser();
    return () => { cancelled = true; };
  }, [authRetry]);

  useEffect(() => {
    if (!userLoaded || !canSubmit) return;
    const controller = new AbortController();
    setSubmissionsLoading(true);
    setSubmissionsError("");

    async function loadSubmissions() {
      try {
        const response = await fetch(
          `/api/opportunities/submitted?page=${submissionsPage}&limit=12`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );
        if (!response.ok) throw new Error("Submissions could not be loaded.");
        const data = await response.json();
        if (!data.success || !Array.isArray(data.submissions) || !data.pagination) {
          throw new Error("Submissions could not be loaded.");
        }
        if (!controller.signal.aborted) {
          setMySubmissions(data.submissions.map(fromSubmissionApiRecord));
          setSubmissionsPagination(data.pagination);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMySubmissions([]);
          setSubmissionsError("Your submissions could not be loaded. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setSubmissionsLoading(false);
      }
    }

    void loadSubmissions();
    return () => controller.abort();
  }, [userLoaded, canSubmit, submissionsPage, submissionsRetry]);

  useEffect(() => {
    if (!userLoaded || role !== "ADMINISTRATOR") return;
    const controller = new AbortController();
    setAdminQueueLoading(true);
    setAdminQueueError("");

    async function loadAdminQueues() {
      try {
        const [pendingResponse, publishedResponse, rejectedResponse] = await Promise.all([
          fetch(`/api/opportunities/pending?page=${adminQueuePage}&limit=50`, {
            cache: "no-store", credentials: "same-origin", signal: controller.signal,
          }),
          fetch(`/api/opportunities/reviewed?status=APPROVED&page=${adminPublishedPage}&limit=50`, {
            cache: "no-store", credentials: "same-origin", signal: controller.signal,
          }),
          fetch(`/api/opportunities/reviewed?status=REJECTED&page=${adminRejectedPage}&limit=50`, {
            cache: "no-store", credentials: "same-origin", signal: controller.signal,
          }),
        ]);
        if (!pendingResponse.ok || !publishedResponse.ok || !rejectedResponse.ok) throw new Error("Review queues could not be loaded.");
        const [pendingData, publishedData, rejectedData] = await Promise.all([
          pendingResponse.json(), publishedResponse.json(), rejectedResponse.json(),
        ]);
        if (!pendingData.success || !Array.isArray(pendingData.opportunities) || !pendingData.pagination ||
            !publishedData.success || !Array.isArray(publishedData.opportunities) || !publishedData.pagination ||
            !rejectedData.success || !Array.isArray(rejectedData.opportunities) || !rejectedData.pagination) {
          throw new Error("Review queues could not be loaded.");
        }
        if (!controller.signal.aborted) {
          setAdminPending(pendingData.opportunities.map(fromSubmissionApiRecord));
          setAdminPublished(publishedData.opportunities.map(fromSubmissionApiRecord));
          setAdminRejected(rejectedData.opportunities.map(fromSubmissionApiRecord));
          setAdminQueuePagination(pendingData.pagination);
          setAdminPublishedPagination(publishedData.pagination);
          setAdminRejectedPagination(rejectedData.pagination);
        }
      } catch {
        if (!controller.signal.aborted) {
          setAdminPending([]);
          setAdminPublished([]);
          setAdminRejected([]);
          setAdminQueueError("Administrator queues could not be loaded. Please retry.");
        }
      } finally {
        if (!controller.signal.aborted) setAdminQueueLoading(false);
      }
    }

    void loadAdminQueues();
    return () => controller.abort();
  }, [userLoaded, role, adminQueuePage, adminPublishedPage, adminRejectedPage, adminQueueRetry]);

  useEffect(() => {
    if (!userLoaded || role !== "STUDENT") return;
    const controller = new AbortController();
    setApplicationsLoading(true);
    setApplicationsError("");
    setApplicationsDiagnostic(null);

    async function loadApplications() {
      try {
        const response = await fetch(
          `/api/opportunities/applications?page=${applicationsPage}&limit=12`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );
        await requireApiSuccess(response, "Applications could not be loaded.");
        const data = await response.json();
        if (!data.success || !Array.isArray(data.applications) || !data.pagination) {
          throw new Error("Applications could not be loaded.");
        }
        if (!controller.signal.aborted) {
          setApplications(data.applications);
          setApplicationsPagination(data.pagination);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setApplications([]);
          setApplicationsError(error instanceof OpportunityApiRequestError
            ? error.message
            : "Applications could not be loaded. Please try again.");
          setApplicationsDiagnostic(error instanceof OpportunityApiRequestError ? error.diagnostic : null);
        }
      } finally {
        if (!controller.signal.aborted) setApplicationsLoading(false);
      }
    }

    void loadApplications();
    return () => controller.abort();
  }, [userLoaded, role, applicationsPage, applicationsRetry]);

  useEffect(() => {
    if (!userLoaded || role !== "STUDENT") return;
    const controller = new AbortController();
    setDiscoveryLoading(true);
    setDiscoveryError("");
    setDiscoveryDiagnostic(null);
    const timer = window.setTimeout(() => {
      async function loadDiscovery() {
        setDiscoveryLoading(true);
        setDiscoveryError("");
        setDiscoveryDiagnostic(null);
        try {
          const response = await fetch(buildDiscoveryUrl({
            page: discoveryPage,
            search,
            category,
            workMode: workModeFilter,
            compensation: compensationFilter,
          }), {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          });
          await requireApiSuccess(response, "Opportunities could not be loaded.");
          const data = await response.json();
          if (!data.success || !Array.isArray(data.opportunities) || !data.pagination) {
            throw new Error("Opportunities could not be loaded.");
          }
          setDiscoveryOpportunities(data.opportunities.map(fromApiOpportunity));
          setDiscoveryPagination(data.pagination);
        } catch (error) {
          if (!controller.signal.aborted) {
            setDiscoveryOpportunities([]);
            setDiscoveryError(error instanceof OpportunityApiRequestError
              ? error.message
              : "Opportunities could not be loaded. Please try again.");
            setDiscoveryDiagnostic(error instanceof OpportunityApiRequestError ? error.diagnostic : null);
          }
        } finally {
          if (!controller.signal.aborted) setDiscoveryLoading(false);
        }
      }
      void loadDiscovery();
    }, search ? 300 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [userLoaded, role, search, category, workModeFilter, compensationFilter, discoveryPage, discoveryRetry]);

  useEffect(() => {
    if (!userLoaded || role !== "STUDENT") return;
    let cancelled = false;

    async function loadSaved() {
      setSavedLoading(true);
      setSavedError("");
      setSavedDiagnostic(null);
      try {
        const firstResponse = await fetch("/api/opportunities/saved?page=1&limit=50", {
          cache: "no-store",
          credentials: "same-origin",
        });
        await requireApiSuccess(firstResponse, "Saved opportunities could not be loaded.");
        const firstData = await firstResponse.json();
        if (!firstData.success || !Array.isArray(firstData.savedOpportunities) || !firstData.pagination) {
          throw new Error("Saved opportunities could not be loaded.");
        }
        const records: SavedApiOpportunity[] = [...firstData.savedOpportunities];
        const pages = Array.from({ length: Math.max(0, firstData.pagination.totalPages - 1) }, (_, index) => index + 2);
        const rest = await Promise.all(pages.map(async (page) => {
          const response = await fetch(`/api/opportunities/saved?page=${page}&limit=50`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          await requireApiSuccess(response, "Saved opportunities could not be loaded.");
          const data = await response.json();
          if (!data.success || !Array.isArray(data.savedOpportunities)) {
            throw new Error("Saved opportunities could not be loaded.");
          }
          return data.savedOpportunities as SavedApiOpportunity[];
        }));
        records.push(...rest.flat());
        if (!cancelled) {
          setSavedOpportunities(records.map((record) => fromApiOpportunity(record.opportunity)));
          setSavedIds(records.map((record) => record.opportunity.id));
        }
      } catch (error) {
        if (!cancelled) {
          setSavedError(error instanceof OpportunityApiRequestError
            ? error.message
            : "Saved opportunities could not be loaded. Please try again.");
          setSavedDiagnostic(error instanceof OpportunityApiRequestError ? error.diagnostic : null);
        }
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    }

    void loadSaved();
    return () => { cancelled = true; };
  }, [userLoaded, role, savedRetry]);

  const isStudent = role === "STUDENT";
  const isAdmin = role === "ADMINISTRATOR";

  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    setCurrentTime(Date.now());
  }, []);

  const approvedOpportunities = useMemo(
    () =>
      opportunities.filter(
        (item) =>
          item.approvalStatus === "APPROVED" &&
          currentTime !== null &&
          new Date(`${item.deadline}T23:59:59`).getTime() >= currentTime
      ),
    [opportunities, currentTime]
  );

  const filteredOpportunities = useMemo(() => {
    return approvedOpportunities.filter((item) => {
      const matchesSearch = [
        item.title,
        item.organization,
        item.description,
        item.skills,
        item.location,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        category === "All" || item.type === category;

      return matchesSearch && matchesCategory;
    });
  }, [approvedOpportunities, search, category]);

  const pendingSubmissions = isAdmin ? adminPending : opportunities.filter(
    (item) => item.approvalStatus === "PENDING"
  );

  const myApplications = applications;

  const mySavedOpportunities = savedOpportunities;
  const discoveryState = discoveryViewState(discoveryLoading, discoveryError, discoveryOpportunities);

  function showMessage(message: string) {
    setNotification(message);
    window.setTimeout(() => setNotification(""), 3000);
  }

  function updateOpportunityForm<K extends keyof OpportunityForm>(
    field: K,
    value: OpportunityForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmissionErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === "skills") delete next.requiredSkills;
      if (field === "compensationType") delete next.compensationAmount;
      return next;
    });
    setSubmissionError("");
  }

  async function toggleSave(id: string) {
    if (savingIds.includes(id)) return;
    const wasSaved = savedIds.includes(id);
    setSavingIds((previous) => [...previous, id]);

    try {
      const result = await updateSavedOpportunity(id, !wasSaved);

      if (result === "already-saved") {
        setSavedIds((previous) => previous.includes(id) ? previous : [...previous, id]);
        showMessage("Opportunity is already saved.");
        return;
      }

      if (wasSaved) {
        setSavedIds((previous) => previous.filter((savedId) => savedId !== id));
        setSavedOpportunities((previous) => previous.filter((item) => item.id !== id));
        showMessage("Opportunity removed from saved items.");
      } else {
        const opportunity = discoveryOpportunities.find((item) => item.id === id);
        setSavedIds((previous) => previous.includes(id) ? previous : [...previous, id]);
        if (opportunity) {
          setSavedOpportunities((previous) => previous.some((item) => item.id === id)
            ? previous
            : [opportunity, ...previous]);
        }
        showMessage("Opportunity saved.");
      }
    } catch {
      showMessage("Could not update saved opportunities. Please try again.");
    } finally {
      setSavingIds((previous) => previous.filter((savingId) => savingId !== id));
    }
  }

  async function submitOpportunity() {
    if (submittingOpportunity || submissionRequestActive.current) return;
    const validation = validateOpportunitySubmission(form);
    setSubmissionErrors(validation.errors);
    setSubmissionError("");
    if (!validation.payload) return;

    submissionRequestActive.current = true;
    setSubmittingOpportunity(true);
    try {
      const response = await fetch("/api/opportunities", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        // Submitter identity, role, university and status are assigned by the API.
        body: JSON.stringify(validation.payload),
      });

      if (response.status === 400) {
        try {
          const data = await response.json();
          if (data.errors && typeof data.errors === "object") {
            setSubmissionErrors((current) => ({ ...current, ...data.errors }));
          }
          setSubmissionError(data.message ?? "Please correct the highlighted fields.");
        } catch {
          setSubmissionError("Please correct the highlighted fields.");
        }
        return;
      }
      if (!response.ok) {
        setSubmissionError(
          response.status === 401 || response.status === 403
            ? "Your account is not authorized to submit opportunities."
            : "Opportunity submission could not be completed. Please try again."
        );
        return;
      }

      setForm(emptyForm);
      setSubmissionErrors({});
      setShowSubmitForm(false);
      setSubmissionsPage(1);
      setSubmissionsRetry((attempt) => attempt + 1);
      setActiveTab("My Submissions");
      showMessage("Opportunity submitted successfully and is pending approval.");
    } catch {
      setSubmissionError("Opportunity submission could not be completed. Check your connection and retry.");
    } finally {
      submissionRequestActive.current = false;
      setSubmittingOpportunity(false);
    }
  }

  async function applyToOpportunity() {
    if (!selectedOpportunity || submittingApplication) return;

    setSubmittingApplication(true);
    setApplicationFeedback("");
    try {
      const result = await submitApplication(selectedOpportunity.id, applicationMessage);
      if (result.kind === "validation-error") {
        setApplicationFeedback(result.message);
        return;
      }
      if (result.kind === "duplicate") {
        setApplicationFeedback("You have already applied for this opportunity.");
        setApplicationsRetry((attempt) => attempt + 1);
        return;
      }
      if (result.kind === "server-error") {
        setApplicationFeedback("We could not submit your application. Please try again later.");
        return;
      }

      setApplicationsRetry((attempt) => attempt + 1);
      setApplicationMessage("");
      setShowApplicationForm(false);
      showMessage("Application submitted successfully. Status: APPLIED.");
    } catch {
      setApplicationFeedback("We could not submit your application. Check your connection and retry.");
    } finally {
      setSubmittingApplication(false);
    }
  }

  async function approveOpportunity(id: string) {
    if (reviewingId) return;
    setReviewingId(id);
    setReviewError("");
    try {
      const result = await sendOpportunityReview(id, "APPROVE");
      if (result.kind === "success") {
        showMessage("Opportunity approved and published.");
        setAdminQueueRetry((attempt) => attempt + 1);
      } else if (result.kind === "conflict") {
        setReviewError("This opportunity has already been reviewed. The queue is refreshing.");
        setAdminQueueRetry((attempt) => attempt + 1);
      } else if (result.kind === "forbidden") {
        setReviewError("Your administrator access could not be verified.");
      } else {
        setReviewError("We could not approve this opportunity. Please retry.");
      }
    } catch {
      setReviewError("We could not approve this opportunity. Please check your connection and retry.");
    } finally {
      setReviewingId(null);
    }
  }

  async function rejectOpportunity(id: string) {
    const reason = rejectionReason.trim();
    if (reason.length < 10 || reason.length > 2_000) {
      setReviewError("Provide a rejection reason between 10 and 2000 characters.");
      return;
    }
    if (reviewingId) return;
    setReviewingId(id);
    setReviewError("");
    try {
      const result = await sendOpportunityReview(id, "REJECT", reason);
      if (result.kind === "success") {
        setShowRejectForm(null);
        setRejectionReason("");
        showMessage("Opportunity rejected. Reason recorded.");
        setAdminQueueRetry((attempt) => attempt + 1);
      } else if (result.kind === "conflict") {
        setReviewError("This opportunity has already been reviewed. The queue is refreshing.");
        setAdminQueueRetry((attempt) => attempt + 1);
      } else if (result.kind === "validation-error") {
        setReviewError(result.message);
      } else if (result.kind === "forbidden") {
        setReviewError("Your administrator access could not be verified.");
      } else {
        setReviewError("We could not reject this opportunity. Please retry.");
      }
    } catch {
      setReviewError("We could not reject this opportunity. Please check your connection and retry.");
    } finally {
      setReviewingId(null);
    }
  }

  const tabs = [
    ...(isStudent
      ? ["Discover", "My Applications", "Saved"]
      : []),
    ...(canSubmit ? ["Discover", "My Submissions"] : []),
    ...(isAdmin
      ? ["Pending Approvals", "Published", "Rejected"]
      : []),
  ];

  const visibleTab = tabs.includes(activeTab) ? activeTab : tabs[0];

  if (!userLoaded) {
    return (
      <main className="min-h-screen bg-[#f7f8fc] p-8">
        <p className="text-sm text-slate-500">
          Loading opportunities...
        </p>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="min-h-screen bg-[#f7f8fc] px-4 py-10 text-slate-900 sm:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Career & Opportunities</h1>
          <p className="mt-3 text-sm text-slate-600">
            {authError || "            Sign in with an eligible One-Space account to continue."}
          </p>
          {authError ? (
            <button onClick={() => setAuthRetry((attempt) => attempt + 1)} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">Retry</button>
          ) : (
            <a href="/login" className="mt-5 inline-block rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">Sign in</a>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-7">

        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              One-Space / Career
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Career & Opportunities
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Discover opportunities, build professional connections
              and take the next step in your career.
            </p>
          </div>

          {canSubmit && (
            <button
              onClick={() => setShowSubmitForm(true)}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              + Submit Opportunity
            </button>
          )}
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Published opportunities"
            value={isStudent ? discoveryPagination.total : isAdmin ? adminPublishedPagination.total : approvedOpportunities.length}
          />
          <StatCard
            label="My applications"
            value={isStudent ? applicationsPagination.total : myApplications.length}
          />
          <StatCard
            label="Pending approvals"
            value={isAdmin ? adminQueuePagination.total : pendingSubmissions.length}
          />
        </section>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
          {isStudent && (
            <>
              Browse approved opportunities and track your applications.
              Only management-approved opportunities appear in Discover.
            </>
          )}
          {canSubmit && (
            <>
              Your submissions are private until university management
              approves them. You can track their review status under
              My Submissions.
            </>
          )}
          {isAdmin && (
            <>
              Review opportunity submissions before publication.
              Rejected submissions must include a reason.
            </>
          )}
        </div>

        <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                visibleTab === tab
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab}
              {tab === "Pending Approvals" &&
                pendingSubmissions.length > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    {pendingSubmissions.length}
                  </span>
                )}
            </button>
          ))}
        </nav>

        {visibleTab === "Discover" && (
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={search}
                maxLength={200}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setDiscoveryPage(1);
                }}
                placeholder="Search by title, organization or skills..."
                className="form-input"
              />

              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setDiscoveryPage(1);
                }}
                className="form-input"
              >
                <option value="All">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by work mode"
                value={workModeFilter}
                onChange={(event) => {
                  setWorkModeFilter(event.target.value);
                  setDiscoveryPage(1);
                }}
                className="form-input"
              >
                <option value="All">All work modes</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ON_SITE">On-site</option>
              </select>

              <select
                aria-label="Filter by compensation"
                value={compensationFilter}
                onChange={(event) => {
                  setCompensationFilter(event.target.value);
                  setDiscoveryPage(1);
                }}
                className="form-input"
              >
                <option value="All">All compensation</option>
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="NOT_SPECIFIED">Not specified</option>
              </select>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {(isStudent ? discoveryOpportunities : filteredOpportunities).map((item) => (
                <OpportunityCard
                  key={item.id}
                  item={item}
                  isSaved={savedIds.includes(item.id)}
                  onSave={() => toggleSave(item.id)}
                  onOpen={() => setSelectedOpportunity(item)}
                  showApply={isStudent}
                  saving={savingIds.includes(item.id)}
                />
              ))}
            </div>

            {isStudent && discoveryState === "loading" && (
              <p role="status" className="py-8 text-center text-sm text-slate-500">Loading opportunities...</p>
            )}
            {isStudent && discoveryState === "error" && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-800">{discoveryError}</p>
                <DevelopmentDiagnosticPanel diagnostic={discoveryDiagnostic} />
                <button onClick={() => setDiscoveryRetry((attempt) => attempt + 1)} className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Retry</button>
              </div>
            )}
            {isStudent && discoveryState === "empty" && (
              <EmptyState message="No matching published opportunities found." />
            )}
            {!isStudent && filteredOpportunities.length === 0 && (
              <EmptyState message="No matching published opportunities found." />
            )}
            {isStudent && discoveryPagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  disabled={discoveryLoading || discoveryPage <= 1}
                  onClick={() => setDiscoveryPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >Previous</button>
                <span className="text-sm text-slate-600">Page {discoveryPagination.page} of {discoveryPagination.totalPages}</span>
                <button
                  disabled={discoveryLoading || discoveryPage >= discoveryPagination.totalPages}
                  onClick={() => setDiscoveryPage((page) => Math.min(discoveryPagination.totalPages, page + 1))}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >Next</button>
              </div>
            )}
          </section>
        )}

        {visibleTab === "My Applications" && isStudent && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Application Tracker</h2>

            {applicationsLoading && (
              <p role="status" className="py-8 text-center text-sm text-slate-500">Loading your applications...</p>
            )}
            {applicationsError && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-800">{applicationsError}</p>
                <DevelopmentDiagnosticPanel diagnostic={applicationsDiagnostic} />
                <button
                  onClick={() => setApplicationsRetry((attempt) => attempt + 1)}
                  className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                >Retry</button>
              </div>
            )}
            {!applicationsLoading && !applicationsError && myApplications.length === 0 ? (
              <EmptyState message="You have not applied for any opportunities yet." />
            ) : !applicationsLoading && !applicationsError ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-4">Opportunity</th>
                      <th className="p-4">Organization</th>
                      <th className="p-4">Applied on</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myApplications.map((application) => (
                        <tr
                          key={application.id}
                          className="border-t border-slate-100"
                        >
                          <td className="p-4 font-semibold">
                            {application.opportunity.title}
                          </td>
                          <td className="p-4">
                            {application.opportunity.organization}
                          </td>
                          <td className="p-4">
                            {new Date(
                              application.appliedAt
                            ).toLocaleDateString("en-IN")}
                          </td>
                          <td className="p-4">
                            <StatusPill status={application.status} />
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {!applicationsLoading && !applicationsError && applicationsPagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  disabled={applicationsPage <= 1}
                  onClick={() => setApplicationsPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >Previous</button>
                <span className="text-sm text-slate-600">Page {applicationsPagination.page} of {applicationsPagination.totalPages}</span>
                <button
                  disabled={applicationsPage >= applicationsPagination.totalPages}
                  onClick={() => setApplicationsPage((page) => Math.min(applicationsPagination.totalPages, page + 1))}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >Next</button>
              </div>
            )}
          </section>
        )}

        {visibleTab === "Saved" && isStudent && (
          <section className="space-y-4">
            {savedLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Loading saved opportunities...</p>}
            {savedError && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-800">{savedError}</p>
                <DevelopmentDiagnosticPanel diagnostic={savedDiagnostic} />
                <button onClick={() => setSavedRetry((attempt) => attempt + 1)} className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Retry</button>
              </div>
            )}
            {!savedLoading && !savedError && mySavedOpportunities.length === 0 && (
              <EmptyState message="You have not saved any opportunities." />
            )}
            {!savedLoading && !savedError && mySavedOpportunities.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {mySavedOpportunities.map((item) => (
                  <OpportunityCard
                    key={item.id}
                    item={item}
                    isSaved
                    onSave={() => toggleSave(item.id)}
                    onOpen={() => setSelectedOpportunity(item)}
                    showApply
                    saving={savingIds.includes(item.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {visibleTab === "My Submissions" && canSubmit && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">My Submitted Opportunities</h2>

            {submissionsLoading && (
              <p role="status" className="py-8 text-center text-sm text-slate-500">Loading your submissions...</p>
            )}
            {submissionsError && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-800">{submissionsError}</p>
                <button
                  onClick={() => setSubmissionsRetry((attempt) => attempt + 1)}
                  className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                >Retry</button>
              </div>
            )}
            {!submissionsLoading && !submissionsError && mySubmissions.length === 0 ? (
              <EmptyState message="You have not submitted any opportunities." />
            ) : !submissionsLoading && !submissionsError ? (
              mySubmissions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.organization} · {item.type}
                      </p>
                    </div>
                    <StatusPill status={item.approvalStatus} />
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Submitted {formatDate(item.createdAt)}
                    {item.publishedAt ? ` · Published ${formatDate(item.publishedAt)}` : ""}
                  </p>

                  {item.approvalStatus === "PENDING" && (
                    <p className="mt-3 text-sm text-amber-700">
                      Awaiting university management review. This
                      opportunity is not visible to students.
                    </p>
                  )}

                  {item.approvalStatus === "APPROVED" && (
                    <p className="mt-3 text-sm text-emerald-700">
                      Approved and published for eligible students.
                    </p>
                  )}

                  {item.approvalStatus === "REJECTED" && item.rejectionReason && (
                    <p className="mt-3 text-sm text-red-700">
                      Rejection reason: {item.rejectionReason}
                    </p>
                  )}
                  {item.review?.decision === "APPROVED" && item.review.reason && (
                    <p className="mt-3 text-sm text-slate-600">Review note: {item.review.reason}</p>
                  )}
                </div>
              ))
            ) : null}
            {!submissionsLoading && !submissionsError && submissionsPagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  disabled={submissionsPage <= 1}
                  onClick={() => setSubmissionsPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >Previous</button>
                <span className="text-sm text-slate-600">Page {submissionsPagination.page} of {submissionsPagination.totalPages}</span>
                <button
                  disabled={submissionsPage >= submissionsPagination.totalPages}
                  onClick={() => setSubmissionsPage((page) => Math.min(submissionsPagination.totalPages, page + 1))}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >Next</button>
              </div>
            )}
          </section>
        )}

        {visibleTab === "Pending Approvals" && isAdmin && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Management Review Queue</h2>

            {adminQueueError ? (
              <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {adminQueueError}
                <button onClick={() => setAdminQueueRetry((attempt) => attempt + 1)} className="ml-3 font-semibold underline">Retry</button>
              </div>
            ) : adminQueueLoading ? (
              <p className="text-sm text-slate-500">Loading pending approvals...</p>
            ) : pendingSubmissions.length === 0 ? (
              <EmptyState message="There are no pending submissions." />
            ) : (
              <>
              {reviewError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{reviewError}</p>}

              {pendingSubmissions.map((item) => (
                <div
                  key={item.id}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.organization} · {item.type}
                      </p>
                    </div>
                    <StatusPill status="PENDING" />
                  </div>

                  <p className="text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <Info label="Submitted by" value={item.submittedBy ?? "Not available"} />
                    <Info
                      label="Submitter role"
                      value={statusLabel(item.submitterRole ?? "UNKNOWN")}
                    />
                    <Info label="Location" value={item.location} />
                    <Info label="Work mode" value={item.workMode} />
                    <Info label="Eligibility" value={item.eligibility} />
                    <Info label="Skills" value={item.skills} />
                    <Info
                      label="Application deadline"
                      value={formatDate(item.deadline)}
                    />
                  </div>

                  {showRejectForm === item.id ? (
                    <div className="space-y-3 rounded-xl bg-red-50 p-4">
                      <label className="block text-sm font-semibold text-red-900">
                        Rejection reason (required)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(event) =>
                          setRejectionReason(event.target.value)
                        }
                        rows={3}
                        maxLength={2_000}
                        placeholder="Explain why this opportunity is being rejected..."
                        className="form-input"
                      />
                      <p className="text-xs text-slate-500">At least 10 characters, up to 2000.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => rejectOpportunity(item.id)}
                          disabled={reviewingId !== null}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                          {reviewingId === item.id ? "Submitting..." : "Confirm rejection"}
                        </button>
                        <button
                          onClick={() => {
                            setShowRejectForm(null);
                            setRejectionReason("");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <button
                        onClick={() => approveOpportunity(item.id)}
                        disabled={reviewingId !== null}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        {reviewingId === item.id ? "Submitting..." : "Approve & Publish"}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(item.id)}
                        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {adminQueuePagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button disabled={adminQueuePage <= 1 || adminQueueLoading} onClick={() => setAdminQueuePage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Previous</button>
                  <span className="text-sm text-slate-600">Page {adminQueuePagination.page} of {adminQueuePagination.totalPages}</span>
                  <button disabled={adminQueuePage >= adminQueuePagination.totalPages || adminQueueLoading} onClick={() => setAdminQueuePage((page) => Math.min(adminQueuePagination.totalPages, page + 1))} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button>
                </div>
              )}
              </>
            )}
          </section>
        )}

        {visibleTab === "Published" && isAdmin && (
          <section className="space-y-3">
            {adminQueueError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{adminQueueError} <button onClick={() => setAdminQueueRetry((attempt) => attempt + 1)} className="font-semibold underline">Retry</button></p> : adminQueueLoading ? <p className="text-sm text-slate-500">Loading published opportunities...</p> : adminPublished.length === 0 ? <EmptyState message="There are no published opportunities." /> : adminPublished.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{item.title}</h3>
                      <p className="text-sm text-slate-500">
                        {item.organization} · {item.type}
                      </p>
                    </div>
                    <StatusPill status="APPROVED" />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Reviewed {item.review ? formatDate(item.review.reviewedAt) : "date unavailable"}</p>
                </div>
              ))}
            {!adminQueueError && adminPublishedPagination.totalPages > 1 && <div className="flex items-center justify-center gap-4 pt-2"><button disabled={adminPublishedPage <= 1 || adminQueueLoading} onClick={() => setAdminPublishedPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Previous</button><span className="text-sm text-slate-600">Page {adminPublishedPagination.page} of {adminPublishedPagination.totalPages}</span><button disabled={adminPublishedPage >= adminPublishedPagination.totalPages || adminQueueLoading} onClick={() => setAdminPublishedPage((page) => Math.min(adminPublishedPagination.totalPages, page + 1))} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button></div>}
          </section>
        )}

        {visibleTab === "Rejected" && isAdmin && (
          <section className="space-y-3">
            {adminQueueError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{adminQueueError} <button onClick={() => setAdminQueueRetry((attempt) => attempt + 1)} className="font-semibold underline">Retry</button></p> : adminQueueLoading ? <p className="text-sm text-slate-500">Loading rejected opportunities...</p> : adminRejected.length === 0 ? <EmptyState message="There are no rejected opportunities." /> : adminRejected.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.organization} · {item.type}</p>
                  <p className="mt-2 text-sm text-red-700">{item.review?.reason ?? "No reason recorded."}</p>
                  <p className="mt-2 text-xs text-slate-500">Reviewed {item.review ? formatDate(item.review.reviewedAt) : "date unavailable"}</p>
                </div>
              ))}
            {!adminQueueError && adminRejectedPagination.totalPages > 1 && <div className="flex items-center justify-center gap-4 pt-2"><button disabled={adminRejectedPage <= 1 || adminQueueLoading} onClick={() => setAdminRejectedPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Previous</button><span className="text-sm text-slate-600">Page {adminRejectedPagination.page} of {adminRejectedPagination.totalPages}</span><button disabled={adminRejectedPage >= adminRejectedPagination.totalPages || adminQueueLoading} onClick={() => setAdminRejectedPage((page) => Math.min(adminRejectedPagination.totalPages, page + 1))} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button></div>}
          </section>
        )}
      </div>

      {notification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-xl">
          {notification}
        </div>
      )}

      {showSubmitForm && canSubmit && (
        <Modal
          title="Submit an Opportunity"
          onClose={() => setShowSubmitForm(false)}
        >
          <div className="space-y-4">
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Your submission will remain hidden from students until
              university management approves it.
            </p>

            <Field label="Opportunity title *">
              <input
                value={form.title}
                maxLength={200}
                onChange={(event) => updateOpportunityForm("title", event.target.value)}
                className="form-input"
                placeholder="e.g. Software Developer Intern"
              />
            </Field>
            {submissionErrors.title && <FieldError message={submissionErrors.title} />}

            <Field label="Organization *">
              <input
                value={form.organization}
                maxLength={200}
                onChange={(event) => updateOpportunityForm("organization", event.target.value)}
                className="form-input"
                placeholder="Company or organization name"
              />
            </Field>
            {submissionErrors.organization && <FieldError message={submissionErrors.organization} />}

            <Field label="Opportunity category *">
              <select
                value={form.type}
                onChange={(event) => updateOpportunityForm("type", event.target.value as OpportunityType)}
                className="form-input"
              >
                {categories
                  .filter((item) =>
                    role === "ALUMNI"
                      ? [
                          "Job",
                          "Internship",
                          "Referral",
                          "Freelance",
                          "Collaboration",
                        ].includes(item)
                      : [
                          "Job",
                          "Internship",
                          "Live Project",
                          "Challenge",
                          "Collaboration",
                          "Research",
                          "Freelance",
                        ].includes(item)
                  )
                  .map((item) => (
                    <option key={item}>{item}</option>
                  ))}
              </select>
            </Field>
            {submissionErrors.type && <FieldError message={submissionErrors.type} />}

            <Field label="Description *">
              <textarea
                rows={4}
                value={form.description}
                maxLength={10_000}
                onChange={(event) => updateOpportunityForm("description", event.target.value)}
                className="form-input"
                placeholder="Describe the opportunity and responsibilities..."
              />
            </Field>
            {submissionErrors.description && <FieldError message={submissionErrors.description} />}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location">
                <input
                  value={form.location}
                  maxLength={200}
                  onChange={(event) => updateOpportunityForm("location", event.target.value)}
                  className="form-input"
                  placeholder="e.g. Hyderabad or Remote"
                />
              </Field>
              {submissionErrors.location && <FieldError message={submissionErrors.location} />}

              <Field label="Work mode">
                <select
                  value={form.workMode}
                  onChange={(event) => updateOpportunityForm("workMode", event.target.value)}
                  className="form-input"
                >
                  <option>Remote</option>
                  <option>Hybrid</option>
                  <option>On-site</option>
                </select>
              </Field>
            </div>
            {submissionErrors.workMode && <FieldError message={submissionErrors.workMode} />}

            <Field label="Compensation">
              <select
                value={form.compensationType}
                onChange={(event) => updateOpportunityForm("compensationType", event.target.value)}
                className="form-input"
              >
                <option value="NOT_SPECIFIED">Not specified</option>
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </Field>
            {submissionErrors.compensationType && <FieldError message={submissionErrors.compensationType} />}

            <Field label="Compensation amount and currency">
              <input
                value={form.compensationAmount}
                maxLength={120}
                onChange={(event) => updateOpportunityForm("compensationAmount", event.target.value)}
                className="form-input"
                placeholder="e.g. INR 50,000 per month"
                aria-describedby="compensation-amount-note"
              />
            </Field>
            <p id="compensation-amount-note" className="-mt-2 text-xs text-slate-500">
              Optional for paid opportunities. This detail is included in the description.
            </p>
            {submissionErrors.compensationAmount && <FieldError message={submissionErrors.compensationAmount} />}

            <Field label="Eligibility *">
              <textarea
                rows={2}
                value={form.eligibility}
                maxLength={5_000}
                onChange={(event) => updateOpportunityForm("eligibility", event.target.value)}
                className="form-input"
                placeholder="Department, semester, qualification, etc."
              />
            </Field>
            {submissionErrors.eligibility && <FieldError message={submissionErrors.eligibility} />}

            <Field label="Required skills">
              <input
                value={form.skills}
                maxLength={2_000}
                onChange={(event) => updateOpportunityForm("skills", event.target.value)}
                className="form-input"
                placeholder="e.g. Python, React, Communication"
              />
            </Field>
            {submissionErrors.requiredSkills && <FieldError message={submissionErrors.requiredSkills} />}

            <Field label="Application URL">
              <input
                type="url"
                value={form.applicationUrl}
                maxLength={2_048}
                onChange={(event) => updateOpportunityForm("applicationUrl", event.target.value)}
                className="form-input"
                placeholder="https://example.com/apply"
              />
            </Field>
            {submissionErrors.applicationUrl && <FieldError message={submissionErrors.applicationUrl} />}

            <Field label="Application deadline *">
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.deadline}
                onChange={(event) => updateOpportunityForm("deadline", event.target.value)}
                className="form-input"
              />
            </Field>
            {submissionErrors.applicationDeadline && <FieldError message={submissionErrors.applicationDeadline} />}

            {submissionError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{submissionError}</p>
            )}

            <button
              onClick={submitOpportunity}
              disabled={submittingOpportunity}
              className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              {submittingOpportunity ? "Submitting..." : "Submit for Management Approval"}
            </button>
          </div>
        </Modal>
      )}

      {selectedOpportunity && (
        <Modal
          title={selectedOpportunity.title}
          onClose={() => setSelectedOpportunity(null)}
        >
          <div className="space-y-4">
            <div>
              <p className="font-semibold">
                {selectedOpportunity.organization}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedOpportunity.type} · {selectedOpportunity.location}
              </p>
            </div>

            <p className="text-sm leading-6 text-slate-600">
              {selectedOpportunity.description}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Work mode" value={selectedOpportunity.workMode} />
              <Info
                label="Deadline"
                value={formatDate(selectedOpportunity.deadline)}
              />
              <Info
                label="Eligibility"
                value={selectedOpportunity.eligibility}
              />
              <Info
                label="Skills"
                value={selectedOpportunity.skills || "Not specified"}
              />
            </div>

            {isStudent && (
              <button
                onClick={() => {
                  setApplicationFeedback("");
                  setShowApplicationForm(true);
                }}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
              >
                Apply for this Opportunity
              </button>
            )}

            {showApplicationForm && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                <label className="block text-sm font-semibold">
                  Short application message (optional)
                </label>
                <textarea
                  value={applicationMessage}
                  maxLength={5_000}
                  onChange={(event) => {
                    setApplicationMessage(event.target.value)
                    setApplicationFeedback("");
                  }}
                  rows={3}
                  placeholder="Introduce yourself and explain your interest..."
                  className="form-input"
                />
                <p className="text-right text-xs text-slate-500">{applicationMessage.length}/5000</p>
                {applicationFeedback && (
                  <p role="alert" className="text-sm text-red-700">{applicationFeedback}</p>
                )}
                <button
                  onClick={applyToOpportunity}
                  disabled={submittingApplication}
                  className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {submittingApplication ? "Submitting..." : "Confirm Application"}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function OpportunityCard({
  item,
  isSaved,
  onSave,
  onOpen,
  showApply,
  saving = false,
}: {
  item: Opportunity;
  isSaved: boolean;
  onSave: () => void;
  onOpen: () => void;
  showApply: boolean;
  saving?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {item.type}
          </span>
          <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {item.organization}
          </p>
        </div>

        {showApply && (
          <button
            onClick={onSave}
            disabled={saving}
            aria-label={isSaved ? "Unsave opportunity" : "Save opportunity"}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? "Saving..." : isSaved ? "Saved" : "Save"}
          </button>
        )}
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
        {item.description}
      </p>

      <div className="mt-4 space-y-2 text-sm text-slate-500">
        <p>Location: {item.location}</p>
        <p>Work mode: {item.workMode}</p>
        <p>Deadline: {formatDate(item.deadline)}</p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs text-emerald-700">
          Management approved
        </span>
        <button
          onClick={onOpen}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View details →
        </button>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
    CLOSED: "bg-slate-100 text-slate-700",
    APPLIED: "bg-blue-50 text-blue-700",
    UNDER_REVIEW: "bg-amber-50 text-amber-700",
    SHORTLISTED: "bg-violet-50 text-violet-700",
    INTERVIEW: "bg-indigo-50 text-indigo-700",
    SELECTED: "bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return <p role="alert" className="-mt-2 text-sm text-red-700">{message}</p>;
}

function DevelopmentDiagnosticPanel({
  diagnostic,
}: {
  diagnostic: OpportunityApiDiagnostic | null;
}) {
  if (process.env.NODE_ENV !== "development" || !diagnostic) return null;

  return (
    <details open className="mx-auto mt-4 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-xs text-slate-800">
      <summary className="cursor-pointer font-semibold">Development diagnostic (sanitized)</summary>
      <dl className="mt-3 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">Endpoint</dt><dd className="break-all">{diagnostic.endpoint}</dd>
        <dt className="font-semibold">Stage</dt><dd>{diagnostic.stage}</dd>
        <dt className="font-semibold">Error</dt><dd>{diagnostic.errorName}</dd>
        {diagnostic.errorCode && <><dt className="font-semibold">Code</dt><dd>{diagnostic.errorCode}</dd></>}
        <dt className="font-semibold">Message</dt><dd className="whitespace-pre-wrap break-words">{diagnostic.message}</dd>
      </dl>
    </details>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-semibold text-slate-700">{message}</p>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
