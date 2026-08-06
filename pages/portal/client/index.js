import { useRouter } from "next/router";
import { LogOut, Box } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";

const STATUS_LABEL = {
  PENDING_REVIEW: { label: "بانتظار المراجعة", variant: "info" },
  IN_REVIEW: { label: "قيد التنفيذ", variant: "warning" },
  FULFILLED: { label: "تم التنفيذ", variant: "success" },
};

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  const client = await prisma.client.findUnique({
    where: { id: session.id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 30, include: { items: true } },
      invoices: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!client) return { notFound: true };

  return {
    props: {
      clientName: client.name,
      orders: client.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        itemCount: o.items.length,
        createdAt: o.createdAt.toISOString(),
      })),
      invoices: client.invoices.map((i) => ({
        id: i.id,
        periodStart: i.periodStart.toISOString(),
        periodEnd: i.periodEnd.toISOString(),
        status: i.status,
        total: i.total,
      })),
    },
  };
}

export default function ClientPortal({ clientName, orders, invoices }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/portal/client/login");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box size={20} className="text-blue-600" />
            <span className="font-bold text-gray-900">{clientName}</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <LogOut size={14} />
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">طلباتي الأخيرة</h2>
          <div className="divide-y divide-gray-100">
            {orders.map((o) => {
              const st = STATUS_LABEL[o.status];
              return (
                <div key={o.id} className="py-3 flex justify-between items-center text-sm">
                  <div className="text-gray-900">#{o.orderNumber}</div>
                  <div className="flex items-center gap-4 text-gray-500">
                    <span>{o.itemCount} بند</span>
                    <span>{new Date(o.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && <div className="py-6 text-center text-gray-400 text-sm">لا توجد طلبات بعد.</div>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">فواتيري</h2>
          <div className="divide-y divide-gray-100">
            {invoices.map((i) => (
              <div key={i.id} className="py-3 flex justify-between items-center text-sm">
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
            {invoices.length === 0 && <div className="py-6 text-center text-gray-400 text-sm">لا توجد فواتير بعد.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
