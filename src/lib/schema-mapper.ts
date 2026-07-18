import type { ColumnInfo } from './db-schema';

export interface ColumnMapping {
  source_col: string;
  target_col: string;
  source_type: string;
  target_type: string;
  ai_confidence: number;
  ai_warning?: string;
}

// Heuristic matcher: normalized-name similarity (Levenshtein) weighted with
// type-category compatibility. Not an LLM call — a real, deterministic
// algorithm, not a canned response.

function normalize(name: string): string {
  return name.toLowerCase().replace(/[_\s-]+/g, '');
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(na, nb) / maxLen;
}

type TypeCategory = 'numeric' | 'string' | 'date' | 'boolean' | 'other';

function typeCategory(type: string): TypeCategory {
  const t = type.toLowerCase();
  if (/int|numeric|decimal|float|double|real|number/.test(t)) return 'numeric';
  if (/char|text|string|clob/.test(t)) return 'string';
  if (/date|time/.test(t)) return 'date';
  if (/bool/.test(t)) return 'boolean';
  return 'other';
}

const MIN_CONFIDENCE = 0.35;

function buildMapping(sc: ColumnInfo, tc: ColumnInfo, score: number): ColumnMapping {
  const typeMatch = typeCategory(sc.type) === typeCategory(tc.type);
  return {
    source_col: sc.name,
    target_col: tc.name,
    source_type: sc.type,
    target_type: tc.type,
    ai_confidence: Math.round(Math.min(0.99, score) * 100) / 100,
    ai_warning: typeMatch ? undefined : `Type mismatch: source is ${sc.type}, target is ${tc.type}. Verify conversion is safe before running.`,
  };
}

export function mapSchemas(sourceCols: ColumnInfo[], targetCols: ColumnInfo[]): ColumnMapping[] {
  const usedTargets = new Set<string>();
  const mappings: ColumnMapping[] = [];

  // Pass 1: exact normalized-name matches, resolved across every source
  // column before any fuzzy matching happens. Without this pass, a single
  // greedy left-to-right scan lets a weak fuzzy match claim a target column
  // before the source column with the actual exact-name match gets a turn
  // (e.g. a joined source contributing both "code" and "region_name" — if
  // "code" is iterated first, it can grab a "region_name" target on a weak
  // 0.4 score before "region_name" itself is even considered).
  const unmatched: ColumnInfo[] = [];
  for (const sc of sourceCols) {
    const exact = targetCols.find((tc) => !usedTargets.has(tc.name) && normalize(sc.name) === normalize(tc.name));
    if (exact) {
      usedTargets.add(exact.name);
      const typeMatch = typeCategory(sc.type) === typeCategory(exact.type);
      mappings.push(buildMapping(sc, exact, typeMatch ? 1 : 0.75));
    } else {
      unmatched.push(sc);
    }
  }

  // Pass 2: greedy best-score fuzzy match for whatever's left.
  for (const sc of unmatched) {
    let best: { col: ColumnInfo; score: number } | null = null;
    for (const tc of targetCols) {
      if (usedTargets.has(tc.name)) continue;
      const nameScore = nameSimilarity(sc.name, tc.name);
      const typeMatch = typeCategory(sc.type) === typeCategory(tc.type);
      const score = nameScore * 0.75 + (typeMatch ? 0.25 : 0);
      if (!best || score > best.score) best = { col: tc, score };
    }

    if (best && best.score > MIN_CONFIDENCE) {
      usedTargets.add(best.col.name);
      mappings.push(buildMapping(sc, best.col, best.score));
    }
  }

  return mappings;
}
