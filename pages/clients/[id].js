import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, KeyRound, ClipboardList, CheckCircle2, TrendingUp, Package, Box, MessageCircle } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { KpiCard } from "../../components/ui/KpiCard";

const STATUS_LABEL = {
  PENDING_REVIEW: { label: "بانتظار المراجعة", variant: "info" },
  IN_REVIEW: { label: "قيد التنفيذ", variant: "warning" },
  FULFILLED: { label: "تم التنفيذ", variant: "success" },
};

export async function getServerSideProps({ params }) {
  const clientId = Number(params.id);
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      orders: { orderBy: { createdAt: "desc" }, include: { items: true, charge: true } },
    },
  });
  if (!client) return { notFound: true };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const fulfilledOrders = client.orders.filter((o) => o.status === "FULFILLED");
  const ordersThisMonth = client.orders.filter((o) => o.createdAt >= monthStart).length;
  const itemsSold = fulfilledOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantityVerified, 0),
    0
  );
  const totalRevenue = fulfilledOrders.reduce((sum, o) => {
    if (!o.charge) return sum;
    return sum + o.charge.fulfillmentFee + o.charge.labelFee + o.charge.shippingFee + o.charge.packagingFee;
  }, 0);

  return {
    props: {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        hasPortalAccess: Boolean(client.passwordHash),
        daftraClientId: client.daftraClientId || "",
        usesOwnPackaging: client.usesOwnPackaging,
      },
      stats: {
        totalOrders: client.orders.length,
        ordersThisMonth,
        fulfilledCount: fulfilledOrders.length,
        itemsSold,
        totalRevenue,
      },
      orders: client.orders.slice(0, 30).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        itemCount: o.items.length,
        createdAt: o.createdAt.toISOString(),
      })),
    },
  };
}

function PortalForm({ client, onSaved }) {
  const [email, setEmail] = useState(client.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/clients/${client.id}/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setPassword("");
    onSaved();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="بريد بوابة العميل"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[160px]"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="كلمة سر جديدة"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[140px]"
      />
      <button
        onClick={handleSave}
        disabled={saving || !email || !password}
        className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ"}
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </div>
  );
}

function DaftraForm({ client }) {
  const [daftraClientId, setDaftraClientId] = useState(client.daftraClientId);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/clients/${client.id}/daftra`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daftraClientId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={daftraClientId}
        onChange={(e) => setDaftraClientId(e.target.value)}
        placeholder="معرّف العميل بدفترة (Daftra client ID)"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[200px]"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ"}
      </button>
      {saved && <span className="text-green-600 text-xs">تم الحفظ</span>}
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </div>
  );
}

function PackagingForm({ client }) {
  const [usesOwnPackaging, setUsesOwnPackaging] = useState(client.usesOwnPackaging);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function toggle() {
    const next = !usesOwnPackaging;
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/clients/${client.id}/packaging`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usesOwnPackaging: next }),
    });
    setSaving(false);
    if (res.ok) {
      setUsesOwnPackaging(next);
      setSaved(true);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" checked={usesOwnPackaging} onChange={toggle} disabled={saving} />
        هذا العميل يستخدم تغليفه الخاص (كرتونه/مواده) — تُستثنى طلباته من رسوم التغليف
      </label>
      {saved && <span className="text-green-600 text-xs">تم الحفظ</span>}
    </div>
  );
}

export default function ClientDetail({ client, stats, orders }) {
  return (
    <div className="max-w-4xl">
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-4">
        <ArrowRight size={14} />
        رجوع للعملاء
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <div className="mt-1">
            <Badge variant={client.hasPortalAccess ? "success" : "neutral"}>
              {client.hasPortalAccess ? "بوابة مفعّلة" : "بدون بوابة"}
            </Badge>
          </div>
        </div>
        <Link
          href={`/chat/client/${client.id}`}
          className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50"
        >
          <MessageCircle size={14} />
          محادثة الدعم
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard icon={ClipboardList} label="إجمالي الطلبات" value={stats.totalOrders} color="blue" />
        <KpiCard icon={ClipboardList} label="طلبات هذا الشهر" value={stats.ordersThisMonth} color="purple" />
        <KpiCard icon={CheckCircle2} label="طلبات مكتملة" value={stats.fulfilledCount} color="green" />
        <KpiCard icon={Package} label="نسخ تم بيعها/شحنها" value={stats.itemsSold} color="amber" />
        <KpiCard icon={TrendingUp} label="إجمالي إيرادات الرسوم" value={`${stats.totalRevenue.toFixed(2)} ر.س`} color="green" />
      </div>

      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">بيانات دخول بوابة العميل</h2>
        </div>
        <PortalForm client={client} onSaved={() => {}} />
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">تكامل دفترة</h2>
        <p className="text-xs text-gray-400 mb-3">
          يُستخدم عند مزامنة فواتير هذا العميل مع دفترة (بعد ربط حساب دفترة من الإعدادات).
        </p>
        <DaftraForm client={client} />
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Box size={16} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">التغليف</h2>
        </div>
        <PackagingForm client={client} />
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">آخر الطلبات</h2>
        <Link href="/invoices" className="text-sm text-blue-600">
          الفواتير والرسوم
        </Link>
      </div>
      <Card className="divide-y divide-gray-100">
        {orders.map((o) => {
          const st = STATUS_LABEL[o.status];
          return (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="p-4 flex justify-between items-center hover:bg-gray-50"
            >
              <div className="font-medium text-gray-900">#{o.orderNumber}</div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500">{o.itemCount} بند</span>
                <span className="text-gray-400">{new Date(o.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
            </Link>
          );
        })}
        {orders.length === 0 && <div className="p-8 text-center text-gray-400">لا توجد طلبات بعد.</div>}
      </Card>
    </div>
  );
}
