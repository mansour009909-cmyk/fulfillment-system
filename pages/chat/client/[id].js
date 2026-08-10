import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { ChatThread } from "../../../components/chat/ChatThread";

export async function getServerSideProps({ params }) {
  const client = await prisma.client.findUnique({ where: { id: Number(params.id) }, select: { id: true, name: true } });
  if (!client) return { notFound: true };
  return { props: { client } };
}

export default function AdminClientChat({ client }) {
  return (
    <div className="max-w-2xl">
      <Link href="/chat" className="inline-flex items-center gap-1 text-sm text-blue-600 mb-2">
        <ArrowRight size={14} />
        رجوع لمحادثات الدعم
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-4">{client.name} (عميل)</h1>
      <ChatThread apiUrl={`/api/chat/client/${client.id}`} ownRole="ADMIN" ownLabel="أنت" otherLabel={client.name} />
    </div>
  );
}
