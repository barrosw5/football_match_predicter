/** Same rule as football_predictor.dataset._slug (accent-free, lowercase, dashes). */
export function teamSlug(key: string): string {
  return key
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
