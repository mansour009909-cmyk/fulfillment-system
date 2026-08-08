import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { BarcodeLabelSheet } from "../../../components/BarcodeLabelSheet";

export async function getServerSideProps({ params }) {
  const order = await prisma.order.findUnique({ where: { id: Number(params.id) } });
  if (!order) return { notFound: true };

  return { props: { order: { id: order.id, orderNumber: order.orderNumber } } };
}

export default function OrderBoxBarcode({ order }) {
  return (
    <div className="max-w-md">
      <div className="print:hidden mb-6">
        <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-1 text-sm text-blue-600">
          <ArrowRight size={14} />
          رجوع للطلب
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 mt-4 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700"
        >
          <Printer size={16} />
          طباعة
        </button>
      </div>

      <BarcodeLabelSheet items={[{ id: order.id, code: order.orderNumber, title: `صندوق #${order.orderNumber}` }]} />
    </div>
  );
}
