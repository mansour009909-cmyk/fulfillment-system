import { useState } from "react";
import Link from "next/link";
import { History, Plus, FileText, RefreshCw, Trash2 } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { FEE_LABELS } from "../../lib/fees";
import { getIntegration, isConfigured } from "../../lib/integrations";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

const FEE_TYPES = Object.keys(FEE_LABELS);

export async function getServerSideProps() {
  const [generalFees, customFees, clients, invoices, unbilled, daftraIntegration] = await Promise.all([
    prisma.fee.findMany({ where: { clientId: null } }),
    prisma.fee.findMany({ where: { clientId: { not: null } }, include: { client: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.clientInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, charges: { include: { order: true } } },
    }),
    prisma.orderCharge.groupBy({
      by: ["clientId"],
      where: { invoiced: false },
      _count: { id: true },
      _sum: { fulfillmentFee: true, labelFee: true, shippingFee: true, packagingFee: true },
    }),
    getIntegration("DAFTRA"),
  ]);

  const generalMap = Object.fromEntries(generalFees.map((f) => [f.type, f.amount]));
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const unbilledByClient = unbilled.map((u) => ({
    clientId: u.clientId,
    clientName: clientMap[u.clientId] || "—",
    count: u._count.id,
    total:
      (u._sum.fulfillmentFee || 0) +
      (u._sum.labelFee || 0) +
      (u._sum.shippingFee || 0) +
      (u._sum.packagingFee || 0),
  }));

  return {
    props: {
      generalFees: generalMap,
      customFees: customFees.map((f) => ({
        id: f.id,
        type: f.type,
        clientId: f.clientId,
        clientName: f.client.name,
        amount: f.amount,
      })),
      clients: clients.map((c) => ({ id: c.id, name: c.name })),
      unbilledByClient,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        clientName: inv.client.name,
        periodStart: inv.periodStart.toISOString(),
        periodEnd: inv.periodEnd.toISOString(),
        total: inv.total,
        status: inv.status,
        daftraInvoiceId: inv.daftraInvoiceId,
        daftraSyncedAt: inv.daftraSyncedAt ? inv.daftraSyncedAt.toISOString() : null,
        daftraSyncError: inv.daftraSyncError,
        charges: inv.charges.map((c) => ({
          orderNumber: c.order.orderNumber,
          fulfillmentFee: c.fulfillmentFee,
          labelFee: c.labelFee,
          shippingFee: c.shippingFee,
          packagingFee: c.packagingFee,
        })),
      })),
      daftraConfigured: isConfigured(daftraIntegration),
    },
  };
}

export default function InvoicesIndex({
  generalFees,
  customFees,
  clients,
  unbilledByClient,
  invoices,
  daftraConfigured,
}) {
  const [generalValues, setGeneralValues] = useState(generalFees);
  const [savingType, setSavingType] = useState(null);

  const [customClientId, setCustomClientId] = useState(clients[0]?.id || "");
  const [customType, setCustomType] = useState(FEE_TYPES[0]);
  const [customAmount, setCustomAmount] = useState("");
  const [customError, setCustomError] = useState(null);
  const [savingCustom, setSavingCustom] = useState(false);

  const [generating, setGenerating] = useState(null);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  async function saveGeneralFee(type) {
    setSavingType(type);
    await fetch("/api/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, clientId: null, amount: generalValues[type] }),
    });
    setSavingType(null);
  }

  async function saveCustomFee(e) {
    e.preventDefault();
    setCustomError(null);
    setSavingCustom(true);
    const res = await fetch("/api/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: customType, clientId: customClientId, amount: customAmount }),
    });
    setSavingCustom(false);
    if (!res.ok) {
      const data = await res.json();
      setCustomError(data.error || "حدث خطأ");
      return;
    }
    setCustomAmount("");
    window.location.reload();
  }

  async function generateInvoice(clientId) {
    setGenerating(clientId);
    await fetch("/api/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    window.location.reload();
  }

  async function syncToDaftra(invoiceId) {
    setSyncing(invoiceId);
    setSyncError(null);
    const res = await fetch(`/api/invoices/${invoiceId}/sync-daftra`, { method: "POST" });
    const data = await res.json();
    setSyncing(null);
    if (!res.ok) {
      setSyncError(data.error || "تعذّرت المزامنة");
      return;
    }
    window.location.reload();
  }

  async function deleteInvoice(inv) {
    if (
      !window.confirm(
        `متأكد تبي تحذف فاتورة "${inv.clientName}" (${inv.total.toFixed(
          2
        )} ر.س)؟ شحناتها ترجع غير مفوترة وتدخل ضمن فاتورة قادمة. ما يمكن التراجع.`
      )
    )
      return;
    setDeleting(inv.id);
    setDeleteError(null);
    const res = await fetch(`/api/invoices/${inv.id}/delete`, { method: "POST" });
    setDeleting(null);
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error || "تعذّر الحذف");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">الفواتير والرسوم</h1>
          <p className="text-gray-500">إدارة الأسعار العامة والمخصصة، وفواتير مستحقات العملاء</p>
        </div>
        <Link href="/invoices/audit" className="inline-flex items-center gap-1 text-sm text-blue-600">
          <History size={14} />
          سجل تعديلات الرسوم
        </Link>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">الأسعار العامة (الافتراضية)</h2>
        <div className="divide-y divide-gray-100">
          {FEE_TYPES.map((type) => (
            <div key={type} className="py-2.5 flex items-center justify-between gap-4">
              <div className="text-sm text-gray-700">{FEE_LABELS[type]}</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={generalValues[type] ?? ""}
                  onChange={(e) => setGeneralValues((v) => ({ ...v, [type]: e.target.value }))}
                  className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => saveGeneralFee(type)}
                  disabled={savingType === type}
                  className="text-sm bg-gray-800 text-white rounded-lg px-3 py-1.5 hover:bg-gray-900 disabled:opacity-50"
                >
                  {savingType === type ? "..." : "حفظ"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">أسعار مخصصة للعملاء</h2>

        <form onSubmit={saveCustomFee} className="flex flex-wrap items-end gap-2 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">العميل</label>
            <select
              value={customClientId}
              onChange={(e) => setCustomClientId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">نوع الرسم</label>
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {FEE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FEE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">القيمة</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              required
              className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={savingCustom || !clients.length}
            className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
            حفظ
          </button>
        </form>
        {customError && <p className="text-red-600 text-sm mb-3">{customError}</p>}
        {!clients.length && <p className="text-sm text-gray-400 mb-3">لا يوجد عملاء بعد.</p>}

        <div className="divide-y divide-gray-100">
          {customFees.map((f) => (
            <div key={f.id} className="py-2 flex justify-between text-sm">
              <div className="text-gray-700">
                {f.clientName} — {FEE_LABELS[f.type]}
              </div>
              <div className="font-medium text-gray-900">{f.amount.toFixed(2)}</div>
            </div>
          ))}
          {customFees.length === 0 && <div className="py-3 text-sm text-gray-400">لا توجد أسعار مخصصة بعد.</div>}
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">شحنات مكتملة غير مفوترة</h2>
        <div className="divide-y divide-gray-100">
          {unbilledByClient.map((u) => (
            <div key={u.clientId} className="py-3 flex justify-between items-center">
              <div>
                <div className="text-gray-900 font-medium">{u.clientName}</div>
                <div className="text-sm text-gray-500">{u.count} شحنة — إجمالي {u.total.toFixed(2)} ر.س</div>
              </div>
              <button
                onClick={() => generateInvoice(u.clientId)}
                disabled={generating === u.clientId}
                className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <FileText size={14} />
                {generating === u.clientId ? "جاري التوليد..." : "توليد فاتورة"}
              </button>
            </div>
          ))}
          {unbilledByClient.length === 0 && (
            <div className="py-3 text-sm text-gray-400">لا توجد شحنات مكتملة غير مفوترة حاليًا.</div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-5 pb-0">
          <h2 className="font-semibold text-gray-900 mb-1">فواتير العملاء</h2>
          {!daftraConfigured && (
            <p className="text-xs text-gray-400 mb-3">
              دفترة غير مربوطة بعد — أضف مفتاح API والنطاق الفرعي من صفحة{" "}
              <Link href="/integrations" className="text-blue-600">
                API
              </Link>{" "}
              لتفعيل المزامنة.
            </p>
          )}
          {syncError && <p className="text-xs text-red-600 mb-3">{syncError}</p>}
          {deleteError && <p className="text-xs text-red-600 mb-3">{deleteError}</p>}
        </div>
        <div className="divide-y divide-gray-100">
          {invoices.map((inv) => (
            <div key={inv.id}>
              <div className="w-full p-4 flex justify-between items-center hover:bg-gray-50">
                <button
                  onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                  className="flex-1 text-right"
                >
                  <div className="font-medium text-gray-900">{inv.clientName}</div>
                  <div className="text-sm text-gray-400">
                    {new Date(inv.periodStart).toLocaleDateString("ar-SA-u-nu-latn")} —{" "}
                    {new Date(inv.periodEnd).toLocaleDateString("ar-SA-u-nu-latn")}
                  </div>
                </button>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                    className="font-semibold text-gray-900"
                  >
                    {inv.total.toFixed(2)} ر.س
                  </button>
                  <Badge variant={inv.status === "PAID" ? "success" : "warning"}>
                    {inv.status === "PAID" ? "مدفوعة" : "مستحقة"}
                  </Badge>
                  {inv.status !== "PAID" && (
                    <button
                      onClick={() => deleteInvoice(inv)}
                      disabled={deleting === inv.id}
                      title="حذف الفاتورة"
                      className="text-red-400 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              {expandedInvoice === inv.id && (
                <div className="px-4 pb-4 text-sm">
                  {inv.charges.map((c) => (
                    <div key={c.orderNumber} className="flex justify-between py-1.5 text-gray-600">
                      <span>#{c.orderNumber}</span>
                      <span>
                        {(c.fulfillmentFee + c.labelFee + c.shippingFee + c.packagingFee).toFixed(2)} ر.س
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      {inv.daftraInvoiceId ? (
                        <span className="text-green-600">
                          مُزامنة مع دفترة (#{inv.daftraInvoiceId}) —{" "}
                          {new Date(inv.daftraSyncedAt).toLocaleDateString("ar-SA-u-nu-latn")}
                        </span>
                      ) : inv.daftraSyncError ? (
                        <span className="text-red-600">فشلت آخر مزامنة: {inv.daftraSyncError}</span>
                      ) : (
                        <span className="text-gray-400">لم تُزامَن مع دفترة بعد</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        syncToDaftra(inv.id);
                      }}
                      disabled={!daftraConfigured || syncing === inv.id}
                      title={!daftraConfigured ? "أضف مفتاح API والنطاق الفرعي من الإعدادات أولًا" : undefined}
                      className="flex items-center gap-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RefreshCw size={12} />
                      {syncing === inv.id ? "جاري المزامنة..." : "مزامنة مع دفترة"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {invoices.length === 0 && <div className="p-4 text-sm text-gray-400">لا توجد فواتير بعد.</div>}
        </div>
      </Card>
    </div>
  );
}
