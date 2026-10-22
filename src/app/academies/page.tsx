import Link from "next/link";
import { dictionary } from "@/lib/i18n/dictionary";
import { getPublicAcademyIndex } from "@/lib/public-sport-academies";
import { AcademiesDirectory } from "@/components/academies/academies-directory";

export const revalidate = 3600;

export default async function AcademiesPage() {
  const academies = await getPublicAcademyIndex();
  const t = dictionary.ar;

  return (
    <>
      <AcademiesDirectory />
      {academies.length > 0 && (
        <section
          aria-label={t.directory_title}
          className="mx-auto max-w-5xl px-6 pb-14"
        >
          <h2 className="text-xl font-extrabold">{t.directory_title}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {academies.map((academy) => (
              <li key={academy.slug}>
                <Link
                  href={`/a/${academy.slug}`}
                  className="block rounded-lg border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-muted"
                >
                  <span className="font-semibold">{academy.name}</span>
                  {(academy.area || academy.governorate) && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {[academy.area, academy.governorate].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
