import { useRouter } from "next/router";
import { LogOut, Box } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";

const INVOICE_STATUS = {
  DRAFT: { label: "مسودة", variant: "warning" },
  APPROVED: { label: "معتمدة", variant: "success" },
};

const ORDER_STATUS = {
  PROPOSED: { label: "مقترحة", variant: "neutral" },
  ORDERED: { label: "تم الطلب", variant: "info" },
  SHIPPED: { label: "تم الشحن", variant: "warning" },
  ARRIVED: { label: "وصلت", variant: "success" },
};

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  const supplier = await prisma.supplier.findUnique({
    where: { id: session.id },
    include: {
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { items: true },
      },
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!supplier) return { notFound: true };

  return {
    props: {
      supplierName: supplier.name,
      balance: supplier.balance,
      invoices: supplier.invoices.map((inv) => ({
        id: inv.id,
        status: inv.status,
        type: inv.type,
        createdAt: inv.createdAt.toISOString(),
        total: inv.items.reduce((sum, i) => sum + i.quantityExpected * i.price, 0),
      })),
      orders: supplier.orders.map((o) => ({
        id: o.id,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
    },
  };
}

export default function SupplierPortal({ supplierName, balance, invoices, orders }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/portal/supplier/login");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box size={20} className="text-blue-600" />
            <span className="font-bold text-gray-900">{supplierName}</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <LogOut size={14} />
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Card className="p-5 flex items-center justify-between">
          <span className="text-gray-600">رصيدك المستحق</span>
          <span className="text-2xl font-bold text-gray-900">{balance.toFixed(2)} ر.س</span>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">طلبياتك الآلية</h2>
          <div className="divide-y divide-gray-100">
            {orders.map((o) => {
              const st = ORDER_STATUS[o.status];
              return (
                <div key={o.id} className="py-3 flex justify-between items-center text-sm">
                  <span className="text-gray-600">{new Date(o.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              );
            })}
            {orders.length === 0 && <div className="py-6 text-center text-gray-400 text-sm">لا توجد طلبيات بعد.</div>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">فواتير الشراء</h2>
          <div className="divide-y divide-gray-100">
            {invoices.map((inv) => {
              const st = INVOICE_STATUS[inv.status];
              return (
                <div key={inv.id} className="py-3 flex justify-between items-center text-sm">
                  <div className="text-gray-600">
                    {new Date(inv.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}
                    {inv.type === "CONSIGNMENT" && (
                      <span className="text-xs text-gray-400 mr-2">(تخزين بيع)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-gray-900">{inv.total.toFixed(2)} ر.س</span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </div>
              );
            })}
            {invoices.length === 0 && <div className="py-6 text-center text-gray-400 text-sm">لا توجد فواتير بعد.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
