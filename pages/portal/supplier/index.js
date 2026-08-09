import { Package, Archive, Wallet } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { KpiCard } from "../../../components/ui/KpiCard";
import { PortalLayout } from "../../../components/portal/PortalLayout";
import { SUPPLIER_TABS } from "../../../components/portal/portalTabs";

export async function getServerSideProps({ req }) {
  const session = await getSession(req, "SUPPLIER");
  const supplier = await prisma.supplier.findUnique({ where: { id: session.id } });
  if (!supplier) return { notFound: true };

  const [invoicesCount, storageAgg, consignmentStockAgg, stockLines] = await Promise.all([
    prisma.purchaseInvoice.count({ where: { supplierId: supplier.id, type: "CONSIGNMENT" } }),
    prisma.supplierStorageUnit.aggregate({
      where: { supplierId: supplier.id, active: true },
      _sum: { feePerPeriod: true },
      _count: true,
    }),
    prisma.shelfStock.aggregate({
      where: { ownership: "SUPPLIER", supplierId: supplier.id },
      _sum: { quantity: true },
    }),
    prisma.shelfStock.findMany({
      where: { ownership: "SUPPLIER", supplierId: supplier.id, quantity: { gt: 0 } },
      include: { book: true, shelf: true },
      orderBy: { book: { title: "asc" } },
      take: 5,
    }),
  ]);

  return {
    props: {
      supplierName: supplier.name,
      stats: {
        invoicesCount,
        storageUnitsCount: storageAgg._count,
        duePerPeriod: storageAgg._sum.feePerPeriod || 0,
        consignmentStockQty: consignmentStockAgg._sum.quantity || 0,
      },
      recentStock: stockLines.map((s) => ({
        id: s.id,
        bookTitle: s.book.title,
        shelfName: s.shelf.name,
        quantity: s.quantity,
      })),
    },
  };
}

export default function SupplierPortalHome({ supplierName, stats, recentStock }) {
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
          <KpiCard icon={Archive} label="مخزونك المخزَّن عندنا" value={`${stats.consignmentStockQty} نسخة`} color="purple" />
          <KpiCard icon={Wallet} label="المستحق عليك دوريًا" value={`${stats.duePerPeriod.toFixed(2)} ر.س`} color="amber" />
          <KpiCard icon={Package} label="وحدات تخزين نشطة" value={stats.storageUnitsCount} color="blue" />
        </div>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">آخر ما تم تخزينه</h2>
          <div className="divide-y divide-gray-100">
            {recentStock.map((s) => (
              <div key={s.id} className="py-3 flex justify-between items-center text-sm">
                <span className="text-gray-800">{s.bookTitle}</span>
                <span className="text-gray-500">{s.shelfName} — {s.quantity} نسخة</span>
              </div>
            ))}
            {recentStock.length === 0 && <div className="py-6 text-center text-gray-400 text-sm">لا يوجد مخزون مخزَّن حاليًا.</div>}
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}
