import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Plus, Printer, ArrowRight, Search, ChevronRight, ChevronLeft } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { searchBooks, listBrands } from "../../lib/bookCatalog";
import { Card } from "../../components/ui/Card";

const PAGE_SIZE = 50;

export async function getServerSideProps({ query }) {
  const q = (query.q || "").trim();
  const brand = (query.brand || "").trim();
  const supplierId = query.supplierId ? Number(query.supplierId) : null;
  const stock = query.stock || ""; // "in" | "out" | ""
  const page = Math.max(1, Number(query.page) || 1);

  const [{ books, total, totalPages }, brands, suppliers] = await Promise.all([
    searchBooks({ q, brand, supplierId, stock, page, pageSize: PAGE_SIZE }),
    listBrands(),
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const data = books.map((b) => ({
    id: b.id,
    barcode: b.barcode,
    title: b.title,
    imageUrl: b.imageUrl,
    brandName: b.brandName,
    totalQty: b.totalQty,
  }));

  return {
    props: { books: data, total, totalPages, page, q, brand, supplierId, stock, brands, suppliers },
  };
}

export default function BooksIndex({
  books,
  total,
  totalPages,
  page,
  q,
  brand,
  supplierId,
  stock,
  brands,
  suppliers,
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const debounceRef = useRef(null);

  useEffect(() => setQuery(q), [q]);

  function pushQuery(next) {
    const merged = {
      q: query || undefined,
      brand: brand || undefined,
      supplierId: supplierId || undefined,
      stock: stock || undefined,
      page: undefined, // أي تغيير فلتر يرجع لصفحة 1
      ...next,
    };
    Object.keys(merged).forEach((k) => merged[k] === undefined && delete merged[k]);
    router.push({ pathname: "/books", query: merged }, undefined, { shallow: false });
  }

  function onSearchChange(value) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushQuery({ q: value || undefined }), 300);
  }

  return (
    <div>
      <Link href="/shelves" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للرفوف
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الكتب</h1>
        <div className="flex items-center gap-2">
          <Link
            href={{
              pathname: "/books/print",
              query: { q: q || undefined, brand: brand || undefined, supplierId: supplierId || undefined, stock: stock || undefined },
            }}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            <Printer size={16} />
            طباعة الباركودات
          </Link>
          <Link
            href="/books/new"
            className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} />
            إضافة كتاب
          </Link>
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ابحث بالعنوان أو الباركود..."
          className="w-full border border-gray-200 rounded-lg pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={brand}
          onChange={(e) => pushQuery({ brand: e.target.value || undefined })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">كل الماركات</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={supplierId || ""}
          onChange={(e) => pushQuery({ supplierId: e.target.value || undefined })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">كل الموردين</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={stock}
          onChange={(e) => pushQuery({ stock: e.target.value || undefined })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">كل حالات المخزون</option>
          <option value="in">فيه مخزون</option>
          <option value="out">نافذ المخزون</option>
        </select>
        {(brand || supplierId || stock || q) && (
          <button
            onClick={() => {
              setQuery("");
              router.push({ pathname: "/books" });
            }}
            className="text-sm text-gray-500 hover:text-gray-800 px-2"
          >
            مسح الفلاتر
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-3">
        {total} كتاب — صفحة {page} من {totalPages}
      </p>

      <Card className="divide-y divide-gray-100 mb-4">
        {books.map((book) => (
          <div key={book.id} className="p-4 flex justify-between items-center">
            <Link href={`/books/${book.id}`} className="flex items-center gap-3 min-w-0 hover:opacity-80">
              {book.imageUrl ? (
                <img
                  src={book.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover shrink-0 border border-gray-100"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gray-50 border border-gray-100 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{book.title}</div>
                <div className="text-sm text-gray-400">
                  {book.barcode}
                  {book.brandName && <span className="text-gray-400"> — {book.brandName}</span>}
                </div>
              </div>
            </Link>
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
          <div className="p-4 text-gray-400">لا نتائج مطابقة للفلاتر الحالية.</div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => pushQuery({ page: page - 1 > 1 ? page - 1 : undefined })}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 text-sm text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
            السابق
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => pushQuery({ page: page + 1 })}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 text-sm text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            التالي
            <ChevronLeft size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
