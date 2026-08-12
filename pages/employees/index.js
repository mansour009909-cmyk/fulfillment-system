import { useState, useEffect } from "react";
import Link from "next/link";
import { UserCog, Plus, Smartphone, Monitor, ChevronLeft } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
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
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), pin: pin.trim() || undefined }),
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <UserCog size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">الموظفون</h1>
      </div>
      <p className="text-gray-500 mb-6">
        اضغط على أي موظف لإدارة رقمه السري (تطبيق الجوال)، أو منحه حساب دخول للوحة التحكم بالويب وصلاحياته.
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
            placeholder="رقم سري (اختياري — للجوال)"
            className="w-56 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
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
            <Link
              key={e.id}
              href={`/employees/${e.id}`}
              className="flex justify-between items-center p-4 hover:bg-gray-50 transition"
            >
              <div>
                <div className="font-medium text-gray-900">{e.name}</div>
                <div className="text-sm text-gray-400">
                  {e.fulfilledCount} طلب مكتمل
                  {e.errorCount > 0 && <span className="text-amber-600"> — {e.errorCount} خطأ مسجَّل</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {e.role === "MANAGER" && <Badge variant="info">مدير</Badge>}
                {e.hasMobileAccess && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Smartphone size={14} /> جوال
                  </span>
                )}
                {e.hasWebAccess && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Monitor size={14} /> ويب
                  </span>
                )}
                <Badge variant={e.active ? "success" : "neutral"}>{e.active ? "نشط" : "معطّل"}</Badge>
                <ChevronLeft size={18} className="text-gray-300" />
              </div>
            </Link>
          ))}
        {!loading && employees.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">لا يوجد موظفون بعد.</div>
        )}
      </Card>
    </div>
  );
}
