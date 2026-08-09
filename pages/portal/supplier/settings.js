import { useState } from "react";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { PortalNav } from "../../../components/portal/PortalNav";

const TABS = [
  { href: "/portal/supplier", label: "الرئيسية" },
  { href: "/portal/supplier/orders", label: "الطلبيات" },
  { href: "/portal/supplier/inventory", label: "المخزون" },
  { href: "/portal/supplier/invoices", label: "الفواتير والمستحقات" },
  { href: "/portal/supplier/settings", label: "الإعدادات" },
];

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  const supplier = await prisma.supplier.findUnique({ where: { id: session.id } });
  if (!supplier) return { notFound: true };

  return { props: { supplierName: supplier.name, email: supplier.email } };
}

export default function SupplierSettings({ supplierName, email }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    const res = await fetch("/api/portal/supplier/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSaved(true);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <PortalNav name={supplierName} tabs={TABS} />

      <div className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">الإعدادات</h1>
        <Card className="p-5">
          <div className="mb-4 text-sm text-gray-500">البريد الإلكتروني: {email}</div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">كلمة السر الحالية</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">كلمة السر الجديدة</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {saved && <p className="text-green-600 text-sm">تم تغيير كلمة السر بنجاح.</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "تغيير كلمة السر"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
