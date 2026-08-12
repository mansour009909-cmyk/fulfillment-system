import { useRouter } from "next/router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// صفحات بدون غلاف الشريط الجانبي/العلوي: تسجيل الدخول، بوابتا العميل/المورد الخارجيتان، وصفحة رفض الصلاحية
const BARE_PREFIXES = ["/login", "/portal/", "/no-access"];

export function AppLayout({ children }) {
  const router = useRouter();
  const isBare = BARE_PREFIXES.some((p) => router.pathname === p || router.pathname.startsWith(p));

  if (isBare) {
    return <div dir="rtl">{children}</div>;
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
