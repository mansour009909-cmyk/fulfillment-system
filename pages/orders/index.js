import Link from "next/link";
import { ScanLine, Printer, Plus } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

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

export async function getServerSideProps({ query }) {
  const view = query.view === "completed" ? "completed" : "active";

  const orders =
    view === "completed"
      ? await prisma.order.findMany({
          where: { status: "FULFILLED" },
          orderBy: { charge: { createdAt: "desc" } },
          take: 30,
          include: { client: true, items: true },
        })
      : await prisma.order.findMany({
          where: { status: { in: ["PENDING_REVIEW", "IN_REVIEW"] } },
          orderBy: { createdAt: "asc" },
          take: 30,
          include: { client: true, items: true },
        });

  const data = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    shippingStatus: o.shippingStatus,
    clientName: o.client.name,
    itemCount: o.items.length,
    createdAt: o.createdAt.toISOString(),
  }));

  return { props: { orders: data, view } };
}

export default function OrdersIndex({ orders, view }) {
  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">الطلبات</h1>
          <p className="text-gray-500">
            {view === "completed"
              ? `آخر ${orders.length} طلب مكتمل`
              : `طلبات بانتظار المراجعة، مرتبة من الأقدم إلى الأحدث (دفعة ${orders.length} طلب)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/orders/new"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            <Plus size={16} />
            طلب جديد
          </Link>
          <Link
            href="/orders/print"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            <Printer size={16} />
            طباعة كل الصناديق
          </Link>
          <Link
            href="/orders/picking"
            className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
          >
            <ScanLine size={16} />
            بدء اللقط حسب ترتيب الرفوف
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/orders"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            view === "active" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"
          }`}
        >
          نشطة
        </Link>
        <Link
          href="/orders?view=completed"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            view === "completed" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"
          }`}
        >
          مكتملة
        </Link>
      </div>

      <Card className="divide-y divide-gray-100">
        {orders.map((order) => {
          const st = STATUS_LABEL[order.status];
          const ship = SHIPPING_LABEL[order.shippingStatus];
          return (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="p-4 flex justify-between items-center hover:bg-gray-50"
            >
              <div>
                <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                <div className="text-sm text-gray-400">{order.clientName}</div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-sm text-gray-500">{order.itemCount} بند</div>
                <div className="text-sm text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}
                </div>
                {view === "completed" && <Badge variant={ship.variant}>{ship.label}</Badge>}
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
            </Link>
          );
        })}

        {orders.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            {view === "completed" ? "لا توجد طلبات مكتملة بعد." : "لا توجد طلبات بانتظار المراجعة حاليًا."}
          </div>
        )}
      </Card>
    </div>
  );
}
