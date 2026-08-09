import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps() {
  const clients = await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return { props: { clients } };
}

let nextKey = 1;
const emptyRow = () => ({ key: nextKey++, bookId: null, barcode: "", title: "", quantityRequired: "1" });

function ItemRow({ row, onChange, onRemove }) {
  const [query, setQuery] = useState(row.barcode || "");
  const [suggestions, setSuggestions] = useState([]);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || (row.bookId && query === row.barcode)) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(data.books || []);
      setSearched(true);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function pickBook(book) {
    setQuery(book.barcode);
    setSuggestions([]);
    setSearched(false);
    onChange({ ...row, bookId: book.id, barcode: book.barcode, title: book.title });
  }

  const showDropdown = searched && query && !(row.bookId && query === row.barcode);

  return (
    <tr>
      <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 align-top relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange({ ...row, bookId: null, barcode: e.target.value, title: "" });
          }}
          placeholder="ابحث بالعنوان أو الباركود..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {row.bookId && <div className="text-xs text-green-600 mt-1">{row.title}</div>}
        {showDropdown && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => pickBook(b)}
                className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <div className="text-gray-900">{b.title}</div>
                <div className="text-gray-400 text-xs">{b.barcode}</div>
              </button>
            ))}
            {suggestions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">لا نتائج — الكتاب لازم يكون موجود بالكتالوج مسبقًا</div>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 align-top">
        <input
          type="number"
          min="1"
          value={row.quantityRequired}
          onChange={(e) => onChange({ ...row, quantityRequired: e.target.value })}
          className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 align-top text-center">
        <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}

export default function NewOrder({ clients }) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [items, setItems] = useState([emptyRow()]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function updateRow(key, updated) {
    setItems((prev) => prev.map((i) => (i.key === key ? updated : i)));
  }
  function removeRow(key) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const validItems = items.filter((i) => i.bookId && Number(i.quantityRequired) > 0);
    if (validItems.length === 0) {
      setError("لازم بند واحد على الأقل بكتاب صحيح وكمية");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber,
        clientId,
        items: validItems.map((i) => ({ bookId: i.bookId, quantityRequired: Number(i.quantityRequired) })),
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    router.push(`/orders/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للطلبات
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">طلب جديد</h1>
      <p className="text-gray-500 mb-6">إدخال يدوي — بديل مؤقت لحين ربط سلة لسحب الطلبات تلقائيًا</p>

      <form onSubmit={handleSubmit}>
        <Card className="p-5 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الطلب</label>
              <input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="مثال: RWD-10099"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">العميل</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {clients.length === 0 && <option value="">لا يوجد عملاء بعد</option>}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-4 py-3 text-right border-b border-gray-200">الكتاب</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">الكمية</th>
                <th className="px-4 py-3 border-b border-gray-200"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <ItemRow
                  key={row.key}
                  row={row}
                  onChange={(updated) => updateRow(row.key, updated)}
                  onRemove={() => removeRow(row.key)}
                />
              ))}
            </tbody>
          </table>
          <div className="p-3 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyRow()])}
              className="inline-flex items-center gap-1 text-sm text-blue-600"
            >
              <Plus size={14} />
              إضافة بند
            </button>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={saving || !clients.length}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "جاري الحفظ..." : "إنشاء الطلب"}
        </button>
      </form>
    </div>
  );
}
