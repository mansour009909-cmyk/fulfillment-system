import { useState, useRef, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";

let nextKey = 1;

export function emptyRow() {
  return { key: nextKey++, bookId: null, barcode: "", title: "", quantity: "", price: "" };
}

function ItemRow({ row, onChange, onRemove }) {
  const [query, setQuery] = useState(row.barcode || "");
  const [suggestions, setSuggestions] = useState([]);
  const [searched, setSearched] = useState(false);
  const [showNewTitle, setShowNewTitle] = useState(false);
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
    setShowNewTitle(false);
    onChange({ ...row, bookId: book.id, barcode: book.barcode, title: book.title });
  }

  function useAsNewBook() {
    setSuggestions([]);
    setSearched(false);
    setShowNewTitle(true);
    onChange({ ...row, bookId: null, barcode: query, title: "" });
  }

  const showDropdown = searched && query && !(row.bookId && query === row.barcode);

  const lineTotal = (Number(row.quantity) || 0) * (Number(row.price) || 0);

  return (
    <tr>
      <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 align-top relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange({ ...row, bookId: null, barcode: e.target.value, title: "" });
            setShowNewTitle(false);
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
            <button
              type="button"
              onClick={useAsNewBook}
              className="w-full text-right px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
            >
              + إضافة كتاب جديد: {query}
            </button>
          </div>
        )}
        {showNewTitle && !row.bookId && (
          <input
            value={row.title}
            onChange={(e) => onChange({ ...row, title: e.target.value })}
            placeholder="عنوان الكتاب الجديد"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </td>
      <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 align-top">
        <input
          type="number"
          min="1"
          value={row.quantity}
          onChange={(e) => onChange({ ...row, quantity: e.target.value })}
          placeholder="الكمية"
          className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 align-top">
        <input
          type="number"
          min="0"
          step="0.01"
          value={row.price}
          onChange={(e) => onChange({ ...row, price: e.target.value })}
          placeholder="السعر"
          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 align-top text-center font-medium text-gray-900">
        {lineTotal.toFixed(2)} ر.س
      </td>
      <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 align-top text-center">
        <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}

export function InvoiceItemsEditor({ items, onChange }) {
  const totalQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const grandTotal = items.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.price) || 0),
    0
  );

  function updateRow(key, updated) {
    onChange(items.map((i) => (i.key === key ? updated : i)));
  }
  function removeRow(key) {
    onChange(items.filter((i) => i.key !== key));
  }
  function addRow() {
    onChange([...items, emptyRow()]);
  }

  return (
    <div>
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-4 py-3 text-right border-b border-gray-200">الصنف</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">الكمية</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">السعر</th>
                <th className="px-4 py-3 text-center border-b border-gray-200">الإجمالي</th>
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
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400 text-sm">
                    لا توجد بنود بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 text-sm text-blue-600"
          >
            <Plus size={14} />
            إضافة صنف
          </button>
        </div>
      </div>

      <div className="flex justify-end">
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
        </div>
      </div>
    </div>
  );
}
