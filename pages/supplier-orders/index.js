import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { getSettings } from "../../lib/settings";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

const STATUS_LABEL = { PROPOSED: "مقترح", ORDERED: "تم الطلب", SHIPPED: "تم الشحن", ARRIVED: "تم الوصول" };
const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 دقائق

export async function getServerSideProps() {
  const [orders, settings] = await Promise.all([
    prisma.supplierOrder.findMany({ include: { supplier: true, items: true } }),
    getSettings(),
  ]);
  const delayDays = { DOMESTIC: settings.delayDaysDomestic, INTERNATIONAL: settings.delayDaysInternational };

  const data = orders.map((o) => {
    const includedItems = o.items.filter((i) => i.included);
    const isDelayed =
      ["ORDERED", "SHIPPED"].includes(o.status) &&
      o.orderedAt &&
      Date.now() - new Date(o.orderedAt).getTime() > delayDays[o.supplier.location] * 24 * 60 * 60 * 1000;

    return {
      id: o.id,
      supplierId: o.supplierId,
      supplierName: o.supplier.name,
      status: o.status,
      itemCount: includedItems.length,
      totalQty: includedItems.reduce((sum, i) => sum + i.quantityFinal, 0),
      createdAt: o.createdAt.toISOString(),
      isDelayed,
    };
  });

  // الطلبيات النشطة (لسا ما وصلت) أولًا — الأقدم فالأحدث (تحتاج متابعة) — ثم الواصلة بالأسفل
  data.sort((a, b) => {
    if ((a.status === "ARRIVED") !== (b.status === "ARRIVED")) {
      return a.status === "ARRIVED" ? 1 : -1;
    }
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  return { props: { orders: data } };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

export default function SupplierOrdersIndex({ orders }) {
  const router = useRouter();
  const timerRef = useRef(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    timerRef.current = setInterval(() => {
      router.replace(router.asPath, undefined, { scroll: false });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [router]);

  const activeCount = orders.filter((o) => o.status !== "ARRIVED").length;
  const filteredOrders = useMemo(() => {
    const q = query.trim();
    if (!q) return orders;
    return orders.filter((o) => o.supplierName.includes(q) || String(o.id).includes(q));
  }, [orders, query]);

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">طلبات الموردين الآلية</h1>
          <p className="text-gray-500">كل الطلبيات المقترحة والجارية عبر كل الموردين ({activeCount} نشطة)</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <RefreshCw size={12} />
          تتحدّث تلقائيًا كل 10 دقائق
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم المورد أو رقم الطلبية..."
          className="w-full border border-gray-200 rounded-lg pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card className="overflow-hidden">
        {filteredOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 text-right">الطلبية</th>
                  <th className="px-4 py-3 text-right">المورد</th>
                  <th className="px-4 py-3 text-right">التاريخ</th>
                  <th className="px-4 py-3 text-center">عدد الأصناف</th>
                  <th className="px-4 py-3 text-center">الكمية</th>
                  <th className="px-4 py-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/suppliers/${o.supplierId}/orders/${o.id}`} className="font-medium text-blue-600">
                        طلبية #{o.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{o.supplierName}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{o.itemCount}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{o.totalQty}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {o.isDelayed && <Badge variant="danger">متأخرة</Badge>}
                        <Badge variant={o.status === "ARRIVED" ? "success" : "neutral"}>
                          {STATUS_LABEL[o.status]}
                        </Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            {query ? "لا نتائج مطابقة." : "لا توجد طلبيات موردين بعد."}
          </div>
        )}
      </Card>
    </div>
  );
}
