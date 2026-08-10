import { prisma } from "./prisma";

// محادثة دعم — بدون نظام تذاكر: محادثة واحدة مستمرة لكل عميل/مورد مع الإدارة.
// partyType: "CLIENT" | "SUPPLIER" — يحدد أي عمود (clientId/supplierId) يُستخدم.

function whereFor(partyType, partyId) {
  return partyType === "CLIENT" ? { clientId: partyId } : { supplierId: partyId };
}

export async function getThread(partyType, partyId) {
  return prisma.chatMessage.findMany({
    where: whereFor(partyType, partyId),
    orderBy: { createdAt: "asc" },
  });
}

// senderRole: من أرسل هذي الرسالة تحديدًا — ADMIN لو الإدارة، أو نفس partyType لو الطرف الآخر
export async function sendMessage(partyType, partyId, senderRole, body) {
  const text = (body || "").trim();
  if (!text) return { error: { status: 400, body: { error: "الرسالة فارغة" } } };

  const message = await prisma.chatMessage.create({
    data: {
      ...whereFor(partyType, partyId),
      senderRole,
      body: text,
      readByAdmin: senderRole === "ADMIN",
      readByParty: senderRole !== "ADMIN",
    },
  });
  return { result: message };
}

// يعلّم كل رسائل المحادثة كمقروءة من جهة القارئ (الإدارة أو الطرف نفسه)
export async function markRead(partyType, partyId, readerRole) {
  const data = readerRole === "ADMIN" ? { readByAdmin: true } : { readByParty: true };
  await prisma.chatMessage.updateMany({ where: whereFor(partyType, partyId), data });
  return { result: { ok: true } };
}

// قائمة كل المحادثات (عملاء + موردين) لصندوق وارد الإدارة — آخر رسالة + عدد غير مقروء لكل طرف
export async function listThreadsForAdmin() {
  const [clients, suppliers] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        chatMessages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { chatMessages: { where: { readByAdmin: false, senderRole: "CLIENT" } } } },
      },
    }),
    prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
        chatMessages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { chatMessages: { where: { readByAdmin: false, senderRole: "SUPPLIER" } } } },
      },
    }),
  ]);

  const clientThreads = clients
    .filter((c) => c.chatMessages.length > 0)
    .map((c) => ({
      partyType: "CLIENT",
      partyId: c.id,
      partyName: c.name,
      lastMessage: c.chatMessages[0],
      unreadCount: c._count.chatMessages,
    }));

  const supplierThreads = suppliers
    .filter((s) => s.chatMessages.length > 0)
    .map((s) => ({
      partyType: "SUPPLIER",
      partyId: s.id,
      partyName: s.name,
      lastMessage: s.chatMessages[0],
      unreadCount: s._count.chatMessages,
    }));

  return [...clientThreads, ...supplierThreads].sort(
    (a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
  );
}
