import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });

  return {
    props: {
      suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, balance: s.balance })),
    },
  };
}

export default function SuppliersIndex({ suppliers }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.includes(q));
  }, [suppliers, query]);

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">الموردون</h1>
          <p className="text-gray-500">إدارة الموردين وفواتير الشراء والرصيد المستحق</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/receiving"
            className="flex items-center gap-2 bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-900"
          >
            استلام شحنة
          </Link>
          <Link
            href="/suppliers/new"
            className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} />
            إضافة مورد
          </Link>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم المورد..."
          className="w-full border border-gray-200 rounded-lg pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <p className="text-sm text-gray-400 mb-3">
        {query ? `${filtered.length} من ${suppliers.length} مورد` : `${suppliers.length} مورد`}
      </p>

      <Card className="divide-y divide-gray-100">
        {filtered.map((s) => (
          <Link
            key={s.id}
            href={`/suppliers/${s.id}`}
            className="p-4 flex justify-between items-center hover:bg-gray-50"
          >
            <div className="font-medium text-gray-900">{s.name}</div>
            <div className="text-sm text-gray-600">الرصيد المستحق: {s.balance.toFixed(2)} ر.س</div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            {query ? "لا نتائج مطابقة." : "لا يوجد موردون بعد."}
          </div>
        )}
      </Card>
    </div>
  );
}
