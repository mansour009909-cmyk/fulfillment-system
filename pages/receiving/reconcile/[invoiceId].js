import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, Check, Pencil, FileText } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";

export async function getServerSideProps({ params }) {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: Number(params.invoiceId) },
    include: { supplier: true, items: { include: { book: true } } },
  });
  if (!invoice) return { notFound: true };

  const items = [];
  for (const item of invoice.items) {
    const availableWhere =
      invoice.status === "APPROVED"
        ? { bookId: item.bookId, invoiceId: invoice.id }
        : { bookId: item.bookId, invoiceId: null };
    const available = await prisma.receivingScan.count({ where: availableWhere });
    items.push({
      bookId: item.bookId,
      barcode: item.book.barcode,
      title: item.book.title,
      quantityExpected: item.quantityExpected,
      price: item.price,
      available,
    });
  }

  const shelves = await prisma.shelf.findMany({ orderBy: { sortOrder: "asc" } });

  // كتب ممسوحة فعليًا (غير مرتبطة بأي فاتورة بعد) لكنها غير مدرجة ببنود هذي الفاتورة —
  // يحتاجها الموظف لإضافة كتاب جديد وصل بنفس الشحنة بس ما كان بالفاتورة الأصلية
  let extraItems = [];
  if (invoice.status !== "APPROVED") {
    const invoiceBookIds = invoice.items.map((i) => i.bookId);
    const unlinkedScans = await prisma.receivingScan.findMany({
      where: { invoiceId: null, bookId: { notIn: invoiceBookIds.length ? invoiceBookIds : [-1] } },
      select: { bookId: true },
    });
    const countByBook = {};
    for (const s of unlinkedScans) countByBook[s.bookId] = (countByBook[s.bookId] || 0) + 1;
    const extraBookIds = Object.keys(countByBook).map(Number);
    if (extraBookIds.length) {
      const extraBooks = await prisma.book.findMany({ where: { id: { in: extraBookIds } } });
      extraItems = extraBooks.map((b) => ({
        bookId: b.id,
        barcode: b.barcode,
        title: b.title,
        scannedCount: countByBook[b.id],
      }));
    }
  }

  return {
    props: {
      invoice: {
        id: invoice.id,
        status: invoice.status,
        type: invoice.type,
        supplierId: invoice.supplierId,
        supplierName: invoice.supplier.name,
        supplierBalance: invoice.supplier.balance,
        createdAt: invoice.createdAt.toISOString(),
        approvedAt: invoice.approvedAt ? invoice.approvedAt.toISOString() : null,
        items,
        extraItems,
      },
      shelves: shelves.map((s) => ({ id: s.id, name: s.name })),
    },
  };
}

function rowStatus(item) {
  if (item.available === item.quantityExpected) return { label: "مطابق", variant: "success" };
  if (item.available > item.quantityExpected) return { label: "فرق (زائد)", variant: "warning" };
  return { label: "ناقص", variant: "danger" };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

export default function ReconcileInvoice({ invoice, shelves }) {
  const router = useRouter();
  const [items, setItems] = useState(invoice.items);
  const [extraItems, setExtraItems] = useState(invoice.extraItems || []);
  const [editValue, setEditValue] = useState({});
  const [savingBookId, setSavingBookId] = useState(null);
  const [addPrice, setAddPrice] = useState({});
  const [addingBookId, setAddingBookId] = useState(null);
  const [addError, setAddError] = useState(null);
  const [shelfId, setShelfId] = useState(shelves[0]?.id || "");
  const [approveError, setApproveError] = useState(null);
  const [approving, setApproving] = useState(false);

  async function adjustItem(bookId, value) {
    if (value === undefined || value === "") return;
    setSavingBookId(bookId);

    await fetch(`/api/receiving/${invoice.id}/adjust-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, quantityExpected: value }),
    });

    setItems((prev) =>
      prev.map((i) => (i.bookId === bookId ? { ...i, quantityExpected: Number(value) } : i))
    );
    setEditValue((prev) => ({ ...prev, [bookId]: undefined }));
    setSavingBookId(null);
  }

  async function addExtraItem(extraItem) {
    setAddError(null);
    const price = addPrice[extraItem.bookId];
    if (price === undefined || price === "") {
      setAddError("لازم تدخل سعر الوحدة قبل الإضافة");
      return;
    }
    setAddingBookId(extraItem.bookId);

    const res = await fetch(`/api/receiving/${invoice.id}/add-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: extraItem.bookId,
        quantityExpected: extraItem.scannedCount,
        price,
      }),
    });
    const data = await res.json();
    setAddingBookId(null);

    if (!res.ok) {
      setAddError(data.error || "حدث خطأ");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        bookId: extraItem.bookId,
        barcode: extraItem.barcode,
        title: extraItem.title,
        quantityExpected: extraItem.scannedCount,
        price: Number(price),
        available: extraItem.scannedCount,
      },
    ]);
    setExtraItems((prev) => prev.filter((e) => e.bookId !== extraItem.bookId));
  }

  async function approve() {
    setApproveError(null);
    setApproving(true);

    const res = await fetch(`/api/receiving/${invoice.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelfId }),
    });
    const data = await res.json();
    setApproving(false);

    if (!res.ok) {
      setApproveError(data.error || "حدث خطأ");
      return;
    }

    router.push(`/suppliers`);
  }

  const allMatched = items.every((i) => i.available === i.quantityExpected);
  const totalQty = items.reduce((sum, i) => sum + i.quantityExpected, 0);
  const grandTotal = items.reduce((sum, i) => sum + i.quantityExpected * i.price, 0);
  const isApproved = invoice.status === "APPROVED";

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-4">
        <Link href="/receiving/reconcile" className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للفواتير المرشَّحة
        </Link>
        <Link
          href={`/suppliers/${invoice.supplierId}/invoices/${invoice.id}/edit`}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50"
        >
          <Pencil size={14} />
          تعديل الفاتورة
        </Link>
      </div>

      {/* بطاقة الفاتورة بأسلوب مستند رسمي */}
      <Card className="p-8 mb-6">
        <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">فاتورة شراء #{invoice.id}</h1>
              <div className="text-xs text-gray-400 mt-0.5">استلام ومطابقة مخزون</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {invoice.type === "CONSIGNMENT" && <Badge variant="info">تخزين بغرض البيع</Badge>}
            <Badge variant={isApproved ? "success" : "neutral"}>{isApproved ? "معتمدة" : "مسودة"}</Badge>
          </div>
        </div>

        {invoice.type === "CONSIGNMENT" && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-6">
            مخزون خاص بالمورد — لا يؤثر على رصيده عند الاستلام؛ التسوية المالية (عمولة أو غيرها) تُدار خارج النظام.
          </p>
        )}

        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <div className="text-gray-400 mb-1">المورد</div>
            <div className="font-medium text-gray-900">{invoice.supplierName}</div>
          </div>
          <div className="text-left">
            <div className="text-gray-400 mb-1">تاريخ الإنشاء</div>
            <div className="font-medium text-gray-900">{formatDate(invoice.createdAt)}</div>
            {isApproved && invoice.approvedAt && (
              <>
                <div className="text-gray-400 mb-1 mt-2">تاريخ الاعتماد</div>
                <div className="font-medium text-gray-900">{formatDate(invoice.approvedAt)}</div>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-4 py-3 text-right border-b border-gray-200">البند</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">سعر الوحدة</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">الكمية المتوقعة</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">
                  {isApproved ? "المستلم" : "الممسوح المتاح"}
                </th>
                <th className="px-4 py-3 text-center border-b border-gray-200">المجموع</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">الحالة</th>
                {!isApproved && <th className="px-4 py-3 text-center border-b border-gray-200">تعديل المتوقع</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const st = rowStatus(item);
                return (
                  <tr key={item.bookId} className={idx % 2 === 1 ? "bg-gray-50/60" : ""}>
                    <td className="px-4 py-3 border-b border-gray-100 last:border-b-0">
                      <div className="font-medium text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-400">{item.barcode}</div>
                    </td>
                    <td className="px-4 py-3 text-center border-b border-gray-100 text-gray-700">
                      {item.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center border-b border-gray-100 text-gray-700">
                      {item.quantityExpected}
                    </td>
                    <td className="px-4 py-3 text-center border-b border-gray-100 text-gray-700">
                      {item.available}
                    </td>
                    <td className="px-4 py-3 text-center border-b border-gray-100 font-medium text-gray-900">
                      {(item.quantityExpected * item.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center border-b border-gray-100">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    {!isApproved && (
                      <td className="px-4 py-3 border-b border-gray-100">
                        {st.variant !== "success" ? (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              min="0"
                              placeholder={String(item.available)}
                              value={editValue[item.bookId] ?? ""}
                              onChange={(e) =>
                                setEditValue((prev) => ({ ...prev, [item.bookId]: e.target.value }))
                              }
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                            />
                            <button
                              onClick={() => adjustItem(item.bookId, editValue[item.bookId] ?? item.available)}
                              disabled={savingBookId === item.bookId}
                              className="text-xs bg-blue-600 text-white rounded-lg px-2 py-1.5 hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                              title={`اعتماد الكمية الفعلية الممسوحة (${item.available})`}
                            >
                              تأكيد الكمية الفعلية
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-gray-300">—</div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-6">
          <div className="w-full max-w-xs">
            <div className="flex justify-between py-2 text-sm text-gray-500">
              <span>عدد الأصناف</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between py-2 text-sm text-gray-500 border-b border-gray-100">
              <span>إجمالي الكمية</span>
              <span>{totalQty}</span>
            </div>
            <div className="flex justify-between py-3 text-base font-bold text-gray-900">
              <span>الإجمالي</span>
              <span>{grandTotal.toFixed(2)} ر.س</span>
            </div>
            {isApproved && invoice.type !== "CONSIGNMENT" && (
              <div className="flex justify-between items-center py-2 px-3 text-sm bg-gray-50 rounded-lg">
                <span className="text-gray-500">رصيد المورد الحالي (تراكمي)</span>
                <span className="font-medium text-gray-900">{invoice.supplierBalance.toFixed(2)} ر.س</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {!isApproved && extraItems.length > 0 && (
        <Card className="p-5 mb-6">
          <h2 className="font-medium text-gray-900 mb-1">كتب ممسوحة وصلت بنفس الشحنة ولم تكن مدرجة بهذي الفاتورة</h2>
          <p className="text-sm text-gray-500 mb-4">
            هذي كتب فعليًا ممسوحة وغير مرتبطة بأي فاتورة بعد — لو تعرف إنها فعلًا جزء من هذي الفاتورة، حدّد سعر الوحدة وأضفها.
          </p>
          {addError && <p className="text-red-600 text-sm mb-3">{addError}</p>}
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {extraItems.map((extra) => (
              <div key={extra.bookId} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{extra.title}</div>
                  <div className="text-xs text-gray-400">{extra.barcode} — ممسوح {extra.scannedCount} مرة</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="سعر الوحدة"
                    value={addPrice[extra.bookId] ?? ""}
                    onChange={(e) => setAddPrice((prev) => ({ ...prev, [extra.bookId]: e.target.value }))}
                    className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center"
                  />
                  <button
                    onClick={() => addExtraItem(extra)}
                    disabled={addingBookId === extra.bookId}
                    className="text-xs bg-gray-800 text-white rounded-lg px-3 py-1.5 hover:bg-gray-900 disabled:opacity-50 whitespace-nowrap"
                  >
                    إضافة للفاتورة
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isApproved && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-700">رف إضافة المخزون</label>
            <select
              value={shelfId}
              onChange={(e) => setShelfId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {approveError && <p className="text-red-600 text-sm mb-3">{approveError}</p>}
          <button
            onClick={approve}
            disabled={approving || !allMatched || !shelves.length}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Check size={16} />
            {approving ? "جاري الاعتماد..." : "اعتماد الفاتورة"}
          </button>
          {!allMatched && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              لازم تقفل كل الفروقات (متوقع = ممسوح) قبل الاعتماد.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
