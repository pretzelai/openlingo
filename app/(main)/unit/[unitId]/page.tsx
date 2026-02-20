import { notFound, redirect } from "next/navigation";
import { getUnitWithContent } from "@/lib/db/queries/courses";
import { getUnitProgress } from "@/lib/actions/progress";
import { StandaloneUnitPath } from "./standalone-unit-path";
import { HoverableText } from "@/components/word/hoverable-text";
import { getLanguageName } from "@/lib/languages";

interface PageProps {
  params: Promise<{ unitId: string }>;
}


export default async function StandaloneUnitPage({ params }: PageProps) {
  const { unitId } = await params;
  const unit = await getUnitWithContent(unitId);
  if (!unit) notFound();

  // If unit belongs to a course, redirect there
  if (unit.courseId) {
    redirect(`/units/${unit.courseId}?unit=${unitId}`);
  }

  const { completions } = await getUnitProgress(unitId);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-lingo-text">
          <HoverableText text={unit.title} language={unit.targetLanguage} />
        </h1>
        {unit.sourceLanguage && (
          <p className="text-sm text-lingo-text-light mt-1">
            {getLanguageName(unit.sourceLanguage)} →{" "}
            {getLanguageName(unit.targetLanguage)}
          </p>
        )}
      </div>
      <StandaloneUnitPath unit={unit} completions={completions} />
    </div>
  );
}
