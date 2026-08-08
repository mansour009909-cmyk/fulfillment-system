import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { BarcodeLabelSheet } from "../../components/BarcodeLabelSheet";
import { boxCode } from "../../lib/orderFulfillment";

// يطبع ملصقات الصناديق الفعلية الثابتة (BOX-01..BOX-N) — تُطبع مرة واحدة وتُعاد استخدامها
// باستمرار أثناء اللقط، بدل ملصق جديد لكل طلب (راجع SystemSetting.boxCount)
export async function getServerSideProps() {
  const settings = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  const boxCount = settings?.boxCount ?? 30;
  return { props: { boxCount } };
}

export default function PrintAllBoxes({ boxCount }) {
  const items = Array.from({ length: boxCount }, (_, i) => {
    const n = i + 1;
    return { id: n, code: boxCode(n), title: `صندوق رقم ${n}` };
  });

  return (
    <div className="max-w-md">
      <div className="print:hidden mb-6">
        <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للطلبات
        </Link>
        <p className="text-sm text-gray-500 my-3">
          {boxCount} صندوق ثابت — تُطبع مرة واحدة وتُلصق على الصناديق الفعلية بالمستودع، وتُعاد
          استخدامها تلقائيًا لكل طلب جديد (صفحة طباعة 100×150مم).
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700"
        >
          <Printer size={16} />
          طباعة كل ملصقات الصناديق ({boxCount})
        </button>
      </div>

      <BarcodeLabelSheet items={items} />
    </div>
  );
}
