import Link from "next/link";
import { ScanLine, Printer } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

const STATUS_LABEL = {
  PENDING_REVIEW: { label: "بانتظار المراجعة", variant: "info" },
  IN_REVIEW: { label: "قيد التنفيذ", variant: "warning" },
  FULFILLED: { label: "تم التنفيذ", variant: "success" },
};

export async function getServerSideProps() {
  const orders = await prisma.order.findMany({
    where: { status: { in: ["PENDING_REVIEW", "IN_REVIEW"] } },
    orderBy: { createdAt: "asc" },
    take: 30,
    include: { client: true, items: true },
  });

  const data = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    clientName: o.client.name,
    itemCount: o.items.length,
    createdAt: o.createdAt.toISOString(),
  }));

  return { props: { orders: data } };
}

export default function OrdersIndex({ orders }) {
  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">الطلبات</h1>
          <p className="text-gray-500">
            طلبات بانتظار المراجعة، مرتبة من الأقدم إلى الأحدث (دفعة {orders.length} طلب)
          </p>
        </div>
        <Link
          href="/orders/picking"
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
        >
          <ScanLine size={16} />
          بدء اللقط حسب ترتيب الرفوف
        </Link>
      </div>

      <Card className="divide-y divide-gray-100">
        {orders.map((order) => {
          const st = STATUS_LABEL[order.status];
          return (
            <div key={order.id} className="flex items-center hover:bg-gray-50">
              <Link href={`/orders/${order.id}`} className="flex-1 min-w-0 p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                  <div className="text-sm text-gray-400">{order.clientName}</div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-sm text-gray-500">{order.itemCount} بند</div>
                  <div className="text-sm text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              </Link>
              <Link
                href={`/orders/${order.id}/barcode`}
                title="طباعة باركود الصندوق"
                className="p-2 me-4 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Printer size={16} />
              </Link>
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="p-8 text-center text-gray-400">لا توجد طلبات بانتظار المراجعة حاليًا.</div>
        )}
      </Card>
    </div>
  );
}
