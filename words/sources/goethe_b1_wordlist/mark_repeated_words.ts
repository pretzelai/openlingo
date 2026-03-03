const SCRIPT_DIR = import.meta.dir;
const MISSING_WORDS_PATH = `${SCRIPT_DIR}/missing_words_to_generate.txt`;
const SOURCE_PATH = `${SCRIPT_DIR}/../../../lib/actions/progress.ts`;
const REPEATED_SUFFIX = " [repeated]";

function normalizeWord(input: string): string {
  return input.trim().toLowerCase();
}

function stripRepeatedSuffix(line: string): string {
  return line.replace(/\s*\[repeated\]\s*$/i, "");
}

function extractWordValues(sourceText: string): Set<string> {
  const words = new Set<string>();
  const keyValueRegex = /\bword\b\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;

  for (const match of sourceText.matchAll(keyValueRegex)) {
    const rawValue = match[1] ?? match[2] ?? match[3] ?? "";
    const normalized = normalizeWord(rawValue);
    if (normalized.length > 0) {
      words.add(normalized);
    }
  }

  return words;
}

async function main() {
  const [missingWordsText, sourceText] = await Promise.all([
    Bun.file(MISSING_WORDS_PATH).text(),
    Bun.file(SOURCE_PATH).text(),
  ]);

  const knownWords = extractWordValues(sourceText);
  const lines = missingWordsText.split("\n");

  let candidateLines = 0;
  let matchedLines = 0;
  let newlyMarkedLines = 0;

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return line;

    candidateLines++;

    const alreadyMarked = /\[repeated\]\s*$/i.test(line);
    const baseWord = stripRepeatedSuffix(line);
    const normalized = normalizeWord(baseWord);

    if (!knownWords.has(normalized)) {
      return line;
    }

    matchedLines++;

    if (alreadyMarked) {
      return line;
    }

    newlyMarkedLines++;
    return `${line}${REPEATED_SUFFIX}`;
  });

  const outputText = updatedLines.join("\n");
  await Bun.write(MISSING_WORDS_PATH, outputText);

  console.log(
    [
      "Done marking repeated words.",
      `Candidates: ${candidateLines}`,
      `Matched: ${matchedLines}`,
      `Newly marked: ${newlyMarkedLines}`,
    ].join(" "),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`Failed to mark repeated words: ${message}`);
  process.exit(1);
});
