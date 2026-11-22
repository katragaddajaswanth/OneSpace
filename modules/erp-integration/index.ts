
import type { ERPAdapter } from "./types";
import { MockERPAdapter } from "./mock.adapter";

export class ERPIntegrationNotConfiguredError extends Error {
  constructor() {
    super(
      "Institutional verification is unavailable because no production ERP integration is configured."
    );
    this.name = "ERPIntegrationNotConfiguredError";
  }
}

/** Resolves the configured ERP adapter only when institutional verification is requested. */
export function getERPAdapter(): ERPAdapter {
  const adapterType = process.env.ERP_ADAPTER ?? "mock";

  if (adapterType === "mock") {
    if (process.env.NODE_ENV === "production") {
      throw new ERPIntegrationNotConfiguredError();
    }

    return new MockERPAdapter();
  }

  // No production adapter is implemented yet. Fail only at the point where
  // institutional verification is requested; importing this module is safe.
  throw new ERPIntegrationNotConfiguredError();
}

export type {
  ERPAdapter,
  ERPIdentityRecord,
  ERPStatus,
  ERPAcademicSnapshot,
  ERPCourse,
  ERPAttendanceRecord,
  ERPTimetableEntry,
  ERPNotice,
  ERPCourseMaterial,
} from "./types";
