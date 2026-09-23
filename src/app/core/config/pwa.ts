const DISMISS_KEY = 'installBannerDismissedUntil';
const DISMISS_DAYS = 14;

/** Whether the visitor closed the install banner recently enough that it
 * shouldn't be shown again yet. */
export function isInstallBannerDismissed(): boolean {
  const until = Number(localStorage.getItem(DISMISS_KEY));
  return Number.isFinite(until) && Date.now() < until;
}

export function dismissInstallBanner(): void {
  localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
}
