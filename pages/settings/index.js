import { useState } from "react";
import { Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { getSettings } from "../../lib/settings";
import { Card } from "../../components/ui/Card";

export async function getServerSideProps() {
  const settings = await getSettings();

  return {
    props: {
      settings: {
        warehouseName: settings.warehouseName,
        importantSupplierSharePercent: settings.importantSupplierSharePercent,
        minOrderQtyTotal: settings.minOrderQtyTotal,
        minOrderQtyPerTitle: settings.minOrderQtyPerTitle,
        defaultSalesPeriodDays: settings.defaultSalesPeriodDays,
        delayDaysDomestic: settings.delayDaysDomestic,
        delayDaysInternational: settings.delayDaysInternational,
      },
      adminUsername: settings.adminUsername,
    },
  };
}

function AdminAccountForm({ currentUsername }) {
  const [username, setUsername] = useState(currentUsername);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    const res = await fetch("/api/settings/admin-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSaved(true);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">كلمة السر الحالية</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">كلمة السر الجديدة</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">تم تحديث حساب الإدارة بنجاح.</p>}
      <button
        type="submit"
        disabled={saving}
        className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "تحديث بيانات الدخول"}
      </button>
    </form>
  );
}

export default function SettingsPage({ settings, adminUsername }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <SettingsIcon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
          <p className="text-gray-500 text-sm">إعدادات عامة تؤثر مباشرة على سلوك النظام</p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستودع</label>
            <input
              value={form.warehouseName}
              onChange={(e) => set("warehouseName", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">يظهر بالشريط العلوي بكل صفحات النظام.</p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">الطلبيات الآلية للموردين (قسم 8)</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                نسبة كتالوج المورد "المهم" المُدرَجة تلقائيًا بالطلبية المقترحة (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.importantSupplierSharePercent}
                onChange={(e) => set("importantSupplierSharePercent", e.target.value)}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                عند اقتراح طلبية لمورد مصنَّف "مهم"، يُدرَج تلقائيًا أعلى هذي النسبة من كتالوجه (مرتّبة حسب المبيعات).
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الحد الأدنى الإجمالي المعتاد للطلبية
              </label>
              <input
                type="number"
                min="0"
                value={form.minOrderQtyTotal}
                onChange={(e) => set("minOrderQtyTotal", e.target.value)}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                تنبيه غير مانع فقط يظهر بصفحة الطلبية لو الكمية الإجمالية أقل من هذا الرقم — لا يمنع تأكيد الطلب.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى لكل عنوان مُدرَج</label>
              <input
                type="number"
                min="1"
                value={form.minOrderQtyPerTitle}
                onChange={(e) => set("minOrderQtyPerTitle", e.target.value)}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الفترة الافتراضية لحساب المبيعات (يوم)
              </label>
              <input
                type="number"
                min="1"
                value={form.defaultSalesPeriodDays}
                onChange={(e) => set("defaultSalesPeriodDays", e.target.value)}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                تُطبَّق تلقائيًا على أي مورد جديد (قابلة للتخصيص لاحقًا لكل مورد على حدة)، وتحدّد نطاق صفحة التقارير.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">تنبيه تأخير الطلبية (قسم 8.4)</h2>
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مورد داخلي (يوم)</label>
                <input
                  type="number"
                  min="1"
                  value={form.delayDaysDomestic}
                  onChange={(e) => set("delayDaysDomestic", e.target.value)}
                  className="w-28 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مورد خارجي (يوم)</label>
                <input
                  type="number"
                  min="1"
                  value={form.delayDaysInternational}
                  onChange={(e) => set("delayDaysInternational", e.target.value)}
                  className="w-28 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              تظهر شارة "متأخرة" على الطلبية لو تجاوز الوقت منذ "تم الطلب" هذي المدة بدون وصول.
            </p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {saved && <p className="text-green-600 text-sm">تم الحفظ بنجاح.</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        </form>
      </Card>

      <Card className="p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="font-medium text-gray-900">حساب الإدارة</div>
            <p className="text-sm text-gray-500">اسم المستخدم وكلمة السر لتسجيل الدخول للوحة التحكم بالويب.</p>
          </div>
        </div>
        <AdminAccountForm currentUsername={adminUsername} />
      </Card>
    </div>
  );
}
