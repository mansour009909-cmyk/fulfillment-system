import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps() {
  const unlinkedScans = await prisma.receivingScan.findMany({
    where: { invoiceId: null },
    select: { bookId: true },
    distinct: ["bookId"],
  });
  const bookIds = unlinkedScans.map((s) => s.bookId);

  const candidateInvoices = bookIds.length
    ? await prisma.purchaseInvoice.findMany({
        where: {
          status: "DRAFT",
          items: { some: { bookId: { in: bookIds } } },
        },
        include: { supplier: true, items: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const candidates = candidateInvoices.map((inv) => ({
    id: inv.id,
    supplierName: inv.supplier.name,
    itemCount: inv.items.length,
    sharedBookCount: inv.items.filter((i) => bookIds.includes(i.bookId)).length,
  }));

  return { props: { candidates } };
}

export default function ReconcileCandidates({ candidates }) {
  return (
    <div className="max-w-2xl">
      <Link href="/receiving" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للاستلام
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">فواتير مرشَّحة للمطابقة</h1>
      <p className="text-gray-500 mb-6">
        فواتير مسودة (من أي مورد) تشترك بكتاب واحد على الأقل مع الجرد الفعلي غير المرتبط حاليًا
      </p>

      <Card className="overflow-hidden">
        {candidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 text-right">الفاتورة</th>
                  <th className="px-4 py-3 text-right">المورد</th>
                  <th className="px-4 py-3 text-center">عدد البنود</th>
                  <th className="px-4 py-3 text-center">كتب مشتركة</th>
                  <th className="px-4 py-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">فاتورة #{c.id}</td>
                    <td className="px-4 py-3 text-gray-600">{c.supplierName}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{c.itemCount}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{c.sharedBookCount}</td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/receiving/reconcile/${c.id}`} className="text-sm text-blue-600 hover:text-blue-800">
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            لا توجد فواتير مسودة تشترك بأي كتاب مع الجرد الحالي.
          </div>
        )}
      </Card>
    </div>
  );
}
