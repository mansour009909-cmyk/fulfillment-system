import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";
import { BarcodeLabelSheet } from "../../components/BarcodeLabelSheet";

// يطبع باركود صندوق كل الطلبات المعروضة حاليًا بصفحة /orders (نفس الاستعلام: أقدم 30 طلب غير مكتمل)
export async function getServerSideProps() {
  const orders = await prisma.order.findMany({
    where: { status: { in: ["PENDING_REVIEW", "IN_REVIEW"] } },
    orderBy: { createdAt: "asc" },
    take: 30,
    include: { client: true },
  });

  const data = orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, clientName: o.client.name }));

  return { props: { orders: data } };
}

export default function PrintAllOrderBoxes({ orders }) {
  const items = orders.map((o) => ({ id: o.id, code: o.orderNumber, title: `صندوق #${o.orderNumber}` }));

  return (
    <div className="max-w-md">
      <div className="print:hidden mb-6">
        <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للطلبات
        </Link>
        <p className="text-sm text-gray-500 my-3">
          {orders.length} صندوق — صفحة طباعة 100×150مم، عدة ملصقات بكل صفحة.
        </p>
        <button
          onClick={() => window.print()}
          disabled={orders.length === 0}
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Printer size={16} />
          طباعة كل الصناديق ({orders.length})
        </button>
      </div>

      <div className="print:hidden space-y-3">
        {orders.map((o) => (
          <Card key={o.id} className="p-3 text-sm text-gray-600">
            #{o.orderNumber} — {o.clientName}
          </Card>
        ))}
        {orders.length === 0 && <div className="p-8 text-center text-gray-400">لا توجد طلبات بانتظار المراجعة حاليًا.</div>}
      </div>

      <BarcodeLabelSheet items={items} />
    </div>
  );
}
