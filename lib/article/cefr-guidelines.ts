export const GENERIC_CEFR_GUIDELINES: Record<string, string> = {
  A1: `## A1 (Beginner) - STRICT SIMPLIFICATION

SENTENCE STRUCTURE:
• Maximum 8-10 words per sentence
• ONLY simple main clauses (Subject-Verb-Object)
• NO subordinate clauses whatsoever
• One idea per sentence

VOCABULARY (~500 words):
• Use only the most basic, high-frequency words
• Concrete nouns only (no abstract concepts)
• Basic verbs: be, have, go, come, want, can, like, eat, drink, see, hear
• NO idioms, NO figurative language

TENSES:
• Present tense ONLY

CONNECTORS:
• Limited to: and, or, but`,

  A2: `## A2 (Elementary) - SIGNIFICANT SIMPLIFICATION

SENTENCE STRUCTURE:
• Maximum 12-15 words per sentence
• At most ONE subordinate clause per sentence
• Break complex sentences into 2-3 shorter ones

VOCABULARY (~1,500 words):
• Everyday vocabulary for routine situations
• Basic emotions and opinions
• Avoid rare or technical words

TENSES:
• Present tense (primary)
• Simple past (completed actions)
• Basic future expressions

CONNECTORS:
• and, or, but, because, so, when, if (simple)
• First, then, after that`,

  B1: `## B1 (Intermediate) - MODERATE SIMPLIFICATION

SENTENCE STRUCTURE:
• Maximum 18-20 words per sentence
• Up to TWO subordinate clauses per sentence
• Relative clauses allowed (simple ones)

VOCABULARY (~3,000 words):
• Express opinions, hopes, plans, experiences
• Abstract concepts (basic level)
• Common collocations and expressions

TENSES:
• All common tenses including future
• Perfect tenses for experiences
• Conditional for polite requests and hypotheticals

CONNECTORS:
• because, although, even though, so that
• while, during, before, after, until
• however, therefore, moreover (sparingly)`,

  B2: `## B2 (Upper-Intermediate) - LIGHT SIMPLIFICATION

SENTENCE STRUCTURE:
• Maximum 25 words per sentence
• Complex structures allowed
• Only simplify extremely long sentences (4+ nested clauses)

VOCABULARY (~5,000 words):
• Nuanced expression of opinions
• Idiomatic expressions allowed
• Some technical/specialized vocabulary OK

TENSES:
• Full range of tenses
• Subjunctive/conditional for hypotheticals
• Passive voice freely used

CONNECTORS:
• Full range of discourse markers`,

  C1: `## C1 (Advanced) - MINIMAL CHANGES

SENTENCE STRUCTURE:
• Near-native complexity allowed
• Preserve original sentence structure where possible
• Maintain author's style and voice

VOCABULARY:
• Advanced vocabulary preserved
• Technical terms maintained with context
• Figurative language and idioms kept

TENSES & GRAMMAR:
• All grammatical structures permitted`,

  C2: `## C2 (Mastery) - PRESERVE ORIGINAL

SENTENCE STRUCTURE:
• Native-level complexity preserved
• Author's style fully maintained

VOCABULARY:
• Full vocabulary range including rare words
• Domain-specific terminology preserved

TRANSLATION APPROACH:
• Natural, idiomatic translation
• Preserve nuance and subtext`,
};

export const GERMAN_CEFR_GUIDELINES: Record<string, string> = {
  A1: `## German A1 Grammar Constraints

CASES:
• Nominative case ONLY
• NO accusative, NO dative, NO genitive

WORD ORDER:
• Simple SVO only
• Verb ALWAYS in second position

VERBS:
• Present tense ONLY (Präsens)
• Regular verbs: machen, spielen, lernen
• Key irregular: sein, haben, werden
• Modal verbs: können, müssen, wollen

STRUCTURES TO AVOID:
✗ Passive voice ✗ Relative clauses ✗ Konjunktiv ✗ Perfekt tense`,

  A2: `## German A2 Grammar Constraints

CASES:
• Nominative and Accusative
• Simple Dative (indirect objects)
• NO genitive (use "von + dative")

VERBS:
• Present tense + Perfect tense (Perfekt)
• NO Präteritum (except sein/haben)
• Separable verbs allowed

CONNECTORS:
• und, oder, aber, weil, dass, wenn`,

  B1: `## German B1 Grammar Constraints

CASES: All four cases allowed
VERBS: Present, Perfect, Präteritum, Future I, simple Konjunktiv II, Passive voice
STRUCTURES: Relative clauses, indirect questions, reflexive verbs`,

  B2: `## German B2 Grammar - Full access with minor simplification
Konjunktiv I/II, all passive forms, extended adjective constructions, advanced connectors.`,

  C1: `## German C1 - Near-native. Preserve complex structures.`,
  C2: `## German C2 - Full native complexity.`,
};

export const FRENCH_CEFR_GUIDELINES: Record<string, string> = {
  A1: `## French A1 Grammar Constraints

VERBS: Present tense ONLY. Regular -er verbs + être, avoir, aller, faire.
PRONOUNS: Subject pronouns only. NO object pronouns, NO reflexive verbs.
NEGATION: ne...pas ONLY.
STRUCTURES TO AVOID: ✗ Inversion ✗ Object pronouns ✗ Relative clauses ✗ Compound tenses`,

  A2: `## French A2 Grammar Constraints

VERBS: Présent, Passé composé, Imparfait, Futur proche.
PRONOUNS: Direct/indirect object pronouns, reflexive verbs.
NO subjonctif, NO conditionnel passé.`,

  B1: `## French B1 Grammar Constraints

All indicative tenses + basic subjonctif présent + conditionnel présent.
Si clauses (types 1 and 2). Relative pronouns: qui, que, où.`,

  B2: `## French B2 - Full tense system, subjonctif passé, all relative pronouns, passive voice.`,
  C1: `## French C1 - Near-native. Passé simple, formal register.`,
  C2: `## French C2 - Full native complexity.`,
};

export const SPANISH_CEFR_GUIDELINES: Record<string, string> = {
  A1: `## Spanish A1 Grammar Constraints

VERBS: Present tense ONLY. Regular -ar/-er/-ir + ser, estar, tener, ir, hacer.
NO past tenses, NO future, NO subjunctive.`,

  A2: `## Spanish A2 Grammar Constraints

VERBS: Presente, Pretérito indefinido, Imperfecto, Pretérito perfecto, Estar + gerundio, Ir a + infinitive.
Reflexive verbs and object pronouns allowed. NO subjuntivo.`,

  B1: `## Spanish B1 Grammar Constraints

All indicative tenses + basic presente de subjuntivo + imperativo.
Si clauses (type 1). Basic connectors.`,

  B2: `## Spanish B2 - Full subjunctive, all si clause types, passive voice, advanced connectors.`,
  C1: `## Spanish C1 - Near-native. Advanced subjunctive, formal register.`,
  C2: `## Spanish C2 - Full native complexity.`,
};

export function getCefrGuidelines(language: string, level: string): string {
  const normalizedLevel = level.toUpperCase();
  const normalizedLang = language.toLowerCase();

  const genericGuideline =
    GENERIC_CEFR_GUIDELINES[normalizedLevel] || GENERIC_CEFR_GUIDELINES.B1;

  let languageGuideline = "";

  if (
    normalizedLang.includes("german") ||
    normalizedLang.includes("deutsch")
  ) {
    languageGuideline =
      GERMAN_CEFR_GUIDELINES[normalizedLevel] || GERMAN_CEFR_GUIDELINES.B1;
  } else if (
    normalizedLang.includes("french") ||
    normalizedLang.includes("français") ||
    normalizedLang.includes("francais")
  ) {
    languageGuideline =
      FRENCH_CEFR_GUIDELINES[normalizedLevel] || FRENCH_CEFR_GUIDELINES.B1;
  } else if (
    normalizedLang.includes("spanish") ||
    normalizedLang.includes("español") ||
    normalizedLang.includes("espanol")
  ) {
    languageGuideline =
      SPANISH_CEFR_GUIDELINES[normalizedLevel] || SPANISH_CEFR_GUIDELINES.B1;
  }

  if (languageGuideline) {
    return `${genericGuideline}\n\n${languageGuideline}`;
  }

  return genericGuideline;
}
