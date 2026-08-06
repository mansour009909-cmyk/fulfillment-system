import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { Card } from "../../../components/ui/Card";

export async function getServerSideProps({ params }) {
  const supplier = await prisma.supplier.findUnique({ where: { id: Number(params.id) } });
  if (!supplier) return { notFound: true };

  return {
    props: {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        importance: supplier.importance,
        location: supplier.location,
        salesPeriodDays: supplier.salesPeriodDays,
      },
    },
  };
}

export default function EditSupplier({ supplier }) {
  const router = useRouter();
  const [name, setName] = useState(supplier.name);
  const [importance, setImportance] = useState(supplier.importance);
  const [location, setLocation] = useState(supplier.location);
  const [salesPeriodDays, setSalesPeriodDays] = useState(supplier.salesPeriodDays);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/suppliers/${supplier.id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, importance, location, salesPeriodDays }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }

    router.push(`/suppliers/${supplier.id}`);
  }

  return (
    <div className="max-w-md">
      <Link
        href={`/suppliers/${supplier.id}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2"
      >
        <ArrowRight size={14} />
        رجوع لـ{supplier.name}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">تعديل بيانات المورد</h1>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المورد</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تصنيف الأهمية</label>
            <select
              value={importance}
              onChange={(e) => setImportance(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NORMAL">عادي</option>
              <option value="IMPORTANT">مهم</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الموقع الجغرافي</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DOMESTIC">داخلي (داخل السعودية)</option>
              <option value="INTERNATIONAL">خارجي</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">فترة حساب المبيعات (يوم)</label>
            <input
              type="number"
              min="1"
              value={salesPeriodDays}
              onChange={(e) => setSalesPeriodDays(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">تُستخدم لحساب "المطلوب" عند اقتراح طلبية جديدة — افتراضيًا 90 يوم (3 أشهر).</p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </form>
      </Card>
    </div>
  );
}
