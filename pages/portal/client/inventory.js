import { useState } from "react";
import { useRouter } from "next/router";
import { Search } from "lucide-react";
import { getSession } from "../../../lib/webAuth";
import { prisma } from "../../../lib/prisma";
import { searchBooks } from "../../../lib/bookCatalog";
import { Card } from "../../../components/ui/Card";
import { PortalLayout } from "../../../components/portal/PortalLayout";
import { CLIENT_TABS } from "../../../components/portal/portalTabs";

const PAGE_SIZE = 50;

// المخزون المشترك (نفس المخزون المعروض بالداشبورد الرئيسي للإدارة) — قراءة فقط، بدون أي مخزون خاص بالعميل
export async function getServerSideProps({ req, query }) {
  const session = await getSession(req, "CLIENT");
  const client = await prisma.client.findUnique({ where: { id: session.id } });
  if (!client) return { notFound: true };

  const q = (query.q || "").trim();
  const page = Math.max(1, Number(query.page) || 1);
  const { books, total, totalPages } = await searchBooks({ q, stock: "in", page, pageSize: PAGE_SIZE });

  return {
    props: {
      clientName: client.name,
      books: books.map((b) => ({
        id: b.id,
        title: b.title,
        barcode: b.barcode,
        imageUrl: b.imageUrl,
        brandName: b.brandName,
        totalQty: b.totalQty,
      })),
      total,
      totalPages,
      page,
      q,
    },
  };
}

export default function ClientInventory({ clientName, books, total, totalPages, page, q }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);

  function search(e) {
    e.preventDefault();
    router.push({ pathname: "/portal/client/inventory", query: { q: query || undefined } });
  }

  function goToPage(p) {
    router.push({ pathname: "/portal/client/inventory", query: { q: q || undefined, page: p } });
  }

  return (
    <PortalLayout
      name={clientName}
      roleLabel="بوابة العميل"
      tabs={CLIENT_TABS}
      logoutUrl="/api/portal/client/logout"
      loginUrl="/portal/client/login"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">المخزون المشترك</h1>
          <span className="text-sm text-gray-500">{total} عنوان متوفر — صفحة {page} من {totalPages}</span>
        </div>

        <form onSubmit={search} className="relative mb-4">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالعنوان أو الباركود..."
            className="w-full border border-gray-200 rounded-lg pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <Card className="divide-y divide-gray-100 mb-4">
          {books.map((b) => (
            <div key={b.id} className="p-4 flex items-center gap-3">
              {b.imageUrl ? (
                <img src={b.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-gray-100 shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gray-50 border border-gray-100 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">{b.title}</div>
                <div className="text-sm text-gray-400 truncate">
                  {b.barcode}
                  {b.brandName && <span> — {b.brandName}</span>}
                </div>
              </div>
              <div className="text-lg font-semibold text-gray-900 shrink-0">{b.totalQty}</div>
            </div>
          ))}
          {books.length === 0 && <div className="p-8 text-center text-gray-400">لا نتائج مطابقة.</div>}
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="text-sm text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              السابق
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="text-sm text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
