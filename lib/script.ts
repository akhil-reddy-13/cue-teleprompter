export type ScriptBlock = {
  /** Raw text of the paragraph; empty string means a blank spacer line. */
  text: string;
  /** Index of this block's first word within the whole script. */
  wordStart: number;
  /** Number of words in this block. */
  wordCount: number;
};

export type ParsedScript = {
  blocks: ScriptBlock[];
  words: string[];
  totalWords: number;
};

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

/** Lowercased, punctuation-free word list — the unit both scrolling and voice matching use. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(WORD_RE) ?? []).map((w) =>
    w.replace(/[’']/g, ""),
  );
}

export function parseScript(script: string): ParsedScript {
  const lines = script.split(/\r?\n/);
  const blocks: ScriptBlock[] = [];
  const words: string[] = [];

  for (const line of lines) {
    const lineWords = tokenize(line);
    blocks.push({
      text: line,
      wordStart: words.length,
      wordCount: lineWords.length,
    });
    words.push(...lineWords);
  }

  return { blocks, words, totalWords: words.length };
}

export function estimateSeconds(wordCount: number, wpm: number): number {
  if (wordCount <= 0 || wpm <= 0) return 0;
  return (wordCount / wpm) * 60;
}

/**
 * How well a spoken tail lines up with the script ending at `scriptEnd`.
 * Later words count for more, so a fresh match beats a stale one.
 */
function alignmentScore(
  spoken: string[],
  words: string[],
  scriptEnd: number,
): number {
  let score = 0;
  for (let i = 0; i < spoken.length; i += 1) {
    const scriptIndex = scriptEnd - (spoken.length - 1 - i);
    if (scriptIndex < 0 || scriptIndex >= words.length) continue;
    const spokenWord = spoken[i];
    const scriptWord = words[scriptIndex];
    const weight = 1 + i / spoken.length;
    if (spokenWord === scriptWord) {
      score += 2 * weight;
    } else if (
      spokenWord.length > 3 &&
      scriptWord.length > 3 &&
      (scriptWord.startsWith(spokenWord.slice(0, 4)) ||
        spokenWord.startsWith(scriptWord.slice(0, 4)))
    ) {
      // Speech recognition mangles endings ("recording" -> "record") far more
      // often than it mangles stems, so a shared stem still counts.
      score += weight;
    }
  }
  return score;
}

/**
 * Locate the spoken tail inside the script and return the index of the word
 * the speaker has just finished, or null when nothing matches convincingly.
 */
export function matchSpokenPosition(
  spokenTail: string[],
  words: string[],
  currentWord: number,
  lookBehind = 25,
  lookAhead = 140,
): number | null {
  if (spokenTail.length === 0 || words.length === 0) return null;

  const from = Math.max(0, Math.floor(currentWord) - lookBehind);
  const to = Math.min(words.length - 1, Math.floor(currentWord) + lookAhead);

  let bestIndex = -1;
  let bestScore = 0;
  for (let end = from; end <= to; end += 1) {
    const score = alignmentScore(spokenTail, words, end);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = end;
    }
  }

  // Require roughly a third of the tail to land before trusting the match,
  // otherwise a mis-hearing would yank the script to a random line.
  const threshold = Math.max(3, spokenTail.length * 0.8);
  if (bestIndex < 0 || bestScore < threshold) return null;
  return bestIndex;
}
