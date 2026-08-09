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

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  const supplier = await prisma.supplier.findUnique({ where: { id: session.id } });
  if (!supplier) return { notFound: true };

  const [stock, storageUnits] = await Promise.all([
    prisma.shelfStock.findMany({
      where: { ownership: "SUPPLIER", supplierId: supplier.id, quantity: { gt: 0 } },
      include: { book: true, shelf: true },
      orderBy: { book: { title: "asc" } },
    }),
    prisma.supplierStorageUnit.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    props: {
      supplierName: supplier.name,
      stock: stock.map((s) => ({
        id: s.id,
        bookTitle: s.book.title,
        barcode: s.book.barcode,
        imageUrl: s.book.imageUrl,
        shelfName: s.shelf.name,
        quantity: s.quantity,
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

export default function SupplierInventory({ supplierName, stock, storageUnits }) {
  const totalQty = stock.reduce((sum, s) => sum + s.quantity, 0);
  const activeFees = storageUnits.filter((u) => u.active).reduce((sum, u) => sum + u.feePerPeriod, 0);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <PortalNav name={supplierName} tabs={TABS} />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">مخزونك المخزَّن عندنا</h1>
            <span className="text-sm text-gray-500">{totalQty} نسخة إجمالًا</span>
          </div>
          <Card className="divide-y divide-gray-100">
            {stock.map((s) => (
              <div key={s.id} className="p-4 flex items-center gap-3">
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-gray-100 shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-gray-50 border border-gray-100 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">{s.bookTitle}</div>
                  <div className="text-sm text-gray-400">{s.barcode} — {s.shelfName}</div>
                </div>
                <div className="text-lg font-semibold text-gray-900 shrink-0">{s.quantity}</div>
              </div>
            ))}
            {stock.length === 0 && <div className="p-8 text-center text-gray-400">لا يوجد مخزون مخزَّن حاليًا.</div>}
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">وحدات ورسوم التخزين</h2>
            <span className="text-sm text-gray-500">{activeFees.toFixed(2)} ر.س / دورة (النشطة)</span>
          </div>
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
      </div>
    </div>
  );
}
