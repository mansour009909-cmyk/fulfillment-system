import { Card } from "./Card";

const ICON_BG = {
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
};

export function KpiCard({ icon: Icon, label, value, color = "blue" }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-2">{label}</div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
        </div>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${ICON_BG[color]}`}>
          <Icon size={22} strokeWidth={2} />
        </div>
      </div>
    </Card>
  );
}
