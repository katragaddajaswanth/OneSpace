import { describe, expect, it, vi } from "vitest";
import {
  buildDiscoveryUrl,
  canSubmitOpportunity,
  discoveryViewState,
  fromApiOpportunity,
  fromSubmissionApiRecord,
  readOpportunityApiFailure,
  sendOpportunityReview,
  submitApplication,
  updateSavedOpportunity,
  validateOpportunitySubmission,
} from "./page";

describe("Career opportunity discovery client", () => {
  it("reads the structured development diagnostic from a failed API response", async () => {
    const failure = await readOpportunityApiFailure(
      Response.json({
        success: false,
        message: "Opportunities could not be loaded.",
        diagnostic: {
          endpoint: "GET /api/opportunities",
          stage: "prisma_queries",
          errorName: "PrismaClientKnownRequestError",
          errorCode: "P2021",
          message: "The table is unavailable.",
        },
      }, { status: 500 }),
      "Please retry.",
      true
    );

    expect(failure.message).toBe("Opportunities could not be loaded.");
    expect(failure.diagnostic).toEqual({
      endpoint: "GET /api/opportunities",
      stage: "prisma_queries",
      errorName: "PrismaClientKnownRequestError",
      errorCode: "P2021",
      message: "The table is unavailable.",
    });
  });

  it("ignores diagnostic fields outside development", async () => {
    const failure = await readOpportunityApiFailure(
      Response.json({
        success: false,
        message: "Saved opportunities could not be retrieved.",
        diagnostic: {
          endpoint: "GET /api/opportunities/saved",
          stage: "prisma_queries",
          errorName: "Error",
          message: "private details",
        },
      }, { status: 500 }),
      "Please retry.",
      false
    );

    expect(failure.message).toBe("Saved opportunities could not be retrieved.");
    expect(failure.diagnostic).toBeNull();
    expect(JSON.stringify(failure)).not.toContain("private details");
  });

  it("sends approval decisions through the existing approval API without identity fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, approval: { decision: "APPROVED" } }));
    await expect(sendOpportunityReview("opp/1", "APPROVE", undefined, fetcher)).resolves.toMatchObject({ kind: "success" });
    expect(fetcher).toHaveBeenCalledWith("/api/opportunities/opp%2F1/approval", expect.objectContaining({
      method: "PATCH",
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ decision: "APPROVE" }),
    }));
    expect(fetcher.mock.calls[0][1]?.body).not.toContain("universityId");
    expect(fetcher.mock.calls[0][1]?.body).not.toContain("reviewerId");
  });

  it("sends rejection reason and reports concurrent review conflicts", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, approval: { decision: "REJECTED" } }))
      .mockResolvedValueOnce(new Response(null, { status: 409 }));
    await expect(sendOpportunityReview("opp_2", "REJECT", "Insufficient details", fetcher)).resolves.toMatchObject({ kind: "success" });
    expect(fetcher.mock.calls[0][1]?.body).toBe(JSON.stringify({ decision: "REJECT", reason: "Insufficient details" }));
    await expect(sendOpportunityReview("opp_2", "APPROVE", undefined, fetcher)).resolves.toEqual({ kind: "conflict" });
  });

  it("builds discovery requests with search, type, work mode, compensation, and page", () => {
    const url = buildDiscoveryUrl({
      page: 3,
      search: "  data engineer  ",
      category: "Live Project",
      workMode: "HYBRID",
      compensation: "PAID",
    });
    const parsed = new URL(url, "http://localhost");

    expect(parsed.pathname).toBe("/api/opportunities");
    expect(parsed.searchParams.get("search")).toBe("data engineer");
    expect(parsed.searchParams.get("type")).toBe("LIVE_PROJECT");
    expect(parsed.searchParams.get("workMode")).toBe("HYBRID");
    expect(parsed.searchParams.get("compensationType")).toBe("PAID");
    expect(parsed.searchParams.get("page")).toBe("3");
    expect(parsed.searchParams.get("limit")).toBe("12");
  });

  it("maps backend opportunity enums and fields to the existing card shape", () => {
    const result = fromApiOpportunity({
      id: "opp_db_123",
      title: "Research Intern",
      organization: "Example Lab",
      description: "Support the research team.",
      type: "INTERNSHIP",
      compensationType: "PAID",
      location: null,
      workMode: "ON_SITE",
      eligibility: "Current students",
      requiredSkills: "Python",
      applicationDeadline: "2027-02-15T12:00:00.000Z",
      applicationUrl: null,
      createdAt: "2026-11-20T00:00:00.000Z",
      publishedAt: "2026-11-21T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      id: "opp_db_123",
      type: "Internship",
      location: "Not specified",
      workMode: "On-site",
      skills: "Python",
      deadline: "2027-02-15T12:00:00.000Z",
      approvalStatus: "APPROVED",
    });
    expect(result).not.toHaveProperty("submitterRole");
  });

  it.each([
    { loading: true, error: "", opportunities: [], expected: "loading" },
    { loading: false, error: "", opportunities: [], expected: "empty" },
    { loading: false, error: "Could not load", opportunities: [], expected: "error" },
    { loading: false, error: "", opportunities: [{ id: "opp_1" }], expected: "results" },
  ])("selects the $expected discovery view state", ({ loading, error, opportunities, expected }) => {
    expect(discoveryViewState(
      loading,
      error,
      opportunities as unknown as Parameters<typeof discoveryViewState>[2]
    )).toBe(expected);
  });

  it("uses same-origin POST and DELETE requests for saving and unsaving", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await expect(updateSavedOpportunity("opp/with spaces", true, fetcher)).resolves.toBe("saved");
    await expect(updateSavedOpportunity("opp_123", false, fetcher)).resolves.toBe("unsaved");

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/opportunities/opp%2Fwith%20spaces/save", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/opportunities/opp_123/save", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
    });
  });

  it("recognizes duplicate-save responses and reports other request errors", async () => {
    const duplicateFetcher = vi.fn().mockResolvedValue(new Response(null, { status: 409 }));
    await expect(updateSavedOpportunity("opp_123", true, duplicateFetcher)).resolves.toBe("already-saved");

    const failingFetcher = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    await expect(updateSavedOpportunity("opp_123", false, failingFetcher)).rejects.toThrow(
      "Could not update saved opportunities."
    );
  });

  it("submits only the supported application message using the same-origin session", async () => {
    const application = {
      id: "application_123",
      status: "APPLIED",
      appliedAt: "2026-11-21T00:00:00.000Z",
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ application }, { status: 201 }));

    await expect(submitApplication("opp/123", "  I am interested.  ", fetcher)).resolves.toEqual({
      kind: "success",
      application,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/opportunities/opp%2F123/apply", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "I am interested." }),
    });

    const sentBody = JSON.parse(fetcher.mock.calls[0][1].body as string);
    expect(sentBody).not.toHaveProperty("studentId");
    expect(sentBody).not.toHaveProperty("universityId");
    expect(sentBody).not.toHaveProperty("status");
  });

  it("validates application message length before sending", async () => {
    const fetcher = vi.fn();
    await expect(submitApplication("opp_123", "x".repeat(5_001), fetcher)).resolves.toEqual({
      kind: "validation-error",
      message: "Application message must be no more than 5000 characters.",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns clear validation and duplicate outcomes from the API", async () => {
    const validationFetcher = vi.fn().mockResolvedValue(Response.json({
      errors: { message: "Message is invalid." },
    }, { status: 400 }));
    await expect(submitApplication("opp_123", "Hello", validationFetcher)).resolves.toEqual({
      kind: "validation-error",
      message: "Message is invalid.",
    });

    const duplicateFetcher = vi.fn().mockResolvedValue(new Response(null, { status: 409 }));
    await expect(submitApplication("opp_123", "Hello", duplicateFetcher)).resolves.toEqual({
      kind: "duplicate",
    });
  });

  it("returns a generic server-error outcome without forwarding internal details", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      message: "private SQL details",
    }, { status: 500 }));
    await expect(submitApplication("opp_123", "Hello", fetcher)).resolves.toEqual({
      kind: "server-error",
    });
  });
});

describe("Alumni and Industry Representative submission client", () => {
  const validForm = {
    title: "Software Engineer Intern",
    organization: "Example Labs",
    type: "Internship" as const,
    description: "Work with an engineering team.",
    location: "Remote",
    workMode: "Remote",
    compensationType: "PAID",
    compensationAmount: "INR 50,000 per month",
    eligibility: "Current university students",
    skills: "TypeScript",
    deadline: "2099-12-30",
    applicationUrl: "https://example.com/careers",
  };

  it("validates the form and builds only the API's accepted submission fields", () => {
    const validation = validateOpportunitySubmission(validForm);
    expect(validation.errors).toEqual({});
    expect(validation.payload).toEqual({
      title: "Software Engineer Intern",
      organization: "Example Labs",
      description: "Work with an engineering team.\n\nCompensation amount: INR 50,000 per month",
      type: "INTERNSHIP",
      compensationType: "PAID",
      location: "Remote",
      workMode: "REMOTE",
      eligibility: "Current university students",
      requiredSkills: "TypeScript",
      applicationDeadline: "2099-12-30",
      applicationUrl: "https://example.com/careers",
    });
    expect(validation.payload).not.toHaveProperty("status");
    expect(validation.payload).not.toHaveProperty("publishedAt");
    expect(validation.payload).not.toHaveProperty("submittedById");
    expect(validation.payload).not.toHaveProperty("universityId");
    expect(validation.payload).not.toHaveProperty("submitterRole");
  });

  it("allows only university members with an eligible authenticated role to see submission controls", () => {
    expect(canSubmitOpportunity("ALUMNI", [], "university_1")).toBe(true);
    expect(canSubmitOpportunity("STUDENT", ["INDUSTRY_REPRESENTATIVE"], "university_1")).toBe(true);
    expect(canSubmitOpportunity("STUDENT", [], "university_1")).toBe(false);
    expect(canSubmitOpportunity("ALUMNI", [], null)).toBe(false);
  });

  it("validates compensation amount format and only includes it in the supported description field", () => {
    const invalidAmount = validateOpportunitySubmission({
      ...validForm,
      compensationAmount: "  ",
    });
    expect(invalidAmount.errors).toEqual({});

    const invalidFormat = validateOpportunitySubmission({
      ...validForm,
      compensationAmount: "INR <script>",
    });
    expect(invalidFormat.errors.compensationAmount).toBe(
      "Enter a valid amount and currency, such as INR 50,000 per month."
    );

    const unpaidWithAmount = validateOpportunitySubmission({
      ...validForm,
      compensationType: "UNPAID",
    });
    expect(unpaidWithAmount.errors.compensationAmount).toBe(
      "Enter an amount only for paid opportunities."
    );
  });

  it("returns field validation errors for required text, invalid enum, URL, and deadline", () => {
    const validation = validateOpportunitySubmission({
      ...validForm,
      title: "   ",
      type: "Unknown" as never,
      applicationUrl: "javascript:alert(1)",
      deadline: "2020-01-01",
    });
    expect(validation.payload).toBeUndefined();
    expect(validation.errors).toMatchObject({
      title: "This field is required.",
      type: "Select a valid opportunity type.",
      applicationUrl: "Enter a valid HTTP or HTTPS URL.",
      applicationDeadline: "The application deadline must be in the future.",
    });
  });

  it("maps own submission status, dates and latest approval or rejection details", () => {
    const record = fromSubmissionApiRecord({
      id: "opp_123",
      title: "Research Assistant",
      organization: "Example Institute",
      description: "Research description.",
      type: "RESEARCH",
      compensationType: "NOT_SPECIFIED",
      location: null,
      workMode: "REMOTE",
      eligibility: "Students",
      requiredSkills: null,
      applicationDeadline: "2099-12-30T23:59:59.999Z",
      applicationUrl: null,
      createdAt: "2026-11-21T00:00:00.000Z",
      publishedAt: null,
      submitterRole: "INDUSTRY_REPRESENTATIVE",
      status: "REJECTED",
      approvalHistory: [{
        decision: "REJECTED",
        reason: "The eligibility details need clarification.",
        reviewedAt: "2026-11-22T00:00:00.000Z",
      }],
    });
    expect(record).toMatchObject({
      id: "opp_123",
      approvalStatus: "REJECTED",
      submitterRole: "INDUSTRY_REPRESENTATIVE",
      rejectionReason: "The eligibility details need clarification.",
      createdAt: "2026-11-21T00:00:00.000Z",
      review: { decision: "REJECTED" },
    });
  });
});
