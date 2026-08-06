import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import JsBarcode from "jsbarcode";
import { prisma } from "../../../lib/prisma";
import { Card } from "../../../components/ui/Card";

export async function getServerSideProps({ params }) {
  const book = await prisma.book.findUnique({ where: { id: Number(params.id) } });
  if (!book) return { notFound: true };

  return { props: { book: { id: book.id, barcode: book.barcode, title: book.title } } };
}

export default function BookBarcode({ book }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, book.barcode, {
        format: "CODE128",
        width: 3,
        height: 100,
        fontSize: 20,
      });
    }
  }, [book.barcode]);

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

      <Card className="print-area p-8 text-center">
        <div className="print-title text-lg font-semibold text-gray-900 mb-4">{book.title}</div>
        <svg ref={svgRef}></svg>
      </Card>

      <style jsx global>{`
        @media print {
          @page {
            size: 50mm 30mm;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            inset: 0;
            width: 50mm;
            height: 30mm;
            margin: 0;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 0;
            box-shadow: none;
            overflow: hidden;
          }
          .print-area .print-title {
            font-size: 8px;
            margin-bottom: 1mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 46mm;
          }
          .print-area svg {
            width: 46mm !important;
            height: auto !important;
            max-height: 20mm;
          }
        }
      `}</style>
    </div>
  );
}
