import { prisma } from "./prisma";
import { pushStockUpdate } from "./salla";

// يزامن الكمية المشتركة المتوفرة لكتاب معيّن مع كل متاجر سلة المربوطة (اتجاه: نظامنا → سلة) —
// عشان ما يبيع أي متجر أكثر من المتوفر فعليًا بمخزوننا المشترك. best-effort بالكامل: فشل أي
// متجر لا يوقف الباقي، وفشل الكل لا يكسر العملية اللي استدعته (لقط/استلام) — يُستدعى بدون
// انتظار (fire-and-forget) من نقاط تغيّر المخزون المشترك.
export async function syncStockToSalla(bookId) {
  try {
    const [book, stockAgg, sallaIntegrations] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId } }),
      prisma.shelfStock.aggregate({
        where: { bookId, ownership: "SHARED" },
        _sum: { quantity: true },
      }),
      prisma.integration.findMany({ where: { provider: "SALLA", accessToken: { not: null } } }),
    ]);
    if (!book || sallaIntegrations.length === 0) return;

    const quantity = stockAgg._sum.quantity || 0;

    await Promise.allSettled(
      sallaIntegrations.map((integration) => pushStockUpdate(integration, book.barcode, quantity))
    );
  } catch {
    // لا نرمي — مزامنة سلة يجب ألا تكسر أي عملية مستودع فعلية
  }
}
