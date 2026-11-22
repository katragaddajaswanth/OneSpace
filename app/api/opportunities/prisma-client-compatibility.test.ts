import { describe, expect, it, vi } from "vitest";
import {
  getOrCreateCompatiblePrismaClient,
  hasRequiredPrismaDelegates,
} from "@/lib/prisma-client-compatibility";

function currentClientFixture() {
  const readMethods = { findMany: vi.fn(), count: vi.fn() };
  return {
    userSession: { findUnique: vi.fn(), update: vi.fn() },
    unifiedProfile: { findUnique: vi.fn(), upsert: vi.fn() },
    profileExperience: { create: vi.fn() },
    profileCertification: { findMany: vi.fn(), create: vi.fn() },
    profilePortfolioItem: { findMany: vi.fn(), create: vi.fn() },
    profileCorrection: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    profileSkillVerification: { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    universityPost: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    postLike: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    postComment: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    project: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    projectMember: { findUnique: vi.fn(), create: vi.fn() },
    projectJoinRequest: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    community: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    communityMembership: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    communityPost: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    mentorProfile: { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    mentorshipRequest: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    mentorshipRelationship: { findMany: vi.fn(), create: vi.fn() },
    opportunity: { ...readMethods },
    savedOpportunity: { ...readMethods },
    opportunityApplication: { ...readMethods },
  };
}

describe("generated Prisma client compatibility", () => {
  it("accepts a client with session and discovery delegates required by current routes", () => {
    expect(hasRequiredPrismaDelegates(currentClientFixture())).toBe(true);
  });

  it("rejects a cached client generated before the Opportunity model delegate existed", () => {
    const staleClient = currentClientFixture();
    delete (staleClient as { opportunity?: unknown }).opportunity;

    expect(hasRequiredPrismaDelegates(staleClient)).toBe(false);
  });

  it("recreates an incompatible hot-reloaded singleton but reuses a compatible one", () => {
    const staleClient = currentClientFixture();
    delete (staleClient as { opportunity?: unknown }).opportunity;
    const freshClient = currentClientFixture();
    const createClient = vi.fn(() => freshClient);

    expect(getOrCreateCompatiblePrismaClient(staleClient, createClient)).toBe(freshClient);
    expect(createClient).toHaveBeenCalledOnce();

    createClient.mockClear();
    expect(getOrCreateCompatiblePrismaClient(freshClient, createClient)).toBe(freshClient);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("safely rejects missing and throwing delegates", () => {
    expect(hasRequiredPrismaDelegates(undefined)).toBe(false);
    expect(hasRequiredPrismaDelegates({
      get opportunity() {
        throw new TypeError("stale generated client");
      },
    })).toBe(false);
  });
});
