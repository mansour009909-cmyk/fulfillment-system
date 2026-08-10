import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { PortalLayout } from "../../../components/portal/PortalLayout";
import { CLIENT_TABS } from "../../../components/portal/portalTabs";
import { ChatThread } from "../../../components/chat/ChatThread";

export async function getServerSideProps({ req }) {
  const session = await getSession(req, "CLIENT");
  const client = await prisma.client.findUnique({ where: { id: session.id } });
  if (!client) return { notFound: true };
  return { props: { clientName: client.name } };
}

export default function ClientSupport({ clientName }) {
  return (
    <PortalLayout
      name={clientName}
      roleLabel="بوابة العميل"
      tabs={CLIENT_TABS}
      logoutUrl="/api/portal/client/logout"
      loginUrl="/portal/client/login"
    >
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-4">الدعم</h1>
        <ChatThread apiUrl="/api/portal/client/chat" ownRole="CLIENT" ownLabel="أنت" otherLabel="الدعم" />
      </div>
    </PortalLayout>
  );
}
