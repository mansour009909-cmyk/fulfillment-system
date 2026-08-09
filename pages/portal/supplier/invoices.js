import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { PortalLayout } from "../../../components/portal/PortalLayout";
import { SUPPLIER_TABS } from "../../../components/portal/portalTabs";

const INVOICE_STATUS = {
  DRAFT: { label: "مسودة", variant: "warning" },
  APPROVED: { label: "معتمدة", variant: "success" },
};

export async function getServerSideProps({ req }) {
  const session = await getSession(req, "SUPPLIER");
  const supplier = await prisma.supplier.findUnique({ where: { id: session.id } });
  if (!supplier) return { notFound: true };

  const [invoices, storageUnits] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: { supplierId: supplier.id, type: "CONSIGNMENT" },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
    prisma.supplierStorageUnit.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    props: {
      supplierName: supplier.name,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        status: inv.status,
        createdAt: inv.createdAt.toISOString(),
        itemCount: inv.items.length,
        totalQty: inv.items.reduce((sum, i) => sum + i.quantityExpected, 0),
      })),
      storageUnits: storageUnits.map((u) => ({
        id: u.id,
        label: u.label,
        feePerPeriod: u.feePerPeriod,
        active: u.active,
        notes: u.notes,
      })),
    },
  };
}

export default function SupplierInvoices({ supplierName, invoices, storageUnits }) {
  const dueTotal = storageUnits.filter((u) => u.active).reduce((sum, u) => sum + u.feePerPeriod, 0);

  return (
    <PortalLayout
      name={supplierName}
      roleLabel="بوابة المورد"
      tabs={SUPPLIER_TABS}
      logoutUrl="/api/portal/supplier/logout"
      loginUrl="/portal/supplier/login"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-5 flex items-center justify-between">
          <span className="text-gray-600">المستحق عليك دوريًا (رسوم التخزين)</span>
          <span className="text-2xl font-bold text-gray-900">{dueTotal.toFixed(2)} ر.س</span>
        </Card>

        <div>
          <h2 className="font-semibold text-gray-900 mb-3">وحدات ورسوم التخزين</h2>
          <Card className="divide-y divide-gray-100">
            {storageUnits.map((u) => (
              <div key={u.id} className="p-4 flex justify-between items-center text-sm">
                <div>
                  <div className="text-gray-900">{u.label}</div>
                  {u.notes && <div className="text-gray-400 text-xs">{u.notes}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{u.feePerPeriod.toFixed(2)} ر.س</span>
                  <Badge variant={u.active ? "success" : "neutral"}>{u.active ? "نشطة" : "معطّلة"}</Badge>
                </div>
              </div>
            ))}
            {storageUnits.length === 0 && <div className="p-8 text-center text-gray-400">لا توجد وحدات تخزين مسجَّلة.</div>}
          </Card>
        </div>

        <div>
          <h2 className="font-semibold text-gray-900 mb-3">فواتير التخزين بغرض البيع</h2>
          <Card className="divide-y divide-gray-100">
            {invoices.map((inv) => {
              const st = INVOICE_STATUS[inv.status];
              return (
                <div key={inv.id} className="p-4 flex justify-between items-center text-sm">
                  <div className="text-gray-600">
                    {new Date(inv.createdAt).toLocaleDateString("ar-SA-u-nu-latn")} — {inv.itemCount} بند ({inv.totalQty} نسخة)
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              );
            })}
            {invoices.length === 0 && (
              <div className="p-8 text-center text-gray-400">لا توجد فواتير تخزين بغرض البيع بعد.</div>
            )}
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
