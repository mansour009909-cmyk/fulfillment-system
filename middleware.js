import { NextResponse } from "next/server";
import { verifySessionToken } from "./lib/webAuth";

// حماية مسارات الويب الثلاثة: لوحة التحكم الإدارية (ADMIN)، بوابة العميل (CLIENT)، بوابة المورد (SUPPLIER).
// تطبيق الجوال له مصادقته الخاصة بتوكن Bearer (لا كوكي) — يُستثنى بالكامل هنا.
// Edge middleware: يتحقق فقط من توقيع الكوكي (Web Crypto) بدون أي استدعاء لقاعدة البيانات.

const PUBLIC_PATHS = [
  "/login",
  "/portal/client/login",
  "/portal/supplier/login",
  "/api/auth/login",
  "/api/portal/client/login",
  "/api/portal/supplier/login",
  "/warehouse-app.apk", // تحميل تطبيق الجوال مباشرة من المتصفح — لا يحتاج تسجيل دخول
];

function isApi(pathname) {
  return pathname.startsWith("/api/");
}

function deny(req, pathname, loginPath) {
  if (isApi(pathname)) {
    return NextResponse.json({ error: "يلزم تسجيل الدخول" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = loginPath;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/mobile/")) return NextResponse.next();
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  const session = await verifySessionToken(token);

  if (pathname.startsWith("/portal/client") || pathname.startsWith("/api/portal/client")) {
    if (!session || session.role !== "CLIENT") return deny(req, pathname, "/portal/client/login");
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal/supplier") || pathname.startsWith("/api/portal/supplier")) {
    if (!session || session.role !== "SUPPLIER") return deny(req, pathname, "/portal/supplier/login");
    return NextResponse.next();
  }

  // كل شيء آخر — لوحة التحكم الإدارية بالكامل
  if (!session || session.role !== "ADMIN") return deny(req, pathname, "/login");
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
