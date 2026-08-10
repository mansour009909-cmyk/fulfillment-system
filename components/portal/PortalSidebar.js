import Link from "next/link";
import { useRouter } from "next/router";
import { Box, LogOut } from "lucide-react";

function TabLink({ tab, active }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
        active ? "bg-blue-600 text-white font-medium" : "text-gray-300 hover:bg-sidebar-hover"
      }`}
    >
      <Icon size={18} strokeWidth={1.75} />
      {tab.label}
    </Link>
  );
}

export function PortalSidebar({ tabs, logoutUrl, loginUrl }) {
  const router = useRouter();
  const mainTabs = tabs.filter((t) => !t.footer);
  const footerTab = tabs.find((t) => t.footer);

  async function handleLogout() {
    await fetch(logoutUrl, { method: "POST" });
    router.replace(loginUrl);
  }

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-white flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
          <Box size={20} />
        </div>
        <span className="font-bold text-lg">نظام الفولفيلمنت</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {mainTabs.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={router.pathname === tab.href} />
        ))}
      </nav>

      <div className="px-3 pb-6 pt-3 border-t border-sidebar-hover space-y-1">
        {footerTab && <TabLink tab={footerTab} active={router.pathname === footerTab.href} />}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-sidebar-hover"
        >
          <LogOut size={18} strokeWidth={1.75} />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
