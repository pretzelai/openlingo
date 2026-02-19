import { loadContentDir, type LoadedCourse, type LoadedUnit } from "./loader";

export type { LoadedCourse, LoadedUnit };

let cache: { courses: LoadedCourse[]; units: LoadedUnit[] } | null = null;

function ensureLoaded() {
  if (!cache) cache = loadContentDir();
  return cache;
}

export function getAllCourses(): LoadedCourse[] {
  return ensureLoaded().courses;
}

export function getAllUnits(): LoadedUnit[] {
  return ensureLoaded().units;
}

export function invalidateCache() {
  cache = null;
}
