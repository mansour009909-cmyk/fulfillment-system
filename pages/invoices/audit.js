import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { FEE_LABELS } from "../../lib/fees";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

export async function getServerSideProps() {
  const logs = await prisma.feeAuditLog.findMany({
    orderBy: { changedAt: "desc" },
    include: { client: true },
    take: 100,
  });

  return {
    props: {
      logs: logs.map((l) => ({
        id: l.id,
        feeType: l.feeType,
        clientName: l.client ? l.client.name : null,
        oldAmount: l.oldAmount,
        newAmount: l.newAmount,
        changedBy: l.changedBy,
        changedAt: l.changedAt.toISOString(),
      })),
    },
  };
}

export default function FeeAuditLogPage({ logs }) {
  return (
    <div className="max-w-4xl">
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع للفواتير والرسوم
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">سجل تعديلات الرسوم</h1>
      <p className="text-gray-500 mb-6">سجل كامل وشفاف لجميع تعديلات الأسعار والرسوم</p>

      <Card className="divide-y divide-gray-100">
        {logs.map((log) => (
          <div key={log.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-900">{FEE_LABELS[log.feeType] || log.feeType}</div>
              <div className="text-sm text-gray-400">
                {log.clientName ? (
                  <Badge variant="info">{log.clientName} — سعر مخصص</Badge>
                ) : (
                  <Badge variant="neutral">سعر عام</Badge>
                )}
              </div>
            </div>
            <div className="text-left">
              <div className="text-sm">
                <span className="text-red-500 line-through">{log.oldAmount.toFixed(2)}</span>{" "}
                <span className="text-green-600 font-medium">{log.newAmount.toFixed(2)}</span>
              </div>
              <div className="text-xs text-gray-400">
                {log.changedBy} — {new Date(log.changedAt).toLocaleString("ar-SA-u-nu-latn")}
              </div>
            </div>
          </div>
        ))}
        {logs.length === 0 && <div className="p-8 text-center text-gray-400">لا توجد تعديلات مسجّلة بعد.</div>}
      </Card>
    </div>
  );
}
