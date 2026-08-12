import { useEffect, useRef, useState } from "react";
import { Bell, MapPin, ChevronDown, LogOut, UserCog } from "lucide-react";

const LEVEL_LABEL = {
  MANAGER: "مدير العمليات",
  EMPLOYEE: "موظف",
};

export function Topbar() {
  const [warehouseName, setWarehouseName] = useState("المستودع الرئيسي");
  const [me, setMe] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.warehouseName) setWarehouseName(data.warehouseName);
      })
      .catch(() => {});

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const displayName = me?.username || "مستخدم النظام";
  const roleLabel = LEVEL_LABEL[me?.level] || "مدير العمليات";
  const initial = displayName.trim().charAt(0) || "م";

  return (
    <header className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <MapPin size={16} />
        {warehouseName}
      </div>

      <div className="flex items-center gap-5">
        <button className="text-gray-400 hover:text-gray-600">
          <Bell size={20} strokeWidth={1.75} />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-50"
          >
            <div className="text-right">
              <div className="text-sm font-medium text-gray-800">{displayName}</div>
              <div className="text-xs text-gray-400">{roleLabel}</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
              {initial}
            </div>
            <ChevronDown size={16} className="text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute left-0 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-right"
              >
                <UserCog size={16} />
                تبديل الحساب
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-right"
              >
                <LogOut size={16} />
                تسجيل الخروج
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
