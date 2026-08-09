import { Bell } from "lucide-react";

export function PortalTopbar({ name, roleLabel }) {
  const initial = (name || "؟").trim()[0];

  return (
    <header className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="text-sm text-gray-600">{roleLabel}</div>

      <div className="flex items-center gap-5">
        <button className="text-gray-400 hover:text-gray-600">
          <Bell size={20} strokeWidth={1.75} />
        </button>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-800">{name}</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
