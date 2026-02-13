import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { parseExercise, parseExercisesFromMarkdown } from "./parser";
import type {
  Course,
  Unit,
  UnitLesson,
  Exercise,
} from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

export function loadCourse(courseDir: string): Course {
  const coursePath = path.join(CONTENT_DIR, courseDir);
  const courseFile = fs.readFileSync(
    path.join(coursePath, "course.md"),
    "utf-8"
  );
  const { data: courseMeta } = matter(courseFile);

  const entries = fs.readdirSync(coursePath);
  const unitEntries = entries
    .filter((f) => {
      if (!f.startsWith("unit-")) return false;
      const fullPath = path.join(coursePath, f);
      const isDir = fs.statSync(fullPath).isDirectory();
      return isDir || f.endsWith(".md");
    })
    .sort((a, b) => a.replace(/\.md$/, "").localeCompare(b.replace(/\.md$/, "")));

  const courseId = courseMeta.id as string;
  const units = unitEntries.map((entry, index) => {
    const fullPath = path.join(coursePath, entry);
    const unitId = `${courseId}-unit-${index}`;
    if (fs.statSync(fullPath).isDirectory()) {
      return loadUnit(fullPath, unitId);
    }
    return loadUnitFromFile(fullPath, unitId);
  });

  return {
    id: courseMeta.id,
    title: courseMeta.title,
    sourceLanguage: courseMeta.sourceLanguage,
    targetLanguage: courseMeta.targetLanguage,
    level: courseMeta.level,
    units,
  };
}

function loadUnit(unitPath: string, unitId: string): Unit {
  const unitFile = fs.readFileSync(path.join(unitPath, "unit.md"), "utf-8");
  const { data: unitMeta } = matter(unitFile);

  const lessonFiles = fs
    .readdirSync(unitPath)
    .filter((f) => f.startsWith("lesson-") && f.endsWith(".md"))
    .sort();

  const lessons: UnitLesson[] = lessonFiles.map((file) => {
    const l = loadLessonRaw(path.join(unitPath, file));
    return { title: l.title, xpReward: l.xpReward, exercises: l.exercises };
  });

  return {
    id: unitId,
    title: unitMeta.title,
    description: unitMeta.description,
    icon: unitMeta.icon,
    color: unitMeta.color,
    lessons,
  };
}

function loadUnitFromFile(filePath: string, unitId: string): Unit {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data: unitMeta, content } = matter(raw);

  const sections = content
    .split(/^(?=## )/m)
    .filter((s) => s.trim().startsWith("## "));

  const lessons: UnitLesson[] = sections.map((section) => {
    const lines = section.split("\n");
    const title = lines[0].replace(/^##\s+/, "").trim();
    const body = lines.slice(1).join("\n").trim();

    let xpReward = 10;
    let exerciseContent = body;

    const xpMatch = body.match(/^xpReward:\s*(\d+)\s*\n?/);
    if (xpMatch) {
      xpReward = parseInt(xpMatch[1], 10);
      exerciseContent = body.slice(xpMatch[0].length).trim();
    }

    const exercises = parseExercisesFromMarkdown(exerciseContent);

    return { title, xpReward, exercises };
  });

  return {
    id: unitId,
    title: unitMeta.title,
    description: unitMeta.description,
    icon: unitMeta.icon,
    color: unitMeta.color,
    lessons,
  };
}

function loadLessonRaw(lessonPath: string): { title: string; xpReward: number; exercises: Exercise[] } {
  const raw = fs.readFileSync(lessonPath, "utf-8");
  const { data: meta, content } = matter(raw);

  const exercises = parseExercisesFromMarkdown(content);

  return {
    title: meta.title,
    xpReward: meta.xpReward,
    exercises,
  };
}
