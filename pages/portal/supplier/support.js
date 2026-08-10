import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/webAuth";
import { PortalLayout } from "../../../components/portal/PortalLayout";
import { SUPPLIER_TABS } from "../../../components/portal/portalTabs";
import { ChatThread } from "../../../components/chat/ChatThread";

export async function getServerSideProps({ req }) {
  const session = await getSession(req, "SUPPLIER");
  const supplier = await prisma.supplier.findUnique({ where: { id: session.id } });
  if (!supplier) return { notFound: true };
  return { props: { supplierName: supplier.name } };
}

export default function SupplierSupport({ supplierName }) {
  return (
    <PortalLayout
      name={supplierName}
      roleLabel="بوابة المورد"
      tabs={SUPPLIER_TABS}
      logoutUrl="/api/portal/supplier/logout"
      loginUrl="/portal/supplier/login"
    >
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-4">الدعم</h1>
        <ChatThread apiUrl="/api/portal/supplier/chat" ownRole="SUPPLIER" ownLabel="أنت" otherLabel="الدعم" />
      </div>
    </PortalLayout>
  );
}
