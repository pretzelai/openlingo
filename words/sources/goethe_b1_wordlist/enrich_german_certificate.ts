type GermanWordEntry = {
  word: string;
  cefr_level?: string;
  gender?: string;
  goethe_wordlist?: boolean;
  [key: string]: unknown;
};

type CsvRow = {
  fields: string[];
  line: number;
};

const SCRIPT_DIR = import.meta.dir;
const GERMAN_JSON_PATH = `${SCRIPT_DIR}/../../german.json`;
const GOETHE_CSV_PATH = `${SCRIPT_DIR}/goethe-zertifikat-b1-wortliste.csv`;
const LOG_NOT_FOUND_PATH = `${SCRIPT_DIR}/logs_not_found.txt`;
const LOG_DIFFERENT_LEVEL_PATH = `${SCRIPT_DIR}/logs_different_level.txt`;

function parseCsvWithLineNumbers(input: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let currentLine = 1;
  let rowStartLine = 1;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = input[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
        if (ch === "\n") {
          currentLine++;
        }
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      fields.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      fields.push(field);
      rows.push({ fields, line: rowStartLine });
      fields = [];
      field = "";
      currentLine++;
      rowStartLine = currentLine;
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || fields.length > 0) {
    fields.push(field);
    rows.push({ fields, line: rowStartLine });
  }

  return rows;
}

function cleanGoetheWord(rawWordField: string): { words: string[]; nounGender: string } {
  let value = rawWordField.trim();
  let nounGender = "";
  const stripLeadingParenthetical = (input: string): string =>
    input.replace(/^\([^)]*\)\s*/, "");

  // Remove leading parenthetical marker, e.g. "(sich) zwingen" or "(Back)Rohr".
  if (value.startsWith("(")) {
    value = stripLeadingParenthetical(value);
  }
  // Remove reflexive prefix at start, e.g. "sich freuen" -> "freuen".
  value = value.replace(/^sich\s+/i, "");

  const genderMatch = value.match(/^(der|die|das)\s+/i);
  if (genderMatch) {
    nounGender = genderMatch[1].toLowerCase();
    value = value.slice(genderMatch[0].length);
  }
  // Handle cases like "das (Back)Rohr" after article removal.
  if (value.startsWith("(")) {
    value = stripLeadingParenthetical(value);
  }
  value = value.replace(/^sich\s+/i, "");

  // Remove cross-reference suffixes like "Abitur (D) → A, CH: Matura".
  value = value.replace(/\s+→.*/g, "");
  // Remove parenthetical variants like "Abgase (Pl.)" and everything after " (".
  value = value.replace(/\s+\(.*/g, "");

  const beforeComma = value.split(",")[0] ?? "";

  const normalizeCandidate = (input: string): string => {
    let candidate = input.trim();
    candidate = candidate.replace(/^sich\s+/i, "");
    if (candidate.startsWith("(")) {
      candidate = stripLeadingParenthetical(candidate);
    }
    // Normalize collocations like "Bescheid sagen" to "Bescheid".
    candidate = candidate.replace(/\s+(geben|sagen)$/i, "");
    // Remove exclamation marks from lookup key.
    candidate = candidate.replace(/!/g, "");
    // Remove dashes from the cleaned lookup key.
    candidate = candidate.replace(/[-–—]/g, "");
    candidate = candidate.replace(/\s+/g, " ").trim();
    return candidate;
  };

  const words = Array.from(
    new Set(
      beforeComma
        .split("/")
        .map(normalizeCandidate)
        .filter((word) => word.length > 0),
    ),
  );

  return { words, nounGender };
}

function buildWordIndex(entries: GermanWordEntry[]): Map<string, number[]> {
  const index = new Map<string, number[]>();

  for (let i = 0; i < entries.length; i++) {
    const word = entries[i]?.word;
    if (!word) continue;

    const existing = index.get(word);
    if (existing) {
      existing.push(i);
    } else {
      index.set(word, [i]);
    }
  }

  return index;
}

async function main() {
  const [germanText, goetheCsv] = await Promise.all([
    Bun.file(GERMAN_JSON_PATH).text(),
    Bun.file(GOETHE_CSV_PATH).text(),
  ]);

  const germanWords = JSON.parse(germanText) as GermanWordEntry[];
  const rows = parseCsvWithLineNumbers(goetheCsv);
  const wordIndex = buildWordIndex(germanWords);
  const notFoundErrors: string[] = [];
  const differentLevelErrors: string[] = [];

  for (const row of rows) {
    const rawWordField = row.fields[0]?.trim() ?? "";
    if (!rawWordField) continue;

    // First CSV line is metadata, not a lexical entry.
    if (row.line === 1 && /goethe zertifikat/i.test(rawWordField)) {
      continue;
    }

    const { words } = cleanGoetheWord(rawWordField);
    if (words.length === 0) continue;

    for (const word of words) {
      const matchingIndices = wordIndex.get(word);
      if (!matchingIndices || matchingIndices.length === 0) {
        notFoundErrors.push(`${word}, ${row.line}: word not found in german.json`);
        continue;
      }

      for (const idx of matchingIndices) {
        const entry = germanWords[idx];
        if (entry.cefr_level !== "B1") {
          const actualLevel = entry.cefr_level ?? "unknown";
          differentLevelErrors.push(
            `${word}, ${row.line}: word not matching cefr_level (${actualLevel})`,
          );
          continue;
        }
        entry.goethe_b1_wordlist = true;
      }
    }
  }

  await Promise.all([
    Bun.write(GERMAN_JSON_PATH, `${JSON.stringify(germanWords, null, 2)}\n`),
    Bun.write(
      LOG_NOT_FOUND_PATH,
      notFoundErrors.length > 0 ? `${notFoundErrors.join("\n")}\n` : "",
    ),
    Bun.write(
      LOG_DIFFERENT_LEVEL_PATH,
      differentLevelErrors.length > 0 ? `${differentLevelErrors.join("\n")}\n` : "",
    ),
  ]);

  console.log(
    `Done. Enriched ${GERMAN_JSON_PATH}; wrote ${notFoundErrors.length} not-found logs to ${LOG_NOT_FOUND_PATH} and ${differentLevelErrors.length} level-mismatch logs to ${LOG_DIFFERENT_LEVEL_PATH}.`,
  );
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  await Promise.all([
    Bun.write(LOG_NOT_FOUND_PATH, `script_error, 0: ${message}\n`),
    Bun.write(LOG_DIFFERENT_LEVEL_PATH, `script_error, 0: ${message}\n`),
  ]);
  console.error("Failed. See logs_not_found.txt and logs_different_level.txt for details.");
  process.exit(1);
});
