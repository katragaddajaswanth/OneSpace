
import { getAuthenticatedSession } from "@/lib/auth";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();

  try {
    const session = await getAuthenticatedSession(request);

    if ("failure" in session && session.failure === "missing") {
      return Response.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    if ("failure" in session) {
      return Response.json(
        { success: false, message: "Session is invalid or expired." },
        { status: 401 }
      );
    }

    const user = session.user;

    return Response.json(
      {
        success: true,
        message: "Session is valid.",
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          institutionalId: user.institutionalId,
          primaryRole: user.primaryRole,
          secondaryRoles: user.secondaryRoles.map(
            (item) => item.role
          ),
          accountStatus: user.accountStatus,

          university: user.university
            ? {
                id: user.university.id,
                name: user.university.name,
                slug: user.university.slug,
              }
            : null,

          department: user.department
            ? {
                id: user.department.id,
                name: user.department.name,
                code: user.department.code,
              }
            : null,

          program: user.program
            ? {
                id: user.program.id,
                name: user.program.name,
                code: user.program.code,
              }
            : null,

          studentProfile: user.studentProfile
            ? {
                admissionYear: user.studentProfile.admissionYear,
                currentSemester: user.studentProfile.currentSemester,
                batch: user.studentProfile.batch,
              }
            : null,

          facultyProfile: user.facultyProfile
            ? {
                designation: user.facultyProfile.designation,
                specialization: user.facultyProfile.specialization,
                experienceYears: user.facultyProfile.experienceYears,
              }
            : null,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("SESSION VERIFICATION ERROR:", error);

    return Response.json(
      { success: false, message: "Could not verify session." },
      { status: 500 }
    );
  }
}
