const displayNames = new Intl.DisplayNames(["en"], { type: "language" });

export function getLanguageName(code: string): string {
  return displayNames.of(code) ?? code;
}
