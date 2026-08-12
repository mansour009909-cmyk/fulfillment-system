import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, UserCog, Smartphone, Monitor, KeyRound, Trash2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { prisma } from "../../lib/prisma";
import { MODULES } from "../../lib/adminModules";

export async function getServerSideProps({ params }) {
  const id = Number(params.id);
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      permissions: { select: { module: true } },
      _count: { select: { fulfilledOrders: true, errorLogs: true } },
    },
  });
  if (!employee) return { notFound: true };

  return {
    props: {
      employee: {
        id: employee.id,
        name: employee.name,
        active: employee.active,
        hasMobileAccess: Boolean(employee.pinHash),
        username: employee.username,
        role: employee.role,
        modules: employee.permissions.map((p) => p.module),
        fulfilledCount: employee._count.fulfilledOrders,
        errorCount: employee._count.errorLogs,
      },
    },
  };
}

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

export default function EmployeeDetailPage({ employee }) {
  const router = useRouter();
  const [active, setActive] = useState(employee.active);
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState(null);

  const [grantUsername, setGrantUsername] = useState("");
  const [grantPassword, setGrantPassword] = useState("");
  const [grantMsg, setGrantMsg] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState(null);

  const [modules, setModules] = useState(employee.modules);
  const [savingModules, setSavingModules] = useState(false);
  const [modulesMsg, setModulesMsg] = useState(null);

  const [deleteError, setDeleteError] = useState(null);

  async function patch(body) {
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  }

  async function toggleActive() {
    const next = !active;
    const { ok } = await patch({ active: next });
    if (ok) setActive(next);
  }

  async function savePin(e) {
    e.preventDefault();
    setPinMsg(null);
    const { ok, data } = await patch({ pin });
    setPinMsg(ok ? "تم الحفظ" : data.error);
    if (ok) setPin("");
  }

  async function grantWebAccess(e) {
    e.preventDefault();
    setGrantMsg(null);
    const { ok, data } = await patch({ username: grantUsername, password: grantPassword });
    if (ok) {
      router.replace(router.asPath);
    } else {
      setGrantMsg(data.error);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setPasswordMsg(null);
    const { ok, data } = await patch({ newPassword });
    setPasswordMsg(ok ? "تم الحفظ" : data.error);
    if (ok) setNewPassword("");
  }

  async function revokeWebAccess() {
    const { ok } = await patch({ revokeWebAccess: true });
    if (ok) router.replace(router.asPath);
  }

  async function saveModules() {
    setSavingModules(true);
    setModulesMsg(null);
    const { ok, data } = await patch({ modules });
    setSavingModules(false);
    setModulesMsg(ok ? "تم حفظ الصلاحيات" : data.error);
  }

  async function handleDelete() {
    if (!confirm(`حذف الموظف "${employee.name}" نهائيًا؟`)) return;
    setDeleteError(null);
    const res = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setDeleteError(data.error);
      return;
    }
    router.push("/employees");
  }

  return (
    <div>
      <Link href="/employees" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={16} />
        رجوع لقائمة الموظفين
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <UserCog size={22} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
          {employee.role === "MANAGER" && <Badge variant="info">مدير</Badge>}
          <Badge variant={active ? "success" : "neutral"}>{active ? "نشط" : "معطّل"}</Badge>
        </div>
        <button onClick={toggleActive} className="text-sm text-gray-500 hover:text-gray-800">
          {active ? "تعطيل الحساب" : "تفعيل الحساب"}
        </button>
      </div>

      <div className="text-sm text-gray-400 mb-6">
        {employee.fulfilledCount} طلب مكتمل
        {employee.errorCount > 0 && <span className="text-amber-600"> — {employee.errorCount} خطأ مسجَّل</span>}
      </div>

      <Card className="p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone size={18} className="text-gray-500" />
          <h2 className="font-medium text-gray-900">الدخول بتطبيق الجوال (المستودع)</h2>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          {employee.hasMobileAccess ? "عنده رقم سري حاليًا." : "ما عنده رقم سري بعد."}
        </p>
        <form onSubmit={savePin} className="flex flex-wrap items-center gap-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={employee.hasMobileAccess ? "رقم سري جديد" : "تعيين رقم سري (4 أرقام على الأقل)"}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
          />
          <button
            type="submit"
            disabled={!pin}
            className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          >
            <KeyRound size={14} />
            حفظ
          </button>
        </form>
        {pinMsg && <p className="text-xs mt-2 text-gray-500">{pinMsg}</p>}
      </Card>

      <Card className="p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Monitor size={18} className="text-gray-500" />
          <h2 className="font-medium text-gray-900">الدخول بلوحة التحكم (الويب)</h2>
        </div>

        {employee.role === "MANAGER" ? (
          <p className="text-sm text-gray-400">حساب المدير — له كل الصلاحيات دائمًا، بدون حاجة لتحديد أقسام.</p>
        ) : employee.username ? (
          <>
            <p className="text-sm text-gray-500 mb-3">
              اسم المستخدم: <span className="font-medium text-gray-800">{employee.username}</span>
            </p>
            <form onSubmit={resetPassword} className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="كلمة سر جديدة"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
              />
              <button
                type="submit"
                disabled={!newPassword}
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              >
                حفظ كلمة السر
              </button>
              <button
                type="button"
                onClick={revokeWebAccess}
                className="text-sm text-red-600 hover:text-red-800"
              >
                إلغاء الوصول للويب
              </button>
            </form>
            {passwordMsg && <p className="text-xs mb-3 text-gray-500">{passwordMsg}</p>}

            <div className="pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-2">الأقسام المسموحة:</div>
              <ModuleCheckboxes selected={modules} onChange={setModules} />
              <button
                onClick={saveModules}
                disabled={savingModules}
                className="mt-3 bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {savingModules ? "جاري الحفظ..." : "حفظ الصلاحيات"}
              </button>
              {modulesMsg && <p className="text-xs mt-2 text-gray-500">{modulesMsg}</p>}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-3">ما عنده وصول للوحة التحكم بالويب.</p>
            <form onSubmit={grantWebAccess} className="flex flex-wrap gap-2">
              <input
                value={grantUsername}
                onChange={(e) => setGrantUsername(e.target.value)}
                placeholder="اسم مستخدم"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]"
              />
              <input
                type="password"
                value={grantPassword}
                onChange={(e) => setGrantPassword(e.target.value)}
                placeholder="كلمة سر (6 أحرف على الأقل)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56"
              />
              <button
                type="submit"
                disabled={!grantUsername.trim() || !grantPassword}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                منح صلاحية دخول الويب
              </button>
            </form>
            {grantMsg && <p className="text-red-600 text-xs mt-2">{grantMsg}</p>}
          </>
        )}
      </Card>

      {employee.role !== "MANAGER" && (
        <Card className="p-5">
          <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800">
            <Trash2 size={16} />
            حذف الموظف نهائيًا
          </button>
          {deleteError && <p className="text-red-600 text-xs mt-2">{deleteError}</p>}
        </Card>
      )}
    </div>
  );
}
