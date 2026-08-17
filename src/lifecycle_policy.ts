export const nonprofitKinds = [
  "donor-receipt",
  "volunteer-reminder",
  "campaign-report",
] as const;

export type NonprofitKind = (typeof nonprofitKinds)[number];
export type ExpiryDecision = {
  key: string;
  kind: NonprofitKind;
  expiresAt: string;
  expired: boolean;
};

const keyPattern = new RegExp(
  `^throwaway/(${nonprofitKinds.join("|")})/(\\d{4}-\\d{2}-\\d{2}T[^/]+)/[^/]+\\.json$`,
);

export function classifyForExpiry(key: string, now: Date): ExpiryDecision | null {
  const match = keyPattern.exec(key);
  if (!match) return null;

  const expiresAt = new Date(match[2]);
  if (Number.isNaN(expiresAt.getTime())) return null;

  return {
    key,
    kind: match[1] as NonprofitKind,
    expiresAt: expiresAt.toISOString(),
    expired: expiresAt.getTime() <= now.getTime(),
  };
}
