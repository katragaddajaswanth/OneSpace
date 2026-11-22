
import type {
  ERPAdapter,
  ERPIdentityRecord,
  ERPAcademicSnapshot,
} from "./types";

// DEMO DATA ONLY.
// Replace these records with test records approved for your project.
// Never use fabricated records to verify real students.

const mockRecords: ERPIdentityRecord[] = [
  {
    primaryRole: "STUDENT",
    institutionalId: "DEMO-STUDENT-001",
    fullName: "Demo Student",
    officialEmail: "jaswanthkatrgadda@gmail.com",
    universitySlug: "demo-university",
    status: "ACTIVE",
    departmentName: "Computer Science",
    programName: "B.Tech CSE",
    currentSemester: 3,
  },
  {
    primaryRole: "STUDENT",
    institutionalId: "DEMO-STU-001",
    fullName: "Aarav Patel",
    officialEmail: "aarav.patel@demo.university",
    universitySlug: "demo-university",
    status: "ACTIVE",
    departmentName: "Computer Science",
    programName: "B.Tech CSE",
    currentSemester: 3,
  },
  {
    primaryRole: "STUDENT",
    institutionalId: "DEMO-STU-002",
    fullName: "Meera Reddy",
    officialEmail: "meera.reddy@demo.university",
    universitySlug: "demo-university",
    status: "ACTIVE",
    departmentName: "Computer Science",
    programName: "B.Tech CSE",
    currentSemester: 5,
  },
  {
    primaryRole: "STUDENT",
    institutionalId: "DEMO-STU-003",
    fullName: "Kabir Singh",
    officialEmail: "kabir.singh@demo.university",
    universitySlug: "demo-university",
    status: "ACTIVE",
    departmentName: "Information Technology",
    programName: "B.Tech IT",
    currentSemester: 7,
  },
];

export class MockERPAdapter implements ERPAdapter {
  async findByInstitutionalId(
    institutionalId: string
  ): Promise<ERPIdentityRecord | null> {
    const record = mockRecords.find(
      (item) =>
        item.institutionalId.toLowerCase() ===
        institutionalId.trim().toLowerCase()
    );

    return record ?? null;
  }

  async getAcademicSnapshot(
    institutionalId: string
  ): Promise<ERPAcademicSnapshot | null> {
    const record = mockRecords.find(
      (item) =>
        item.institutionalId.toLowerCase() ===
        institutionalId.trim().toLowerCase()
    );
    if (!record || record.primaryRole !== "STUDENT") return null;

    return {
      simulated: true,
      courses: [
        { code: "CS301", title: "Data Structures and Algorithms", instructor: "Dr. Priya Sharma", credits: 4, schedule: "Mon/Wed 10:00 AM" },
        { code: "CS315", title: "Database Management Systems", instructor: "Prof. Arjun Mehta", credits: 4, schedule: "Tue/Thu 11:30 AM" },
        { code: "AI320", title: "Introduction to Machine Learning", instructor: "Dr. Kavya Nair", credits: 3, schedule: "Fri 09:00 AM" },
        { code: "EN302", title: "Professional Communication", instructor: "Prof. Rahul Iyer", credits: 2, schedule: "Wed 02:00 PM" },
      ],
      attendance: [
        { courseCode: "CS301", present: 24, conducted: 26, percentage: 92 },
        { courseCode: "CS315", present: 22, conducted: 24, percentage: 92 },
        { courseCode: "AI320", present: 18, conducted: 20, percentage: 90 },
        { courseCode: "EN302", present: 14, conducted: 16, percentage: 88 },
      ],
      timetable: [
        { day: "Monday", time: "10:00-11:30", courseCode: "CS301", room: "CSE-204" },
        { day: "Tuesday", time: "11:30-13:00", courseCode: "CS315", room: "CSE-112" },
        { day: "Wednesday", time: "10:00-11:30", courseCode: "CS301", room: "CSE-204" },
        { day: "Wednesday", time: "14:00-15:30", courseCode: "EN302", room: "LANG-03" },
        { day: "Friday", time: "09:00-11:00", courseCode: "AI320", room: "LAB-AI-01" },
      ],
      notices: [
        { title: "Mid-semester examination timetable", body: "The simulated mid-semester examination timetable has been published for student planning.", date: "2026-11-18" },
        { title: "Project presentation week", body: "Project presentations for the current prototype semester are scheduled in the next academic week.", date: "2026-11-16" },
        { title: "Library digital access", body: "Demonstration access reminders and resource links are available through the academic library portal.", date: "2026-11-10" },
      ],
      materials: [
        { courseCode: "CS301", title: "Stacks, queues and trees", type: "LECTURE", url: "https://example.com/demo/cs301/trees" },
        { courseCode: "CS315", title: "Normalization worksheet", type: "ASSIGNMENT", url: "https://example.com/demo/cs315/normalization" },
        { courseCode: "AI320", title: "Linear regression reference", type: "REFERENCE", url: "https://example.com/demo/ai320/regression" },
      ],
    };
  }
}
