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

export function mapSchemas(sourceCols: ColumnInfo[], targetCols: ColumnInfo[]): ColumnMapping[] {
  const usedTargets = new Set<string>();
  const mappings: ColumnMapping[] = [];

  for (const sc of sourceCols) {
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
      const typeMatch = typeCategory(sc.type) === typeCategory(best.col.type);
      mappings.push({
        source_col: sc.name,
        target_col: best.col.name,
        source_type: sc.type,
        target_type: best.col.type,
        ai_confidence: Math.round(Math.min(0.99, best.score) * 100) / 100,
        ai_warning: typeMatch ? undefined : `Type mismatch: source is ${sc.type}, target is ${best.col.type}. Verify conversion is safe before running.`,
      });
    }
  }

  return mappings;
}
