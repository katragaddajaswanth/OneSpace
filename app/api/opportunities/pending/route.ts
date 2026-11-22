import { getOpportunityReviewQueue } from "@/lib/opportunity-review-queue";

export async function GET(request: Request) {
  return getOpportunityReviewQueue(request, "PENDING");
}
