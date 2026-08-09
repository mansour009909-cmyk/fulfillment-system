import { PortalSidebar } from "./PortalSidebar";
import { PortalTopbar } from "./PortalTopbar";

// نفس هيكل AppLayout بالضبط (Sidebar + Topbar + main) — بس بتبويبات محدودة خاصة بالبوابة
// وقراءة فقط (عدا صفحة الإعدادات لتغيير كلمة السر الخاصة)
export function PortalLayout({ name, roleLabel, tabs, logoutUrl, loginUrl, children }) {
  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50">
      <PortalSidebar tabs={tabs} logoutUrl={logoutUrl} loginUrl={loginUrl} />
      <div className="flex-1 flex flex-col min-w-0">
        <PortalTopbar name={name} roleLabel={roleLabel} />
        <main className="flex-1 p-6 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
