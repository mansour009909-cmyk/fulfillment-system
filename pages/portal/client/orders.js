import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { PortalLayout } from "../../../components/portal/PortalLayout";
import { CLIENT_TABS } from "../../../components/portal/portalTabs";

const STATUS_LABEL = {
  PENDING_REVIEW: { label: "بانتظار المراجعة", variant: "info" },
  IN_REVIEW: { label: "قيد التنفيذ", variant: "warning" },
  FULFILLED: { label: "تم التنفيذ", variant: "success" },
};

const SHIPPING_LABEL = {
  NOT_SHIPPED: { label: "لم يُشحن", variant: "neutral" },
  SHIPPED: { label: "تم الشحن", variant: "info" },
  DELIVERED: { label: "تم التسليم", variant: "success" },
  RETURNED: { label: "مرتجع", variant: "danger" },
};

export async function getServerSideProps({ req }) {
  const session = await getSession(req, "CLIENT");
  const client = await prisma.client.findUnique({ where: { id: session.id } });
  if (!client) return { notFound: true };

  const orders = await prisma.order.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: true },
  });

  return {
    props: {
      clientName: client.name,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        shippingStatus: o.shippingStatus,
        carrierName: o.carrierName,
        trackingNumber: o.trackingNumber,
        itemCount: o.items.length,
        createdAt: o.createdAt.toISOString(),
      })),
    },
  };
}

export default function ClientOrders({ clientName, orders }) {
  return (
    <PortalLayout
      name={clientName}
      roleLabel="بوابة العميل"
      tabs={CLIENT_TABS}
      logoutUrl="/api/portal/client/logout"
      loginUrl="/portal/client/login"
    >
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-4">الطلبات ({orders.length})</h1>
        <Card className="divide-y divide-gray-100">
          {orders.map((o) => {
            const st = STATUS_LABEL[o.status];
            const ship = SHIPPING_LABEL[o.shippingStatus];
            return (
              <div key={o.id} className="p-4 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium text-gray-900">#{o.orderNumber}</div>
                  <div className="text-gray-400">
                    {o.itemCount} بند — {new Date(o.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}
                  </div>
                  {o.status === "FULFILLED" && (o.carrierName || o.trackingNumber) && (
                    <div className="text-xs text-gray-400 mt-1">
                      {o.carrierName && <span>{o.carrierName}</span>}
                      {o.trackingNumber && <span> — بوليصة: {o.trackingNumber}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {o.status === "FULFILLED" && <Badge variant={ship.variant}>{ship.label}</Badge>}
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              </div>
            );
          })}
          {orders.length === 0 && <div className="p-8 text-center text-gray-400">لا توجد طلبات بعد.</div>}
        </Card>
      </div>
    </PortalLayout>
  );
}
