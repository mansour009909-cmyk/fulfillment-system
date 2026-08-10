import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { ChatThread } from "../../../components/chat/ChatThread";

export async function getServerSideProps({ params }) {
  const supplier = await prisma.supplier.findUnique({ where: { id: Number(params.id) }, select: { id: true, name: true } });
  if (!supplier) return { notFound: true };
  return { props: { supplier } };
}

export default function AdminSupplierChat({ supplier }) {
  return (
    <div className="max-w-2xl">
      <Link href="/chat" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع لمحادثات الدعم
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">{supplier.name} (مورد)</h1>
      <ChatThread
        apiUrl={`/api/chat/supplier/${supplier.id}`}
        ownRole="ADMIN"
        ownLabel="أنت"
        otherLabel={supplier.name}
      />
    </div>
  );
}
