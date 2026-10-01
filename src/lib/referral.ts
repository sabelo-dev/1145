const STORAGE_KEY = "1145_referral_code";

/** Keeps the `?ref=` code from a shared link so sign-up can prefill it later. */
export function rememberReferralCode(code: string | null | undefined): void {
  const clean = code?.trim().toUpperCase();
  if (!clean || clean.length > 40) return;
  try {
    localStorage.setItem(STORAGE_KEY, clean);
  } catch {
    // Storage unavailable (private mode): the link still works, just without the prefill.
  }
}

export function recalledReferralCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
