import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
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

  const invoices = await prisma.clientInvoice.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  });

  return {
    props: {
      clientName: client.name,
      invoices: invoices.map((i) => ({
        id: i.id,
        periodStart: i.periodStart.toISOString(),
        periodEnd: i.periodEnd.toISOString(),
        status: i.status,
        total: i.total,
      })),
    },
  };
}

export default function ClientInvoices({ clientName, invoices }) {
  const unpaidTotal = invoices.filter((i) => i.status === "UNPAID").reduce((sum, i) => sum + i.total, 0);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <PortalNav name={clientName} tabs={TABS} />

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">فواتيري</h1>
          <span className="text-sm text-amber-700">إجمالي غير المدفوع: {unpaidTotal.toFixed(2)} ر.س</span>
        </div>
        <Card className="divide-y divide-gray-100">
          {invoices.map((i) => (
            <div key={i.id} className="p-4 flex justify-between items-center text-sm">
              <div className="text-gray-600">
                {new Date(i.periodStart).toLocaleDateString("ar-SA-u-nu-latn")} —{" "}
                {new Date(i.periodEnd).toLocaleDateString("ar-SA-u-nu-latn")}
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-900">{i.total.toFixed(2)} ر.س</span>
                <Badge variant={i.status === "PAID" ? "success" : "warning"}>
                  {i.status === "PAID" ? "مدفوعة" : "غير مدفوعة"}
                </Badge>
              </div>
            </div>
          ))}
          {invoices.length === 0 && <div className="p-8 text-center text-gray-400">لا توجد فواتير بعد.</div>}
        </Card>
      </div>
    </div>
  );
}
