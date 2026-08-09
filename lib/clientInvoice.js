import { prisma } from "./prisma";

// يحذف فاتورة عميل تم إنشاؤها بالغلط — يحرر شحناتها (OrderCharge) لتكون غير مفوترة
// مجددًا فتدخل ضمن أول فاتورة قادمة. لا يمس Order أو ShelfStock (الفاتورة مجرّد تجميع
// رسوم، لا أثر مالي/مخزني مباشر لها غير حقل invoiced على الشحنة).
export async function deleteClientInvoice(invoiceId) {
  const invoice = await prisma.clientInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: { status: 404, body: { error: "الفاتورة غير موجودة" } } };

  if (invoice.status === "PAID") {
    return {
      error: {
        status: 400,
        body: { error: "لا يمكن حذف فاتورة مدفوعة بالفعل — سُجّلت كتسوية مالية نهائية" },
      },
    };
  }

  await prisma.orderCharge.updateMany({
    where: { invoiceId },
    data: { invoiced: false, invoiceId: null },
  });
  await prisma.clientInvoice.delete({ where: { id: invoiceId } });

  return { result: { ok: true } };
}
