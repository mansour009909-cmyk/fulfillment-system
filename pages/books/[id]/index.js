import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, Printer, Package, Trash2 } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";

export async function getServerSideProps({ params }) {
  const book = await prisma.book.findUnique({
    where: { id: Number(params.id) },
    include: {
      supplier: true,
      shelfStock: { include: { shelf: true } },
    },
  });
  if (!book) return { notFound: true };

  const sharedStock = book.shelfStock.filter((s) => s.ownership === "SHARED" && !s.clientId);
  const supplierStock = book.shelfStock.filter((s) => s.ownership === "SUPPLIER");

  return {
    props: {
      book: {
        id: book.id,
        barcode: book.barcode,
        title: book.title,
        imageUrl: book.imageUrl,
        brandName: book.brandName,
        brandImageUrl: book.brandImageUrl,
        price: book.price,
        costPrice: book.costPrice,
        supplierName: book.supplier?.name || null,
        supplierId: book.supplierId,
        totalQty: sharedStock.reduce((sum, s) => sum + s.quantity, 0),
        stockByShelf: sharedStock.map((s) => ({
          shelfId: s.shelfId,
          shelfName: s.shelf.name,
          quantity: s.quantity,
        })),
        supplierOwnedQty: supplierStock.reduce((sum, s) => sum + s.quantity, 0),
      },
    },
  };
}

export default function BookDetail({ book }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function handleDelete() {
    if (!window.confirm(`متأكد تبي تحذف "${book.title}" نهائيًا من الكتالوج؟ ما يمكن التراجع.`)) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/books/${book.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error || "حدث خطأ");
      setDeleting(false);
      return;
    }
    router.push("/books");
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/books" className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للكتب
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-1 text-sm text-red-600 disabled:opacity-50"
        >
          <Trash2 size={14} />
          {deleting ? "جاري الحذف..." : "حذف الكتاب"}
        </button>
      </div>
      {deleteError && <p className="text-red-600 text-sm mb-4">{deleteError}</p>}

      <Card className="p-6 mb-6">
        <div className="flex items-start gap-5">
          {book.imageUrl ? (
            <img
              src={book.imageUrl}
              alt=""
              className="h-32 w-32 rounded-xl object-cover border border-gray-100 shrink-0"
            />
          ) : (
            <div className="h-32 w-32 rounded-xl bg-gray-50 border border-gray-100 shrink-0 flex items-center justify-center">
              <Package size={32} className="text-gray-300" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{book.title}</h1>
            <p className="text-sm text-gray-400 mb-3">{book.barcode}</p>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {book.brandName && (
                <span className="inline-flex items-center gap-1.5">
                  {book.brandImageUrl && (
                    <img src={book.brandImageUrl} alt="" className="h-5 w-5 rounded object-contain" />
                  )}
                  <Badge variant="info">{book.brandName}</Badge>
                </span>
              )}
              {book.supplierName && (
                <Link href={`/suppliers/${book.supplierId}`}>
                  <Badge variant="neutral">المورد: {book.supplierName}</Badge>
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">سعر البيع</div>
                <div className="text-lg font-semibold text-gray-900">
                  {book.price != null ? `${book.price.toFixed(2)} ر.س` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">سعر التكلفة</div>
                <div className="text-lg font-semibold text-gray-900">
                  {book.costPrice != null ? `${book.costPrice.toFixed(2)} ر.س` : "—"}
                </div>
              </div>
            </div>
            <Link
              href={`/books/${book.id}/barcode`}
              className="inline-flex items-center gap-1 text-sm text-blue-600"
            >
              <Printer size={14} />
              طباعة الباركود
            </Link>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-gray-900">المخزون بالرفوف</h2>
        <span className="text-sm text-gray-500">الإجمالي: {book.totalQty} نسخة</span>
      </div>
      <Card className="overflow-hidden mb-6">
        {book.stockByShelf.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {book.stockByShelf.map((s) => (
              <Link
                key={s.shelfId}
                href={`/shelves/${s.shelfId}`}
                className="p-4 flex justify-between items-center hover:bg-gray-50"
              >
                <span className="text-gray-800">{s.shelfName}</span>
                <span className="font-medium text-gray-900">{s.quantity} نسخة</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400 text-sm">لا يوجد مخزون مشترك لهذا الكتاب بأي رف حاليًا.</div>
        )}
      </Card>

      {book.supplierOwnedQty > 0 && (
        <div className="text-sm text-gray-500">
          + {book.supplierOwnedQty} نسخة مخزون خاص بالمورد (تخزين بغرض البيع بالجملة — منفصل عن هذا المخزون).
        </div>
      )}
    </div>
  );
}
