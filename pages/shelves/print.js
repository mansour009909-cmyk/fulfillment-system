import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";
import { BarcodeLabelSheet } from "../../components/BarcodeLabelSheet";

export async function getServerSideProps() {
  const shelves = await prisma.shelf.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, barcode: true, name: true },
  });
  return { props: { shelves } };
}

export default function PrintAllShelves({ shelves }) {
  const items = shelves.map((s) => ({ id: s.id, code: s.barcode, title: s.name }));

  return (
    <div className="max-w-md">
      <div className="print:hidden mb-6">
        <Link href="/shelves" className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للرفوف
        </Link>
        <p className="text-sm text-gray-500 my-3">
          {shelves.length} ملصق — صفحة طباعة 100×150مم، عدة ملصقات بكل صفحة.
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700"
        >
          <Printer size={16} />
          طباعة كل الملصقات ({shelves.length})
        </button>
      </div>

      <div className="print:hidden space-y-3">
        {shelves.map((s) => (
          <Card key={s.id} className="p-3 text-sm text-gray-600">
            {s.name} — {s.barcode}
          </Card>
        ))}
      </div>

      <BarcodeLabelSheet items={items} />
    </div>
  );
}
