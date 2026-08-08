import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { BarcodeLabelSheet } from "../../../components/BarcodeLabelSheet";

export async function getServerSideProps({ params }) {
  const book = await prisma.book.findUnique({ where: { id: Number(params.id) } });
  if (!book) return { notFound: true };

  return { props: { book: { id: book.id, barcode: book.barcode, title: book.title } } };
}

export default function BookBarcode({ book }) {
  return (
    <div className="max-w-md">
      <div className="print:hidden mb-6">
        <Link href="/books" className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للكتب
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 mt-4 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700"
        >
          <Printer size={16} />
          طباعة
        </button>
      </div>

      <BarcodeLabelSheet items={[{ id: book.id, code: book.barcode, title: book.title }]} />
    </div>
  );
}
