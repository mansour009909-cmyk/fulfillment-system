import { useState, useEffect } from "react";
import { Users, Plus, KeyRound } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

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
    <div className="mt-2 p-3 bg-gray-50 rounded-lg flex flex-wrap items-center gap-2">
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

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPortalId, setOpenPortalId] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/clients");
    setClients(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    setCreating(false);
    load();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Users size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">العملاء</h1>
      </div>
      <p className="text-gray-500 mb-6">إدارة العملاء وبيانات دخول بوابتهم الخارجية</p>

      <Card className="p-4 mb-6">
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم العميل الجديد"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            <Plus size={16} />
            إضافة عميل
          </button>
        </form>
      </Card>

      <Card className="divide-y divide-gray-100">
        {loading && <div className="p-6 text-center text-gray-400 text-sm">جاري التحميل...</div>}
        {!loading &&
          clients.map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{c.name}</div>
                  <div className="text-sm text-gray-400">{c.orderCount} طلب</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={c.hasPortalAccess ? "success" : "neutral"}>
                    {c.hasPortalAccess ? "بوابة مفعّلة" : "بدون بوابة"}
                  </Badge>
                  <button
                    onClick={() => setOpenPortalId(openPortalId === c.id ? null : c.id)}
                    className="flex items-center gap-1 text-sm text-blue-600"
                  >
                    <KeyRound size={14} />
                    بيانات البوابة
                  </button>
                </div>
              </div>
              {openPortalId === c.id && (
                <PortalForm
                  client={c}
                  onSaved={() => {
                    setOpenPortalId(null);
                    load();
                  }}
                />
              )}
            </div>
          ))}
        {!loading && clients.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">لا يوجد عملاء بعد.</div>
        )}
      </Card>
    </div>
  );
}
