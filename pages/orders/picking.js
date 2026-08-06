import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ScanLine, Check, ArrowLeft } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps() {
  const pendingOrders = await prisma.order.findMany({
    where: { status: "PENDING_REVIEW" },
    include: { items: { include: { book: true } } },
    orderBy: { createdAt: "asc" },
  });

  const neededMap = new Map();
  for (const order of pendingOrders) {
    for (const item of order.items) {
      const remaining = item.quantityRequired - item.quantityPicked;
      if (remaining <= 0) continue;
      const entry = neededMap.get(item.bookId) || { book: item.book, remaining: 0 };
      entry.remaining += remaining;
      neededMap.set(item.bookId, entry);
    }
  }

  // مخزون مشترك فقط — مخزون المورد بغرض البيع (قسم 7.2) مستبعَد عمدًا، يُباع بالجملة بمسار منفصل
  const bookIds = [...neededMap.keys()];
  const shelfStocks = bookIds.length
    ? await prisma.shelfStock.findMany({
        where: { bookId: { in: bookIds }, ownership: "SHARED", clientId: null },
        include: { shelf: true },
      })
    : [];

  const shelvesMap = new Map();
  const stockedBookIds = new Set();
  for (const stock of shelfStocks) {
    const needed = neededMap.get(stock.bookId);
    if (!needed) continue;
    stockedBookIds.add(stock.bookId);
    const entry = shelvesMap.get(stock.shelfId) || { shelf: stock.shelf, rows: [] };
    entry.rows.push({
      bookId: stock.bookId,
      barcode: needed.book.barcode,
      title: needed.book.title,
      remaining: needed.remaining,
      available: stock.quantity,
    });
    shelvesMap.set(stock.shelfId, entry);
  }

  const pickList = [...shelvesMap.values()]
    .sort((a, b) => a.shelf.sortOrder - b.shelf.sortOrder)
    .map((g) => ({
      shelfId: g.shelf.id,
      shelfName: g.shelf.name,
      sortOrder: g.shelf.sortOrder,
      rows: g.rows,
    }));

  const outOfStock = [...neededMap.entries()]
    .filter(([bookId]) => !stockedBookIds.has(bookId))
    .map(([, v]) => ({ title: v.book.title, remaining: v.remaining }));

  return { props: { pickList, outOfStock, batchSize: pendingOrders.length } };
}

export default function Picking({ pickList: initialPickList, outOfStock, batchSize }) {
  const [pickList, setPickList] = useState(initialPickList);
  const [shelfIndex, setShelfIndex] = useState(0);
  const [scanInput, setScanInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [shelfIndex]);

  const currentShelf = pickList[shelfIndex];
  const shelfDone = currentShelf && currentShelf.rows.every((r) => r.remaining <= 0);
  const allDone = shelfIndex >= pickList.length;

  async function handleScan(e) {
    e.preventDefault();
    const barcode = scanInput.trim();
    if (!barcode) return;
    setScanInput("");
    setError(null);
    setResult(null);

    const res = await fetch("/api/orders/pick-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      if (data.book && data.remainingForBook !== undefined) {
        setPickList((prev) =>
          prev.map((group) => ({
            ...group,
            rows: group.rows.map((row) =>
              row.barcode === data.book.barcode ? { ...row, remaining: data.remainingForBook } : row
            ),
          }))
        );
      }
      inputRef.current?.focus();
      return;
    }

    setResult(data);
    setPickList((prev) =>
      prev.map((group) => ({
        ...group,
        rows: group.rows.map((row) =>
          row.barcode === data.book.barcode
            ? {
                ...row,
                remaining: data.remainingForBook,
                available: group.shelfId === data.shelfId ? data.shelfQuantity : row.available,
              }
            : row
        ),
      }))
    );
    inputRef.current?.focus();
  }

  return (
    <div className="max-w-3xl">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للطلبات
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">مسار اللقط حسب الرفوف</h1>
      <p className="text-gray-500 mb-6">التقط الكتب رفًا بعد رف وفق أولوية الرفوف — دفعة {batchSize} طلب</p>

      {pickList.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto">
          {pickList.map((group, i) => (
            <div
              key={group.shelfId}
              className={`shrink-0 px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${
                i === shelfIndex
                  ? "bg-blue-600 text-white border-blue-600"
                  : i < shelfIndex
                  ? "bg-green-50 text-green-700 border-green-100"
                  : "bg-white text-gray-500 border-gray-200"
              }`}
            >
              {i < shelfIndex && <Check size={14} />}
              الرف {group.shelfName}
            </div>
          ))}
        </div>
      )}

      {outOfStock.length > 0 && (
        <Card className="p-4 mb-6 bg-red-50 border-red-100">
          <div className="font-medium text-red-700 mb-2">كتب غير متوفرة بأي رف حاليًا</div>
          <ul className="text-sm text-red-600 space-y-1">
            {outOfStock.map((b) => (
              <li key={b.title}>
                {b.title} — مطلوب {b.remaining} نسخة
              </li>
            ))}
          </ul>
        </Card>
      )}

      {currentShelf && (
        <>
          <Card className="p-5 mb-6">
            <form onSubmit={handleScan}>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <ScanLine size={16} />
                امسح باركود الكتاب — الرف الحالي: {currentShelf.shelfName}
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
              {result && !error && (
                <p className="text-green-600 text-sm mt-2">
                  {result.book.title} — ضعه في صندوق الطلب #{result.orderNumber} ({result.quantityPicked}/
                  {result.quantityRequired})
                </p>
              )}
            </form>
          </Card>

          <Card className="p-4 mb-6">
            <div className="font-semibold text-gray-900 mb-3">
              الرف {currentShelf.shelfName} — ترتيب اللقط: {currentShelf.sortOrder}
            </div>
            <div className="divide-y divide-gray-100">
              {currentShelf.rows.map((row) => (
                <div key={row.bookId} className="py-2 flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    {row.remaining <= 0 && <Check size={16} className="text-green-600" />}
                    <div>
                      <div className={row.remaining <= 0 ? "text-gray-400 line-through" : "text-gray-900"}>
                        {row.title}
                      </div>
                      <div className="text-gray-400">{row.barcode}</div>
                    </div>
                  </div>
                  <div className={row.remaining <= 0 ? "text-green-600" : "text-gray-600"}>
                    {row.remaining <= 0 ? "مكتمل" : `مطلوب ${row.remaining} — متاح ${row.available}`}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {shelfDone && (
            <button
              onClick={() => setShelfIndex((i) => i + 1)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700"
            >
              الرف مكتمل — الانتقال للرف التالي
              <ArrowLeft size={16} />
            </button>
          )}
        </>
      )}

      {(allDone || pickList.length === 0) && outOfStock.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          {pickList.length === 0
            ? "لا توجد كتب بانتظار اللقط حاليًا — كل الطلبات إما مُلقطة بالكامل أو بحالة قيد التنفيذ."
            : "اكتملت عملية اللقط لهذه الدفعة. تقدر الآن تنتقل للتحقق من كل طلب من صفحة الطلبات."}
        </Card>
      )}
    </div>
  );
}
