import { describe, expect, test } from "bun:test";
import { checkSimilarity, checkBestMatch } from "./similarity";

describe("checkSimilarity", () => {
  describe("normalization", () => {
    test("ignores case", () => {
      const r = checkSimilarity("i am tired", "I am tired");
      expect(r.isCorrect).toBe(true);
      expect(r.similarity).toBe(1);
    });

    test("ignores case on single word", () => {
      const r = checkSimilarity("deutschland", "Deutschland");
      expect(r.isCorrect).toBe(true);
      expect(r.similarity).toBe(1);
    });

    test("treats ß as ss", () => {
      const r = checkSimilarity("strasse", "Straße");
      expect(r.isCorrect).toBe(true);
      expect(r.similarity).toBe(1);
    });

    test("treats ss as ß", () => {
      const r = checkSimilarity("Straße", "Strasse");
      expect(r.isCorrect).toBe(true);
      expect(r.similarity).toBe(1);
    });

    test("ignores umlauts (ä ö ü)", () => {
      expect(checkSimilarity("uber", "Über").isCorrect).toBe(true);
      expect(checkSimilarity("schon", "schön").isCorrect).toBe(true);
      expect(checkSimilarity("Madchen", "Mädchen").isCorrect).toBe(true);
    });

    test("ignores accents from other languages", () => {
      expect(checkSimilarity("cafe", "Café").isCorrect).toBe(true);
      expect(checkSimilarity("nino", "Niño").isCorrect).toBe(true);
      expect(checkSimilarity("naive", "naïve").isCorrect).toBe(true);
    });

    test("trims whitespace", () => {
      const r = checkSimilarity("  hello  ", "hello");
      expect(r.isCorrect).toBe(true);
    });
  });

  describe("threshold", () => {
    test("default threshold (1) forgives one typo", () => {
      const r = checkSimilarity("helo", "hello");
      expect(r.isCorrect).toBe(true);
      expect(r.similarity).toBeLessThan(1);
    });

    test("default threshold rejects two typos", () => {
      const r = checkSimilarity("hlo", "hello");
      expect(r.isCorrect).toBe(false);
    });

    test("threshold=0 requires exact match after normalization", () => {
      const r = checkSimilarity("helo", "hello", { threshold: 0 });
      expect(r.isCorrect).toBe(false);
    });

    test("threshold=2 forgives two typos", () => {
      const r = checkSimilarity("hlo", "hello", { threshold: 2 });
      expect(r.isCorrect).toBe(true);
    });
  });

  describe("similarity score", () => {
    test("exact match is 1", () => {
      expect(checkSimilarity("hello", "hello").similarity).toBe(1);
    });

    test("normalized match is 1", () => {
      expect(checkSimilarity("HELLO", "hello").similarity).toBe(1);
    });

    test("completely different strings have low similarity", () => {
      expect(checkSimilarity("abc", "xyz").similarity).toBeLessThan(0.5);
    });

    test("one char off has high similarity", () => {
      const r = checkSimilarity("hell", "hello");
      expect(r.similarity).toBeGreaterThan(0.7);
    });
  });

  describe("correctedMarkdown", () => {
    test("no diff on exact match", () => {
      expect(checkSimilarity("hello", "hello").correctedMarkdown).toBe("hello");
    });

    test("no diff on normalized match (case)", () => {
      expect(checkSimilarity("deutschland", "Deutschland").correctedMarkdown).toBe("Deutschland");
    });

    test("no diff on normalized match (ß/ss)", () => {
      expect(checkSimilarity("strasse", "Straße").correctedMarkdown).toBe("Straße");
    });

    test("no diff on normalized match (umlaut)", () => {
      expect(checkSimilarity("uber", "Über").correctedMarkdown).toBe("Über");
    });

    test("bolds missing character", () => {
      expect(checkSimilarity("Deutshland", "Deutschland").correctedMarkdown)
        .toBe("Deuts**c**hland");
    });

    test("bolds multiple missing chars in a sentence", () => {
      // bolds missing 'm' and 'c', plus case diffs on 'I' and 'D'
      expect(checkSimilarity("ich kome aus deutshland", "Ich komme aus Deutschland").correctedMarkdown)
        .toBe("**I**ch ko**m**me aus **D**euts**c**hland");
    });

    test("bolds wrong character (substitution)", () => {
      expect(checkSimilarity("hallo", "hello").correctedMarkdown)
        .toBe("h**e**llo");
    });

    test("handles extra character in input gracefully", () => {
      // user typed "helllo" — correct is "hello", no chars to bold
      expect(checkSimilarity("helllo", "hello").correctedMarkdown)
        .toBe("hello");
    });

    test("bolds missing character at start", () => {
      expect(checkSimilarity("eutschland", "Deutschland").correctedMarkdown)
        .toBe("**D**eutschland");
    });

    test("preserves ß in output and bolds it when wrong", () => {
      // also bolds 'S' since user typed lowercase 's'
      expect(checkSimilarity("strase", "Straße").correctedMarkdown)
        .toBe("**S**tra**ß**e");
    });

    test("bolds missing chars at end", () => {
      expect(checkSimilarity("I am go", "I am good").correctedMarkdown)
        .toBe("I am g**o**o**d**");
    });

    test("bolds swapped/wrong region", () => {
      expect(checkSimilarity("teh", "the").correctedMarkdown)
        .toBe("t**he**");
    });

    test("bolds missing space", () => {
      expect(checkSimilarity("ichlerne", "ich lerne").correctedMarkdown)
        .toBe("ich** **lerne");
    });
  });
});

describe("checkBestMatch", () => {
  test("returns exact match when available", () => {
    const r = checkBestMatch("street", ["Straße", "Street", "Road"]);
    expect(r.isCorrect).toBe(true);
    expect(r.similarity).toBe(1);
    expect(r.correctedMarkdown).toBe("Street");
  });

  test("returns best match from multiple options", () => {
    const r = checkBestMatch("strasse", ["Straße", "Street", "Road"]);
    expect(r.isCorrect).toBe(true);
    expect(r.similarity).toBe(1);
  });

  test("picks closest answer when none is exact", () => {
    const r = checkBestMatch("stret", ["Straße", "Street", "Road"]);
    // "stret" is closest to "Street" — bolds case diff 'S' and missing 'e'
    expect(r.correctedMarkdown).toBe("**S**tr**e**et");
    expect(r.similarity).toBeGreaterThan(0.7);
  });

  test("works with acceptAlso pattern", () => {
    const answers = ["I am tired", "I'm tired"];
    expect(checkBestMatch("i am tired", answers).isCorrect).toBe(true);
    expect(checkBestMatch("i'm tired", answers).isCorrect).toBe(true);
  });
});
