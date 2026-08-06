import Link from "next/link";
import { Plus, Printer } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps() {
  const shelves = await prisma.shelf.findMany({
    orderBy: { sortOrder: "asc" },
    include: { stock: true },
  });

  const data = shelves.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    stock: s.stock.map((st) => ({ ...st, updatedAt: st.updatedAt.toISOString() })),
  }));

  return { props: { shelves: data } };
}

export default function ShelvesIndex({ shelves }) {
  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">إدارة الرفوف</h1>
          <p className="text-gray-500">هيكلة المخزون والباركود لكل رف</p>
        </div>
        <Link
          href="/shelves/new"
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          إضافة رف
        </Link>
      </div>

      <div className="grid gap-4">
        {shelves.map((shelf) => {
          const totalQty = shelf.stock.reduce((sum, s) => sum + s.quantity, 0);
          return (
            <Card key={shelf.id} className="p-4 hover:shadow-md transition">
              <div className="flex justify-between items-center">
                <Link href={`/shelves/${shelf.id}`} className="flex-1">
                  <div className="font-semibold text-lg text-gray-900">{shelf.name}</div>
                  <div className="text-sm text-gray-400">باركود: {shelf.barcode}</div>
                </Link>
                <div className="text-left">
                  <div className="text-sm text-gray-500 mb-1">ترتيب اللقط: {shelf.sortOrder}</div>
                  <div className="text-sm font-medium text-gray-800 mb-1">
                    {shelf.stock.length} عنوان — {totalQty} نسخة
                  </div>
                  <Link
                    href={`/shelves/${shelf.id}/barcode`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600"
                  >
                    <Printer size={14} />
                    طباعة الباركود
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}

        {shelves.length === 0 && (
          <Card className="p-8 text-center text-gray-400">
            لا توجد رفوف بعد. أضف رفًا جديدًا أو شغّل <code>npm run seed</code> لإضافة بيانات تجريبية.
          </Card>
        )}
      </div>
    </div>
  );
}
