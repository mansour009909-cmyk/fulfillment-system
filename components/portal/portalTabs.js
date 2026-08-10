import { Home, ClipboardList, Package, FileText, Settings, MessageCircle } from "lucide-react";

export const CLIENT_TABS = [
  { href: "/portal/client", label: "الرئيسية", icon: Home },
  { href: "/portal/client/orders", label: "الطلبات", icon: ClipboardList },
  { href: "/portal/client/inventory", label: "المخزون", icon: Package },
  { href: "/portal/client/invoices", label: "الفواتير", icon: FileText },
  { href: "/portal/client/settings", label: "الإعدادات", icon: Settings },
  { href: "/portal/client/support", label: "الدعم", icon: MessageCircle, footer: true },
];

// بوابة المورد مخصَّصة لمورد التخزين (يخزن مخزونه عندنا — تخزين بحت أو بغرض البيع)،
// مو مورد شراء عادي — فما فيها طلبيات آلية ولا فواتير شراء ولا رصيد مستحق له
export const SUPPLIER_TABS = [
  { href: "/portal/supplier", label: "الرئيسية", icon: Home },
  { href: "/portal/supplier/inventory", label: "المخزون", icon: Package },
  { href: "/portal/supplier/invoices", label: "الفواتير والمستحقات", icon: FileText },
  { href: "/portal/supplier/settings", label: "الإعدادات", icon: Settings },
  { href: "/portal/supplier/support", label: "الدعم", icon: MessageCircle, footer: true },
];
