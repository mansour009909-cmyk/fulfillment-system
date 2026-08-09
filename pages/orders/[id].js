import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, ScanLine, Undo2 } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { ZoomableImage } from "../../components/ui/ZoomableImage";

const STATUS_LABEL = {
  PENDING_REVIEW: { label: "بانتظار المراجعة", variant: "info" },
  IN_REVIEW: { label: "قيد التنفيذ", variant: "warning" },
  FULFILLED: { label: "تم التنفيذ", variant: "success" },
};

const SHIPPING_LABEL = {
  NOT_SHIPPED: { label: "لم يُشحن بعد", variant: "neutral" },
  SHIPPED: { label: "تم الشحن", variant: "info" },
  DELIVERED: { label: "تم التسليم", variant: "success" },
  RETURNED: { label: "مرتجع", variant: "danger" },
};

export async function getServerSideProps({ params }) {
  const order = await prisma.order.findUnique({
    where: { id: Number(params.id) },
    include: { client: true, items: { include: { book: true } }, fulfilledByEmployee: true },
  });
  if (!order) return { notFound: true };

  return {
    props: {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        size: order.size,
        boxNumber: order.boxNumber,
        boxScanned: order.boxScanned,
        clientName: order.client.name,
        createdAt: order.createdAt.toISOString(),
        fulfilledByEmployeeName: order.fulfilledByEmployee?.name || null,
        shippingStatus: order.shippingStatus,
        carrierName: order.carrierName,
        trackingNumber: order.trackingNumber,
        items: order.items.map((i) => ({
          bookId: i.bookId,
          title: i.book.title,
          barcode: i.book.barcode,
          imageUrl: i.book.imageUrl,
          brandName: i.book.brandName,
          brandImageUrl: i.book.brandImageUrl,
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
  const [boxNumber, setBoxNumber] = useState(order.boxNumber);
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

  const [markingInReview, setMarkingInReview] = useState(false);
  const [markError, setMarkError] = useState(null);

  const [shippingStatus, setShippingStatus] = useState(order.shippingStatus);
  const [carrierName, setCarrierName] = useState(order.carrierName || "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingSaved, setShippingSaved] = useState(false);
  const [shippingError, setShippingError] = useState(null);

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
    if (data.boxNumber) setBoxNumber(data.boxNumber);
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

  async function handleMarkInReview() {
    setMarkingInReview(true);
    setMarkError(null);
    const res = await fetch(`/api/orders/${order.id}/mark-in-review`, { method: "POST" });
    const data = await res.json();
    setMarkingInReview(false);
    if (!res.ok) {
      setMarkError(data.error || "حدث خطأ");
      return;
    }
    setStatus("IN_REVIEW");
  }

  async function handleSaveShipping() {
    setSavingShipping(true);
    setShippingError(null);
    setShippingSaved(false);
    const res = await fetch(`/api/orders/${order.id}/shipping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shippingStatus, carrierName, trackingNumber }),
    });
    const data = await res.json();
    setSavingShipping(false);
    if (!res.ok) {
      setShippingError(data.error || "حدث خطأ");
      return;
    }
    setShippingSaved(true);
  }

  const st = STATUS_LABEL[status];

  return (
    <div className="max-w-2xl">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للطلبات
      </Link>

      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">#{order.orderNumber}</h1>
            <Badge variant={st.variant}>{st.label}</Badge>
            {boxNumber && <Badge variant="info">صندوق رقم {boxNumber}</Badge>}
          </div>
          {status === "PENDING_REVIEW" && (
            <button
              onClick={handleMarkInReview}
              disabled={markingInReview}
              className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 hover:bg-amber-100 disabled:opacity-50"
            >
              {markingInReview ? "جاري التحويل..." : "تحويل لقيد التنفيذ (نقص مخزون)"}
            </button>
          )}
        </div>
        <p className="text-gray-500">{order.clientName}</p>
        {markError && <p className="text-red-600 text-sm mt-1">{markError}</p>}
        {order.fulfilledByEmployeeName && (
          <p className="text-xs text-gray-400 mt-1">جهّزه: {order.fulfilledByEmployeeName}</p>
        )}
      </div>

      {!boxScanned && status !== "FULFILLED" && (
        <Card className="p-5 mb-6">
          <form onSubmit={handleBoxScan}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <ScanLine size={16} />
              {boxNumber
                ? `امسح باركود الصندوق رقم ${boxNumber} قبل البدء بالتحقق`
                : "امسح باركود الصندوق الفعلي قبل البدء بالتحقق"}
            </label>
            <input
              ref={boxRef}
              value={boxInput}
              onChange={(e) => setBoxInput(e.target.value)}
              placeholder="امسح أو اكتب باركود الصندوق (BOX-01)..."
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
          <div
            key={item.bookId}
            onClick={() => router.push(`/books/${item.bookId}`)}
            className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
          >
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
                <div className="text-sm text-gray-400 truncate flex items-center gap-1.5">
                  {item.barcode}
                  {item.brandName && <span> — {item.brandName}</span>}
                  {item.brandImageUrl && (
                    <ZoomableImage
                      src={item.brandImageUrl}
                      alt={item.brandName}
                      className="h-5 w-5 rounded object-contain shrink-0"
                    />
                  )}
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
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-medium text-gray-900">الشحن</div>
            <Badge variant={SHIPPING_LABEL[shippingStatus].variant}>{SHIPPING_LABEL[shippingStatus].label}</Badge>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            تتبّع يدوي فقط (بدون تكامل فعلي مع شركة شحن حاليًا) — لتسجيل حالة الشحنة وبياناتها للمرجعية.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">شركة الشحن</label>
              <input
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">رقم البوليصة</label>
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">حالة الشحنة</label>
            <select
              value={shippingStatus}
              onChange={(e) => setShippingStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(SHIPPING_LABEL).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {shippingError && <p className="text-red-600 text-sm mb-3">{shippingError}</p>}
          {shippingSaved && <p className="text-green-600 text-sm mb-3">تم الحفظ بنجاح.</p>}
          <button
            onClick={handleSaveShipping}
            disabled={savingShipping}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {savingShipping ? "جاري الحفظ..." : "حفظ بيانات الشحن"}
          </button>
        </Card>
      )}
    </div>
  );
}
