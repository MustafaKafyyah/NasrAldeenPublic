import { notFound } from "next/navigation";
import { FamilyTree } from "@/components/FamilyTree";
import { isLang } from "@/lib/i18n";

/**
 * The shared `?p=` link is read in the browser, not here: touching
 * `searchParams` would make this route server-rendered on demand, and the whole
 * site is a static export so it can be served as plain files.
 */
export default async function TreePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <FamilyTree lang={lang} initialPersonId={null} />;
}
