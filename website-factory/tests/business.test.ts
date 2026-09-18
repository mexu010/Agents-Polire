import { expect, test } from "vitest";
import { businessBlocker, validateBusinessReview } from "../src/business.js";
const review = {
  status: "operating",
  reason: "Dated company activity independently checked",
  sourceUrl: "https://company.ch/news",
  excerpt: "New project completed",
  activityDate: new Date().toISOString(),
  checkedAt: new Date().toISOString(),
};
test("business status requires dated evidence and distinguishes unknown from closed", () => {
  expect(businessBlocker(null)).toBe("business_activity_unverified");
  expect(businessBlocker(validateBusinessReview(review))).toBeNull();
  expect(
    businessBlocker(validateBusinessReview({ ...review, status: "closed" })),
  ).toBe("business_closed");
  expect(() =>
    validateBusinessReview({ ...review, sourceUrl: "http://127.0.0.1/" }),
  ).toThrow();
  expect(() => validateBusinessReview({ ...review, excerpt: "" })).toThrow();
  expect(businessBlocker({ ...review, checkedAt: "2020-01-01" })).toBe(
    "business_activity_stale",
  );
  expect(() =>
    validateBusinessReview({ ...review, activityDate: "2099-01-01" }),
  ).toThrow();
});
