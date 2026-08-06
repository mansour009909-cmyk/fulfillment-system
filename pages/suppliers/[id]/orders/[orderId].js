import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, FileText, AlertTriangle, Truck, Package, CheckCircle, Download } from "lucide-react";
import { prisma } from "../../../../lib/prisma";
import { getSettings } from "../../../../lib/settings";
import { Card } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";

const STATUS_LABELS = { PROPOSED: "مقترح", ORDERED: "تم الطلب", SHIPPED: "تم الشحن", ARRIVED: "تم الوصول" };
const STEPS = ["PROPOSED", "ORDERED", "SHIPPED", "ARRIVED"];

export async function getServerSideProps({ params }) {
  const order = await prisma.supplierOrder.findUnique({
    where: { id: Number(params.orderId) },
    include: { supplier: true, items: { include: { book: true } } },
  });
  if (!order) return { notFound: true };
  if (order.supplierId !== Number(params.id)) return { notFound: true };

  const settings = await getSettings();
  const delayDays = { DOMESTIC: settings.delayDaysDomestic, INTERNATIONAL: settings.delayDaysInternational };
  const isDelayed =
    ["ORDERED", "SHIPPED"].includes(order.status) &&
    order.orderedAt &&
    Date.now() - new Date(order.orderedAt).getTime() > delayDays[order.supplier.location] * 24 * 60 * 60 * 1000;

  return {
    props: {
      minOrderQtyTotal: settings.minOrderQtyTotal,
      order: {
        id: order.id,
        status: order.status,
        supplierId: order.supplierId,
        supplierName: order.supplier.name,
        purchaseInvoiceId: order.purchaseInvoiceId,
        createdAt: order.createdAt.toISOString(),
        orderedAt: order.orderedAt ? order.orderedAt.toISOString() : null,
        shippedAt: order.shippedAt ? order.shippedAt.toISOString() : null,
        arrivedAt: order.arrivedAt ? order.arrivedAt.toISOString() : null,
        isDelayed,
        items: order.items.map((i) => ({
          bookId: i.bookId,
          title: i.book.title,
          barcode: i.book.barcode,
          soldInPeriod: i.soldInPeriod,
          quantityProposed: i.quantityProposed,
          quantityFinal: i.quantityFinal,
          included: i.included,
        })),
      },
    },
  };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

export default function SupplierOrderDetail({ order, minOrderQtyTotal }) {
  const router = useRouter();
  const [items, setItems] = useState(order.items);
  const [prices, setPrices] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isProposed = order.status === "PROPOSED";
  const isShipped = order.status === "SHIPPED";
  const isArrived = order.status === "ARRIVED";
  const includedItems = items.filter((i) => i.included);
  const totalQty = includedItems.reduce((sum, i) => sum + Number(i.quantityFinal || 0), 0);
  const stepIndex = STEPS.indexOf(order.status);

  function updateItem(bookId, patch) {
    setItems((prev) => prev.map((i) => (i.bookId === bookId ? { ...i, ...patch } : i)));
  }

  async function confirmOrder() {
    setError(null);
    setSaving(true);

    const saveRes = await fetch(`/api/suppliers/orders/${order.id}/update-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ bookId: i.bookId, quantityFinal: i.quantityFinal, included: i.included })),
      }),
    });
    if (!saveRes.ok) {
      setSaving(false);
      setError((await saveRes.json()).error || "حدث خطأ بحفظ البنود");
      return;
    }

    const res = await fetch(`/api/suppliers/orders/${order.id}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "ORDERED" }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json()).error || "حدث خطأ");
      return;
    }
    router.replace(router.asPath);
  }

  async function advance(toStatus, extra = {}) {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/suppliers/orders/${order.id}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, ...extra }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    if (data.purchaseInvoiceId) {
      router.push(`/suppliers/${order.supplierId}/invoices/${data.purchaseInvoiceId}/edit`);
    } else {
      router.replace(router.asPath);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/suppliers/${order.supplierId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 mb-4"
      >
        <ArrowRight size={14} />
        رجوع لـ{order.supplierName}
      </Link>

      {order.isDelayed && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          <AlertTriangle size={16} />
          <span>متأخرة — تجاوزت المدة المعتادة لوصول طلبيات هذا المورد.</span>
        </div>
      )}

      <Card className="p-8 mb-6">
        <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">طلبية مورد #{order.id}</h1>
              <div className="text-xs text-gray-400 mt-0.5">{order.supplierName}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isProposed && (
              <a
                href={`/api/suppliers/orders/${order.id}/export`}
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50"
              >
                <Download size={14} />
                تصدير Excel
              </a>
            )}
            <Badge variant={isArrived ? "success" : "neutral"}>{STATUS_LABELS[order.status]}</Badge>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-8">
          {STEPS.map((step, idx) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    idx < stepIndex
                      ? "bg-green-500 text-white"
                      : idx === stepIndex
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {idx < stepIndex ? <CheckCircle size={16} /> : idx + 1}
                </div>
                <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">{STATUS_LABELS[step]}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${idx < stepIndex ? "bg-green-500" : "bg-gray-100"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                {isProposed && <th className="px-4 py-3 text-center border-b border-gray-200">إدراج</th>}
                <th className="px-4 py-3 text-right border-b border-gray-200">البند</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">مباع بالفترة</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">الكمية المقترحة</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">الكمية النهائية</th>
                {isShipped && <th className="px-4 py-3 text-center border-b border-gray-200">سعر الوحدة</th>}
              </tr>
            </thead>
            <tbody>
              {(isProposed ? items : includedItems).map((item, idx) => (
                <tr key={item.bookId} className={idx % 2 === 1 ? "bg-gray-50/60" : ""}>
                  {isProposed && (
                    <td className="px-4 py-3 text-center border-b border-gray-100">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={(e) => updateItem(item.bookId, { included: e.target.checked })}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">{item.title}</div>
                      {isProposed && item.included && item.soldInPeriod === 0 && (
                        <Badge variant="warning">راكد</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{item.barcode}</div>
                  </td>
                  <td className="px-4 py-3 text-center border-b border-gray-100 text-gray-700">
                    {item.soldInPeriod}
                  </td>
                  <td className="px-4 py-3 text-center border-b border-gray-100 text-gray-700">
                    {item.quantityProposed}
                  </td>
                  <td className="px-4 py-3 text-center border-b border-gray-100">
                    {isProposed ? (
                      <input
                        type="number"
                        min="0"
                        value={item.quantityFinal}
                        onChange={(e) => updateItem(item.bookId, { quantityFinal: Number(e.target.value) })}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                      />
                    ) : (
                      item.quantityFinal
                    )}
                  </td>
                  {isShipped && (
                    <td className="px-4 py-3 text-center border-b border-gray-100">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="السعر"
                        value={prices[item.bookId] ?? ""}
                        onChange={(e) => setPrices((prev) => ({ ...prev, [item.bookId]: e.target.value }))}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4 text-sm">
          <span className="text-gray-500">إجمالي الكمية المُدرَجة: {totalQty}</span>
          {totalQty < minOrderQtyTotal && (
            <span className="text-amber-700 bg-amber-50 rounded-lg px-3 py-1">
              أقل من الحد المعتاد ({minOrderQtyTotal}) — القرار يرجع لك
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-100 text-sm">
          <div>
            <div className="text-gray-400 mb-1">تاريخ الاقتراح</div>
            <div className="font-medium text-gray-900">{formatDate(order.createdAt)}</div>
          </div>
          <div className="text-left">
            {order.orderedAt && (
              <>
                <div className="text-gray-400 mb-1">تاريخ الطلب</div>
                <div className="font-medium text-gray-900">{formatDate(order.orderedAt)}</div>
              </>
            )}
            {order.shippedAt && (
              <>
                <div className="text-gray-400 mb-1 mt-2">تاريخ الشحن</div>
                <div className="font-medium text-gray-900">{formatDate(order.shippedAt)}</div>
              </>
            )}
            {order.arrivedAt && (
              <>
                <div className="text-gray-400 mb-1 mt-2">تاريخ الوصول</div>
                <div className="font-medium text-gray-900">{formatDate(order.arrivedAt)}</div>
              </>
            )}
          </div>
        </div>
      </Card>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {isProposed && (
        <button
          onClick={confirmOrder}
          disabled={saving || includedItems.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Package size={16} />
          {saving ? "جاري الحفظ..." : "تأكيد الطلب"}
        </button>
      )}
      {order.status === "ORDERED" && (
        <button
          onClick={() => advance("SHIPPED")}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Truck size={16} />
          {saving ? "جاري الحفظ..." : "تأكيد الشحن"}
        </button>
      )}
      {isShipped && (
        <button
          onClick={() => advance("ARRIVED", { prices })}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <CheckCircle size={16} />
          {saving ? "جاري الحفظ..." : "تأكيد الوصول وإنشاء فاتورة الشراء"}
        </button>
      )}
      {isArrived && order.purchaseInvoiceId && (
        <Link
          href={`/suppliers/${order.supplierId}/invoices/${order.purchaseInvoiceId}/edit`}
          className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white rounded-lg py-2.5 font-medium hover:bg-gray-900"
        >
          فتح فاتورة الشراء الناتجة
        </Link>
      )}
    </div>
  );
}
