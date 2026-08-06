import { useState, useEffect } from "react";
import { UserCog, Plus, KeyRound } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

function ResetPinForm({ employee, onSaved }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setPin("");
    onSaved();
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg flex flex-wrap items-center gap-2">
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="رقم سري جديد"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[140px]"
      />
      <button
        onClick={handleSave}
        disabled={saving || !pin}
        className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ"}
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openResetId, setOpenResetId] = useState(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/employees");
    setEmployees(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !pin.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), pin: pin.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setName("");
    setPin("");
    load();
  }

  async function toggleActive(employee) {
    await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !employee.active }),
    });
    load();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <UserCog size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">الموظفون</h1>
      </div>
      <p className="text-gray-500 mb-6">
        موظفو المستودع اللي يسجّلون دخول تطبيق الجوال (اللقط والتحقق) — منفصل عن حساب لوحة التحكم بالويب
      </p>

      <Card className="p-4 mb-6">
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم الموظف"
            className="flex-1 min-w-[160px] border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="رقم سري (4 أرقام على الأقل)"
            className="w-52 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating || !name.trim() || !pin.trim()}
            className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            <Plus size={16} />
            إضافة موظف
          </button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </Card>

      <Card className="divide-y divide-gray-100">
        {loading && <div className="p-6 text-center text-gray-400 text-sm">جاري التحميل...</div>}
        {!loading &&
          employees.map((e) => (
            <div key={e.id} className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{e.name}</div>
                  <div className="text-sm text-gray-400">{e.fulfilledCount} طلب مكتمل</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={e.active ? "success" : "neutral"}>{e.active ? "نشط" : "معطّل"}</Badge>
                  <button
                    onClick={() => setOpenResetId(openResetId === e.id ? null : e.id)}
                    className="flex items-center gap-1 text-sm text-blue-600"
                  >
                    <KeyRound size={14} />
                    رقم سري جديد
                  </button>
                  <button onClick={() => toggleActive(e)} className="text-sm text-gray-500 hover:text-gray-800">
                    {e.active ? "تعطيل" : "تفعيل"}
                  </button>
                </div>
              </div>
              {openResetId === e.id && (
                <ResetPinForm
                  employee={e}
                  onSaved={() => {
                    setOpenResetId(null);
                    load();
                  }}
                />
              )}
            </div>
          ))}
        {!loading && employees.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">لا يوجد موظفون بعد.</div>
        )}
      </Card>
    </div>
  );
}
