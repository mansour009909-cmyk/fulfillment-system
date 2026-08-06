import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, Printer, ScanLine, Undo2 } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

const STATUS_LABEL = {
  PENDING_REVIEW: { label: "بانتظار المراجعة", variant: "info" },
  IN_REVIEW: { label: "قيد التنفيذ", variant: "warning" },
  FULFILLED: { label: "تم التنفيذ", variant: "success" },
};

export async function getServerSideProps({ params }) {
  const order = await prisma.order.findUnique({
    where: { id: Number(params.id) },
    include: { client: true, items: { include: { book: true } } },
  });
  if (!order) return { notFound: true };

  return {
    props: {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        size: order.size,
        boxScanned: order.boxScanned,
        clientName: order.client.name,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((i) => ({
          bookId: i.bookId,
          title: i.book.title,
          barcode: i.book.barcode,
          imageUrl: i.book.imageUrl,
          brandName: i.book.brandName,
          quantityRequired: i.quantityRequired,
          quantityVerified: i.quantityVerified,
        })),
      },
    },
  };
}

export default function OrderDetail({ order }) {
  const router = useRouter();
  const [boxScanned, setBoxScanned] = useState(order.boxScanned);
  const [status, setStatus] = useState(order.status);
  const [items, setItems] = useState(order.items);

  const [boxInput, setBoxInput] = useState("");
  const [boxError, setBoxError] = useState(null);
  const boxRef = useRef(null);

  const [bookInput, setBookInput] = useState("");
  const [bookError, setBookError] = useState(null);
  const [excessBook, setExcessBook] = useState(null);
  const bookRef = useRef(null);

  const [size, setSize] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  useEffect(() => {
    if (!boxScanned) boxRef.current?.focus();
    else bookRef.current?.focus();
  }, [boxScanned]);

  const allVerified = items.every((i) => i.quantityVerified === i.quantityRequired);

  async function handleBoxScan(e) {
    e.preventDefault();
    const barcode = boxInput.trim();
    if (!barcode) return;
    setBoxInput("");
    setBoxError(null);

    const res = await fetch(`/api/orders/${order.id}/box-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });
    const data = await res.json();

    if (!res.ok) {
      setBoxError(data.error || "حدث خطأ");
      return;
    }
    setBoxScanned(true);
  }

  async function handleBookScan(e) {
    e.preventDefault();
    const barcode = bookInput.trim();
    if (!barcode) return;
    setBookInput("");
    setBookError(null);
    setExcessBook(null);

    const res = await fetch(`/api/orders/${order.id}/verify-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });
    const data = await res.json();

    if (!res.ok) {
      setBookError(data.error || "حدث خطأ");
      if (data.excess) setExcessBook(data.book);
      bookRef.current?.focus();
      return;
    }

    setItems(data.items);
    bookRef.current?.focus();
  }

  async function handleUndo(bookId) {
    const res = await fetch(`/api/orders/${order.id}/undo-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.bookId === bookId ? { ...i, quantityVerified: i.quantityVerified - 1 } : i))
      );
      setExcessBook(null);
      setBookError(null);
    }
    bookRef.current?.focus();
  }

  async function handleComplete() {
    setCompleting(true);
    setCompleteError(null);
    const res = await fetch(`/api/orders/${order.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ size }),
    });
    const data = await res.json();
    setCompleting(false);

    if (!res.ok) {
      setCompleteError(data.error || "حدث خطأ");
      return;
    }
    setStatus("FULFILLED");
    router.replace(`/orders/${order.id}`);
  }

  const st = STATUS_LABEL[status];

  return (
    <div className="max-w-2xl">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للطلبات
      </Link>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">#{order.orderNumber}</h1>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
          <p className="text-gray-500">{order.clientName}</p>
        </div>
        <Link
          href={`/orders/${order.id}/barcode`}
          className="inline-flex items-center gap-1 text-sm text-blue-600 whitespace-nowrap"
        >
          <Printer size={14} />
          طباعة باركود الصندوق
        </Link>
      </div>

      {!boxScanned && status !== "FULFILLED" && (
        <Card className="p-5 mb-6">
          <form onSubmit={handleBoxScan}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <ScanLine size={16} />
              امسح باركود الصندوق قبل البدء بالتحقق
            </label>
            <input
              ref={boxRef}
              value={boxInput}
              onChange={(e) => setBoxInput(e.target.value)}
              placeholder="امسح أو اكتب باركود الصندوق..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {boxError && <p className="text-red-600 text-sm mt-2">{boxError}</p>}
          </form>
        </Card>
      )}

      {boxScanned && status !== "FULFILLED" && (
        <Card className="p-5 mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <ScanLine size={16} />
            امسح باركود كل كتاب توضعه بالصندوق
          </label>
          <form onSubmit={handleBookScan}>
            <input
              ref={bookRef}
              value={bookInput}
              onChange={(e) => setBookInput(e.target.value)}
              placeholder="امسح أو اكتب الباركود..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </form>
          {bookError && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-red-700 text-sm mb-2">{bookError}</p>
              {excessBook && (
                <button
                  onClick={() => handleUndo(items.find((i) => i.barcode === excessBook.barcode)?.bookId)}
                  className="inline-flex items-center gap-1 text-sm bg-white border border-red-200 text-red-700 rounded-lg px-3 py-1.5"
                >
                  <Undo2 size={14} />
                  تراجع عن آخر مسح لهذا الكتاب
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      <Card className="divide-y divide-gray-100 mb-6">
        {items.map((item) => (
          <div key={item.bookId} className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3 min-w-0">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover shrink-0 border border-gray-100"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gray-50 border border-gray-100 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{item.title}</div>
                <div className="text-sm text-gray-400 truncate">
                  {item.barcode}
                  {item.brandName && <span> — {item.brandName}</span>}
                </div>
              </div>
            </div>
            <div
              className={`text-lg font-semibold ${
                item.quantityVerified === item.quantityRequired ? "text-green-600" : "text-gray-900"
              }`}
            >
              {item.quantityVerified} / {item.quantityRequired}
            </div>
          </div>
        ))}
      </Card>

      {boxScanned && status !== "FULFILLED" && allVerified && (
        <Card className="p-5">
          <div className="font-medium text-gray-900 mb-3">حجم الطلب (اختياري)</div>
          <div className="flex gap-2 mb-4">
            {[
              { value: "SMALL", label: "صغير" },
              { value: "LARGE", label: "كبير" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSize(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm border ${
                  size === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {completeError && <p className="text-red-600 text-sm mb-3">{completeError}</p>}
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {completing ? "جاري الإكمال..." : "إكمال الطلب"}
          </button>
        </Card>
      )}

      {status === "FULFILLED" && (
        <Card className="p-5 text-center text-green-700 bg-green-50 border-green-100">
          تم تنفيذ هذا الطلب بالكامل.
        </Card>
      )}
    </div>
  );
}
