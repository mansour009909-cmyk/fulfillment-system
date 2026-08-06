import { Card } from "./ui/Card";

export function ComingSoon({ icon: Icon, title, description }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-gray-500 mb-6">{description}</p>

      <Card className="p-12 flex flex-col items-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
          <Icon size={32} strokeWidth={1.75} />
        </div>
        <div className="text-lg font-semibold text-gray-900 mb-1">قيد الإنشاء</div>
        <p className="text-gray-500 max-w-md">
          هذا القسم جزء من مرحلة قادمة بخطة تنفيذ النظام، ولسا ما بُني وظيفيًا.
        </p>
      </Card>
    </div>
  );
}
