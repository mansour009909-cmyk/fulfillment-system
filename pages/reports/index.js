import { TrendingUp, AlertTriangle, Wallet, Package, CheckCircle2, Users } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { getSettings } from "../../lib/settings";
import { Card } from "../../components/ui/Card";
import { KpiCard } from "../../components/ui/KpiCard";

export async function getServerSideProps() {
  const settings = await getSettings();
  const periodDays = settings.defaultSalesPeriodDays;
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [
    fulfilledCount,
    pendingCount,
    inReviewCount,
    supplierBalanceAgg,
    unpaidInvoicesAgg,
    chargesAgg,
    salesAgg,
    stockAgg,
    employees,
  ] = await Promise.all([
    prisma.order.count({ where: { status: "FULFILLED" } }),
    prisma.order.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.order.count({ where: { status: "IN_REVIEW" } }),
    prisma.supplier.aggregate({ _sum: { balance: true } }),
    prisma.clientInvoice.aggregate({ where: { status: "UNPAID" }, _sum: { total: true } }),
    prisma.orderCharge.aggregate({
      _sum: { fulfillmentFee: true, labelFee: true, shippingFee: true, packagingFee: true },
    }),
    prisma.orderItem.groupBy({
      by: ["bookId"],
      where: { order: { status: "FULFILLED", charge: { createdAt: { gte: periodStart } } } },
      _sum: { quantityVerified: true },
    }),
    prisma.shelfStock.groupBy({
      by: ["bookId"],
      where: { ownership: "SHARED" },
      _sum: { quantity: true },
    }),
    prisma.employee.findMany({
      where: { active: true },
      include: { _count: { select: { fulfilledOrders: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalRevenue =
    (chargesAgg._sum.fulfillmentFee || 0) +
    (chargesAgg._sum.labelFee || 0) +
    (chargesAgg._sum.shippingFee || 0) +
    (chargesAgg._sum.packagingFee || 0);

  // الكتب الأكثر مبيعًا بالفترة
  const topSellingRaw = [...salesAgg]
    .sort((a, b) => (b._sum.quantityVerified || 0) - (a._sum.quantityVerified || 0))
    .slice(0, 8);
  const topSellingBooks = await prisma.book.findMany({
    where: { id: { in: topSellingRaw.map((s) => s.bookId) } },
  });
  const topSelling = topSellingRaw.map((s) => {
    const book = topSellingBooks.find((b) => b.id === s.bookId);
    return { bookId: s.bookId, title: book?.title || "—", barcode: book?.barcode || "", sold: s._sum.quantityVerified || 0 };
  });
  const maxSold = topSelling[0]?.sold || 1;

  // تنبيه مخزون منخفض/سريع البيع: مخزون حالي <= نصف المباع بالفترة
  const stockByBook = Object.fromEntries(stockAgg.map((s) => [s.bookId, s._sum.quantity || 0]));
  const lowStockCandidates = salesAgg
    .map((s) => ({
      bookId: s.bookId,
      sold: s._sum.quantityVerified || 0,
      stock: stockByBook[s.bookId] || 0,
    }))
    .filter((s) => s.sold > 0 && s.stock <= s.sold / 2)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8);
  const lowStockBooks = await prisma.book.findMany({
    where: { id: { in: lowStockCandidates.map((s) => s.bookId) } },
  });
  const lowStock = lowStockCandidates.map((s) => {
    const book = lowStockBooks.find((b) => b.id === s.bookId);
    return { bookId: s.bookId, title: book?.title || "—", barcode: book?.barcode || "", sold: s.sold, stock: s.stock };
  });

  return {
    props: {
      kpis: {
        fulfilledCount,
        pendingCount,
        inReviewCount,
        supplierBalance: supplierBalanceAgg._sum.balance || 0,
        unpaidInvoices: unpaidInvoicesAgg._sum.total || 0,
        totalRevenue,
      },
      topSelling,
      maxSold,
      lowStock,
      periodDays,
      employeePerformance: employees
        .map((e) => ({ id: e.id, name: e.name, fulfilledCount: e._count.fulfilledOrders }))
        .sort((a, b) => b.fulfilledCount - a.fulfilledCount),
    },
  };
}

export default function Reports({ kpis, topSelling, maxSold, lowStock, periodDays, employeePerformance }) {
  const maxFulfilled = employeePerformance[0]?.fulfilledCount || 1;
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">التقارير</h1>
        <p className="text-gray-500">كل الأرقام من قاعدة البيانات الفعلية — لا بيانات تقديرية</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard icon={CheckCircle2} label="طلبات مكتملة (كل الوقت)" value={kpis.fulfilledCount} color="green" />
        <KpiCard icon={TrendingUp} label="إجمالي إيرادات الرسوم" value={`${kpis.totalRevenue.toFixed(2)} ر.س`} color="blue" />
        <KpiCard icon={Wallet} label="رصيد الموردين المستحق" value={`${kpis.supplierBalance.toFixed(2)} ر.س`} color="amber" />
        <KpiCard icon={Package} label="طلبات بانتظار المراجعة" value={kpis.pendingCount} color="purple" />
        <KpiCard icon={AlertTriangle} label="طلبات قيد التنفيذ (نفاد مخزون)" value={kpis.inReviewCount} color="amber" />
        <KpiCard icon={Wallet} label="فواتير عملاء غير مدفوعة" value={`${kpis.unpaidInvoices.toFixed(2)} ر.س`} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">الكتب الأكثر مبيعًا (آخر {periodDays} يوم)</h2>
          {topSelling.length > 0 ? (
            <div className="space-y-3">
              {topSelling.map((b) => (
                <div key={b.bookId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-800 truncate">{b.title}</span>
                    <span className="text-gray-500 shrink-0 mr-2">{b.sold}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${Math.max(4, (b.sold / maxSold) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm py-6">لا توجد مبيعات بهذي الفترة بعد.</div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="font-semibold text-gray-900">تنبيه مخزون منخفض (كتب سريعة البيع)</h2>
          </div>
          {lowStock.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {lowStock.map((b) => (
                <div key={b.bookId} className="py-2.5 flex justify-between items-center text-sm">
                  <div>
                    <div className="text-gray-800">{b.title}</div>
                    <div className="text-xs text-gray-400">{b.barcode}</div>
                  </div>
                  <div className="text-amber-700 text-xs bg-amber-50 rounded-lg px-2 py-1 shrink-0">
                    متوفر {b.stock} — بيع {b.sold}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm py-6">لا توجد تنبيهات مخزون حاليًا.</div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">أداء الموظفين (طلبات مكتملة عبر تطبيق الجوال)</h2>
        </div>
        {employeePerformance.length > 0 ? (
          <div className="space-y-3">
            {employeePerformance.map((e) => (
              <div key={e.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-800">{e.name}</span>
                  <span className="text-gray-500">{e.fulfilledCount}</span>
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
  );
}
