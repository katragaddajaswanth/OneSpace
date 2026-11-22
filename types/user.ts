
export type PrimaryRole =
  | "STUDENT"
  | "FACULTY"
  | "ALUMNI"
  | "PROSPECTIVE_STUDENT";

export type SecondaryRole =
  | "MENTOR"
  | "ADMINISTRATOR"
  | "PLACEMENT_OFFICER"
  | "INDUSTRY_REPRESENTATIVE"
  | "PROCTOR"
  | "PROJECT_ANALYSIS_CREW";

export type ERPAccountStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED";

export type UserAccountStatus =
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "RESTRICTED"
  | "DISABLED";

export interface User {
  id: string;
  institutionalId?: string;
  fullName: string;
  email: string;

  primaryRole: PrimaryRole;
  secondaryRoles: SecondaryRole[];

  accountStatus: UserAccountStatus;
  erpStatus?: ERPAccountStatus;

  universityId?: string;
  department?: string;
  program?: string;
  currentSemester?: number;

  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
