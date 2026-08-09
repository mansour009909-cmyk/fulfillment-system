import { Wallet, Package, ClipboardList, Archive } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { KpiCard } from "../../../components/ui/KpiCard";
import { Badge } from "../../../components/ui/Badge";
import { PortalLayout } from "../../../components/portal/PortalLayout";
import { SUPPLIER_TABS } from "../../../components/portal/portalTabs";

const ORDER_STATUS = {
  PROPOSED: { label: "مقترحة", variant: "neutral" },
  ORDERED: { label: "تم الطلب", variant: "info" },
  SHIPPED: { label: "تم الشحن", variant: "warning" },
  ARRIVED: { label: "وصلت", variant: "success" },
};

export async function getServerSideProps({ req }) {
  const session = await getSession(req, "SUPPLIER");
  const supplier = await prisma.supplier.findUnique({ where: { id: session.id } });
  if (!supplier) return { notFound: true };

  const [activeOrdersCount, draftInvoicesCount, storageAgg, consignmentStockAgg, recentOrders] = await Promise.all([
    prisma.supplierOrder.count({ where: { supplierId: supplier.id, status: { not: "ARRIVED" } } }),
    prisma.purchaseInvoice.count({ where: { supplierId: supplier.id, status: "DRAFT" } }),
    prisma.supplierStorageUnit.aggregate({
      where: { supplierId: supplier.id, active: true },
      _sum: { feePerPeriod: true },
      _count: true,
    }),
    prisma.shelfStock.aggregate({
      where: { ownership: "SUPPLIER", supplierId: supplier.id },
      _sum: { quantity: true },
    }),
    prisma.supplierOrder.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    props: {
      supplierName: supplier.name,
      stats: {
        balance: supplier.balance,
        activeOrdersCount,
        draftInvoicesCount,
        storageUnitsCount: storageAgg._count,
        storageMonthlyFee: storageAgg._sum.feePerPeriod || 0,
        consignmentStockQty: consignmentStockAgg._sum.quantity || 0,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
    },
  };
}

export default function SupplierPortalHome({ supplierName, stats, recentOrders }) {
  return (
    <PortalLayout
      name={supplierName}
      roleLabel="بوابة المورد"
      tabs={SUPPLIER_TABS}
      logoutUrl="/api/portal/supplier/logout"
      loginUrl="/portal/supplier/login"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KpiCard icon={Wallet} label="رصيدك المستحق" value={`${stats.balance.toFixed(2)} ر.س`} color="green" />
          <KpiCard icon={ClipboardList} label="طلبيات جارية" value={stats.activeOrdersCount} color="blue" />
          <KpiCard icon={Package} label="فواتير مسودة" value={stats.draftInvoicesCount} color="amber" />
          <KpiCard icon={Archive} label="مخزونك المخزَّن عندنا" value={`${stats.consignmentStockQty} نسخة`} color="purple" />
          <KpiCard
            icon={Archive}
            label="وحدات تخزين نشطة"
            value={`${stats.storageUnitsCount} (${stats.storageMonthlyFee.toFixed(2)} ر.س/دورة)`}
            color="blue"
          />
        </div>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">آخر الطلبيات الآلية</h2>
          <div className="divide-y divide-gray-100">
            {recentOrders.map((o) => {
              const st = ORDER_STATUS[o.status];
              return (
                <div key={o.id} className="py-3 flex justify-between items-center text-sm">
                  <span className="text-gray-600">{new Date(o.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              );
            })}
            {recentOrders.length === 0 && <div className="py-6 text-center text-gray-400 text-sm">لا توجد طلبيات بعد.</div>}
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}
