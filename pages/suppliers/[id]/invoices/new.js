import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { prisma } from "../../../../lib/prisma";
import { InvoiceItemsEditor, emptyRow } from "../../../../components/InvoiceItemsEditor";
import { Card } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";

export async function getServerSideProps({ params }) {
  const supplier = await prisma.supplier.findUnique({ where: { id: Number(params.id) } });
  if (!supplier) return { notFound: true };

  return { props: { supplier: { id: supplier.id, name: supplier.name } } };
}

export default function NewPurchaseInvoice({ supplier }) {
  const router = useRouter();
  const [items, setItems] = useState([emptyRow()]);
  const [type, setType] = useState("PURCHASE");
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function saveInvoice() {
    setSaveError(null);

    const cleaned = items.filter((i) => i.barcode && i.quantity && i.price !== "");
    if (cleaned.length === 0) {
      setSaveError("أضف بند واحد على الأقل (باركود، كمية، سعر) قبل الحفظ");
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/suppliers/${supplier.id}/purchase-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        items: cleaned.map((i) => ({
          barcode: i.barcode,
          title: i.title,
          quantityExpected: i.quantity,
          price: i.price,
        })),
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setSaveError(data.error || "حدث خطأ");
      return;
    }

    router.push(`/suppliers/${supplier.id}`);
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/suppliers/${supplier.id}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 mb-4"
      >
        <ArrowRight size={14} />
        رجوع لـ{supplier.name}
      </Link>

      <Card className="p-8 mb-6">
        <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">فاتورة شراء جديدة</h1>
              <div className="text-xs text-gray-400 mt-0.5">استلام ومطابقة مخزون</div>
            </div>
          </div>
          <Badge variant="neutral">مسودة</Badge>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <div className="text-gray-400 mb-1">المورد</div>
            <div className="font-medium text-gray-900">{supplier.name}</div>
          </div>
          <div className="text-left">
            <label className="text-gray-400 mb-1 block">نوع الفاتورة</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="PURCHASE">شراء عادي</option>
              <option value="CONSIGNMENT">تخزين بغرض البيع (يبقى ملك المورد)</option>
            </select>
          </div>
        </div>

        {type === "CONSIGNMENT" && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-6">
            هذا النوع لا يزيد رصيد المورد عند الاعتماد — المخزون يبقى ملكًا له، والتسوية المالية (عمولة أو غيرها) تُدار خارج النظام.
          </p>
        )}

        <InvoiceItemsEditor items={items} onChange={setItems} />
      </Card>

      {saveError && <p className="text-red-600 text-sm mb-4">{saveError}</p>}
      <button
        onClick={saveInvoice}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ الفاتورة (مسودة)"}
      </button>
    </div>
  );
}
