import { prisma } from "./prisma";

// يرجع السعر الفعّال لنوع رسم معيّن: سعر مخصص للعميل إن وُجد، وإلا السعر العام
// ملاحظة: findFirst (وليس findUnique على المفتاح المركّب) لأن clientId قد يكون null،
// وPrisma لا يسمح بـ null داخل where لمفتاح فريد مركّب
export async function getEffectiveFee(type, clientId) {
  if (clientId) {
    const custom = await prisma.fee.findFirst({ where: { type, clientId } });
    if (custom) return custom.amount;
  }

  const general = await prisma.fee.findFirst({ where: { type, clientId: null } });
  return general ? general.amount : 0;
}

export const FEE_LABELS = {
  FULFILLMENT: "رسوم التجهيز",
  LABEL: "رسوم البوليصة",
  SHIPPING: "رسوم الشحن",
  CARTON_SMALL: "كرتون صغير",
  CARTON_LARGE: "كرتون كبير",
  BUBBLES: "فقاعات",
  SHIPPING_BAG: "كيس شحن",
  STORAGE: "تخزين (لكل قطعة/يوم)",
};
