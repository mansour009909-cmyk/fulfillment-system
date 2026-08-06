import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Plus, Printer, ArrowRight, Search } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

const PAGE_SIZE = 50;

export async function getServerSideProps({ query }) {
  const q = (query.q || "").trim();

  const where = q ? { OR: [{ title: { contains: q } }, { barcode: { contains: q } }] } : {};

  const [books, total] = await Promise.all([
    prisma.book.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { shelfStock: true },
      take: PAGE_SIZE,
    }),
    prisma.book.count({ where }),
  ]);

  const data = books.map((b) => ({
    id: b.id,
    barcode: b.barcode,
    title: b.title,
    totalQty: b.shelfStock.reduce((sum, s) => sum + s.quantity, 0),
  }));

  return { props: { books: data, total, q } };
}

export default function BooksIndex({ books, total, q }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const debounceRef = useRef(null);

  useEffect(() => setQuery(q), [q]);

  function onChange(value) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(
        { pathname: "/books", query: value ? { q: value } : {} },
        undefined,
        { shallow: false }
      );
    }, 300);
  }

  return (
    <div>
      <Link href="/shelves" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للرفوف
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الكتب</h1>
        <Link
          href="/books/new"
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          إضافة كتاب
        </Link>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ابحث بالعنوان أو الباركود..."
          className="w-full border border-gray-200 rounded-lg pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <p className="text-sm text-gray-400 mb-3">
        {q ? `${total} نتيجة لـ"${q}"` : `${total} كتاب بالنظام — يعرض أحدث ${PAGE_SIZE}، ابحث لتضييق النتائج`}
      </p>

      <Card className="divide-y divide-gray-100">
        {books.map((book) => (
          <div key={book.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-900">{book.title}</div>
              <div className="text-sm text-gray-400">{book.barcode}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">{book.totalQty} نسخة</div>
              <Link
                href={`/books/${book.id}/barcode`}
                className="inline-flex items-center gap-1 text-sm text-blue-600"
              >
                <Printer size={14} />
                طباعة الباركود
              </Link>
            </div>
          </div>
        ))}
        {books.length === 0 && (
          <div className="p-4 text-gray-400">{q ? "لا نتائج مطابقة." : "لا توجد كتب بعد."}</div>
        )}
      </Card>
    </div>
  );
}
