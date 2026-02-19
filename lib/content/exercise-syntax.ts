/**
 * Exercise syntax reference — single source of truth.
 * Inlined as a string constant so it works with Turbopack.
 */
export const EXERCISE_SYNTAX = `# Exercise Syntax Reference

## Unit Frontmatter

Every unit starts with YAML frontmatter containing ALL metadata. The frontmatter is the single source of truth:

\`\`\`
---
unitTitle: "Unit Title"
description: "Short English description of what this unit teaches"
icon: "📘"
color: "#4CAF50"
targetLanguage: "de"
sourceLanguage: "en"
level: "B1"
---
\`\`\`

| Field | Required | Description |
|-------|----------|-------------|
| unitTitle | yes | Unit title (in the target language) |
| description | yes | Short English description |
| icon | yes | Single emoji |
| color | yes | Hex color code |
| targetLanguage | yes | ISO 639-1 language code being learned (e.g. "de", "fr", "es") |
| sourceLanguage | yes | ISO 639-1 native language code (e.g. "en") |
| level | yes | CEFR level: A1, A2, B1, B2, C1, C2 |

## Lesson Sections

After the unit frontmatter, each lesson is defined by a \`---\` delimited metadata block:

\`\`\`
---
lessonTitle: "Greetings"
description: "Learn basic greeting phrases"
icon: "👋"
color: "#FF9600"
---

[exercise blocks here...]
\`\`\`

| Field | Required | Description |
|-------|----------|-------------|
| lessonTitle | yes | Lesson title |
| description | no | Short description of the lesson |
| icon | no | Single emoji |
| color | no | Hex color code |

## Exercise Blocks

Exercises are written in markdown files. Each exercise block starts with a type tag
\`[type-name]\` and fields are written as \`key: value\`. The parser splits on type tags
automatically — no \`---\` separators needed (though they're accepted and ignored).

## Comments

Lines starting with \`//\` (with optional leading whitespace) are stripped before parsing:

\`\`\`
// This is a comment — it will be ignored
[multiple-choice]
text: "What color is the sky?"
// Maybe add more choices later
choices:
  - "Blue" (correct)
  - "Green"
\`\`\`

## SRS Word Tracking

Every exercise **must** include an \`srsWords\` field listing the target-language word(s) to track in the spaced repetition system.
Words practiced correctly reinforce the card; incorrect answers flag them for review.

For most exercises this will be a single word. Use quotes for the value.

\`\`\`
srsWords: "gato"
\`\`\`

For multiple words, quote each one on the same line:

\`\`\`
srsWords: "gato" "perro"
\`\`\`

For \`matching-pairs\`, srsWords are auto-inferred from the left side of the pairs if omitted.

## Exercise Types

### multiple-choice

Present a text with several choices. Exactly one is marked \`(correct)\`.

| Field | Required | Description |
|-------|----------|-------------|
| text | yes | The question text |
| choices (list) | yes | \`- "text"\` items, one with \`(correct)\` |
| random_order | no | \`true\` to shuffle choices at runtime |
| srsWords | **yes** | Target-language word(s) for SRS |

\`\`\`
[multiple-choice]
text: "What does 'gato' mean?"
choices:
  - "Dog"
  - "Cat" (correct)
  - "Bird"
srsWords: "gato"
\`\`\`

### translation

User translates a sentence. Supports alternate accepted answers.

| Field | Required | Description |
|-------|----------|-------------|
| text | yes | Instruction shown to user |
| sentence | yes | The sentence to translate |
| answer | yes | The expected answer |
| acceptAlso | no | Additional accepted answers: \`"alt1" "alt2"\` |
| srsWords | **yes** | Target-language word(s) for SRS |

\`\`\`
[translation]
text: "Translate to English"
sentence: "El gato es negro"
answer: "The cat is black"
acceptAlso: "The cat's black"
srsWords: "gato" "negro"
\`\`\`

### fill-in-the-blank

User fills in the missing word in a sentence.

| Field | Required | Description |
|-------|----------|-------------|
| sentence | yes | Sentence with \`___\` marking the blank |
| blank | yes | The correct word for the blank |
| srsWords | **yes** | Target-language word(s) for SRS |

\`\`\`
[fill-in-the-blank]
sentence: "El ___ es negro"
blank: "gato"
srsWords: "gato"
\`\`\`

### matching-pairs

User matches left-side items to right-side items.

| Field | Required | Description |
|-------|----------|-------------|
| pairs (list) | yes | \`- "left" = "right"\` items |
| random_order | no | \`true\` to shuffle pairs |
| srsWords | no | Target-language word(s) for SRS (auto-inferred from pairs if omitted) |

\`\`\`
[matching-pairs]
- "gato" = "cat"
- "perro" = "dog"
- "pájaro" = "bird"
\`\`\`

### listening

User listens to TTS audio and types what they hear.

| Field | Required | Description |
|-------|----------|-------------|
| text | yes | The text that will be spoken |
| ttsLang | yes | BCP-47 language code for TTS (e.g. \`es-ES\`) |
| mode | no | \`choices\` or \`word-bank\` for alternate UI |
| srsWords | **yes** | Target-language word(s) for SRS |

\`\`\`
[listening]
text: "El gato es negro"
ttsLang: es-ES
srsWords: "gato" "negro"
\`\`\`

### word-bank

User assembles a sentence from a set of word tiles.

| Field | Required | Description |
|-------|----------|-------------|
| text | yes | Instruction shown to user |
| words | yes | Available tiles: \`"word1" "word2" ...\` |
| answer | yes | Correct order: \`"word1" "word2" ...\` |
| random_order | no | \`true\` to shuffle tiles |
| srsWords | **yes** | Target-language word(s) for SRS |

\`\`\`
[word-bank]
text: "Arrange the translation"
words: "cat" "the" "is" "black" "big"
answer: "the" "cat" "is" "black"
srsWords: "gato" "negro"
\`\`\`

### free-text

User writes a free-form text response. After submitting, an AI prompt is called with their response and the result (Markdown-formatted) is shown back. This exercise is always marked correct (participation-based).

| Field | Required | Description |
|-------|----------|-------------|
| text | yes | Instruction shown to user |
| afterSubmitPrompt | yes | AI prompt template — use \`{userResponse}\` as placeholder |
| srsWords | no | Target-language word(s) for SRS (optional for free-text) |

\`\`\`
[free-text]
text: "Write a short paragraph introducing yourself in German"
afterSubmitPrompt: "The user is learning German. They wrote: {userResponse}. Please provide feedback on grammar and vocabulary. Be encouraging."
\`\`\`

### speaking

User speaks a sentence aloud for pronunciation practice.

| Field | Required | Description |
|-------|----------|-------------|
| sentence | yes | The sentence the user should say |
| srsWords | **yes** | Target-language word(s) for SRS |

\`\`\`
[speaking]
sentence: "El gato es negro"
srsWords: "gato" "negro"
\`\`\`

### flashcard-review

A flashcard exercise for spaced repetition review. The user sees the front of the card, taps to reveal the back, then rates their recall. Both \`front\` and \`back\` support markdown.

| Field | Required | Description |
|-------|----------|-------------|
| front | yes | Front of the card (markdown) |
| back | yes | Back of the card (markdown) |
| srsWords | **yes** | Target-language word(s) for SRS |

\`\`\`
[flashcard-review]
front: "Katze"
back: "cat"
srsWords: "Katze"
\`\`\``;
