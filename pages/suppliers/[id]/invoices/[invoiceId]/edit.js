import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, FileText, AlertTriangle } from "lucide-react";
import { prisma } from "../../../../../lib/prisma";
import { InvoiceItemsEditor, emptyRow } from "../../../../../components/InvoiceItemsEditor";
import { Card } from "../../../../../components/ui/Card";
import { Badge } from "../../../../../components/ui/Badge";

export async function getServerSideProps({ params }) {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: Number(params.invoiceId) },
    include: { supplier: true, items: { include: { book: true } } },
  });
  if (!invoice) return { notFound: true };
  if (invoice.supplierId !== Number(params.id)) return { notFound: true };

  const shelves = await prisma.shelf.findMany({ orderBy: { sortOrder: "asc" } });

  return {
    props: {
      supplierId: Number(params.id),
      invoice: {
        id: invoice.id,
        status: invoice.status,
        supplierName: invoice.supplier.name,
        shelfId: invoice.shelfId,
        items: invoice.items.map((i) => ({
          key: i.id,
          bookId: i.bookId,
          barcode: i.book.barcode,
          title: i.book.title,
          quantity: i.quantityExpected,
          price: i.price,
        })),
      },
      shelves: shelves.map((s) => ({ id: s.id, name: s.name })),
    },
  };
}

export default function EditPurchaseInvoice({ supplierId, invoice, shelves }) {
  const router = useRouter();
  const isApproved = invoice.status === "APPROVED";
  const [items, setItems] = useState(invoice.items.length ? invoice.items : [emptyRow()]);
  const [shelfId, setShelfId] = useState(invoice.shelfId || shelves[0]?.id || "");
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function saveChanges() {
    setSaveError(null);
    const cleaned = items.filter((i) => i.barcode && i.quantity && i.price !== "");
    if (cleaned.length === 0) {
      setSaveError("لازم بند واحد على الأقل");
      return;
    }

    setSaving(true);
    const endpoint = isApproved
      ? `/api/suppliers/purchase-invoices/${invoice.id}/update-approved`
      : `/api/suppliers/purchase-invoices/${invoice.id}/update`;
    const body = {
      items: cleaned.map((i) => ({
        barcode: i.barcode,
        title: i.title,
        quantityExpected: i.quantity,
        price: i.price,
      })),
      ...(isApproved ? { shelfId } : {}),
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setSaveError(data.error || "حدث خطأ");
      return;
    }

    router.push(`/suppliers/${supplierId}`);
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/suppliers/${supplierId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 mb-4"
      >
        <ArrowRight size={14} />
        رجوع لـ{invoice.supplierName}
      </Link>

      {isApproved && (
        <div className="flex items-start gap-2 bg-amber-50 text-amber-800 rounded-xl px-4 py-3 mb-4 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            تنبيه: هذا تعديل على فاتورة معتمدة — أي تغيير يؤثر مباشرة على رصيد المورد والمخزون الفعلي بالرف.
            لن يُسمح بتقليل كمية إذا كان المخزون المقابل لها تم صرفه بالفعل.
          </span>
        </div>
      )}

      <Card className="p-8 mb-6">
        <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">تعديل فاتورة شراء #{invoice.id}</h1>
              <div className="text-xs text-gray-400 mt-0.5">استلام ومطابقة مخزون</div>
            </div>
          </div>
          <Badge variant={isApproved ? "success" : "neutral"}>{isApproved ? "معتمدة" : "مسودة"}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <div className="text-gray-400 mb-1">المورد</div>
            <div className="font-medium text-gray-900">{invoice.supplierName}</div>
          </div>
          {isApproved && (
            <div className="text-left">
              <label className="text-gray-400 mb-1 block">رف المخزون المرتبط بالفاتورة</label>
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
          )}
        </div>

        <InvoiceItemsEditor items={items} onChange={setItems} />
      </Card>

      {saveError && <p className="text-red-600 text-sm mb-4">{saveError}</p>}
      <button
        onClick={saveChanges}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
      </button>
    </div>
  );
}
