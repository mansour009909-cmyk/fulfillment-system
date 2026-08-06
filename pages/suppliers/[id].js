import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, Plus, Pencil, Eye, Package, Sparkles, Zap, KeyRound } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { getFastSellingAlerts } from "../../lib/supplierAlerts";

export async function getServerSideProps({ params }) {
  const supplierId = Number(params.id);
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: {
      invoices: { include: { items: true }, orderBy: { createdAt: "desc" } },
      storageUnits: { orderBy: { createdAt: "desc" } },
      _count: { select: { books: true } },
    },
  });
  if (!supplier) return { notFound: true };

  const supplierStock = await prisma.shelfStock.findMany({
    where: { ownership: "SUPPLIER", supplierId, quantity: { gt: 0 } },
    include: { book: true, shelf: true },
    orderBy: { updatedAt: "desc" },
  });

  const fastSellingAlerts = await getFastSellingAlerts(supplierId);

  return {
    props: {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        balance: supplier.balance,
        importance: supplier.importance,
        location: supplier.location,
        email: supplier.email,
        hasPortalAccess: Boolean(supplier.passwordHash),
        invoices: supplier.invoices.map((inv) => ({
          id: inv.id,
          status: inv.status,
          type: inv.type,
          itemCount: inv.items.length,
          total: inv.items.reduce((sum, i) => sum + i.quantityExpected * i.price, 0),
          createdAt: inv.createdAt.toISOString(),
        })),
        storageUnits: supplier.storageUnits.map((u) => ({
          id: u.id,
          label: u.label,
          feePerPeriod: u.feePerPeriod,
          active: u.active,
          notes: u.notes,
        })),
        stock: supplierStock.map((s) => ({
          id: s.id,
          bookTitle: s.book.title,
          barcode: s.book.barcode,
          shelfName: s.shelf.name,
          quantity: s.quantity,
        })),
        catalogBookCount: supplier._count.books,
        fastSellingAlerts,
      },
    },
  };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

function StorageUnitForm({ supplierId }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [feePerPeriod, setFeePerPeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/suppliers/${supplierId}/storage-units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, feePerPeriod, notes }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }

    setLabel("");
    setFeePerPeriod("");
    setNotes("");
    router.replace(router.asPath);
  }

  return (
    <form onSubmit={submit} className="p-4 flex flex-wrap items-end gap-2 border-t border-gray-100 bg-gray-50/50">
      <div>
        <label className="block text-xs text-gray-500 mb-1">وصف الوحدة</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="مثال: كرتون تخزين رقم 1"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">رسوم دورية (ر.س)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={feePerPeriod}
          onChange={(e) => setFeePerPeriod(e.target.value)}
          className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          required
        />
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs text-gray-500 mb-1">ملاحظات (اختياري)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-900 disabled:opacity-50"
      >
        <Plus size={14} />
        إضافة وحدة
      </button>
      {error && <p className="text-red-600 text-sm w-full">{error}</p>}
    </form>
  );
}

function ProposeOrderButton({ supplierId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function propose() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/suppliers/${supplierId}/orders/propose`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    router.push(`/suppliers/${supplierId}/orders/${data.id}`);
  }

  return (
    <div>
      <button
        onClick={propose}
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-900 disabled:opacity-50"
      >
        <Sparkles size={14} />
        {loading ? "جاري الحساب..." : "اقتراح طلبية جديدة"}
      </button>
      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
    </div>
  );
}

function SupplierPortalForm({ supplierId, currentEmail }) {
  const router = useRouter();
  const [email, setEmail] = useState(currentEmail || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/suppliers/${supplierId}/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setPassword("");
    router.replace(router.asPath);
  }

  return (
    <form onSubmit={submit} className="p-4 flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">بريد بوابة المورد</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">كلمة سر جديدة</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          required
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-900 disabled:opacity-50"
      >
        <KeyRound size={14} />
        حفظ بيانات الدخول
      </button>
      {error && <p className="text-red-600 text-sm w-full">{error}</p>}
    </form>
  );
}

export default function SupplierDetail({ supplier }) {
  return (
    <div className="max-w-2xl">
      <Link href="/suppliers" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للموردين
      </Link>

      {supplier.fastSellingAlerts.length > 0 && (
        <Card className="p-4 mb-4 border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm mb-2">
            <Zap size={16} />
            تنبيه كتب سريعة البيع — مخزونها الحالي وصل نصف ما بيع بفترة الحساب أو أقل
          </div>
          <div className="space-y-1">
            {supplier.fastSellingAlerts.map((a) => (
              <div key={a.bookId} className="flex justify-between text-sm text-amber-900">
                <span>{a.title} <span className="text-amber-600 text-xs">({a.barcode})</span></span>
                <span>متوفر {a.currentStock} — بيع {a.soldInPeriod} بالفترة</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
            <Badge variant={supplier.importance === "IMPORTANT" ? "warning" : "neutral"}>
              {supplier.importance === "IMPORTANT" ? "مهم" : "عادي"}
            </Badge>
            <Badge variant="info">{supplier.location === "INTERNATIONAL" ? "خارجي" : "داخلي"}</Badge>
          </div>
          <p className="text-gray-500">
            الرصيد المستحق: {supplier.balance.toFixed(2)} ر.س — كتالوج: {supplier.catalogBookCount} كتاب
          </p>
          <Link
            href={`/suppliers/${supplier.id}/edit`}
            className="inline-flex items-center gap-1 text-sm text-blue-600 mt-1"
          >
            <Pencil size={12} />
            تعديل بيانات المورد
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ProposeOrderButton supplierId={supplier.id} />
          <Link
            href={`/suppliers/${supplier.id}/invoices/new`}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} />
            فاتورة شراء جديدة
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-gray-900">فواتير الشراء</h2>
        <Link href={`/supplier-orders`} className="text-sm text-blue-600 hover:text-blue-800">
          متابعة كل الطلبيات الآلية ←
        </Link>
      </div>
      <Card className="overflow-hidden mb-6">
        {supplier.invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 text-right">الفاتورة</th>
                  <th className="px-4 py-3 text-right">التاريخ</th>
                  <th className="px-4 py-3 text-center">النوع</th>
                  <th className="px-4 py-3 text-center">عدد البنود</th>
                  <th className="px-4 py-3 text-center">الإجمالي</th>
                  <th className="px-4 py-3 text-center">الحالة</th>
                  <th className="px-4 py-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplier.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">فاتورة #{inv.id}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={inv.type === "CONSIGNMENT" ? "info" : "neutral"}>
                        {inv.type === "CONSIGNMENT" ? "تخزين بيع" : "شراء"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{inv.itemCount}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{inv.total.toFixed(2)} ر.س</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={inv.status === "APPROVED" ? "success" : "neutral"}>
                        {inv.status === "APPROVED" ? "معتمدة" : "مسودة"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-3">
                        <Link
                          href={`/receiving/reconcile/${inv.id}`}
                          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                          title="عرض"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link
                          href={`/suppliers/${supplier.id}/invoices/${inv.id}/edit`}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          title="تعديل"
                        >
                          <Pencil size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">لا توجد فواتير بعد لهذا المورد.</div>
        )}
      </Card>

      <h2 className="font-medium text-gray-900 mb-2">رسوم التخزين</h2>
      <Card className="overflow-hidden mb-6">
        {supplier.storageUnits.length > 0 && (
          <div className="divide-y divide-gray-100">
            {supplier.storageUnits.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{u.label}</div>
                  {u.notes && <div className="text-xs text-gray-400">{u.notes}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={u.active ? "success" : "neutral"}>{u.active ? "فعّالة" : "متوقفة"}</Badge>
                  <span className="text-sm text-gray-600">{u.feePerPeriod.toFixed(2)} ر.س / دوري</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {supplier.storageUnits.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-sm">لا توجد وحدات تخزين مسجَّلة لهذا المورد.</div>
        )}
        <StorageUnitForm supplierId={supplier.id} />
      </Card>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-medium text-gray-900">بوابة المورد</h2>
        <Badge variant={supplier.hasPortalAccess ? "success" : "neutral"}>
          {supplier.hasPortalAccess ? "مفعّلة" : "غير مفعّلة"}
        </Badge>
      </div>
      <Card className="overflow-hidden mb-6">
        <SupplierPortalForm supplierId={supplier.id} currentEmail={supplier.email} />
      </Card>

      <h2 className="font-medium text-gray-900 mb-2">مخزون المورد بالمستودع</h2>
      <Card className="overflow-hidden">
        {supplier.stock.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {supplier.stock.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Package size={16} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{s.bookTitle}</div>
                    <div className="text-xs text-gray-400">{s.barcode} — {s.shelfName}</div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700">{s.quantity} نسخة</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400 text-sm">
            لا يوجد مخزون بغرض البيع (بعمولة) خاص بهذا المورد بالمستودع حاليًا.
          </div>
        )}
      </Card>
    </div>
  );
}
