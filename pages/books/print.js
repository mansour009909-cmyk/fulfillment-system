import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { searchBooks } from "../../lib/bookCatalog";
import { BarcodeLabelSheet } from "../../components/BarcodeLabelSheet";

// يطبع باركود كل الكتب المطابقة لنفس فلاتر /books الحالية (q, brand, supplierId, stock)
export async function getServerSideProps({ query }) {
  const q = (query.q || "").trim();
  const brand = (query.brand || "").trim();
  const supplierId = query.supplierId ? Number(query.supplierId) : null;
  const stock = query.stock || "";

  const { books } = await searchBooks({ q, brand, supplierId, stock, pageSize: 10000 });

  return {
    props: {
      books: books.map((b) => ({ id: b.id, barcode: b.barcode, title: b.title })),
      filtered: Boolean(q || brand || supplierId || stock),
    },
  };
}

export default function PrintBooks({ books, filtered }) {
  const items = books.map((b) => ({ id: b.id, code: b.barcode, title: b.title }));

  return (
    <div className="max-w-md">
      <div className="print:hidden mb-6">
        <Link href="/books" className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للكتب
        </Link>
        <p className="text-sm text-gray-500 my-3">
          {books.length} ملصق{filtered ? " (حسب الفلاتر الحالية بصفحة الكتب)" : " (كل الكتب)"} — صفحة طباعة
          100×150مم، عدة ملصقات بكل صفحة.
        </p>
        {books.length > 300 && (
          <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm mb-3">
            عدد كبير من الملصقات ({books.length}) — تأكد إنك تبيها كلها، أو ضيّق الفلاتر بصفحة الكتب أولًا.
          </p>
        )}
        <button
          onClick={() => window.print()}
          disabled={books.length === 0}
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Printer size={16} />
          طباعة كل الملصقات ({books.length})
        </button>
      </div>

      <BarcodeLabelSheet items={items} />
    </div>
  );
}
