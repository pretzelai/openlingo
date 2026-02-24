import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUnitForEdit } from "@/lib/db/queries/courses";
import { UnitEditor } from "./unit-editor";

interface EditUnitPageProps {
  params: Promise<{ unitId: string }>;
}

export default async function EditUnitPage({ params }: EditUnitPageProps) {
  const { unitId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const unitData = await getUnitForEdit(unitId, session.user.id);

  if (!unitData) {
    redirect("/units");
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <UnitEditor
        unitId={unitData.id}
        title={unitData.title}
        initialMarkdown={unitData.markdown}
      />
    </div>
  );
}
