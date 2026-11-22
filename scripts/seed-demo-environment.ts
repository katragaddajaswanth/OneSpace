import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hashPassword } from "../lib/password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");
if (process.env.NODE_ENV !== "development" || process.env.ONE_SPACE_DATABASE_ENV !== "development") {
  throw new Error("Demo seeding is restricted to the Development environment");
}
if (!/ep-orange-base-bbxyc64t/i.test(connectionString)) {
  throw new Error("Refusing to seed: DATABASE_URL is not the verified Development endpoint");
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const demoUniversity = {
  name: "Demo University",
  slug: "demo-university",
};

const demoPassword = "ONE-Space-Demo-2026!";

const accounts = [
  { key: "student1", fullName: "Aarav Patel", email: "aarav.patel@demo.university", institutionalId: "DEMO-STU-001", role: "STUDENT" as const, semester: 3, department: "Computer Science", program: "B.Tech CSE", batch: "2024-2028" },
  { key: "student2", fullName: "Meera Reddy", email: "meera.reddy@demo.university", institutionalId: "DEMO-STU-002", role: "STUDENT" as const, semester: 5, department: "Computer Science", program: "B.Tech CSE", batch: "2023-2027" },
  { key: "student3", fullName: "Kabir Singh", email: "kabir.singh@demo.university", institutionalId: "DEMO-STU-003", role: "STUDENT" as const, semester: 7, department: "Information Technology", program: "B.Tech IT", batch: "2022-2026" },
  { key: "faculty1", fullName: "Dr. Priya Sharma", email: "priya.sharma@demo.university", institutionalId: "DEMO-FAC-001", role: "FACULTY" as const, department: "Computer Science", program: "B.Tech CSE", designation: "Professor", specialization: "Artificial Intelligence" },
  { key: "faculty2", fullName: "Prof. Arjun Mehta", email: "arjun.mehta@demo.university", institutionalId: "DEMO-FAC-002", role: "FACULTY" as const, department: "Computer Science", program: "B.Tech CSE", designation: "Associate Professor", specialization: "Database Systems" },
  { key: "alumni1", fullName: "Ananya Kapoor", email: "ananya.kapoor@demo.university", institutionalId: "DEMO-ALM-001", role: "ALUMNI" as const, department: "Computer Science", program: "B.Tech CSE" },
  { key: "alumni2", fullName: "Rohan Verma", email: "rohan.verma@demo.university", institutionalId: "DEMO-ALM-002", role: "ALUMNI" as const, department: "Information Technology", program: "B.Tech IT" },
  { key: "admin", fullName: "Neha Iyer", email: "neha.iyer@demo.university", institutionalId: "DEMO-ADM-001", role: "FACULTY" as const, department: "University Administration", program: "Administration" },
];

async function main() {
  const university = await prisma.university.upsert({
    where: { slug: demoUniversity.slug },
    update: { name: demoUniversity.name, isActive: true },
    create: { name: demoUniversity.name, slug: demoUniversity.slug, isActive: true },
  });

  const departments = new Map<string, string>();
  for (const departmentName of ["Computer Science", "Information Technology", "University Administration"]) {
    const department = await prisma.department.upsert({
      where: { universityId_name: { universityId: university.id, name: departmentName } },
      update: {},
      create: { universityId: university.id, name: departmentName, code: departmentName === "Computer Science" ? "CSE" : departmentName === "Information Technology" ? "IT" : "ADMIN" },
    });
    departments.set(departmentName, department.id);
  }

  const programs = new Map<string, string>();
  for (const [departmentName, programName, code] of [
    ["Computer Science", "B.Tech CSE", "BT-CSE"],
    ["Information Technology", "B.Tech IT", "BT-IT"],
    ["University Administration", "Administration", "ADMIN"],
  ] as const) {
    const departmentId = departments.get(departmentName)!;
    const program = await prisma.program.upsert({
      where: { departmentId_name: { departmentId, name: programName } },
      update: {},
      create: { departmentId, name: programName, code },
    });
    programs.set(programName, program.id);
  }

  const users = new Map<string, any>();
  for (const account of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: account.email }, select: { passwordHash: true } });
    const passwordHash = existing?.passwordHash ?? await hashPassword(demoPassword);
    const departmentId = departments.get(account.department)!;
    const programId = programs.get(account.program)!;
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        fullName: account.fullName,
        institutionalId: account.institutionalId,
        primaryRole: account.role,
        universityId: university.id,
        departmentId,
        programId,
        accountStatus: "ACTIVE",
        emailVerified: true,
      },
      create: {
        fullName: account.fullName,
        email: account.email,
        passwordHash,
        institutionalId: account.institutionalId,
        primaryRole: account.role,
        universityId: university.id,
        departmentId,
        programId,
        accountStatus: "ACTIVE",
        emailVerified: true,
      },
    });
    if (account.role === "STUDENT") {
      await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: { admissionYear: 2023 - ((account.semester - 1) / 2), currentSemester: account.semester, batch: account.batch },
        create: { userId: user.id, admissionYear: 2023 - ((account.semester - 1) / 2), currentSemester: account.semester, batch: account.batch },
      });
    }
    if (account.role === "FACULTY" && account.key !== "admin") {
      await prisma.facultyProfile.upsert({
        where: { userId: user.id },
        update: { designation: account.designation, specialization: account.specialization, experienceYears: account.key === "faculty1" ? 12 : 9 },
        create: { userId: user.id, designation: account.designation, specialization: account.specialization, experienceYears: account.key === "faculty1" ? 12 : 9 },
      });
    }
    users.set(account.key, user);
  }

  const admin = users.get("admin");
  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: "ADMINISTRATOR" } },
    update: {},
    create: { userId: admin.id, role: "ADMINISTRATOR" },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: "PROCTOR" } },
    update: {},
    create: { userId: admin.id, role: "PROCTOR" },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: "PROJECT_ANALYSIS_CREW" } },
    update: {},
    create: { userId: admin.id, role: "PROJECT_ANALYSIS_CREW" },
  });

  let profilesCreated = 0;
  for (const account of accounts) {
    const user = users.get(account.key);
    const existingProfile = await prisma.unifiedProfile.findUnique({ where: { userId: user.id } });
    if (!existingProfile) profilesCreated++;
    const profile = await prisma.unifiedProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        bio: account.key.startsWith("student")
          ? `${account.fullName} is a ${account.department} student interested in building practical software, open-source collaboration and university projects.`
          : account.key.startsWith("faculty")
            ? `${account.fullName} teaches ${account.specialization ?? "university programs"} and mentors students through applied academic projects.`
            : account.key.startsWith("alumni")
              ? `${account.fullName} is a ${account.department} alumnus supporting students through mentoring, career guidance and real-world projects.`
              : "University administrator responsible for governance, approvals and academic platform operations.",
        skills: account.key === "student1" ? ["React", "TypeScript", "Node.js"] : account.key === "student2" ? ["Python", "Machine Learning", "PostgreSQL"] : account.key === "student3" ? ["Cybersecurity", "Linux", "Networking"] : account.key === "alumni1" ? ["Software Engineering", "Cloud", "Mentoring"] : account.key === "alumni2" ? ["DevOps", "Cybersecurity", "Career Guidance"] : ["Teaching", "Research", "Academic Mentoring"],
        interests: ["Open Source", "University Innovation", "Technology"],
        visibility: "UNIVERSITY",
      },
    });

    if (account.key === "alumni1" || account.key === "alumni2") {
      await prisma.profileSkillVerification.upsert({
        where: { userId_skill: { userId: user.id, skill: account.key === "alumni1" ? "Cloud Architecture" : "DevOps" } },
        update: { status: "VERIFIED", verifierId: admin.id, verifiedAt: new Date() },
        create: { profileId: profile.id, userId: user.id, skill: account.key === "alumni1" ? "Cloud Architecture" : "DevOps", status: "VERIFIED", verifierId: admin.id, verifiedAt: new Date() },
      });
    }

    const experienceTitle = account.key === "alumni1" ? "Senior Software Engineer" : account.key === "alumni2" ? "Cloud and Security Engineer" : account.key === "faculty1" ? "Professor" : account.key === "faculty2" ? "Associate Professor" : "Student Developer";
    await prisma.profileExperience.findFirst({ where: { profileId: profile.id, organization: "Demo University", title: experienceTitle } }).then(async (item) => {
      if (!item) await prisma.profileExperience.create({ data: { profileId: profile.id, organization: "Demo University", title: experienceTitle, description: "Demonstration profile experience record." } });
    });
  }

  const student1 = users.get("student1");
  const student2 = users.get("student2");
  const student3 = users.get("student3");
  const faculty1 = users.get("faculty1");
  const faculty2 = users.get("faculty2");

  const profileCertifications = [
    [student1.id, "AWS Cloud Practitioner", "Amazon Web Services"],
    [student2.id, "TensorFlow Developer", "Google"],
    [student3.id, "CompTIA Security+", "CompTIA"],
  ] as const;
  for (const [ownerId, title, issuer] of profileCertifications) {
    const profile = await prisma.unifiedProfile.findUnique({ where: { userId: ownerId } });
    await prisma.profileCertification.findFirst({ where: { ownerId, title } }).then(async (item) => {
      if (!item) await prisma.profileCertification.create({ data: { profileId: profile!.id, ownerId, title, issuer, status: "VERIFIED", verifiedById: admin.id, verifiedAt: new Date() } });
    });
  }

  const portfolioItems = [
    [student1.id, "PROJECT" as const, "Campus Lost and Found Portal", "React and Node.js platform for university items"],
    [student2.id, "ACHIEVEMENT" as const, "AI Research Symposium Winner", "Prototype AI project demonstrated at the university symposium"],
    [student3.id, "PROJECT" as const, "Network Incident Monitor", "Linux and packet-analysis security dashboard"],
  ] as const;
  for (const [userId, type, title, description] of portfolioItems) {
    const profile = await prisma.unifiedProfile.findUnique({ where: { userId } });
    await prisma.profilePortfolioItem.findFirst({ where: { userId, title } }).then(async (item) => {
      if (!item) await prisma.profilePortfolioItem.create({ data: { profileId: profile!.id, userId, type, title, description } });
    });
  }

  const communitiesData = [
    { name: "Coding Club", category: "Technology", tags: ["coding", "open-source"], privacy: "OPEN" as const, description: "Collaborative programming, open-source mentoring and coding challenges." },
    { name: "AI and Machine Learning", category: "Artificial Intelligence", tags: ["AI", "ML", "research"], privacy: "APPROVAL_REQUIRED" as const, description: "AI research discussions, model-building projects and paper reviews." },
    { name: "Cybersecurity Club", category: "Security", tags: ["cybersecurity", "CTF"], privacy: "OPEN" as const, description: "Hands-on defensive security, CTF practice and incident analysis." },
    { name: "Entrepreneurship Cell", category: "Entrepreneurship", tags: ["startup", "business"], privacy: "OPEN" as const, description: "Startup ideation, pitch practice and student venture collaboration." },
  ];
  const communityIds = new Map<string, string>();
  for (let index = 0; index < communitiesData.length; index++) {
    const data = communitiesData[index];
    const creator = [student1, student2, student3, faculty1][index];
    let community = await prisma.community.findFirst({ where: { universityId: university.id, name: data.name } });
    if (!community) {
      community = await prisma.community.create({ data: { universityId: university.id, createdById: creator.id, name: data.name, description: data.description, category: data.category, tags: data.tags, privacy: data.privacy, status: "PENDING" } });
    }
    await prisma.community.update({
      where: { id: community.id },
      data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date(), reviewNote: "Approved demonstration community." },
    });
    communityIds.set(data.name, community.id);
  }
  for (const [communityName, memberIds] of [
    ["Coding Club", [student1.id, student2.id, student3.id, faculty1.id]],
    ["AI and Machine Learning", [student1.id, student2.id, faculty1.id]],
    ["Cybersecurity Club", [student2.id, student3.id, faculty2.id]],
    ["Entrepreneurship Cell", [student1.id, student3.id]],
  ] as const) {
    const communityId = communityIds.get(communityName)!;
    for (const userId of memberIds) {
      await prisma.communityMembership.upsert({
        where: { communityId_userId: { communityId, userId } },
        update: { status: "APPROVED", respondedAt: new Date() },
        create: { communityId, userId, status: "APPROVED", respondedAt: new Date() },
      });
    }
  }

  const communityDiscussions = [
    ["Coding Club", "This week: bring one open-source issue you want to solve and pair with a teammate."],
    ["AI and Machine Learning", "Share one practical ML project idea and identify the dataset and baseline model."],
    ["Cybersecurity Club", "Next CTF practice will cover web exploitation and secure debugging fundamentals."],
  ] as const;
  for (const [communityName, content] of communityDiscussions) {
    const communityId = communityIds.get(communityName)!;
    const existing = await prisma.communityPost.findFirst({ where: { communityId, content } });
    if (!existing) await prisma.communityPost.create({ data: { communityId, authorId: student1.id, content } });
  }

  let pendingCommunity = await prisma.community.findFirst({ where: { universityId: university.id, name: "Robotics Society" } });
  if (!pendingCommunity) {
    pendingCommunity = await prisma.community.create({ data: { universityId: university.id, createdById: student3.id, name: "Robotics Society", description: "Prototype robotics projects and embedded systems demonstrations.", category: "Robotics", tags: ["robotics", "embedded"], privacy: "APPROVAL_REQUIRED", status: "PENDING" } });
  } else {
    await prisma.community.update({ where: { id: pendingCommunity.id }, data: { status: "PENDING", reviewedById: null, reviewedAt: null, reviewNote: null } });
  }

  const projectData = [
    { title: "Smart Campus Energy Monitor", category: "Sustainability", theme: "Green Campus", problem: "Track high-impact energy usage across campus buildings.", skills: ["React", "IoT", "PostgreSQL"], lead: student1, status: "OPEN" as const },
    { title: "Adaptive Interview Preparation", category: "Career Technology", theme: "Student Employability", problem: "Provide personalized interview practice and feedback.", skills: ["Python", "NLP", "React"], lead: student2, status: "IN_PROGRESS" as const },
    { title: "Campus Cyber Defense Lab", category: "Cybersecurity", theme: "Digital Safety", problem: "Create a safe lab for detecting and responding to simulated incidents.", skills: ["Linux", "Networking", "SIEM"], lead: student3, status: "IN_PROGRESS" as const },
    { title: "Accessible Learning Companion", category: "Accessibility", theme: "Inclusive Education", problem: "Improve access to learning materials for students with varied needs.", skills: ["TypeScript", "AI", "Accessibility"], lead: student1, status: "COMPLETED" as const },
    { title: "Community Waste Exchange", category: "Social Impact", theme: "Circular Economy", problem: "Connect reusable campus resources with student and community needs.", skills: ["Mobile", "Maps", "Node.js"], lead: student3, status: "PENDING_PROCTOR_APPROVAL" as const },
  ];
  const projectIds = new Map<string, string>();
  for (const data of projectData) {
    let project = await prisma.project.findFirst({ where: { universityId: university.id, title: data.title } });
    if (!project) {
      project = await prisma.project.create({
        data: { universityId: university.id, leadId: data.lead.id, title: data.title, description: `${data.title} is a realistic student-led prototype focused on measurable university impact.`, category: data.category, theme: data.theme, problemStatement: data.problem, requiredSkills: data.skills, objectives: "Build a working prototype, validate it with users and document outcomes.", outcomes: "A demonstrable solution with measurable campus value.", visibility: "UNIVERSITY", status: data.status, proctorId: data.status === "PENDING_PROCTOR_APPROVAL" ? null : admin.id, proctorReviewedAt: data.status === "PENDING_PROCTOR_APPROVAL" ? null : new Date() },
      });
    } else {
      await prisma.project.update({ where: { id: project.id }, data: { status: data.status, requiredSkills: data.skills } });
    }
    projectIds.set(data.title, project.id);
  }

  for (const [title, memberIds] of [
    ["Smart Campus Energy Monitor", [student1.id, student2.id]],
    ["Adaptive Interview Preparation", [student2.id, student3.id]],
    ["Campus Cyber Defense Lab", [student3.id, student1.id]],
    ["Accessible Learning Companion", [student1.id, student2.id]],
  ] as const) {
    const projectId = projectIds.get(title)!;
    for (const userId of memberIds) {
      await prisma.projectMember.upsert({ where: { projectId_userId: { projectId, userId } }, update: {}, create: { projectId, userId } });
    }
  }

  for (const [title, status, score] of [
    ["Adaptive Interview Preparation", "ACCEPTED" as const, 88],
    ["Campus Cyber Defense Lab", "NEEDS_CHANGES" as const, 74],
    ["Accessible Learning Companion", "ACCEPTED" as const, 92],
  ] as const) {
    const projectId = projectIds.get(title)!;
    const existing = await prisma.projectEvaluation.findFirst({ where: { projectId, reviewerId: admin.id, feedback: status === "ACCEPTED" ? "Strong implementation plan and measurable project outcomes." : "Improve threat-model documentation and testing evidence." } });
    if (!existing) await prisma.projectEvaluation.create({ data: { projectId, reviewerId: admin.id, status, score, feedback: status === "ACCEPTED" ? "Strong implementation plan and measurable project outcomes." : "Improve threat-model documentation and testing evidence." } });
  }

  let revaluation = await prisma.projectRevaluationRequest.findFirst({ where: { projectId: projectIds.get("Campus Cyber Defense Lab")!, requesterId: student3.id } });
  if (!revaluation) {
    revaluation = await prisma.projectRevaluationRequest.create({ data: { projectId: projectIds.get("Campus Cyber Defense Lab")!, requesterId: student3.id, reason: "Updated threat-model documentation and expanded test evidence." } });
  }

  let postCount = 0;
  const postData = [
    [student1.id, "Started planning a campus energy dashboard with live visualizations. Looking for teammates interested in IoT and React.", "APPROVED"],
    [student2.id, "Our interview-preparation prototype now includes personalized practice questions and a review rubric.", "APPROVED"],
    [student3.id, "Cybersecurity Club is opening CTF practice sessions this week. Beginners are welcome.", "APPROVED"],
    [faculty1.id, "Reminder: project proposals should identify a real user, an implementation plan and measurable outcomes.", "APPROVED"],
    [faculty2.id, "Database systems students will review normalization and indexing examples during Friday's lab.", "APPROVED"],
    [users.get("alumni1").id, "Sharing a career tip: communicate the impact of each project, not just its technology stack.", "APPROVED"],
    [users.get("alumni2").id, "Open-source contribution is an excellent way to practice code review and incident debugging.", "APPROVED"],
    [student2.id, "Machine learning study group: compare baseline models before adding advanced preprocessing.", "APPROVED"],
    [student3.id, "Demo moderation example: this post is awaiting Proctor review.", "PENDING"],
    [student1.id, "Draft update for the campus sustainability project; pending community review.", "PENDING"],
  ] as const;
  for (const [authorId, content, status] of postData) {
    const existing = await prisma.universityPost.findFirst({ where: { universityId: university.id, authorId, content } });
    if (!existing) {
      await prisma.universityPost.create({ data: { authorId, universityId: university.id, content, attachments: [], visibility: "UNIVERSITY", status, requiresProctorApproval: true, moderatorId: status === "APPROVED" ? admin.id : null, moderationNote: status === "APPROVED" ? "Approved for the demonstration feed." : null, moderatedAt: status === "APPROVED" ? new Date() : null } });
      postCount++;
    }
  }

  const approvedPosts = await prisma.universityPost.findMany({ where: { universityId: university.id, status: "APPROVED" }, take: 20, select: { id: true } });
  for (let index = 0; index < approvedPosts.length; index++) {
    const post = approvedPosts[index];
    const liker = index % 2 === 0 ? student2 : student3;
    await prisma.postLike.upsert({ where: { postId_userId: { postId: post.id, userId: liker.id } }, update: { removedAt: null }, create: { postId: post.id, userId: liker.id } });
  }
  for (const post of approvedPosts.slice(0, 4)) {
    const existingComment = await prisma.postComment.findFirst({ where: { postId: post.id, content: "Great initiative - happy to collaborate." } });
    if (!existingComment) await prisma.postComment.create({ data: { postId: post.id, userId: faculty1.id, content: "Great initiative - happy to collaborate." } });
  }

  const alumni1 = users.get("alumni1");
  const alumni2 = users.get("alumni2");
  for (const [accountKey, expertise, semesters] of [
    ["alumni1", ["Cloud Architecture", "Software Engineering"], [5, 6, 7, 8]],
    ["alumni2", ["DevOps", "Cybersecurity"], [6, 7, 8]],
  ] as const) {
    const alumni = users.get(accountKey);
    const profile = await prisma.unifiedProfile.findUnique({ where: { userId: alumni.id } });
    await prisma.mentorProfile.upsert({
      where: { userId: alumni.id },
      update: { enabled: true, available: true, expertise: [...expertise], eligibleSemesters: [...semesters], bio: accountKey === "alumni1" ? "Software engineering and cloud mentor helping students plan projects and prepare for technical careers." : "DevOps and cybersecurity mentor supporting students with practical labs and career readiness." },
      create: { profileId: profile!.id, userId: alumni.id, enabled: true, available: true, expertise: [...expertise], eligibleSemesters: [...semesters], bio: accountKey === "alumni1" ? "Software engineering and cloud mentor helping students plan projects and prepare for technical careers." : "DevOps and cybersecurity mentor supporting students with practical labs and career readiness." },
    });
  }

  const mentor1 = await prisma.mentorProfile.findUnique({ where: { userId: alumni1.id } });
  const mentor2 = await prisma.mentorProfile.findUnique({ where: { userId: alumni2.id } });
  for (const [mentorId, menteeId, goal, message, accepted] of [
    [mentor1!.id, student1.id, "Plan a cloud deployment portfolio", "I would like guidance on choosing a practical cloud project.", true],
    [mentor1!.id, student2.id, "Prepare for software engineering interviews", "Please help me structure interview preparation and project stories.", false],
    [mentor2!.id, student3.id, "Build a cybersecurity career roadmap", "I need help selecting practical security labs and certifications.", true],
  ] as const) {
    let request = await prisma.mentorshipRequest.findUnique({ where: { mentorId_menteeId: { mentorId, menteeId } } }).catch(() => null);
    if (!request) {
      request = await prisma.mentorshipRequest.create({ data: { mentorId, menteeId, goal, message, status: accepted ? "ACCEPTED" : "PENDING", respondedAt: accepted ? new Date() : null } });
    }
    if (accepted) {
      await prisma.mentorshipRelationship.upsert({
        where: { requestId: request.id },
        update: { status: "ACTIVE" },
        create: { mentorId, menteeId, requestId: request.id, status: "ACTIVE" },
      });
    }
  }

  const counts = {
    accounts: accounts.length,
    profiles: profilesCreated,
    communities: communitiesData.length,
    pendingCommunities: 1,
    projects: projectData.length,
    approvedFeedPosts: postData.filter((item) => item[2] === "APPROVED").length,
    pendingFeedPosts: postData.filter((item) => item[2] === "PENDING").length,
    mentorshipProfiles: 2,
  };

  console.log("Demo environment seed completed.");
  console.log(JSON.stringify(counts, null, 2));
  console.log("Demo account credentials:");
  for (const account of accounts) {
    console.log(`${account.fullName} | ${account.email} | ${demoPassword}`);
  }
  console.log("Note: existing account passwords were preserved; credentials above apply to newly seeded accounts.");
}

main()
  .catch((error) => {
    console.error(`Demo seed failed: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
