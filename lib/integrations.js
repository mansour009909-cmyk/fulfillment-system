import { prisma } from "./prisma";

// كتالوج مزوّدات الربط — كل مزوّد يحدد فئته، نطاقه (نظام عام أو خاص بعميل)،
// والحقول المطلوبة منه (تختلف تسميتها حسب طبيعة كل مزوّد).
export const PROVIDER_CATALOG = {
  // تطبيق سلة — نسجّله مرة واحدة عند سلة (Partner App)، ونستخدم بياناته لتوليد رابط تفويض
  // لكل متجر عميل على حدة. هذا نظامي (Client ID/Secret واحد للشركة كلها)، وليس خاص بعميل.
  SALLA_APP: {
    label: "تطبيق سلة (بيانات التطبيق)",
    category: "STORE",
    scope: "SYSTEM",
    description: "بيانات التطبيق المسجَّل عندنا بمنصّة شركاء سلة — تُستخدم لربط متجر كل عميل بشكل منفصل",
    fields: [
      { key: "apiKey", label: "Client ID" },
      { key: "apiSecret", label: "Client Secret" },
      { key: "accountId", label: "سر الويبهوك (Webhook Secret)", optional: true, secret: true },
    ],
  },
  // ربط متجر عميل — عبر تفويض OAuth: العميل يوافق بمتجره بسلة، وسلة يرجّعنا access token
  // خاص بمتجره فقط. ما يُدخَل يدويًا — يمتلئ تلقائيًا بعد نجاح التفويض.
  SALLA: {
    label: "سلة — متجر العميل",
    category: "STORE",
    scope: "CLIENT",
    oauth: true,
    description: "كل عميل يفوّض تطبيقنا بمتجره على سلة؛ بعدها نسحب طلباته تلقائيًا ونزامن المخزون المشترك",
    fields: [],
  },
  DAFTRA: {
    label: "دفترة",
    category: "ACCOUNTING",
    scope: "SYSTEM",
    description: "مزامنة فواتير العملاء مع دفترة",
    fields: [
      { key: "accountId", label: "النطاق الفرعي (Subdomain)" },
      { key: "apiKey", label: "مفتاح API" },
    ],
  },
  SMSA: {
    label: "SMSA Express",
    category: "SHIPPING",
    scope: "SYSTEM",
    description: "توليد بوليصات الشحن تلقائيًا عبر SMSA",
    fields: [
      { key: "apiKey", label: "مفتاح API" },
      { key: "accountId", label: "رقم الحساب" },
    ],
  },
  ARAMEX: {
    label: "أرامكس",
    category: "SHIPPING",
    scope: "SYSTEM",
    description: "توليد بوليصات الشحن تلقائيًا عبر أرامكس",
    fields: [
      { key: "apiKey", label: "مفتاح API" },
      { key: "accountId", label: "رقم الحساب" },
    ],
  },
  NAQEL: {
    label: "ناقل إكسبرس",
    category: "SHIPPING",
    scope: "SYSTEM",
    description: "توليد بوليصات الشحن تلقائيًا عبر ناقل إكسبرس",
    fields: [
      { key: "apiKey", label: "مفتاح API" },
      { key: "accountId", label: "رقم الحساب" },
    ],
  },
  REDBOX: {
    label: "ريدبوكس",
    category: "SHIPPING",
    scope: "SYSTEM",
    description: "توليد بوليصات الشحن تلقائيًا عبر ريدبوكس",
    fields: [
      { key: "apiKey", label: "مفتاح API" },
      { key: "accountId", label: "رقم الحساب" },
    ],
  },
  ZAJEL: {
    label: "زاجل",
    category: "SHIPPING",
    scope: "SYSTEM",
    description: "توليد بوليصات الشحن تلقائيًا عبر زاجل",
    fields: [
      { key: "apiKey", label: "مفتاح API" },
      { key: "accountId", label: "رقم الحساب" },
    ],
  },
  SAUDI_POST: {
    label: "البريد السعودي (SPL)",
    category: "SHIPPING",
    scope: "SYSTEM",
    description: "توليد بوليصات الشحن تلقائيًا عبر البريد السعودي",
    fields: [
      { key: "apiKey", label: "مفتاح API" },
      { key: "accountId", label: "رقم الحساب" },
    ],
  },
  OTHER_SHIPPING: {
    label: "شركة شحن أخرى",
    category: "SHIPPING",
    scope: "SYSTEM",
    description: "أي شركة شحن أخرى غير مدرجة بالقائمة",
    fields: [
      { key: "apiKey", label: "مفتاح API" },
      { key: "accountId", label: "رقم الحساب" },
    ],
  },
};

export const CATEGORY_LABELS = {
  STORE: "ربط المتاجر",
  SHIPPING: "شركات الشحن",
  ACCOUNTING: "المحاسبة",
};

export function isConfigured(integration) {
  if (!integration) return false;
  const catalog = PROVIDER_CATALOG[integration.provider];
  if (!catalog) return false;
  if (catalog.oauth) return Boolean(integration.accessToken);
  return catalog.fields
    .filter((f) => !f.optional)
    .every((f) => Boolean(integration[f.key]));
}

// يجيب ربط مزوّد معيّن — نظامي (clientId فاضي) أو خاص بعميل
// (findFirst بدل findUnique على المفتاح المركّب لأن Prisma ما يدعم قيمة null بالبحث المركّب مباشرة)
export async function getIntegration(provider, clientId = null) {
  return prisma.integration.findFirst({ where: { provider, clientId } });
}
