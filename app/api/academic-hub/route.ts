import { getAuthenticatedUser } from "@/lib/auth";
import { getERPAdapter } from "@/modules/erp-integration";
import { apiJson } from "@/lib/prototype-api";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  const user = await getAuthenticatedUser(request);
  if (!user) return apiJson({ success: false, message: "Authentication required." }, 401);
  if (user.primaryRole === "PROSPECTIVE_STUDENT") {
    return apiJson({ success: false, message: "Academic Hub is restricted to enrolled student and authorized university accounts." }, 403);
  }
  if (!user.institutionalId) {
    return apiJson({ success: true, academic: null, message: "No institutional identity is configured." });
  }
  const adapter = getERPAdapter();
  if (!adapter.getAcademicSnapshot) {
    return apiJson({ success: true, academic: null, message: "Academic records are unavailable." });
  }
  try {
    const academic = await adapter.getAcademicSnapshot(user.institutionalId);
    return apiJson({ success: true, academic });
  } catch {
    return apiJson({ success: true, academic: null, message: "Academic records are unavailable." });
  }
}
