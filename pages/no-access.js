import { ShieldOff } from "lucide-react";

// وجهة أي تحويل بسبب رفض صلاحية — صفحة عامة بسيطة (بدون Sidebar ولا أي قسم محدَّد)،
// عشان تبقى وصول آمن دائمًا حتى لو الموظف ما عنده صلاحية "الرئيسية" نفسها.
export default function NoAccessPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
          <ShieldOff size={26} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">ما عندك صلاحية الوصول</h1>
        <p className="text-gray-500 text-sm">
          حسابك ما له صلاحية على هذا القسم حاليًا. تواصل مع المدير عشان يفعّل لك القسم المطلوب.
        </p>
      </div>
    </div>
  );
}
