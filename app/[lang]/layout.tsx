import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Reem_Kufi, Amiri, EB_Garamond } from "next/font/google";
import { isLang, t } from "@/lib/i18n";
import "../globals.css";

/* Arabic display — headings, the wordmark, generation titles */
const kufi = Reem_Kufi({
  variable: "--font-kufi",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/* Arabic text — every name, the nasab sentence, notes */
const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "block",
});

/* Latin — English names, metadata and the Latin wordmark */
const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "block",
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
