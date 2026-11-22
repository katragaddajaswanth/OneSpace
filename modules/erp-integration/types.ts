
export type ERPStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "NOT_FOUND"
  | "UNKNOWN";

export type ERPPrimaryRole =
  | "STUDENT"
  | "FACULTY"
  | "ALUMNI";

export interface ERPIdentityRecord {
  institutionalId: string;
  fullName: string;
  officialEmail: string;
  universitySlug: string;
  primaryRole: ERPPrimaryRole;
  status: ERPStatus;
  departmentName?: string;
  programName?: string;
  currentSemester?: number;
}

export interface ERPCourse {
  code: string;
  title: string;
  instructor: string;
  credits: number;
  schedule: string;
}

export interface ERPAttendanceRecord {
  courseCode: string;
  present: number;
  conducted: number;
  percentage: number;
}

export interface ERPTimetableEntry {
  day: string;
  time: string;
  courseCode: string;
  room: string;
}

export interface ERPNotice {
  title: string;
  body: string;
  date: string;
}

export interface ERPCourseMaterial {
  courseCode: string;
  title: string;
  type: "LECTURE" | "ASSIGNMENT" | "REFERENCE";
  url: string;
}

export interface ERPAcademicSnapshot {
  simulated: true;
  courses: ERPCourse[];
  attendance: ERPAttendanceRecord[];
  timetable: ERPTimetableEntry[];
  notices: ERPNotice[];
  materials: ERPCourseMaterial[];
}

export interface ERPAdapter {
  findByInstitutionalId(
    institutionalId: string
  ): Promise<ERPIdentityRecord | null>;
  getAcademicSnapshot?(
    institutionalId: string
  ): Promise<ERPAcademicSnapshot | null>;
}
