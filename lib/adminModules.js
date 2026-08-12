// كتالوج أقسام صلاحيات لوحة التحكم — ملف "نظيف" بدون أي استيراد لـPrisma أو Node crypto،
// عشان يُستورد بأمان من: middleware.js (Edge runtime)، ومكوّنات العميل (Sidebar، صفحة
// صلاحيات الموظفين). المنطق اللي يحتاج قاعدة بيانات (verifyAdminLogin، hasModuleAccess...)
// موجود بـlib/adminAuth.js اللي يستورد من هذا الملف.

export const MODULES = {
  ORDERS: "الطلبات",
  INVENTORY: "المخزون (الرفوف والكتب)",
  CLIENTS: "العملاء",
  SUPPLIERS: "الموردون والاستلام",
  INVOICES: "الفواتير والرسوم",
  REPORTS: "التقارير",
  INTEGRATIONS: "API",
  CHAT: "محادثات الدعم",
};

// أقسام محصورة بالمدير فقط — ما تظهر بواجهة تعيين الصلاحيات، ومرفوضة صراحة لأي EMPLOYEE
export const MANAGER_ONLY_PATHS = ["/employees", "/settings"];

export function moduleForPath(pathname) {
  if (pathname.startsWith("/orders") || pathname.startsWith("/api/orders")) return "ORDERS";
  if (
    pathname.startsWith("/shelves") ||
    pathname.startsWith("/books") ||
    pathname.startsWith("/api/shelves") ||
    pathname.startsWith("/api/books")
  )
    return "INVENTORY";
  if (pathname.startsWith("/clients") || pathname.startsWith("/api/clients")) return "CLIENTS";
  if (
    pathname.startsWith("/suppliers") ||
    pathname.startsWith("/receiving") ||
    pathname.startsWith("/supplier-orders") ||
    pathname.startsWith("/api/suppliers") ||
    pathname.startsWith("/api/receiving")
  )
    return "SUPPLIERS";
  if (pathname.startsWith("/invoices") || pathname.startsWith("/api/invoices") || pathname.startsWith("/api/fees"))
    return "INVOICES";
  if (pathname.startsWith("/reports")) return "REPORTS";
  if (pathname.startsWith("/integrations") || pathname.startsWith("/api/integrations")) return "INTEGRATIONS";
  if (pathname.startsWith("/chat") || pathname.startsWith("/api/chat")) return "CHAT";
  return null; // بدون قسم محدَّد (مثل الصفحة الرئيسية) — متاح لأي حساب ويب مفعّل
}
