import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { Card } from "../../../components/ui/Card";
import { PortalLayout } from "../../../components/portal/PortalLayout";
import { CLIENT_TABS } from "../../../components/portal/portalTabs";

export async function getServerSideProps({ req }) {
  const session = await getSession(req, "CLIENT");
  const client = await prisma.client.findUnique({ where: { id: session.id } });
  if (!client) return { notFound: true };

  const stock = await prisma.shelfStock.findMany({
    where: { ownership: "PRIVATE", clientId: client.id, quantity: { gt: 0 } },
    include: { book: true, shelf: true },
    orderBy: { book: { title: "asc" } },
  });

  return {
    props: {
      clientName: client.name,
      stock: stock.map((s) => ({
        id: s.id,
        bookTitle: s.book.title,
        barcode: s.book.barcode,
        imageUrl: s.book.imageUrl,
        shelfName: s.shelf.name,
        quantity: s.quantity,
      })),
    },
  };
}

export default function ClientInventory({ clientName, stock }) {
  const total = stock.reduce((sum, s) => sum + s.quantity, 0);

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
          <h1 className="text-xl font-bold text-gray-900">مخزوني الخاص</h1>
          <span className="text-sm text-gray-500">{total} نسخة إجمالًا</span>
        </div>
        <Card className="divide-y divide-gray-100">
          {stock.map((s) => (
            <div key={s.id} className="p-4 flex items-center gap-3">
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-gray-100 shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gray-50 border border-gray-100 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">{s.bookTitle}</div>
                <div className="text-sm text-gray-400">{s.barcode} — {s.shelfName}</div>
              </div>
              <div className="text-lg font-semibold text-gray-900 shrink-0">{s.quantity}</div>
            </div>
          ))}
          {stock.length === 0 && <div className="p-8 text-center text-gray-400">لا يوجد مخزون خاص مسجَّل حاليًا.</div>}
        </Card>
      </div>
    </PortalLayout>
  );
}
