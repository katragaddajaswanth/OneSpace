
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createAndSendOtp } from "@/lib/otp-service";
import {
  getERPAdapter,
  ERPIntegrationNotConfiguredError,
} from "@/modules/erp-integration";

import type { ERPPrimaryRole } from "@/modules/erp-integration/types";

type RegistrationBody = {
  accountType?: string;
  institutionalId?: string;
  fullName?: string;
  email?: string;
  universitySlug?: string;
  password?: string;
  departmentId?: string;
  programId?: string;
  admissionYear?: number;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let userId: string | undefined;

  try {
    const body = (await request.json()) as RegistrationBody;

    const {
      accountType,
      institutionalId,
      fullName,
      email,
      universitySlug,
      password,
      departmentId: requestedDepartmentId,
      programId: requestedProgramId,
      admissionYear,
    } = body;

    if (
      !password ||
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return Response.json(
        { success: false, message: "Password must be at least 12 characters and at most 72 bytes." },
        { status: 400 }
      );
    }

    let primaryRole: ERPPrimaryRole | "PROSPECTIVE_STUDENT";
    let officialEmail: string;
    let verifiedName: string;
    let verifiedUniversitySlug: string;
    let departmentName: string | undefined;
    let programName: string | undefined;
    let currentSemester: number | undefined;
    let verifiedInstitutionalId: string | undefined;

    // -------------------------------------------
    // INSTITUTIONAL REGISTRATION
    // Student, Faculty and Alumni
    // -------------------------------------------

    if (accountType === "INSTITUTIONAL") {
      if (
        !institutionalId ||
        typeof institutionalId !== "string" ||
        institutionalId.trim().length < 3
      ) {
        return Response.json(
          { success: false, message: "A valid institutional ID is required." },
          { status: 400 }
        );
      }

      const erpRecord = await getERPAdapter().findByInstitutionalId(
        institutionalId.trim()
      );

      if (!erpRecord || erpRecord.status !== "ACTIVE") {
        return Response.json(
          { success: false, message: "Unable to verify your institutional record." },
          { status: 400 }
        );
      }

      primaryRole = erpRecord.primaryRole;
      officialEmail = erpRecord.officialEmail.trim().toLowerCase();
      verifiedName = erpRecord.fullName;
      verifiedUniversitySlug = erpRecord.universitySlug;
      departmentName = erpRecord.departmentName;
      programName = erpRecord.programName;
      currentSemester = erpRecord.currentSemester;
      verifiedInstitutionalId = erpRecord.institutionalId;

    // -------------------------------------------
    // PROSPECTIVE STUDENT REGISTRATION
    // -------------------------------------------

    } else if (accountType === "PROSPECTIVE_STUDENT") {
      if (
        !fullName ||
        typeof fullName !== "string" ||
        fullName.trim().length < 2 ||
        fullName.length > 100 ||
        !email ||
        typeof email !== "string" ||
        !isValidEmail(email.trim()) ||
        !universitySlug ||
        typeof universitySlug !== "string"
      ) {
        return Response.json(
          { success: false, message: "Please provide valid registration details." },
          { status: 400 }
        );
      }

      primaryRole = "PROSPECTIVE_STUDENT";
      officialEmail = email.trim().toLowerCase();
      verifiedName = fullName.trim();
      verifiedUniversitySlug = universitySlug.trim();

    } else {
      return Response.json(
        { success: false, message: "Invalid registration type." },
        { status: 400 }
      );
    }

    if (!isValidEmail(officialEmail)) {
      return Response.json(
        { success: false, message: "Unable to verify your email address." },
        { status: 400 }
      );
    }

    // -------------------------------------------
    // UNIVERSITY LOOKUP
    // -------------------------------------------

    const university = await prisma.university.findUnique({
      where: { slug: verifiedUniversitySlug },
    });

    if (!university || !university.isActive) {
      return Response.json(
        { success: false, message: "University registration is unavailable." },
        { status: 400 }
      );
    }

    // -------------------------------------------
    // DEPARTMENT AND PROGRAM LOOKUP
    // -------------------------------------------

    let departmentId: string | undefined;
    let programId: string | undefined;

    if (primaryRole === "PROSPECTIVE_STUDENT" && (requestedDepartmentId || requestedProgramId)) {
      if (requestedDepartmentId) {
        const intendedDepartment = await prisma.department.findFirst({
          where: { id: requestedDepartmentId, universityId: university.id },
          select: { id: true },
        });
        if (!intendedDepartment) return Response.json({ success: false, message: "Select a valid university department." }, { status: 400 });
        departmentId = intendedDepartment.id;
      }
      if (requestedProgramId) {
        const intendedProgram = await prisma.program.findFirst({
          where: { id: requestedProgramId, department: { universityId: university.id }, ...(departmentId ? { departmentId } : {}) },
          select: { id: true },
        });
        if (!intendedProgram) return Response.json({ success: false, message: "Select a valid university program." }, { status: 400 });
        programId = intendedProgram.id;
      }
      void admissionYear;
    }

    if (departmentName) {
      const department = await prisma.department.findFirst({
        where: {
          universityId: university.id,
          name: departmentName,
        },
      });

      if (!department) {
        return Response.json(
          { success: false, message: "University department is not configured." },
          { status: 400 }
        );
      }

      departmentId = department.id;

      if (programName) {
        const program = await prisma.program.findFirst({
          where: {
            departmentId: department.id,
            name: programName,
          },
        });

        if (!program) {
          return Response.json(
            { success: false, message: "University program is not configured." },
            { status: 400 }
          );
        }

        programId = program.id;
      }
    } else if (programName) {
      return Response.json(
        { success: false, message: "Department information is required for this program." },
        { status: 400 }
      );
    }

    // -------------------------------------------
    // CHECK EXISTING ACCOUNT
    // -------------------------------------------

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: officialEmail },
          ...(verifiedInstitutionalId
            ? [{
                universityId: university.id,
                institutionalId: verifiedInstitutionalId,
              }]
            : []),
        ],
      },
    });

    if (existingUser) {
      return Response.json(
        { success: false, message: "Unable to complete registration. Check your details or contact support." },
        { status: 409 }
      );
    }

    // -------------------------------------------
    // HASH PASSWORD
    // -------------------------------------------

    const passwordHash = await hashPassword(password);

    // -------------------------------------------
    // CREATE PENDING ACCOUNT
    // -------------------------------------------

    const user = await prisma.user.create({
      data: {
        fullName: verifiedName,
        email: officialEmail,
        passwordHash,
        primaryRole,
        accountStatus: "PENDING_VERIFICATION",
        emailVerified: false,
        universityId: university.id,
        institutionalId: verifiedInstitutionalId,
        departmentId,
        programId,

        ...(primaryRole === "STUDENT"
          ? {
              studentProfile: {
                create: {
                  currentSemester,
                },
              },
            }
          : {}),

        ...(primaryRole === "FACULTY"
          ? {
              facultyProfile: {
                create: {},
              },
            }
          : {}),
      },
    });

    userId = user.id;

    // -------------------------------------------
    // SEND EMAIL OTP
    // -------------------------------------------

    await createAndSendOtp(
      user.id,
      officialEmail,
      "EMAIL_VERIFICATION"
    );

    return Response.json(
      {
        success: true,
        message: "Registration initiated. Check your email for the verification code.",
        userId: user.id,
        role: user.primaryRole,
      },
      { status: 201 }
    );

  } catch (error) {
    // Remove the pending account if OTP delivery fails.
    if (userId) {
      try {
        await prisma.user.delete({
          where: { id: userId },
        });
      } catch {
        // Do not expose cleanup errors.
      }
    }

    if (error instanceof ERPIntegrationNotConfiguredError) {
      return Response.json(
        { success: false, message: error.message },
        { status: 503 }
      );
    }

    console.error("Registration error:", error);

    return Response.json(
      {
        success: false,
        message: "Registration could not be completed. Please try again.",
      },
      { status: 500 }
    );
  }
}
