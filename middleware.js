import { NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAMES } from "./lib/webAuth";
import { moduleForPath, MANAGER_ONLY_PATHS } from "./lib/adminModules";

// حماية مسارات الويب الثلاثة: لوحة التحكم الإدارية (ADMIN)، بوابة العميل (CLIENT)، بوابة المورد (SUPPLIER).
// تطبيق الجوال له مصادقته الخاصة بتوكن Bearer (لا كوكي) — يُستثنى بالكامل هنا.
// كل دور له كوكي جلسة منفصل (COOKIE_NAMES) — يخلي الثلاثة يبقون مسجّلين دخول بنفس المتصفح
// بنفس الوقت بدون ما يسجّل أحدهم خروج الثاني.
// Edge middleware: يتحقق فقط من توقيع الكوكي (Web Crypto) بدون أي استدعاء لقاعدة البيانات —
// عدا صلاحيات موظف الويب (EMPLOYEE) اللي تحتاج قراءة حيّة، فنستدعي API داخلي (Node runtime،
// وصول كامل لقاعدة البيانات) بدل كسر قاعدة "بدون قاعدة بيانات هنا" — يضمن أثر فوري لأي تغيير.

const PUBLIC_PATHS = [
  "/login",
  "/portal/client/login",
  "/portal/supplier/login",
  "/api/auth/login",
  "/api/portal/client/login",
  "/api/portal/supplier/login",
  "/warehouse-app.apk", // تحميل تطبيق الجوال مباشرة من المتصفح — لا يحتاج تسجيل دخول
  "/api/integrations/salla/callback", // سلة يرجّع المتصفح لهنا بعد موافقة العميل — قد يكون متصفح العميل نفسه بدون جلسة إدارية
  "/api/integrations/salla/webhook", // سلة يستدعيه مباشرة (سيرفر لسيرفر) عند أي طلب جديد — محمي بتوقيع الويبهوك لا بجلسة
];

function isApi(pathname) {
  return pathname.startsWith("/api/");
}

function denyLogin(req, pathname, loginPath) {
  if (isApi(pathname)) {
    return NextResponse.json({ error: "يلزم تسجيل الدخول" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = loginPath;
  url.search = "";
  return NextResponse.redirect(url);
}

function denyForbidden(req, pathname) {
  if (isApi(pathname)) {
    return NextResponse.json({ error: "ما عندك صلاحية الوصول لهذا القسم" }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "?forbidden=1";
  return NextResponse.redirect(url);
}

async function checkSession(req, role) {
  const token = req.cookies.get(COOKIE_NAMES[role])?.value;
  const session = await verifySessionToken(token);
  return session && session.role === role ? session : null;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/mobile/")) return NextResponse.next();
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  // تقديم صور مرفوعة (أغلفة كتب، شعارات) — تُطلَب من الجوال والبوابات بدون جلسة إدارية،
  // مثل أي ملف ثابت عام. رفع صورة جديدة (POST على /api/uploads/image بدون معرّف) يبقى محميًا.
  if (/^\/api\/uploads\/image\/\d+$/.test(pathname)) return NextResponse.next();

  if (pathname.startsWith("/portal/client") || pathname.startsWith("/api/portal/client")) {
    const session = await checkSession(req, "CLIENT");
    if (!session) return denyLogin(req, pathname, "/portal/client/login");
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal/supplier") || pathname.startsWith("/api/portal/supplier")) {
    const session = await checkSession(req, "SUPPLIER");
    if (!session) return denyLogin(req, pathname, "/portal/supplier/login");
    return NextResponse.next();
  }

  // كل شيء آخر — لوحة التحكم الإدارية
  const session = await checkSession(req, "ADMIN");
  if (!session) return denyLogin(req, pathname, "/login");

  // جلسات قديمة (قبل نظام الصلاحيات) ما فيها level إطلاقًا — نعاملها كمدير (نفس صلاحياتها
  // الأصلية) بدل ما نحظر صاحبها فجأة لين يسجّل خروج ودخول من جديد
  if (!session.level || session.level === "MANAGER") return NextResponse.next();

  // موظف ويب (EMPLOYEE): أقسام محصورة بالمدير صراحة (بدون حاجة لاستدعاء إضافي)
  if (MANAGER_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return denyForbidden(req, pathname);
  }

  const module = moduleForPath(pathname);
  if (!module) return NextResponse.next(); // صفحات بدون قسم محدَّد (الرئيسية) متاحة لأي حساب مفعّل

  const checkUrl = new URL("/api/auth/permission-check", req.url);
  checkUrl.searchParams.set("module", module);
  const checkRes = await fetch(checkUrl, { headers: { cookie: req.headers.get("cookie") || "" } });
  const { allowed } = await checkRes.json().catch(() => ({ allowed: false }));

  return allowed ? NextResponse.next() : denyForbidden(req, pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
