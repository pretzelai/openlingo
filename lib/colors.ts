/** Hardcoded unit color palette — cycled by index so we never depend on DB values. */
export const UNIT_COLORS = [
  "#58CC02", // green
  "#1CB0F6", // blue
  "#CE82FF", // purple
  "#FF9600", // orange
  "#FF4B4B", // red
  "#FF86D0", // pink
  "#2B9E8F", // teal
  "#8B5CF6", // indigo
] as const;

export function getUnitColor(index: number): string {
  return UNIT_COLORS[index % UNIT_COLORS.length];
}
