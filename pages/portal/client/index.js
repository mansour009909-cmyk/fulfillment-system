import { ClipboardList, AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { KpiCard } from "../../../components/ui/KpiCard";
import { Badge } from "../../../components/ui/Badge";
import { PortalNav } from "../../../components/portal/PortalNav";

const TABS = [
  { href: "/portal/client", label: "الرئيسية" },
  { href: "/portal/client/orders", label: "الطلبات" },
  { href: "/portal/client/inventory", label: "المخزون" },
  { href: "/portal/client/invoices", label: "الفواتير" },
  { href: "/portal/client/settings", label: "الإعدادات" },
];

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  const client = await prisma.client.findUnique({ where: { id: session.id } });
  if (!client) return { notFound: true };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ordersThisMonth, pendingCount, inReviewCount, fulfilledCount, unpaidAgg, privateStockAgg, recentOrders] =
    await Promise.all([
      prisma.order.count({ where: { clientId: client.id, createdAt: { gte: monthStart } } }),
      prisma.order.count({ where: { clientId: client.id, status: "PENDING_REVIEW" } }),
      prisma.order.count({ where: { clientId: client.id, status: "IN_REVIEW" } }),
      prisma.order.count({ where: { clientId: client.id, status: "FULFILLED" } }),
      prisma.clientInvoice.aggregate({ where: { clientId: client.id, status: "UNPAID" }, _sum: { total: true } }),
      prisma.shelfStock.aggregate({
        where: { ownership: "PRIVATE", clientId: client.id },
        _sum: { quantity: true },
      }),
      prisma.order.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: true },
      }),
    ]);

  return {
    props: {
      clientName: client.name,
      stats: {
        ordersThisMonth,
        pendingCount,
        inReviewCount,
        fulfilledCount,
        unpaidTotal: unpaidAgg._sum.total || 0,
        privateStockQty: privateStockAgg._sum.quantity || 0,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        itemCount: o.items.length,
        createdAt: o.createdAt.toISOString(),
      })),
    },
  };
}

const STATUS_LABEL = {
  PENDING_REVIEW: { label: "بانتظار المراجعة", variant: "info" },
  IN_REVIEW: { label: "قيد التنفيذ", variant: "warning" },
  FULFILLED: { label: "تم التنفيذ", variant: "success" },
};

export default function ClientPortalHome({ clientName, stats, recentOrders }) {
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <PortalNav name={clientName} tabs={TABS} />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KpiCard icon={ClipboardList} label="طلبات هذا الشهر" value={stats.ordersThisMonth} color="blue" />
          <KpiCard icon={AlertTriangle} label="قيد التنفيذ" value={stats.inReviewCount} color="amber" />
          <KpiCard icon={CheckCircle2} label="طلبات مكتملة" value={stats.fulfilledCount} color="green" />
          <KpiCard icon={ClipboardList} label="بانتظار المراجعة" value={stats.pendingCount} color="purple" />
          <KpiCard icon={Wallet} label="فواتير غير مدفوعة" value={`${stats.unpaidTotal.toFixed(2)} ر.س`} color="amber" />
          <KpiCard icon={ClipboardList} label="مخزوني الخاص" value={`${stats.privateStockQty} نسخة`} color="blue" />
        </div>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">آخر الطلبات</h2>
          <div className="divide-y divide-gray-100">
            {recentOrders.map((o) => {
              const st = STATUS_LABEL[o.status];
              return (
                <div key={o.id} className="py-3 flex justify-between items-center text-sm">
                  <div className="text-gray-900">#{o.orderNumber}</div>
                  <div className="flex items-center gap-4 text-gray-500">
                    <span>{o.itemCount} بند</span>
                    <span>{new Date(o.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </div>
              );
            })}
            {recentOrders.length === 0 && <div className="py-6 text-center text-gray-400 text-sm">لا توجد طلبات بعد.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
