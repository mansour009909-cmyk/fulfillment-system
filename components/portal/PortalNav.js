import Link from "next/link";
import { useRouter } from "next/router";
import { Box, LogOut } from "lucide-react";

// شريط تنقّل مشترك لبوابتي العميل والمورد — نفس الشكل، تبويبات مختلفة حسب الدور
export function PortalNav({ name, tabs }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace(router.pathname.startsWith("/portal/supplier") ? "/portal/supplier/login" : "/portal/client/login");
  }

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box size={20} className="text-blue-600" />
          <span className="font-bold text-gray-900">{name}</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <LogOut size={14} />
          تسجيل الخروج
        </button>
      </div>
      <div className="max-w-4xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = router.pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
                active ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
