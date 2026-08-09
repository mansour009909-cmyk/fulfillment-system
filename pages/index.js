import Link from "next/link";
import { LayoutGrid, BookOpen, Package, ScanLine, ClipboardList, AlertTriangle, Users, Store } from "lucide-react";
import { prisma } from "../lib/prisma";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";

export async function getServerSideProps() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [shelfCount, bookCount, quantityAgg, recentScans, ordersThisMonth, inReviewCount, employees, storeOrders] =
    await Promise.all([
      prisma.shelf.count(),
      prisma.book.count(),
      prisma.shelfStock.aggregate({ _sum: { quantity: true } }),
      prisma.shelfScanLog.findMany({
        orderBy: { scannedAt: "desc" },
        take: 5,
        include: { shelf: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.count({ where: { status: "IN_REVIEW" } }),
      prisma.employee.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              fulfilledOrders: { where: { status: "FULFILLED", charge: { createdAt: { gte: monthStart } } } },
              errorLogs: { where: { createdAt: { gte: monthStart } } },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.order.findMany({
        where: { status: "FULFILLED", charge: { createdAt: { gte: monthStart } } },
        select: {
          clientId: true,
          client: { select: { name: true } },
          items: { select: { quantityVerified: true, book: { select: { price: true } } } },
        },
      }),
    ]);

  const storeMap = {};
  for (const order of storeOrders) {
    const entry = (storeMap[order.clientId] ||= {
      clientName: order.client.name,
      ordersCount: 0,
      itemsSold: 0,
      estimatedSales: 0,
    });
    entry.ordersCount += 1;
    for (const item of order.items) {
      entry.itemsSold += item.quantityVerified;
      entry.estimatedSales += item.quantityVerified * (item.book.price || 0);
    }
  }
  const storeStats = Object.values(storeMap).sort((a, b) => b.ordersCount - a.ordersCount);

  return {
    props: {
      stats: {
        shelfCount,
        bookCount,
        totalCopies: quantityAgg._sum.quantity || 0,
        ordersThisMonth,
        inReviewCount,
      },
      employeePerformance: employees
        .map((e) => ({ id: e.id, name: e.name, fulfilledCount: e._count.fulfilledOrders, errorCount: e._count.errorLogs }))
        .sort((a, b) => b.fulfilledCount - a.fulfilledCount),
      recentScans: recentScans.map((s) => ({
        id: s.id,
        bookBarcode: s.bookBarcode,
        quantityDelta: s.quantityDelta,
        scannedAt: s.scannedAt.toISOString(),
        shelfName: s.shelf.name,
      })),
      storeStats,
    },
  };
}

export default function Home({ stats, employeePerformance, recentScans, storeStats }) {
  const maxFulfilled = employeePerformance[0]?.fulfilledCount || 1;
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">لوحة العمليات الرئيسية</h1>
        <p className="text-gray-500">نظرة عامة على المخزون والطلبات</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard icon={LayoutGrid} label="إجمالي الرفوف" value={stats.shelfCount} color="blue" />
        <KpiCard icon={BookOpen} label="إجمالي العناوين" value={stats.bookCount} color="purple" />
        <KpiCard icon={Package} label="إجمالي النسخ بالمخزون" value={stats.totalCopies} color="green" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <KpiCard icon={ClipboardList} label="طلبات هذا الشهر" value={stats.ordersThisMonth} color="blue" />
        <KpiCard icon={AlertTriangle} label="طلبات قيد التنفيذ (نقص مخزون)" value={stats.inReviewCount} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">آخر عمليات المسح</h2>
            <Link href="/shelves" className="text-sm text-blue-600">
              عرض كل الرفوف
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {recentScans.map((scan) => (
              <div key={scan.id} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <ScanLine size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-800">
                    مسح باركود <span className="font-medium">{scan.bookBarcode}</span> على{" "}
                    {scan.shelfName} (+{scan.quantityDelta})
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(scan.scannedAt).toLocaleString("ar-SA-u-nu-latn")}
                  </div>
                </div>
              </div>
            ))}

            {recentScans.length === 0 && (
              <div className="py-6 text-center text-gray-400 text-sm">لا توجد عمليات مسح بعد.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">أداء الموظفين (هذا الشهر)</h2>
          </div>
          {employeePerformance.length > 0 ? (
            <div className="space-y-3">
              {employeePerformance.map((e) => (
                <div key={e.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-800">{e.name}</span>
                    <span className="text-gray-500">
                      {e.fulfilledCount} طلب
                      {e.errorCount > 0 && <span className="text-amber-600"> · {e.errorCount} خطأ</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full"
                      style={{ width: `${Math.max(4, (e.fulfilledCount / maxFulfilled) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm py-6">لا يوجد موظفون نشطون بعد.</div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">إحصائيات المتاجر (هذا الشهر)</h2>
          </div>
          <Link href="/clients" className="text-sm text-blue-600">
            عرض كل العملاء
          </Link>
        </div>
        {storeStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-right font-medium py-2">المتجر</th>
                  <th className="text-right font-medium py-2">الطلبات المكتملة</th>
                  <th className="text-right font-medium py-2">القطع المباعة</th>
                  <th className="text-right font-medium py-2">إجمالي المبيعات (تقديري)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {storeStats.map((s) => (
                  <tr key={s.clientName}>
                    <td className="py-2.5 text-gray-900 font-medium">{s.clientName}</td>
                    <td className="py-2.5 text-gray-600">{s.ordersCount}</td>
                    <td className="py-2.5 text-gray-600">{s.itemsSold}</td>
                    <td className="py-2.5 text-gray-600">{s.estimatedSales.toFixed(2)} ر.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">
              المبيعات تقديرية بناءً على سعر البيع المسجَّل لكل كتاب — قد يختلف عن السعر الفعلي وقت البيع.
            </p>
          </div>
        ) : (
          <div className="text-center text-gray-400 text-sm py-6">لا توجد طلبات مكتملة لأي متجر هذا الشهر بعد.</div>
        )}
      </Card>
    </div>
  );
}
