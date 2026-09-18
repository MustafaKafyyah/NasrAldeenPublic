import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Reem_Kufi, Amiri, EB_Garamond } from "next/font/google";
import { isLang, t } from "@/lib/i18n";
import "../globals.css";

/* Arabic display — headings, the wordmark, generation titles */
const kufi = Reem_Kufi({
  variable: "--font-kufi",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"], // 500 is never set; every file is on the first screen
  display: "swap",
});

/* Arabic text — every name, the nasab sentence, notes */
const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  // swap, not block: on a slow connection the names must not stay invisible
  // while the face downloads — the fallback serif shows and is replaced
  display: "swap",
});

/* Latin — English names, metadata and the Latin wordmark */
const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export function generateStaticParams() {
  return [{ lang: "ar" }, { lang: "en" }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const d = t(lang);
  return {
    title: d.siteTitle,
    description: d.intro,
    alternates: { languages: { ar: "/ar", en: "/en" } },
    openGraph: { title: d.siteTitle, description: d.tagline, locale: lang === "ar" ? "ar_SA" : "en_US", type: "website" },
    appleWebApp: { title: d.siteShort },
  };
}

export const viewport: Viewport = {
  themeColor: "#F3EDE1",
  width: "device-width",
  initialScale: 1,
  // the page draws under the notch and the home indicator; every fixed strip
  // pads itself with env(safe-area-inset-*) instead
  viewportFit: "cover",
  // the soft keyboard shrinks the page rather than covering it, so the search
  // results stay above the keys
  interactiveWidget: "resizes-content",
};

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`${kufi.variable} ${amiri.variable} ${garamond.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
