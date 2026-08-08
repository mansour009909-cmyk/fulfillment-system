import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, ScanLine, Plus, Printer, Trash2, ArrowLeftRight, X } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps({ params }) {
  const shelfId = Number(params.id);
  const [shelf, otherShelves] = await Promise.all([
    prisma.shelf.findUnique({
      where: { id: shelfId },
      include: { stock: { where: { ownership: "SHARED", clientId: null }, include: { book: true } } },
    }),
    prisma.shelf.findMany({
      where: { id: { not: shelfId } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, barcode: true },
    }),
  ]);

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
      otherShelves,
    },
  };
}

export default function ShelfDetail({ shelf, otherShelves }) {
  const router = useRouter();
  const [stock, setStock] = useState(shelf.stock);
  const [scanInput, setScanInput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [transferBookId, setTransferBookId] = useState(null);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferError, setTransferError] = useState(null);
  const [transferSaving, setTransferSaving] = useState(false);
  const inputRef = useRef(null);

  async function handleDelete() {
    if (!window.confirm(`متأكد تبي تحذف رف "${shelf.name}"؟ ما يمكن التراجع.`)) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/shelves/${shelf.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/shelves");
      return;
    }

    const data = await res.json();
    if (data.hasStock) {
      const typed = window.prompt(
        `الرف فيه مخزون. لتأكيد الحذف بالقوة (يُفقد تتبّع الكمية بالنظام)، اكتب باركود الرف بالضبط: ${shelf.barcode}`
      );
      if (typed === shelf.barcode) {
        const res2 = await fetch(`/api/shelves/${shelf.id}?force=true`, { method: "DELETE" });
        if (res2.ok) {
          router.push("/shelves");
          return;
        }
        const data2 = await res2.json();
        setDeleteError(data2.error || "حدث خطأ");
      }
      setDeleting(false);
      return;
    }

    setDeleteError(data.error || "حدث خطأ");
    setDeleting(false);
  }

  async function handleRemoveBook(bookId, title) {
    if (!window.confirm(`إزالة "${title}" من هذا الرف؟`)) return;
    const res = await fetch(`/api/shelves/${shelf.id}/stock/${bookId}`, { method: "DELETE" });
    if (res.ok) {
      setStock((prev) => prev.filter((s) => s.bookId !== bookId));
    }
  }

  function openTransfer(bookId) {
    setTransferBookId(bookId);
    setTransferTarget("");
    setTransferQty("");
    setTransferError(null);
  }

  async function handleTransfer(bookId) {
    setTransferError(null);
    if (!transferTarget) {
      setTransferError("اختر الرف الهدف");
      return;
    }
    setTransferSaving(true);
    const res = await fetch(`/api/shelves/${shelf.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, toShelfId: Number(transferTarget), quantity: transferQty }),
    });
    const data = await res.json();
    setTransferSaving(false);
    if (!res.ok) {
      setTransferError(data.error || "حدث خطأ");
      return;
    }
    setStock((prev) =>
      prev
        .map((s) => (s.bookId === bookId ? { ...s, quantity: s.quantity - Number(transferQty) } : s))
        .filter((s) => s.quantity > 0)
    );
    setTransferBookId(null);
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
          <div key={s.bookId} className="p-4">
            <div className="flex justify-between items-center">
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
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-lg font-semibold text-gray-900">{s.quantity}</div>
                <Link
                  href={`/books/${s.bookId}/barcode`}
                  className="inline-flex items-center gap-1 text-sm text-blue-600"
                  title="طباعة"
                >
                  <Printer size={14} />
                </Link>
                <button
                  onClick={() => openTransfer(s.bookId)}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
                  title="نقل لرف آخر"
                >
                  <ArrowLeftRight size={14} />
                </button>
                <button
                  onClick={() => handleRemoveBook(s.bookId, s.book.title)}
                  className="inline-flex items-center gap-1 text-sm text-red-600"
                  title="إزالة من الرف"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {transferBookId === s.bookId && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg flex flex-wrap items-center gap-2">
                <select
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">اختر الرف الهدف...</option>
                  {otherShelves.map((os) => (
                    <option key={os.id} value={os.id}>
                      {os.name} ({os.barcode})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max={s.quantity}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  placeholder={`الكمية (أقصى ${s.quantity})`}
                  className="w-40 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => handleTransfer(s.bookId)}
                  disabled={transferSaving}
                  className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {transferSaving ? "جاري النقل..." : "نقل"}
                </button>
                <button
                  onClick={() => setTransferBookId(null)}
                  className="text-sm text-gray-500"
                >
                  إلغاء
                </button>
                {transferError && <p className="text-red-600 text-xs w-full">{transferError}</p>}
              </div>
            )}
          </div>
        ))}
        {stock.length === 0 && (
          <div className="p-4 text-gray-400">لا توجد كتب في هذا الرف بعد.</div>
        )}
      </Card>
    </div>
  );
}
