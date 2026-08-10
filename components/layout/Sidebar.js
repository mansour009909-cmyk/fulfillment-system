import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Home,
  Users,
  Package,
  LayoutGrid,
  BookOpen,
  ClipboardList,
  Truck,
  PackageCheck,
  FileText,
  Plug,
  Settings,
  ChevronDown,
  Box,
  BarChart3,
  UserCog,
  MessageCircle,
} from "lucide-react";

const NAV = [
  { label: "الرئيسية", href: "/", icon: Home },
  {
    label: "المخزون",
    icon: Package,
    children: [
      { label: "الرفوف", href: "/shelves", icon: LayoutGrid },
      { label: "الكتب", href: "/books", icon: BookOpen },
    ],
  },
  { label: "الطلبات", href: "/orders", icon: ClipboardList },
  { label: "العملاء", href: "/clients", icon: Users },
  {
    label: "الموردون",
    icon: Truck,
    children: [
      { label: "قائمة الموردين", href: "/suppliers", icon: Truck },
      { label: "استلام شحنة", href: "/receiving", icon: PackageCheck },
      { label: "الطلبيات الآلية", href: "/supplier-orders", icon: ClipboardList },
    ],
  },
  { label: "الفواتير والرسوم", href: "/invoices", icon: FileText },
  { label: "الموظفون", href: "/employees", icon: UserCog },
  { label: "التقارير", href: "/reports", icon: BarChart3 },
  { label: "API", href: "/integrations", icon: Plug },
  { label: "الإعدادات", href: "/settings", icon: Settings },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
        active ? "bg-blue-600 text-white font-medium" : "text-gray-300 hover:bg-sidebar-hover"
      }`}
    >
      <Icon size={18} strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const router = useRouter();
  const groupActiveMap = Object.fromEntries(
    NAV.filter((item) => item.children).map((item) => [
      item.label,
      item.children.some((c) => isActive(router.pathname, c.href)),
    ])
  );
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(NAV.filter((item) => item.children).map((item) => [item.label, true]))
  );

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-white flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
          <Box size={20} />
        </div>
        <span className="font-bold text-lg">نظام الفولفيلمنت</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          if (item.children) {
            const isOpen = openGroups[item.label];
            const groupActive = groupActiveMap[item.label];
            return (
              <div key={item.label}>
                <button
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !prev[item.label] }))}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    groupActive ? "text-white font-medium" : "text-gray-300 hover:bg-sidebar-hover"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <item.icon size={18} strokeWidth={1.75} />
                    {item.label}
                  </span>
                  <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="mt-1 mr-2 space-y-1 border-r border-sidebar-hover pr-2">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.href}
                        item={child}
                        active={isActive(router.pathname, child.href)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return <NavLink key={item.href} item={item} active={isActive(router.pathname, item.href)} />;
        })}
      </nav>

      <div className="px-3 pb-6 pt-3 border-t border-sidebar-hover">
        <NavLink
          item={{ href: "/chat", label: "محادثات الدعم", icon: MessageCircle }}
          active={isActive(router.pathname, "/chat")}
        />
      </div>
    </aside>
  );
}
