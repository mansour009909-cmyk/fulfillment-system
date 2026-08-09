import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { PortalNav } from "../../../components/portal/PortalNav";

const TABS = [
  { href: "/portal/supplier", label: "الرئيسية" },
  { href: "/portal/supplier/orders", label: "الطلبيات" },
  { href: "/portal/supplier/inventory", label: "المخزون" },
  { href: "/portal/supplier/invoices", label: "الفواتير والمستحقات" },
  { href: "/portal/supplier/settings", label: "الإعدادات" },
];

const INVOICE_STATUS = {
  DRAFT: { label: "مسودة", variant: "warning" },
  APPROVED: { label: "معتمدة", variant: "success" },
};

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  const supplier = await prisma.supplier.findUnique({ where: { id: session.id } });
  if (!supplier) return { notFound: true };

  const invoices = await prisma.purchaseInvoice.findMany({
    where: { supplierId: supplier.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return {
    props: {
      supplierName: supplier.name,
      balance: supplier.balance,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        status: inv.status,
        type: inv.type,
        createdAt: inv.createdAt.toISOString(),
        approvedAt: inv.approvedAt?.toISOString() || null,
        total: inv.items.reduce((sum, i) => sum + i.quantityExpected * i.price, 0),
        itemCount: inv.items.length,
      })),
    },
  };
}

export default function SupplierInvoices({ supplierName, balance, invoices }) {
  const purchaseInvoices = invoices.filter((i) => i.type === "PURCHASE");
  const consignmentInvoices = invoices.filter((i) => i.type === "CONSIGNMENT");

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <PortalNav name={supplierName} tabs={TABS} />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Card className="p-5 flex items-center justify-between">
          <span className="text-gray-600">رصيدك المستحق</span>
          <span className="text-2xl font-bold text-gray-900">{balance.toFixed(2)} ر.س</span>
        </Card>

        <div>
          <h2 className="font-semibold text-gray-900 mb-3">فواتير الشراء</h2>
          <Card className="divide-y divide-gray-100">
            {purchaseInvoices.map((inv) => (
              <InvoiceRow key={inv.id} inv={inv} />
            ))}
            {purchaseInvoices.length === 0 && (
              <div className="p-8 text-center text-gray-400">لا توجد فواتير شراء بعد.</div>
            )}
          </Card>
        </div>

        <div>
          <h2 className="font-semibold text-gray-900 mb-3">فواتير التخزين بغرض البيع</h2>
          <Card className="divide-y divide-gray-100">
            {consignmentInvoices.map((inv) => (
              <InvoiceRow key={inv.id} inv={inv} />
            ))}
            {consignmentInvoices.length === 0 && (
              <div className="p-8 text-center text-gray-400">لا توجد فواتير تخزين بغرض البيع بعد.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function InvoiceRow({ inv }) {
  const st = INVOICE_STATUS[inv.status];
  return (
    <div className="p-4 flex justify-between items-center text-sm">
      <div className="text-gray-600">
        {new Date(inv.createdAt).toLocaleDateString("ar-SA-u-nu-latn")} — {inv.itemCount} بند
      </div>
      <div className="flex items-center gap-4">
        <span className="font-medium text-gray-900">{inv.total.toFixed(2)} ر.س</span>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>
    </div>
  );
}
