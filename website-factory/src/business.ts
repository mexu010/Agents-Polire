import { publicUrl } from "./crawler.js";
import type { JsonObject } from "./contracts.js";

/** An operator's explicit source review, not a model confidence or registry-status inference. */
export function validateBusinessReview(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("business review must be an object");
  const r = value as JsonObject;
  const keys = [
    "status",
    "reason",
    "sourceUrl",
    "excerpt",
    "activityDate",
    "checkedAt",
  ];
  if (
    Object.keys(r).some((k) => !keys.includes(k)) ||
    keys.some((k) => typeof r[k] !== "string")
  )
    throw new Error("invalid business review fields");
  if (!["operating", "uncertain", "closed"].includes(r.status))
    throw new Error("invalid business status");
  if (
    r.reason.trim().length < 10 ||
    r.reason.length > 2000 ||
    !r.excerpt.trim() ||
    r.excerpt.length > 4000
  )
    throw new Error("business review needs source excerpt and reason");
  publicUrl(r.sourceUrl);
  for (const field of ["activityDate", "checkedAt"])
    if (
      !Number.isFinite(Date.parse(r[field])) ||
      Date.parse(r[field]) > Date.now() + 60_000
    )
      throw new Error(
        "business evidence dates must be valid and not in the future",
      );
  if (Date.parse(r.activityDate) > Date.parse(r.checkedAt) + 60_000)
    throw new Error("activity date cannot follow its review");
  return { ...r, verification: "operator_source_review" };
}

export function businessBlocker(
  review: JsonObject | null | undefined,
): string | null {
  if (!review || review.status === "uncertain")
    return "business_activity_unverified";
  if (review.status === "closed") return "business_closed";
  if (review.status !== "operating") return "business_activity_unverified";
  const checked = Date.parse(review.checkedAt),
    activity = Date.parse(review.activityDate);
  if (
    !Number.isFinite(checked) ||
    !Number.isFinite(activity) ||
    checked > Date.now() + 60_000 ||
    activity > Date.now() + 60_000 ||
    checked < Date.now() - 30 * 86400_000 ||
    activity < Date.now() - 366 * 86400_000
  )
    return "business_activity_stale";
  return null;
}
