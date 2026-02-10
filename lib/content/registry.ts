import fs from "fs";
import path from "path";
import { loadCourse } from "./loader";
import type { Course } from "./types";

let courseCache: Map<string, Course> | null = null;

export function getAllCourses(): Course[] {
  if (courseCache) return Array.from(courseCache.values());

  courseCache = new Map();
  const contentDir = path.join(process.cwd(), "content");

  if (!fs.existsSync(contentDir)) return [];

  const dirs = fs
    .readdirSync(contentDir)
    .filter((f) => fs.statSync(path.join(contentDir, f)).isDirectory());

  for (const dir of dirs) {
    const courseFile = path.join(contentDir, dir, "course.md");
    if (fs.existsSync(courseFile)) {
      const course = loadCourse(dir);
      courseCache.set(course.id, course);
    }
  }

  return Array.from(courseCache.values());
}

export function getCourse(courseId: string): Course | undefined {
  getAllCourses();
  return courseCache?.get(courseId);
}

export function invalidateCache() {
  courseCache = null;
}
