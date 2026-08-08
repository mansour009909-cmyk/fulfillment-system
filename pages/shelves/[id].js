import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, ScanLine, Plus, Printer, Trash2 } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps({ params }) {
  const shelf = await prisma.shelf.findUnique({
    where: { id: Number(params.id) },
    include: { stock: { include: { book: true } } },
  });

  if (!shelf) return { notFound: true };

  return {
    props: {
      shelf: {
        ...shelf,
        createdAt: shelf.createdAt.toISOString(),
        stock: shelf.stock.map((s) => ({
          ...s,
          updatedAt: s.updatedAt.toISOString(),
          book: { ...s.book, createdAt: s.book.createdAt.toISOString() },
        })),
      },
    },
  };
}

export default function ShelfDetail({ shelf }) {
  const router = useRouter();
  const [stock, setStock] = useState(shelf.stock);
  const [scanInput, setScanInput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const inputRef = useRef(null);

  async function handleDelete() {
    if (!window.confirm(`متأكد تبي تحذف رف "${shelf.name}"؟ ما يمكن التراجع.`)) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/shelves/${shelf.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error || "حدث خطأ");
      setDeleting(false);
      return;
    }
    router.push("/shelves");
  }

  const [manualBarcode, setManualBarcode] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualQty, setManualQty] = useState("");
  const [manualError, setManualError] = useState(null);
  const [manualResult, setManualResult] = useState(null);
  const [manualSaving, setManualSaving] = useState(false);

  function mergeStock(data) {
    setStock((prev) => {
      const exists = prev.find((s) => s.bookId === data.bookId);
      if (exists) {
        return prev.map((s) =>
          s.bookId === data.bookId ? { ...s, quantity: data.quantity } : s
        );
      }
      return [...prev, { bookId: data.bookId, book: data.book, quantity: data.quantity }];
    });
  }

  async function handleManualAdd(e) {
    e.preventDefault();
    setManualError(null);
    setManualResult(null);
    setManualSaving(true);

    const res = await fetch(`/api/shelves/${shelf.id}/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: manualBarcode, title: manualTitle, quantity: manualQty }),
    });
    const data = await res.json();
    setManualSaving(false);

    if (!res.ok) {
      setManualError(data.error || "حدث خطأ");
      return;
    }

    setManualResult(data);
    mergeStock(data);
    setManualBarcode("");
    setManualTitle("");
    setManualQty("");
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleScan(e) {
    e.preventDefault();
    const barcode = scanInput.trim();
    if (!barcode) return;
    setScanInput("");
    setError(null);

    const res = await fetch(`/api/shelves/${shelf.id}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      inputRef.current?.focus();
      return;
    }

    setLastResult(data);
    mergeStock(data);
    inputRef.current?.focus();
  }

  return (
    <div className="max-w-2xl">
      <Link href="/shelves" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للرفوف
      </Link>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{shelf.name}</h1>
          <p className="text-gray-500">باركود الرف: {shelf.barcode}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/shelves/${shelf.id}/barcode`}
            className="inline-flex items-center gap-1 text-sm text-blue-600 whitespace-nowrap"
          >
            <Printer size={14} />
            طباعة باركود الرف
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1 text-sm text-red-600 whitespace-nowrap disabled:opacity-50"
          >
            <Trash2 size={14} />
            {deleting ? "جاري الحذف..." : "حذف الرف"}
          </button>
        </div>
      </div>
      {deleteError && <p className="text-red-600 text-sm mb-4">{deleteError}</p>}

      <Card className="p-5 mb-6">
        <form onSubmit={handleScan}>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <ScanLine size={16} />
            امسح باركود الكتاب لتحديث الكمية
          </label>
          <input
            ref={inputRef}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="امسح أو اكتب الباركود..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          {lastResult && !error && (
            <p className="text-green-600 text-sm mt-2">
              تم: {lastResult.book.title} — الكمية الجديدة: {lastResult.quantity}
            </p>
          )}
        </form>
      </Card>

      <Card className="p-5 mb-6">
        <form onSubmit={handleManualAdd} className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Plus size={16} />
            إضافة كتاب يدويًا (بكمية مباشرة)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="باركود الكتاب"
              className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="العنوان (لو كتاب جديد)"
              className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              min="1"
              value={manualQty}
              onChange={(e) => setManualQty(e.target.value)}
              placeholder="الكمية"
              className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {manualError && <p className="text-red-600 text-sm">{manualError}</p>}
          {manualResult && !manualError && (
            <p className="text-green-600 text-sm">
              تم: {manualResult.book.title} — الكمية الجديدة: {manualResult.quantity}
            </p>
          )}
          <button
            type="submit"
            disabled={manualSaving}
            className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
          >
            {manualSaving ? "جاري الحفظ..." : "إضافة"}
          </button>
        </form>
      </Card>

      <Card className="divide-y divide-gray-100">
        {stock.map((s) => (
          <div key={s.bookId} className="p-4 flex justify-between items-center">
            <Link href={`/books/${s.bookId}`} className="flex items-center gap-3 min-w-0 hover:opacity-80">
              {s.book.imageUrl ? (
                <img
                  src={s.book.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover shrink-0 border border-gray-100"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gray-50 border border-gray-100 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{s.book.title}</div>
                <div className="text-sm text-gray-400">
                  {s.book.barcode}
                  {s.book.brandName && <span> — {s.book.brandName}</span>}
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-gray-900">{s.quantity}</div>
              <Link
                href={`/books/${s.bookId}/barcode`}
                className="inline-flex items-center gap-1 text-sm text-blue-600"
              >
                <Printer size={14} />
                طباعة
              </Link>
            </div>
          </div>
        ))}
        {stock.length === 0 && (
          <div className="p-4 text-gray-400">لا توجد كتب في هذا الرف بعد.</div>
        )}
      </Card>
    </div>
  );
}
