import { useState, useEffect } from "react";
import { ShieldCheck, Plus, KeyRound } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { MODULES } from "../../lib/adminModules";

const MODULE_KEYS = Object.keys(MODULES);

function ModuleCheckboxes({ selected, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {MODULE_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={selected.includes(key)}
            onChange={(e) => {
              if (e.target.checked) onChange([...selected, key]);
              else onChange(selected.filter((m) => m !== key));
            }}
          />
          {MODULES[key]}
        </label>
      ))}
    </div>
  );
}

function ResetPasswordForm({ user, onSaved }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin-users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: password }),
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
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="كلمة سر جديدة"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[160px]"
      />
      <button
        onClick={handleSave}
        disabled={saving || !password}
        className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ"}
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openResetId, setOpenResetId] = useState(null);
  const [editingModules, setEditingModules] = useState({}); // { [userId]: string[] }
  const [savingModulesId, setSavingModulesId] = useState(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newModules, setNewModules] = useState([]);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin-users");
    const data = await res.json();
    setUsers(data);
    setEditingModules(Object.fromEntries(data.map((u) => [u.id, u.modules])));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password, modules: newModules }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setUsername("");
    setPassword("");
    setNewModules([]);
    load();
  }

  async function toggleActive(user) {
    await fetch(`/api/admin-users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    load();
  }

  async function saveModules(userId) {
    setSavingModulesId(userId);
    await fetch(`/api/admin-users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: editingModules[userId] || [] }),
    });
    setSavingModulesId(null);
    load();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">صلاحيات الموظفين (الويب)</h1>
      </div>
      <p className="text-gray-500 mb-6">
        حسابات دخول لوحة التحكم بالويب — تختلف عن حسابات الجوال (رقم سري) بصفحة "الموظفون". حساب
        المدير له كل الصلاحيات دائمًا؛ أي تغيير بصلاحيات موظف يسري فورًا.
      </p>

      <Card className="p-4 mb-6">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم"
              className="flex-1 min-w-[160px] border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة سر (6 أحرف على الأقل)"
              className="w-56 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creating || !username.trim() || !password}
              className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              <Plus size={16} />
              إضافة حساب موظف
            </button>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-2">الصلاحيات الابتدائية (تقدر تعدّلها لاحقًا):</div>
            <ModuleCheckboxes selected={newModules} onChange={setNewModules} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      </Card>

      <Card className="divide-y divide-gray-100">
        {loading && <div className="p-6 text-center text-gray-400 text-sm">جاري التحميل...</div>}
        {!loading &&
          users.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{u.username}</div>
                  <div className="text-sm text-gray-400">
                    {u.role === "MANAGER" ? "مدير — كل الصلاحيات" : `${u.modules.length} قسم مسموح`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={u.active ? "success" : "neutral"}>{u.active ? "نشط" : "معطّل"}</Badge>
                  {u.role !== "MANAGER" && (
                    <>
                      <button
                        onClick={() => setOpenResetId(openResetId === u.id ? null : u.id)}
                        className="flex items-center gap-1 text-sm text-blue-600"
                      >
                        <KeyRound size={14} />
                        كلمة سر جديدة
                      </button>
                      <button onClick={() => toggleActive(u)} className="text-sm text-gray-500 hover:text-gray-800">
                        {u.active ? "تعطيل" : "تفعيل"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {openResetId === u.id && (
                <ResetPasswordForm
                  user={u}
                  onSaved={() => {
                    setOpenResetId(null);
                    load();
                  }}
                />
              )}

              {u.role !== "MANAGER" && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <ModuleCheckboxes
                    selected={editingModules[u.id] || []}
                    onChange={(mods) => setEditingModules((prev) => ({ ...prev, [u.id]: mods }))}
                  />
                  <button
                    onClick={() => saveModules(u.id)}
                    disabled={savingModulesId === u.id}
                    className="mt-2 bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-gray-900 disabled:opacity-50"
                  >
                    {savingModulesId === u.id ? "جاري الحفظ..." : "حفظ الصلاحيات"}
                  </button>
                </div>
              )}
            </div>
          ))}
        {!loading && users.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">لا يوجد حسابات موظفين بعد.</div>
        )}
      </Card>
    </div>
  );
}
