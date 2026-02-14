# Exercise Syntax Reference

Exercises are written in markdown files. Each exercise block starts with a type tag
`[type-name]` and fields are written as `key: value`. The parser splits on type tags
automatically — no `---` separators needed (though they're accepted and ignored).

## Comments

Lines starting with `//` (with optional leading whitespace) are stripped before parsing:

```
// This is a comment — it will be ignored
[multiple-choice]
prompt: "What color is the sky?"
// Maybe add more choices later
choices:
  - "Blue" (correct)
  - "Green"
```

## `[no-audio]` flag

Append `[no-audio]` to any text value to suppress TTS for that field:

```
prompt: "Translate this" [no-audio]
```

The parser records which fields have this flag in the `noAudio` array.

---

## Exercise Types

### multiple-choice

Present a prompt with several choices. Exactly one is marked `(correct)`.

| Field | Required | Description |
|-------|----------|-------------|
| prompt | yes | The question text |
| choices (list) | yes | `- "text"` items, one with `(correct)` |
| random_order | no | `true` to shuffle choices at runtime |

```
[multiple-choice]
prompt: "What does 'gato' mean?"
choices:
  - "Dog"
  - "Cat" (correct)
  - "Bird"
```

### translation

User translates a sentence. Supports alternate accepted answers.

| Field | Required | Description |
|-------|----------|-------------|
| prompt | yes | Instruction shown to user |
| sentence | yes | The sentence to translate |
| answer | yes | The expected answer |
| acceptAlso | no | Additional accepted answers: `"alt1" "alt2"` |

```
[translation]
prompt: "Translate to English"
sentence: "El gato es negro"
answer: "The cat is black"
acceptAlso: "The cat's black"
```

### fill-in-the-blank

User fills in the missing word in a sentence.

| Field | Required | Description |
|-------|----------|-------------|
| sentence | yes | Sentence with `___` marking the blank |
| blank | yes | The correct word for the blank |

```
[fill-in-the-blank]
sentence: "El ___ es negro"
blank: "gato"
```

### matching-pairs

User matches left-side items to right-side items.

| Field | Required | Description |
|-------|----------|-------------|
| pairs (list) | yes | `- "left" = "right"` items |
| random_order | no | `true` to shuffle pairs |

```
[matching-pairs]
- "gato" = "cat"
- "perro" = "dog"
- "pájaro" = "bird"
```

### listening

User listens to TTS audio and types what they hear.

| Field | Required | Description |
|-------|----------|-------------|
| text | yes | The text that will be spoken |
| ttsLang | yes | BCP-47 language code for TTS (e.g. `es-ES`) |
| mode | no | `choices` or `word-bank` for alternate UI |

```
[listening]
text: "El gato es negro"
ttsLang: es-ES
```

### word-bank

User assembles a sentence from a set of word tiles.

| Field | Required | Description |
|-------|----------|-------------|
| prompt | yes | Instruction shown to user |
| words | yes | Available tiles: `"word1" "word2" ...` |
| answer | yes | Correct order: `"word1" "word2" ...` |
| random_order | no | `true` to shuffle tiles |

```
[word-bank]
prompt: "Arrange the translation"
words: "cat" "the" "is" "black" "big"
answer: "the" "cat" "is" "black"
```

### speaking

User speaks a sentence aloud for pronunciation practice.

| Field | Required | Description |
|-------|----------|-------------|
| sentence | yes | The sentence the user should say |

```
[speaking]
sentence: "El gato es negro"
```
