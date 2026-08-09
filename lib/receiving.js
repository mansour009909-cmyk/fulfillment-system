import { prisma } from "./prisma";

// يحذف كل عمليات المسح غير المرتبطة بأي فاتورة لكتاب معيّن (تصحيح مسح صار بالغلط) —
// لا يمس أي مخزون أو فاتورة، لأن هذي المسحات أصلًا غير مطابَقة/معتمدة بعد
export async function deleteUnmatchedScans(bookId) {
  const result = await prisma.receivingScan.deleteMany({ where: { bookId, invoiceId: null } });
  return { result: { deleted: result.count } };
}
