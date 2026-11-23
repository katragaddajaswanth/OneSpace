import { requireUniversityUser, requireWritableUniversity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiJson, readJsonObject, rejectUnexpectedFields, requiredText } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUniversityUser(request);
    if (auth.response) return auth.response;
    const requests = await prisma.mentorshipRequest.findMany({
      where: { OR: [{ menteeId: auth.user.id }, { mentor: { userId: auth.user.id } }], mentor: { user: { universityId: auth.user.universityId } } },
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, message: true, goal: true, status: true, createdAt: true, respondedAt: true, mentee: { select: { id: true, fullName: true, primaryRole: true } }, mentor: { select: { id: true, userId: true, user: { select: { fullName: true } } } } },
    });
    const relationships = await prisma.mentorshipRelationship.findMany({ where: { OR: [{ menteeId: auth.user.id }, { mentor: { userId: auth.user.id } }], mentor: { user: { universityId: auth.user.universityId } } }, orderBy: { startedAt: "desc" }, take: 100, select: { id: true, status: true, startedAt: true, endedAt: true, mentee: { select: { id: true, fullName: true } }, mentor: { select: { user: { select: { id: true, fullName: true } } } } } });
    return apiJson({ success: true, requests, relationships });
  } catch {
    return apiJson({ success: false, message: "Mentorship requests could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireWritableUniversity(request);
    if (auth.response) return auth.response;
    if (auth.user.primaryRole === "PROSPECTIVE_STUDENT") return apiJson({ success: false, message: "Mentorship requests are available only to enrolled students." }, 403);
    if (auth.user.primaryRole !== "STUDENT") return apiJson({ success: false, message: "Only students may request mentorship." }, 403);
    const parsed = await readJsonObject(request);
    if (parsed.response) return parsed.response;
    const invalid = rejectUnexpectedFields(parsed.body, ["mentorId", "message", "goal"]);
    if (invalid) return invalid;
    const mentorId = requiredText(parsed.body, "mentorId", 100);
    const message = requiredText(parsed.body, "message", 2000);
    const goal = requiredText(parsed.body, "goal", 1000);
    if (!mentorId || !message || !goal) return apiJson({ success: false, message: "Mentor, personal message, and goal are required." }, 400);
    const mentor = await prisma.mentorProfile.findFirst({ where: { id: mentorId, enabled: true, available: true, user: { universityId: auth.user.universityId, accountStatus: "ACTIVE", emailVerified: true, unifiedProfile: { is: { visibility: { in: ["UNIVERSITY", "PUBLIC"] } } } } }, select: { id: true, userId: true, eligibleSemesters: true } });
    if (!mentor || mentor.userId === auth.user.id) return apiJson({ success: false, message: "Mentor is unavailable." }, 404);
    const semester = auth.user.studentProfile?.currentSemester;
    if (mentor.eligibleSemesters.length && (!semester || !mentor.eligibleSemesters.includes(semester))) return apiJson({ success: false, message: "This mentor is not accepting requests for your semester." }, 403);
    const mentorshipRequest = await prisma.mentorshipRequest.create({ data: { mentorId, menteeId: auth.user.id, message, goal }, select: { id: true, status: true, createdAt: true } });
    return apiJson({ success: true, request: mentorshipRequest }, 201);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return apiJson({ success: false, message: "A request to this mentor already exists." }, 409);
    return apiJson({ success: false, message: "Mentorship request could not be submitted." }, 500);
  }
}
