const requiredDelegateMethods = {
  userSession: ["findUnique", "update"],
  unifiedProfile: ["findUnique", "upsert"],
  profileExperience: ["create"],
  profileCertification: ["findMany", "create"],
  profilePortfolioItem: ["findMany", "create"],
  profileCorrection: ["findMany", "count", "create"],
  profileSkillVerification: ["findMany", "count", "upsert"],
  universityPost: ["findMany", "count", "create"],
  postLike: ["findUnique", "create", "update"],
  postComment: ["findMany", "create", "update"],
  project: ["findMany", "count", "create", "update", "updateMany"],
  projectMember: ["findUnique", "create"],
  projectJoinRequest: ["findUnique", "create", "updateMany"],
  community: ["findMany", "count", "create", "update"],
  communityMembership: ["findMany", "findFirst", "upsert", "updateMany"],
  communityPost: ["findMany", "create", "update"],
  mentorProfile: ["findMany", "count", "upsert"],
  mentorshipRequest: ["findMany", "create", "updateMany"],
  mentorshipRelationship: ["findMany", "create"],
  opportunity: ["findMany", "count"],
  savedOpportunity: ["findMany", "count"],
  opportunityApplication: ["findMany", "count"],
} as const;

/** Rejects hot-reloaded Prisma clients generated before these model delegates existed. */
export function hasRequiredPrismaDelegates(client: unknown): boolean {
  if ((typeof client !== "object" && typeof client !== "function") || client === null) {
    return false;
  }

  try {
    const delegates = client as Record<string, unknown>;
    return Object.entries(requiredDelegateMethods).every(([name, methods]) => {
      const delegate = delegates[name];
      if ((typeof delegate !== "object" && typeof delegate !== "function") || delegate === null) {
        return false;
      }

      const operations = delegate as Record<string, unknown>;
      return methods.every((method) => typeof operations[method] === "function");
    });
  } catch {
    return false;
  }
}

export function getOrCreateCompatiblePrismaClient<T>(
  cachedClient: T | undefined,
  createClient: () => T
): T {
  return cachedClient !== undefined && hasRequiredPrismaDelegates(cachedClient)
    ? cachedClient
    : createClient();
}
