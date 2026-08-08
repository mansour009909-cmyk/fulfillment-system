import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { Card } from "../../../components/ui/Card";

export async function getServerSideProps({ params }) {
  const book = await prisma.book.findUnique({ where: { id: Number(params.id) } });
  if (!book) return { notFound: true };

  return {
    props: {
      book: {
        id: book.id,
        barcode: book.barcode,
        title: book.title,
        brandName: book.brandName || "",
        imageUrl: book.imageUrl || "",
        brandImageUrl: book.brandImageUrl || "",
        price: book.price ?? "",
        costPrice: book.costPrice ?? "",
      },
    },
  };
}

export default function EditBook({ book }) {
  const router = useRouter();
  const [form, setForm] = useState(book);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }

    router.push(`/books/${book.id}`);
  }

  return (
    <div className="max-w-md">
      <Link href={`/books/${book.id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع لتفاصيل الكتاب
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">تعديل الكتاب</h1>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">باركود الكتاب</label>
            <input
              value={form.barcode}
              onChange={(e) => set("barcode", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الكتاب</label>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الماركة</label>
            <input
              value={form.brandName}
              onChange={(e) => set("brandName", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة</label>
              <input
                type="number"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => set("costPrice", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط صورة الكتاب</label>
            <input
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط شعار الماركة</label>
            <input
              value={form.brandImageUrl}
              onChange={(e) => set("brandImageUrl", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </form>
      </Card>
    </div>
  );
}
