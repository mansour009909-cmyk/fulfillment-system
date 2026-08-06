import { useEffect, useState } from "react";
import { Bell, MapPin } from "lucide-react";

export function Topbar() {
  const [warehouseName, setWarehouseName] = useState("المستودع الرئيسي");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.warehouseName) setWarehouseName(data.warehouseName);
      })
      .catch(() => {});
  }, []);

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
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-800">مستخدم النظام</div>
            <div className="text-xs text-gray-400">مدير العمليات</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
            م
          </div>
        </div>
      </div>
    </header>
  );
}
