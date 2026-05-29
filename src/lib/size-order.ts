// Garment size ordering for display/sorting across the app.
// Business preference: bigger sizes first, with XL before L → XXL, XL, L, M, S, XS.
const SIZE_RANK: Record<string, number> = {
  XXXL: 0,
  "3XL": 0,
  XXL: 1,
  "2XL": 1,
  XL: 2,
  L: 3,
  M: 4,
  S: 5,
  XS: 6,
};

const UNKNOWN_RANK = 50; // unknown/non-size tokens sort after known sizes

export function sizeRank(token: string): number {
  const t = token.trim().toUpperCase();
  return t in SIZE_RANK ? SIZE_RANK[t] : UNKNOWN_RANK;
}

// Trailing size token in labels like "Playera Bluemango (Blanco / L)", "Blanco / XL", "Negro - M".
const SIZE_RE = /[/\-(]\s*([A-Za-z0-9]{1,4})\s*\)?\s*$/;

export function extractSize(label: string): string | null {
  const m = label.match(SIZE_RE);
  if (!m) return null;
  const tok = m[1].trim().toUpperCase();
  return tok in SIZE_RANK ? tok : null;
}

// Compare two variant labels: keep the same product+color grouped together,
// then order by size with XL before L. Falls back to alphabetical when no size.
export function compareVariantLabel(a: string, b: string): number {
  const sa = extractSize(a);
  const sb = extractSize(b);
  if (sa && sb) {
    const prefixA = a.slice(0, a.toUpperCase().lastIndexOf(sa));
    const prefixB = b.slice(0, b.toUpperCase().lastIndexOf(sb));
    const byPrefix = prefixA.localeCompare(prefixB);
    if (byPrefix !== 0) return byPrefix;
    return sizeRank(sa) - sizeRank(sb);
  }
  return a.localeCompare(b);
}
