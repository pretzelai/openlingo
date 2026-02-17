import { describe, expect, test } from "bun:test";
import { parseExercise, parseExercisesFromMarkdown } from "./parser";

describe("parseExercisesFromMarkdown", () => {
  test("strips comment lines before parsing", () => {
    const md = `
// this is a comment
[speaking]
sentence: "Hola"
srsWords: "hola"

// another comment
  // indented comment
[speaking]
sentence: "Adiós"
srsWords: "adiós"
`;
    const exercises = parseExercisesFromMarkdown(md);
    expect(exercises).toHaveLength(2);
    expect(exercises[0].type).toBe("speaking");
    expect(exercises[1].type).toBe("speaking");
  });

  test("splits exercises by type tags without separators", () => {
    const md = `
[speaking]
sentence: "Hola"
srsWords: "hola"

[speaking]
sentence: "Adiós"
srsWords: "adiós"

[speaking]
sentence: "Gracias"
srsWords: "gracias"
`;
    const exercises = parseExercisesFromMarkdown(md);
    expect(exercises).toHaveLength(3);
  });

  test("still works with --- separators (backward compat)", () => {
    const md = `
[speaking]
sentence: "Hola"
srsWords: "hola"
---
[speaking]
sentence: "Adiós"
srsWords: "adiós"
`;
    const exercises = parseExercisesFromMarkdown(md);
    expect(exercises).toHaveLength(2);
  });
});

describe("parseExercise", () => {
  test("throws on unknown exercise type", () => {
    expect(() => parseExercise("[unknown-type]\ntext: test")).toThrow(
      "Unknown exercise type: unknown-type"
    );
  });

  test("throws when no type tag found", () => {
    expect(() => parseExercise("text: test")).toThrow(
      "No exercise type found"
    );
  });
});

describe("multiple-choice", () => {
  test("parses basic multiple choice", () => {
    const block = `[multiple-choice]
text: "What does 'gato' mean?"
choices:
  - "Dog"
  - "Cat" (correct)
  - "Bird"
srsWords: "gato"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "multiple-choice",
      text: "What does 'gato' mean?",
      choices: ["Dog", "Cat", "Bird"],
      correctIndex: 1,
      srsWords: "gato",
    });
  });

  test("parses random_order flag", () => {
    const block = `[multiple-choice]
text: "Pick one"
random_order: true
choices:
  - "A" (correct)
  - "B"
srsWords: "a"`;
    const ex = parseExercise(block);
    expect(ex.type).toBe("multiple-choice");
    if (ex.type === "multiple-choice") {
      expect(ex.randomOrder).toBe(true);
    }
  });

  test("parses [no-audio] on text", () => {
    const block = `[multiple-choice]
text: "Pick one" [no-audio]
choices:
  - "A" (correct)
  - "B"
srsWords: "a"`;
    const ex = parseExercise(block);
    if (ex.type === "multiple-choice") {
      expect(ex.noAudio).toEqual(["text"]);
      expect(ex.text).toBe("Pick one");
    }
  });

  test("rejects missing srsWords", () => {
    const block = `[multiple-choice]
text: "Pick one"
choices:
  - "A" (correct)
  - "B"`;
    expect(() => parseExercise(block)).toThrow("Invalid [multiple-choice]");
  });
});

describe("translation", () => {
  test("parses basic translation", () => {
    const block = `[translation]
text: "Translate to English"
sentence: "El gato es negro"
answer: "The cat is black"
srsWords: "gato"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "translation",
      text: "Translate to English",
      sentence: "El gato es negro",
      answer: "The cat is black",
      acceptAlso: [],
      srsWords: "gato",
    });
  });

  test("parses acceptAlso", () => {
    const block = `[translation]
text: "Translate"
sentence: "El gato"
answer: "The cat"
acceptAlso: "A cat" "Cats"
srsWords: "gato"`;
    const ex = parseExercise(block);
    if (ex.type === "translation") {
      expect(ex.acceptAlso).toEqual(["A cat", "Cats"]);
    }
  });

  test("throws on missing required field", () => {
    const block = `[translation]
text: "Translate"
sentence: "El gato"`;
    expect(() => parseExercise(block)).toThrow("Missing field: answer");
  });
});

describe("fill-in-the-blank", () => {
  test("parses basic fill-in-the-blank", () => {
    const block = `[fill-in-the-blank]
sentence: "El ___ es negro"
blank: "gato"
srsWords: "gato"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "fill-in-the-blank",
      sentence: "El ___ es negro",
      blank: "gato",
      srsWords: "gato",
    });
  });

  test("parses [no-audio] on sentence", () => {
    const block = `[fill-in-the-blank]
sentence: "El ___ es negro" [no-audio]
blank: "gato"
srsWords: "gato"`;
    const ex = parseExercise(block);
    if (ex.type === "fill-in-the-blank") {
      expect(ex.noAudio).toEqual(["sentence"]);
      expect(ex.sentence).toBe("El ___ es negro");
    }
  });
});

describe("matching-pairs", () => {
  test("parses basic matching pairs (auto-infers srsWords)", () => {
    const block = `[matching-pairs]
- "gato" = "cat"
- "perro" = "dog"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "matching-pairs",
      pairs: [
        { left: "gato", right: "cat" },
        { left: "perro", right: "dog" },
      ],
      srsWords: ["gato", "perro"],
    });
  });

  test("parses [no-audio] on pair values", () => {
    const block = `[matching-pairs]
- "gato [no-audio]" = "cat"
- "perro" = "dog"`;
    const ex = parseExercise(block);
    if (ex.type === "matching-pairs") {
      expect(ex.pairs[0].left).toBe("gato");
      expect(ex.noAudio).toEqual(["left:0"]);
    }
  });

  test("explicit srsWords overrides auto-infer", () => {
    const block = `[matching-pairs]
- "gato" = "cat"
- "perro" = "dog"
srsWords: "gato"`;
    const ex = parseExercise(block);
    if (ex.type === "matching-pairs") {
      expect(ex.srsWords).toBe("gato");
    }
  });
});

describe("listening", () => {
  test("parses basic listening", () => {
    const block = `[listening]
text: "El gato es negro"
ttsLang: es-ES
srsWords: "gato"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "listening",
      text: "El gato es negro",
      ttsLang: "es-ES",
      srsWords: "gato",
    });
  });

  test("parses optional mode", () => {
    const block = `[listening]
text: "Hola"
ttsLang: es-ES
mode: word-bank
srsWords: "hola"`;
    const ex = parseExercise(block);
    if (ex.type === "listening") {
      expect(ex.mode).toBe("word-bank");
    }
  });
});

describe("word-bank", () => {
  test("parses basic word bank", () => {
    const block = `[word-bank]
text: "Arrange the translation"
words: "the" "cat" "is" "black"
answer: "the" "cat" "is" "black"
srsWords: "gato"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "word-bank",
      text: "Arrange the translation",
      words: ["the", "cat", "is", "black"],
      answer: ["the", "cat", "is", "black"],
      srsWords: "gato",
    });
  });

  test("parses random_order", () => {
    const block = `[word-bank]
text: "Order"
words: "a" "b"
answer: "a" "b"
random_order: true
srsWords: "a"`;
    const ex = parseExercise(block);
    if (ex.type === "word-bank") {
      expect(ex.randomOrder).toBe(true);
    }
  });
});

describe("free-text", () => {
  test("parses basic free-text without srsWords", () => {
    const block = `[free-text]
text: "Write a short paragraph introducing yourself in German"
afterSubmitPrompt: "The user wrote: {userResponse}. Please provide feedback."`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "free-text",
      text: "Write a short paragraph introducing yourself in German",
      afterSubmitPrompt: "The user wrote: {userResponse}. Please provide feedback.",
    });
  });

  test("parses free-text with optional srsWords", () => {
    const block = `[free-text]
text: "Write something"
afterSubmitPrompt: "Evaluate: {userResponse}"
srsWords: "schreiben"`;
    const ex = parseExercise(block);
    if (ex.type === "free-text") {
      expect(ex.srsWords).toBe("schreiben");
    }
  });

  test("parses [no-audio] on text", () => {
    const block = `[free-text]
text: "Write something" [no-audio]
afterSubmitPrompt: "Evaluate: {userResponse}"`;
    const ex = parseExercise(block);
    if (ex.type === "free-text") {
      expect(ex.noAudio).toEqual(["text"]);
      expect(ex.text).toBe("Write something");
    }
  });

  test("throws on missing afterSubmitPrompt", () => {
    const block = `[free-text]
text: "Write something"`;
    expect(() => parseExercise(block)).toThrow("Missing field: afterSubmitPrompt");
  });
});

describe("speaking", () => {
  test("parses basic speaking", () => {
    const block = `[speaking]
sentence: "El gato es negro"
srsWords: "gato"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "speaking",
      sentence: "El gato es negro",
      srsWords: "gato",
    });
  });

  test("parses [no-audio] on sentence", () => {
    const block = `[speaking]
sentence: "El gato" [no-audio]
srsWords: "gato"`;
    const ex = parseExercise(block);
    if (ex.type === "speaking") {
      expect(ex.noAudio).toEqual(["sentence"]);
      expect(ex.sentence).toBe("El gato");
    }
  });

  test("rejects missing srsWords", () => {
    const block = `[speaking]
sentence: "El gato"`;
    expect(() => parseExercise(block)).toThrow("Invalid [speaking]");
  });
});

describe("srsWords", () => {
  test("parses single srsWord inline", () => {
    const block = `[multiple-choice]
text: "What does 'hund' mean?"
choices:
  - "Cat"
  - "Dog" (correct)
srsWords: "hund"`;
    const ex = parseExercise(block);
    if (ex.type === "multiple-choice") {
      expect(ex.srsWords).toBe("hund");
    }
  });

  test("parses multiple srsWords inline", () => {
    const block = `[multiple-choice]
text: "What does 'hund' mean?"
choices:
  - "Cat"
  - "Dog" (correct)
srsWords: "hund" "katze"`;
    const ex = parseExercise(block);
    if (ex.type === "multiple-choice") {
      expect(ex.srsWords).toEqual(["hund", "katze"]);
    }
  });

  test("parses legacy list format (ignores translations)", () => {
    const block = `[multiple-choice]
text: "What does 'hund' mean?"
choices:
  - "Cat"
  - "Dog" (correct)
srsWords:
  - "hund" = "dog"
  - "katze" = "cat"`;
    const ex = parseExercise(block);
    if (ex.type === "multiple-choice") {
      expect(ex.srsWords).toEqual(["hund", "katze"]);
    }
  });

  test("matching-pairs auto-infers srsWords from pairs", () => {
    const block = `[matching-pairs]
- "gato" = "cat"
- "perro" = "dog"`;
    const ex = parseExercise(block);
    if (ex.type === "matching-pairs") {
      expect(ex.srsWords).toEqual(["gato", "perro"]);
    }
  });

  test("flashcard-review parses srsWords", () => {
    const block = `[flashcard-review]
front: "Katze"
back: "cat"
srsWords: "Katze"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "flashcard-review",
      front: "Katze",
      back: "cat",
      srsWords: "Katze",
    });
  });

  test("flashcard-review rejects missing srsWords", () => {
    const block = `[flashcard-review]
front: "Katze"
back: "cat"`;
    expect(() => parseExercise(block)).toThrow("Invalid [flashcard-review]");
  });
});
