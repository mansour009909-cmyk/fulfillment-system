import { useState } from "react";
import { Plug, CheckCircle2, Circle, Trash2, Plus } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { PROVIDER_CATALOG, CATEGORY_LABELS, isConfigured } from "../../lib/integrations";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

export async function getServerSideProps() {
  const [integrations, clients] = await Promise.all([
    prisma.integration.findMany({ include: { client: { select: { id: true, name: true } } } }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    props: {
      integrations: integrations.map((i) => ({
        id: i.id,
        provider: i.provider,
        clientId: i.clientId,
        clientName: i.client?.name || null,
        apiKey: i.apiKey || "",
        apiSecret: i.apiSecret || "",
        accountId: i.accountId || "",
      })),
      clients,
    },
  };
}

function emptyForm(catalog) {
  const form = {};
  catalog.fields.forEach((f) => (form[f.key] = ""));
  return form;
}

function SystemProviderRow({ provider, catalog, existing, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(existing || emptyForm(catalog));
  const [saving, setSaving] = useState(false);
  const configured = isConfigured(existing);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, clientId: null, ...form }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      setOpen(false);
    }
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 py-3.5 text-right"
      >
        <div className="flex items-center gap-3">
          {configured ? (
            <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          ) : (
            <Circle size={18} className="text-gray-300 shrink-0" />
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">{catalog.label}</div>
            <div className="text-xs text-gray-400">{catalog.description}</div>
          </div>
        </div>
        <Badge variant={configured ? "success" : "neutral"}>{configured ? "مربوط" : "غير مربوط"}</Badge>
      </button>

      {open && (
        <form onSubmit={save} className="pb-4 grid grid-cols-2 gap-3">
          {catalog.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
              <input
                type={f.key === "apiKey" || f.key === "apiSecret" ? "password" : "text"}
                value={form[f.key] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div className="col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "حفظ الربط"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ClientProviderSection({ provider, catalog, existing, clients, onSaved }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ clientId: clients[0]?.id || "", ...emptyForm(catalog) });
  const [saving, setSaving] = useState(false);

  function startEdit(row) {
    setEditingId(row.id);
    setAdding(true);
    setForm({ clientId: row.clientId, apiKey: row.apiKey, apiSecret: row.apiSecret, accountId: row.accountId });
  }

  function startAdd() {
    setEditingId(null);
    setAdding(true);
    setForm({ clientId: clients[0]?.id || "", ...emptyForm(catalog) });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...form }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      setAdding(false);
      setEditingId(null);
    }
  }

  async function remove(id) {
    await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-gray-900">{catalog.label}</div>
          <div className="text-xs text-gray-400">{catalog.description}</div>
        </div>
        {!adding && (
          <button
            onClick={startAdd}
            disabled={!clients.length}
            className="flex items-center gap-1 text-sm text-blue-600 disabled:opacity-40"
          >
            <Plus size={14} />
            ربط متجر جديد
          </button>
        )}
      </div>

      {!clients.length && <p className="text-xs text-gray-400">لا يوجد عملاء بعد لربط متاجرهم.</p>}

      <div className="divide-y divide-gray-50">
        {existing.map((row) => (
          <div key={row.id} className="flex items-center justify-between py-2 text-sm">
            <div className="flex items-center gap-2">
              {isConfigured(row) ? (
                <CheckCircle2 size={15} className="text-green-600 shrink-0" />
              ) : (
                <Circle size={15} className="text-gray-300 shrink-0" />
              )}
              <span className="text-gray-800">{row.clientName}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => startEdit(row)} className="text-xs text-blue-600">
                تعديل
              </button>
              <button onClick={() => remove(row.id)} className="text-red-500 hover:text-red-700">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <form onSubmit={save} className="mt-3 grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">العميل (المتجر)</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
              disabled={editingId !== null}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {catalog.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
              <input
                type={f.key === "apiKey" || f.key === "apiSecret" ? "password" : "text"}
                value={form[f.key] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "حفظ الربط"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-sm text-gray-500 px-3 py-2"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function IntegrationsPage({ integrations, clients }) {
  const [data, setData] = useState(integrations);

  async function refresh() {
    const res = await fetch("/api/integrations");
    const rows = await res.json();
    setData(
      rows.map((i) => ({
        id: i.id,
        provider: i.provider,
        clientId: i.clientId,
        clientName: i.client?.name || null,
        apiKey: i.apiKey || "",
        apiSecret: i.apiSecret || "",
        accountId: i.accountId || "",
      }))
    );
  }

  const byProvider = {};
  data.forEach((i) => {
    (byProvider[i.provider] = byProvider[i.provider] || []).push(i);
  });

  const categories = ["STORE", "SHIPPING", "ACCOUNTING"];
  const providersByCategory = {};
  Object.entries(PROVIDER_CATALOG).forEach(([provider, catalog]) => {
    (providersByCategory[catalog.category] = providersByCategory[catalog.category] || []).push([provider, catalog]);
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Plug size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API</h1>
          <p className="text-gray-500 text-sm">
            اختر أي برنامج أو خدمة تبي تربطها بالنظام وحط مفاتيحها — الشكل جاهز، بعض الروابط تحتاج تفعيل فعلي لاحقًا.
          </p>
        </div>
      </div>

      {categories.map((cat) => (
        <Card key={cat} className="p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">{CATEGORY_LABELS[cat]}</h2>
          <div className="divide-y divide-gray-100">
            {providersByCategory[cat].map(([provider, catalog]) =>
              catalog.scope === "SYSTEM" ? (
                <SystemProviderRow
                  key={provider}
                  provider={provider}
                  catalog={catalog}
                  existing={byProvider[provider]?.[0] || null}
                  onSaved={refresh}
                />
              ) : (
                <ClientProviderSection
                  key={provider}
                  provider={provider}
                  catalog={catalog}
                  existing={byProvider[provider] || []}
                  clients={clients}
                  onSaved={refresh}
                />
              )
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
