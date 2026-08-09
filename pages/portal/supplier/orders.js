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

const ORDER_STATUS = {
  PROPOSED: { label: "مقترحة", variant: "neutral" },
  ORDERED: { label: "تم الطلب", variant: "info" },
  SHIPPED: { label: "تم الشحن", variant: "warning" },
  ARRIVED: { label: "وصلت", variant: "success" },
};

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  const supplier = await prisma.supplier.findUnique({ where: { id: session.id } });
  if (!supplier) return { notFound: true };

  const orders = await prisma.supplierOrder.findMany({
    where: { supplierId: supplier.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return {
    props: {
      supplierName: supplier.name,
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        orderedAt: o.orderedAt?.toISOString() || null,
        shippedAt: o.shippedAt?.toISOString() || null,
        arrivedAt: o.arrivedAt?.toISOString() || null,
        itemCount: o.items.filter((i) => i.included).length,
        totalQty: o.items.filter((i) => i.included).reduce((sum, i) => sum + i.quantityFinal, 0),
      })),
    },
  };
}

export default function SupplierOrders({ supplierName, orders }) {
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <PortalNav name={supplierName} tabs={TABS} />

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">الطلبيات الآلية ({orders.length})</h1>
        <Card className="divide-y divide-gray-100">
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status];
            return (
              <div key={o.id} className="p-4 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium text-gray-900">
                    {o.itemCount} عنوان — {o.totalQty} نسخة
                  </div>
                  <div className="text-gray-400">أُنشئت: {new Date(o.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}</div>
                </div>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
            );
          })}
          {orders.length === 0 && <div className="p-8 text-center text-gray-400">لا توجد طلبيات بعد.</div>}
        </Card>
      </div>
    </div>
  );
}
