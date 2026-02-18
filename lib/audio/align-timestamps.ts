export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  charStart: number;
  charEnd: number;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "");
}

function wordSimilarity(a: string, b: string): number {
  const aNorm = normalizeWord(a);
  const bNorm = normalizeWord(b);
  if (aNorm === bNorm) return 1;
  if (aNorm.length === 0 || bNorm.length === 0) return 0;
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.8;
  const maxLen = Math.max(aNorm.length, bNorm.length);
  const distance = levenshtein(aNorm, bNorm);
  return Math.max(0, 1 - distance / maxLen);
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function splitTextIntoWords(
  text: string,
): Array<{ word: string; charStart: number; charEnd: number }> {
  const words: Array<{ word: string; charStart: number; charEnd: number }> = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    words.push({
      word: match[0],
      charStart: match.index,
      charEnd: match.index + match[0].length,
    });
  }
  return words;
}

export function alignWordsToOriginal(
  originalText: string,
  transcribedWords: WhisperWord[],
): WordTimestamp[] {
  const originalWords = splitTextIntoWords(originalText);
  const aligned: WordTimestamp[] = [];
  if (transcribedWords.length === 0 || originalWords.length === 0) return aligned;

  let transcribedIdx = 0;
  const similarityThreshold = 0.5;

  for (let i = 0; i < originalWords.length; i++) {
    const origWord = originalWords[i];
    let bestMatch = -1;
    let bestSimilarity = 0;
    const windowSize = 3;

    for (
      let j = transcribedIdx;
      j < Math.min(transcribedIdx + windowSize, transcribedWords.length);
      j++
    ) {
      const similarity = wordSimilarity(origWord.word, transcribedWords[j].word);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = j;
      }
    }

    if (bestSimilarity >= similarityThreshold && bestMatch !== -1) {
      aligned.push({
        word: origWord.word,
        start: transcribedWords[bestMatch].start,
        end: transcribedWords[bestMatch].end,
        charStart: origWord.charStart,
        charEnd: origWord.charEnd,
      });
      transcribedIdx = bestMatch + 1;
    } else {
      const prevTimestamp = aligned.length > 0 ? aligned[aligned.length - 1] : null;
      const nextTranscribed = transcribedWords[transcribedIdx];
      let interpolatedStart: number;
      let interpolatedEnd: number;

      if (prevTimestamp && nextTranscribed) {
        const gap = nextTranscribed.start - prevTimestamp.end;
        interpolatedStart = prevTimestamp.end;
        interpolatedEnd = prevTimestamp.end + gap * 0.5;
      } else if (prevTimestamp) {
        interpolatedStart = prevTimestamp.end;
        interpolatedEnd = prevTimestamp.end + 0.3;
      } else if (nextTranscribed) {
        interpolatedStart = Math.max(0, nextTranscribed.start - 0.3);
        interpolatedEnd = nextTranscribed.start;
      } else {
        interpolatedStart = i * 0.3;
        interpolatedEnd = (i + 1) * 0.3;
      }

      aligned.push({
        word: origWord.word,
        start: interpolatedStart,
        end: interpolatedEnd,
        charStart: origWord.charStart,
        charEnd: origWord.charEnd,
      });
    }
  }

  return aligned;
}

export function findWordAtTime(
  timestamps: WordTimestamp[],
  currentTime: number,
): number {
  let left = 0;
  let right = timestamps.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const word = timestamps[mid];
    if (currentTime >= word.start && currentTime < word.end) return mid;
    else if (currentTime < word.start) right = mid - 1;
    else left = mid + 1;
  }
  if (left >= timestamps.length) return timestamps.length - 1;
  if (left === 0) return 0;
  const prevDiff = Math.abs(timestamps[left - 1].end - currentTime);
  const nextDiff = Math.abs(timestamps[left].start - currentTime);
  return prevDiff < nextDiff ? left - 1 : left;
}
