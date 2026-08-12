import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ScanLine, ListChecks, Trash2 } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps() {
  const tallyRows = await prisma.receivingScan.groupBy({
    by: ["bookId"],
    where: { invoiceId: null },
    _count: { id: true },
  });

  const books = await prisma.book.findMany({
    where: { id: { in: tallyRows.map((t) => t.bookId) } },
  });
  const bookMap = Object.fromEntries(books.map((b) => [b.id, b]));

  const tally = tallyRows.map((t) => ({
    bookId: t.bookId,
    barcode: bookMap[t.bookId].barcode,
    title: bookMap[t.bookId].title,
    quantityScanned: t._count.id,
  }));

  return { props: { tally } };
}

export default function Receiving({ tally: initialTally }) {
  const [tally, setTally] = useState(initialTally);
  const [scanInput, setScanInput] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [deletingBookId, setDeletingBookId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleScan(e) {
    e.preventDefault();
    const barcode = scanInput.trim();
    if (!barcode) return;
    setScanInput("");
    setError(null);

    const res = await fetch("/api/receiving/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode, quantity: Number(quantity) || 1 }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      inputRef.current?.focus();
      return;
    }

    setResult({ ...data.book, quantity: data.quantity });
    setTally(data.tally);
    setQuantity("1");
    inputRef.current?.focus();
  }

  async function handleDelete(row) {
    if (!window.confirm(`متأكد تبي تحذف كل مسحات "${row.title}" (${row.quantityScanned})؟ ما يمكن التراجع.`)) return;
    setDeletingBookId(row.bookId);
    await fetch("/api/receiving/delete-scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: row.bookId }),
    });
    setTally((prev) => prev.filter((t) => t.bookId !== row.bookId));
    setDeletingBookId(null);
  }

  return (
    <div className="max-w-2xl">
      <Link href="/suppliers" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للموردين
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">استلام شحنة</h1>
      <p className="text-gray-500 mb-6">
        امسح باركود كل كتاب وصل فعليًا — بدون تحديد مورد أو فاتورة الآن. المطابقة تصير بالخطوة التالية.
      </p>

      <Card className="p-5 mb-6">
        <form onSubmit={handleScan} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <ScanLine size={16} />
              امسح باركود الكتاب
            </label>
            <input
              ref={inputRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="امسح أو اكتب الباركود..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="w-28">
            <label className="block text-sm font-medium text-gray-700 mb-2">الكمية</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm w-full">{error}</p>}
          {result && !error && (
            <p className="text-green-600 text-sm w-full">
              تم مسح: {result.title} {result.quantity > 1 ? `× ${result.quantity}` : ""}
            </p>
          )}
        </form>
        <p className="text-xs text-gray-400 mt-2">
          لو وصلك كمية كبيرة من نفس الكتاب، غيّر رقم الكمية قبل المسح بدل ما تمسحه نسخة نسخة.
        </p>
      </Card>

      <Card className="divide-y divide-gray-100 mb-6">
        {tally.map((row) => (
          <div key={row.bookId} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-900">{row.title}</div>
              <div className="text-sm text-gray-400">{row.barcode}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold text-gray-900">{row.quantityScanned}</div>
              <button
                onClick={() => handleDelete(row)}
                disabled={deletingBookId === row.bookId}
                title="حذف كل مسحات هذا الكتاب"
                className="text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {tally.length === 0 && (
          <div className="p-8 text-center text-gray-400">لا توجد كتب ممسوحة بانتظار المطابقة حاليًا.</div>
        )}
      </Card>

      {tally.length > 0 && (
        <Link
          href="/receiving/reconcile"
          className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700"
        >
          <ListChecks size={16} />
          عرض الفواتير المرشَّحة للمطابقة
        </Link>
      )}
    </div>
  );
}
