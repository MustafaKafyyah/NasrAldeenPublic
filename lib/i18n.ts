import type { Lang } from "./family";

export const LANGS: Lang[] = ["ar", "en"];

export function isLang(s: string): s is Lang {
  return s === "ar" || s === "en";
}

/** Eastern Arabic-Indic digits — Arabic copy never carries Western figures. */
function ar(n: number): string {
  const d = "٠١٢٣٤٥٦٧٨٩";
  return String(n).replace(/\d/g, (c) => d[Number(c)]);
}

const dict = {
  ar: {
    siteTitle: "شجرة عائلة نصر الدين",
    siteShort: "آل نصر الدين",
    family: "عائلة",
    tagline: "سبعة أجيال، شجرة واحدة",
    members: "فرداً",
    generations: "أجيال",
    generation: "الجيل",
    branches: "فروع",
    search: "ابحث عن اسم…",
    searchHint: "اكتب الاسم بالعربية أو الإنجليزية",
    noResults: "لا يوجد اسم مطابق",
    founder: "الجدّ المؤسّس",
    father: "الأب",
    children: "الأبناء",
    childrenNone: "لا أبناء مسجّلون",
    siblings: "الإخوة",
    siblingsNone: "لا إخوة مسجّلون",
    descendants: "الذرّية",
    lineage: "النسب",
    born: "وُلد",
    in: "في",
    openBranch: "افتح الفرع",
    backToTree: "الشجرة الكاملة",
    zoomIn: "تكبير",
    zoomOut: "تصغير",
    reset: "إعادة الضبط",
    close: "إغلاق",
    switchLang: "English",
    wholeFamily: "العائلة كاملة",
    branchOf: "فرع",
    sons: "ابن",
    daughters: "ابنة",
    ordinal: ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"],
    genLabel: (n: number) => `الجيل ${["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"][n - 1] ?? n}`,
    countPeople: (n: number) => (n === 1 ? "فرد واحد" : n === 2 ? "فردان" : n <= 10 ? `${ar(n)} أفراد` : `${ar(n)} فرداً`),
    countChildren: (n: number) => (n === 1 ? "ابن واحد" : n === 2 ? "ابنان" : n <= 10 ? `${ar(n)} أبناء` : `${ar(n)} ابناً`),
    countDescendants: (n: number) => (n === 0 ? "لا ذرّية مسجّلة" : n === 1 ? "فرد واحد من الذرّية" : n === 2 ? "فردان من الذرّية" : n <= 10 ? `${ar(n)} أفراد من الذرّية` : `${ar(n)} فرداً من الذرّية`),
    plate: "لوحة",
    intro:
      "مشجّرة نسب آل نصر الدين، من الجدّ المؤسّس إلى الجيل السابع. المس أي اسم لترى نسبه وإخوته وأبناءه.",
    hintDesktop: "انقر على اسم ليضيء نسبه · انقر مرتين أو على الرقم لفتح الفرع أو طيّه · اسحب لتحريك الورقة · العجلة للتقريب والتبعيد · ٧ … ١ لطيّ الأجيال · / للبحث · f للملاءمة",
    hintMobile: "المس اسماً ليضيء نسبه · المس الرقم لفتح الفرع",
    daughter: "بنت",
    son: "ابن",
    of: "من",
    unknown: "غير مسجّل",
    firstNamed: "الاسم الأكثر تكرّراً",
    largestBranch: "أكبر فرع",
    treeView: "الشجرة",
    listView: "القائمة",
    location: "الموقع في الشجرة",
    findInTree: "أظهر في الشجرة",
    share: "نسخ الرابط",
    copied: "تم النسخ",
    viewHouses: "شجرة",
    viewScroll: "قائمة",
    house: "بيت",
    fit: "ملاءمة",
    title: "الصفة",
    died: "تُوفّي",
    note: "ملاحظة",
    age: "العمر",
    city: "المدينة",
    wives: "الزوجة",
    wivesMany: "الزوجات",
    phone: "الهاتف",
    email: "البريد",
  },
  en: {
    siteTitle: "The Nasr Aldeen Family Tree",
    siteShort: "Nasr Aldeen",
    family: "Family",
    tagline: "Seven generations, one tree",
    members: "members",
    generations: "generations",
    generation: "Generation",
    branches: "branches",
    search: "Search a name…",
    searchHint: "Type a name in English or Arabic",
    noResults: "No matching name",
    founder: "Founding ancestor",
    father: "Father",
    children: "Children",
    childrenNone: "No children recorded",
    siblings: "Siblings",
    siblingsNone: "No siblings recorded",
    descendants: "Descendants",
    lineage: "Lineage",
    born: "Born",
    in: "in",
    openBranch: "Open branch",
    backToTree: "Whole tree",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    reset: "Reset view",
    close: "Close",
    switchLang: "العربية",
    wholeFamily: "Whole family",
    branchOf: "Branch of",
    sons: "son",
    daughters: "daughter",
    ordinal: ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"],
    genLabel: (n: number) => `Generation ${n}`,
    countPeople: (n: number) => (n === 1 ? "1 person" : `${n} people`),
    countChildren: (n: number) => (n === 1 ? "1 child" : `${n} children`),
    countDescendants: (n: number) => (n === 0 ? "No descendants recorded" : n === 1 ? "1 descendant" : `${n} descendants`),
    plate: "Plate",
    intro:
      "The lineage of the Nasr Aldeen family, from the founding ancestor to the seventh generation. Tap any name to see their lineage, siblings and children.",
    hintDesktop: "Click a name to light its lineage · double-click or click the number to open or fold a branch · drag to pan · wheel to zoom · 1–7 folds generations · / to search · f to fit",
    hintMobile: "Tap a name to light its lineage · tap the number to open a branch",
    daughter: "daughter",
    son: "son",
    of: "of",
    unknown: "not recorded",
    firstNamed: "Most common name",
    largestBranch: "Largest branch",
    treeView: "Tree",
    listView: "List",
    location: "Place in the tree",
    findInTree: "Show in tree",
    share: "Copy link",
    copied: "Copied",
    viewHouses: "Tree",
    viewScroll: "List",
    house: "House of",
    fit: "Fit",
    title: "Title",
    died: "Died",
    note: "Note",
    age: "Age",
    city: "City",
    wives: "Wife",
    wivesMany: "Wives",
    phone: "Phone",
    email: "Email",
  },
} as const;

export type Dict = (typeof dict)["ar"] | (typeof dict)["en"];

export function t(lang: Lang): Dict {
  return dict[lang];
}

/** Eastern Arabic-Indic digits for Arabic UI, Western otherwise. */
export function num(n: number, lang: Lang): string {
  if (lang !== "ar") return String(n);
  const d = "٠١٢٣٤٥٦٧٨٩";
  return String(n).replace(/\d/g, (c) => d[Number(c)]);
}
