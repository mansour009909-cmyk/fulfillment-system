import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { BarcodeLabelSheet } from "../../../components/BarcodeLabelSheet";

export async function getServerSideProps({ params }) {
  const shelf = await prisma.shelf.findUnique({ where: { id: Number(params.id) } });
  if (!shelf) return { notFound: true };

  return { props: { shelf: { id: shelf.id, barcode: shelf.barcode, name: shelf.name } } };
}

export default function ShelfBarcode({ shelf }) {
  return (
    <div className="max-w-md">
      <div className="print:hidden mb-6">
        <Link href={`/shelves/${shelf.id}`} className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للرف
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 mt-4 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700"
        >
          <Printer size={16} />
          طباعة
        </button>
      </div>

      <BarcodeLabelSheet items={[{ id: shelf.id, code: shelf.barcode, title: shelf.name }]} />
    </div>
  );
}
