import { describe, expect, test } from "bun:test";
import { parseExercise, parseExercisesFromMarkdown } from "./parser";

describe("parseExercisesFromMarkdown", () => {
  test("strips comment lines before parsing", () => {
    const md = `
// this is a comment
[speaking]
sentence: "Hola"
---
// another comment
  // indented comment
[speaking]
sentence: "Adiós"
`;
    const exercises = parseExercisesFromMarkdown(md);
    expect(exercises).toHaveLength(2);
    expect(exercises[0].type).toBe("speaking");
    expect(exercises[1].type).toBe("speaking");
  });

  test("splits on --- separators", () => {
    const md = `
[speaking]
sentence: "Hola"
---
[speaking]
sentence: "Adiós"
---
[speaking]
sentence: "Gracias"
`;
    const exercises = parseExercisesFromMarkdown(md);
    expect(exercises).toHaveLength(3);
  });
});

describe("parseExercise", () => {
  test("throws on unknown exercise type", () => {
    expect(() => parseExercise("[unknown-type]\nprompt: test")).toThrow(
      "Unknown exercise type: unknown-type"
    );
  });

  test("throws when no type tag found", () => {
    expect(() => parseExercise("prompt: test")).toThrow(
      "No exercise type found"
    );
  });
});

describe("multiple-choice", () => {
  test("parses basic multiple choice", () => {
    const block = `[multiple-choice]
prompt: "What does 'gato' mean?"
choices:
  - "Dog"
  - "Cat" (correct)
  - "Bird"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "multiple-choice",
      prompt: "What does 'gato' mean?",
      choices: ["Dog", "Cat", "Bird"],
      correctIndex: 1,
    });
  });

  test("parses random_order flag", () => {
    const block = `[multiple-choice]
prompt: "Pick one"
random_order: true
choices:
  - "A" (correct)
  - "B"`;
    const ex = parseExercise(block);
    expect(ex.type).toBe("multiple-choice");
    if (ex.type === "multiple-choice") {
      expect(ex.randomOrder).toBe(true);
    }
  });

  test("parses [no-audio] on prompt", () => {
    const block = `[multiple-choice]
prompt: "Pick one" [no-audio]
choices:
  - "A" (correct)
  - "B"`;
    const ex = parseExercise(block);
    if (ex.type === "multiple-choice") {
      expect(ex.noAudio).toEqual(["prompt"]);
      expect(ex.prompt).toBe("Pick one");
    }
  });
});

describe("translation", () => {
  test("parses basic translation", () => {
    const block = `[translation]
prompt: "Translate to English"
sentence: "El gato es negro"
answer: "The cat is black"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "translation",
      prompt: "Translate to English",
      sentence: "El gato es negro",
      answer: "The cat is black",
      acceptAlso: [],
    });
  });

  test("parses acceptAlso", () => {
    const block = `[translation]
prompt: "Translate"
sentence: "El gato"
answer: "The cat"
acceptAlso: "A cat" "Cats"`;
    const ex = parseExercise(block);
    if (ex.type === "translation") {
      expect(ex.acceptAlso).toEqual(["A cat", "Cats"]);
    }
  });

  test("throws on missing required field", () => {
    const block = `[translation]
prompt: "Translate"
sentence: "El gato"`;
    expect(() => parseExercise(block)).toThrow("Missing field: answer");
  });
});

describe("fill-in-the-blank", () => {
  test("parses basic fill-in-the-blank", () => {
    const block = `[fill-in-the-blank]
sentence: "El ___ es negro"
blank: "gato"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "fill-in-the-blank",
      sentence: "El ___ es negro",
      blank: "gato",
    });
  });

  test("parses [no-audio] on sentence", () => {
    const block = `[fill-in-the-blank]
sentence: "El ___ es negro" [no-audio]
blank: "gato"`;
    const ex = parseExercise(block);
    if (ex.type === "fill-in-the-blank") {
      expect(ex.noAudio).toEqual(["sentence"]);
      expect(ex.sentence).toBe("El ___ es negro");
    }
  });
});

describe("matching-pairs", () => {
  test("parses basic matching pairs", () => {
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
    });
  });

  test("parses [no-audio] on pair values", () => {
    const block = `[matching-pairs]
- "gato [no-audio]" = "cat"`;
    const ex = parseExercise(block);
    if (ex.type === "matching-pairs") {
      expect(ex.pairs[0].left).toBe("gato");
      expect(ex.noAudio).toEqual(["left:0"]);
    }
  });
});

describe("listening", () => {
  test("parses basic listening", () => {
    const block = `[listening]
text: "El gato es negro"
ttsLang: es-ES`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "listening",
      text: "El gato es negro",
      ttsLang: "es-ES",
    });
  });

  test("parses optional mode", () => {
    const block = `[listening]
text: "Hola"
ttsLang: es-ES
mode: word-bank`;
    const ex = parseExercise(block);
    if (ex.type === "listening") {
      expect(ex.mode).toBe("word-bank");
    }
  });
});

describe("word-bank", () => {
  test("parses basic word bank", () => {
    const block = `[word-bank]
prompt: "Arrange the translation"
words: "the" "cat" "is" "black"
answer: "the" "cat" "is" "black"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "word-bank",
      prompt: "Arrange the translation",
      words: ["the", "cat", "is", "black"],
      answer: ["the", "cat", "is", "black"],
    });
  });

  test("parses random_order", () => {
    const block = `[word-bank]
prompt: "Order"
words: "a" "b"
answer: "a" "b"
random_order: true`;
    const ex = parseExercise(block);
    if (ex.type === "word-bank") {
      expect(ex.randomOrder).toBe(true);
    }
  });
});

describe("speaking", () => {
  test("parses basic speaking", () => {
    const block = `[speaking]
sentence: "El gato es negro"`;
    const ex = parseExercise(block);
    expect(ex).toEqual({
      type: "speaking",
      sentence: "El gato es negro",
    });
  });

  test("parses [no-audio] on sentence", () => {
    const block = `[speaking]
sentence: "El gato" [no-audio]`;
    const ex = parseExercise(block);
    if (ex.type === "speaking") {
      expect(ex.noAudio).toEqual(["sentence"]);
      expect(ex.sentence).toBe("El gato");
    }
  });
});
