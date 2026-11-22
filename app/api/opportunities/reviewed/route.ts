import { getOpportunityReviewQueue } from "@/lib/opportunity-review-queue";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") ?? "REVIEWED";
  if (status !== "APPROVED" && status !== "REJECTED" && status !== "REVIEWED") {
    return Response.json(
      { success: false, message: "Status must be APPROVED or REJECTED." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  return getOpportunityReviewQueue(request, status);
}
