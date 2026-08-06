import Link from "next/link";
import { LayoutGrid, BookOpen, Package, ScanLine } from "lucide-react";
import { prisma } from "../lib/prisma";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";

export async function getServerSideProps() {
  const [shelfCount, bookCount, quantityAgg, recentScans] = await Promise.all([
    prisma.shelf.count(),
    prisma.book.count(),
    prisma.shelfStock.aggregate({ _sum: { quantity: true } }),
    prisma.shelfScanLog.findMany({
      orderBy: { scannedAt: "desc" },
      take: 5,
      include: { shelf: true },
    }),
  ]);

  return {
    props: {
      stats: {
        shelfCount,
        bookCount,
        totalCopies: quantityAgg._sum.quantity || 0,
      },
      recentScans: recentScans.map((s) => ({
        id: s.id,
        bookBarcode: s.bookBarcode,
        quantityDelta: s.quantityDelta,
        scannedAt: s.scannedAt.toISOString(),
        shelfName: s.shelf.name,
      })),
    },
  };
}

export default function Home({ stats, recentScans }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">لوحة العمليات الرئيسية</h1>
        <p className="text-gray-500">نظرة عامة على المخزون (المرحلة 1 — باقي المراحل قيد الإنشاء)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard icon={LayoutGrid} label="إجمالي الرفوف" value={stats.shelfCount} color="blue" />
        <KpiCard icon={BookOpen} label="إجمالي العناوين" value={stats.bookCount} color="purple" />
        <KpiCard icon={Package} label="إجمالي النسخ بالمخزون" value={stats.totalCopies} color="green" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">آخر عمليات المسح</h2>
          <Link href="/shelves" className="text-sm text-blue-600">
            عرض كل الرفوف
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          {recentScans.map((scan) => (
            <div key={scan.id} className="flex items-center gap-3 py-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <ScanLine size={16} />
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-800">
                  مسح باركود <span className="font-medium">{scan.bookBarcode}</span> على{" "}
                  {scan.shelfName} (+{scan.quantityDelta})
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(scan.scannedAt).toLocaleString("ar-SA-u-nu-latn")}
                </div>
              </div>
            </div>
          ))}

          {recentScans.length === 0 && (
            <div className="py-6 text-center text-gray-400 text-sm">لا توجد عمليات مسح بعد.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
