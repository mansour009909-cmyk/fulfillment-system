import { prisma } from "./prisma";
import { getEffectiveFee } from "./fees";
import { syncStockToSalla } from "./sallaSync";

// طبقة منطق مشتركة للقط/التحقق/الإكمال — تُستخدم من مسارات الويب الحالية (pages/api/orders/**)
// ومن مسارات الجوال الجديدة (pages/api/mobile/**) بدون تكرار الكود. كل دالة ترجّع
// { result } عند النجاح أو { error: { status, body } } عند الفشل — الأغلفة (routes) تحوّلها لاستجابة HTTP.

export const remainingOf = (i) => i.quantityRequired - i.quantityPicked - i.quantityShort;

// يخصّص للطلب رقم صندوق فعلي حر (من مجموعة الصناديق الثابتة القابلة لإعادة الاستخدام) عند أول لقط له،
// ويعيد نفس الرقم لو كان مخصَّصًا مسبقًا. يرجع null لو كل الصناديق مشغولة حاليًا بطلبات نشطة أخرى.
export async function ensureBoxNumber(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order.boxNumber) return order.boxNumber;

  const settings = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  const boxCount = settings?.boxCount ?? 30;

  const activeOrders = await prisma.order.findMany({
    where: { status: { not: "FULFILLED" }, boxNumber: { not: null } },
    select: { boxNumber: true },
  });
  const used = new Set(activeOrders.map((o) => o.boxNumber));
  let freeNumber = null;
  for (let n = 1; n <= boxCount; n++) {
    if (!used.has(n)) {
      freeNumber = n;
      break;
    }
  }
  if (!freeNumber) return null;

  await prisma.order.update({ where: { id: orderId }, data: { boxNumber: freeNumber } });
  return freeNumber;
}

export const boxCode = (n) => `BOX-${String(n).padStart(2, "0")}`;

// راجع قسم 4.3 (اللقط): مسح كتاب يوجّهه لأقدم طلب/صندوق يحتاجه، وينقص المخزون المشترك.
// batchId (اختياري): يقيّد البحث على طلبات دفعة جوّال معيّنة، مرتّبة برقم الصندوق بدل تاريخ الإنشاء.
export async function pickBookByBarcode(barcode, { batchId } = {}) {
  const book = await prisma.book.findUnique({ where: { barcode } });
  if (!book) {
    return { error: { status: 404, body: { error: "هذا الباركود غير مسجّل كـكتاب بالنظام" } } };
  }

  const orderWhere = batchId
    ? { status: "PENDING_REVIEW", pickingBatchOrder: { batchId } }
    : { status: "PENDING_REVIEW" };

  const allNeeding = await prisma.orderItem.findMany({
    where: { bookId: book.id, order: orderWhere },
    include: { order: { include: { pickingBatchOrder: true } } },
  });
  allNeeding.sort((a, b) =>
    batchId
      ? (a.order.pickingBatchOrder?.boxNumber ?? 0) - (b.order.pickingBatchOrder?.boxNumber ?? 0)
      : new Date(a.order.createdAt) - new Date(b.order.createdAt)
  );
  const item = allNeeding.find((i) => remainingOf(i) > 0);

  if (!item) {
    return {
      error: {
        status: 400,
        body: { error: "لا يوجد طلب بالدفعة الحالية يحتاج هذا الكتاب الآن" },
      },
    };
  }

  const stock = await prisma.shelfStock.findFirst({
    where: { bookId: book.id, ownership: "SHARED", clientId: null, quantity: { gt: 0 } },
    include: { shelf: true },
  });

  if (!stock) {
    await prisma.order.update({ where: { id: item.order.id }, data: { status: "IN_REVIEW" } });

    const stillNeeding = await prisma.orderItem.findMany({ where: { bookId: book.id, order: orderWhere } });
    const remainingForBook = stillNeeding.reduce((sum, i) => sum + Math.max(0, remainingOf(i)), 0);

    return {
      error: {
        status: 409,
        body: {
          error: `لا يوجد مخزون كافٍ لهذا الكتاب — تحوّل الطلب #${item.order.orderNumber} إلى "قيد التنفيذ" لمراجعته`,
          orderNumber: item.order.orderNumber,
          book: { title: book.title, barcode: book.barcode },
          remainingForBook,
        },
      },
    };
  }

  const updatedStock = await prisma.shelfStock.update({
    where: { id: stock.id },
    data: { quantity: { decrement: 1 } },
  });
  syncStockToSalla(book.id).catch(() => {});
  const updatedItem = await prisma.orderItem.update({
    where: { id: item.id },
    data: { quantityPicked: { increment: 1 } },
  });

  const stillNeeding = await prisma.orderItem.findMany({ where: { bookId: book.id, order: orderWhere } });
  const remainingForBook = stillNeeding.reduce((sum, i) => sum + Math.max(0, remainingOf(i)), 0);

  // رقم الصندوق: بدفعة جوّال يُستخدم رقم الدفعة الثابت (PickingBatchOrder.boxNumber)،
  // وبمسار الويب العام يُخصَّص رقم صندوق عام حر عند أول لقط لهذا الطلب (راجع ensureBoxNumber)
  const boxNumber = batchId ? item.order.pickingBatchOrder?.boxNumber ?? null : await ensureBoxNumber(item.order.id);

  return {
    result: {
      book: {
        id: book.id,
        title: book.title,
        barcode: book.barcode,
        imageUrl: book.imageUrl,
        brandName: book.brandName,
        brandImageUrl: book.brandImageUrl,
      },
      orderId: item.order.id,
      orderNumber: item.order.orderNumber,
      boxNumber,
      quantityPicked: updatedItem.quantityPicked,
      quantityRequired: updatedItem.quantityRequired,
      shelfId: stock.shelfId,
      shelfName: stock.shelf.name,
      shelfQuantity: updatedStock.quantity,
      remainingForBook,
    },
  };
}

// يعلن باقي الكمية المطلوبة من كتاب معيّن بدفعة جوّال "غير متوفرة" (تخطّي) — بدون لمس المخزون
export async function skipBookInBatch(batchId, bookId) {
  const batchOrders = await prisma.pickingBatchOrder.findMany({
    where: { batchId },
    include: { order: { include: { items: true } } },
  });

  let skipped = 0;
  for (const bo of batchOrders) {
    const item = bo.order.items.find((i) => i.bookId === bookId);
    if (!item) continue;
    const remaining = remainingOf(item);
    if (remaining <= 0) continue;
    await prisma.orderItem.update({ where: { id: item.id }, data: { quantityShort: { increment: remaining } } });
    skipped += remaining;
  }
  return { skipped };
}

// راجع قسم 4.4 خطوة 1: مسح باركود الصندوق الفعلي (عام وقابل لإعادة الاستخدام — BOX-01..BOX-N) قبل البدء بالتحقق
export async function scanBox(orderId, barcode) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: { status: 404, body: { error: "الطلب غير موجود" } } };

  const match = /^BOX-(\d+)$/.exec((barcode || "").trim().toUpperCase());
  if (!match) {
    return { error: { status: 400, body: { error: "هذا مو باركود صندوق (الصيغة المتوقعة: BOX-01)" } } };
  }
  const scannedNumber = Number(match[1]);

  if (!order.boxNumber) {
    // لم يُخصَّص صندوق لهذا الطلب بعد (مثلًا ما احتاج أي لقط) — نتحقق أن الصندوق الممسوح حر ونخصصه الآن
    const takenBy = await prisma.order.findFirst({
      where: { status: { not: "FULFILLED" }, boxNumber: scannedNumber, id: { not: orderId } },
    });
    if (takenBy) {
      return { error: { status: 409, body: { error: `الصندوق رقم ${scannedNumber} مستخدَم حاليًا بطلب #${takenBy.orderNumber}` } } };
    }
    await prisma.order.update({ where: { id: orderId }, data: { boxNumber: scannedNumber, boxScanned: true } });
    return { result: { ok: true, boxNumber: scannedNumber } };
  }

  if (scannedNumber !== order.boxNumber) {
    return {
      error: { status: 400, body: { error: `هذا الصندوق رقم ${scannedNumber} — الطلب مخصَّص له الصندوق رقم ${order.boxNumber}` } },
    };
  }
  await prisma.order.update({ where: { id: orderId }, data: { boxScanned: true } });
  return { result: { ok: true, boxNumber: order.boxNumber } };
}

// راجع قسم 4.4 خطوة 2: مسح كل كتاب يوضع بالصندوق ومقارنته بالكمية المطلوبة
export async function verifyItemScan(orderId, barcode) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: { status: 404, body: { error: "الطلب غير موجود" } } };
  if (!order.boxScanned) return { error: { status: 400, body: { error: "امسح باركود الصندوق أولًا" } } };

  const book = await prisma.book.findUnique({ where: { barcode } });
  if (!book) return { error: { status: 404, body: { error: "هذا الباركود غير مسجّل كـكتاب بالنظام" } } };

  const item = await prisma.orderItem.findFirst({ where: { orderId, bookId: book.id } });
  if (!item) {
    return {
      error: {
        status: 409,
        body: {
          error: `كتاب زائد: "${book.title}" غير موجود ضمن طلب هذا الصندوق أصلًا`,
          excess: true,
          book: { title: book.title, barcode: book.barcode },
        },
      },
    };
  }
  if (item.quantityVerified >= item.quantityRequired) {
    return {
      error: {
        status: 409,
        body: {
          error: `كتاب زائد: "${book.title}" — تم مسح الكمية المطلوبة بالكامل مسبقًا`,
          excess: true,
          book: { title: book.title, barcode: book.barcode },
        },
      },
    };
  }

  const updated = await prisma.orderItem.update({
    where: { id: item.id },
    data: { quantityVerified: { increment: 1 } },
  });

  const items = await prisma.orderItem.findMany({ where: { orderId }, include: { book: true } });
  const complete = items.every((i) => i.quantityVerified === i.quantityRequired);

  return {
    result: {
      book: { title: book.title, barcode: book.barcode },
      quantityVerified: updated.quantityVerified,
      quantityRequired: updated.quantityRequired,
      complete,
      items: items.map((i) => ({
        bookId: i.bookId,
        title: i.book.title,
        barcode: i.book.barcode,
        imageUrl: i.book.imageUrl,
        brandName: i.book.brandName,
        brandImageUrl: i.book.brandImageUrl,
        quantityRequired: i.quantityRequired,
        quantityVerified: i.quantityVerified,
      })),
    },
  };
}

// تراجع عن آخر مسح تحقق لكتاب معيّن
export async function undoVerify(orderId, bookId) {
  const item = await prisma.orderItem.findFirst({ where: { orderId, bookId: Number(bookId) } });
  if (!item || item.quantityVerified <= 0) {
    return { error: { status: 400, body: { error: "لا يوجد مسح سابق للتراجع عنه" } } };
  }
  const updated = await prisma.orderItem.update({
    where: { id: item.id },
    data: { quantityVerified: { decrement: 1 } },
  });
  return { result: { quantityVerified: updated.quantityVerified } };
}

// راجع قسم 4.4: عند اكتمال كل البنود يتحول الطلب لحالة "تم التنفيذ" وتُحسب رسومه كلقطة ثابتة
// employeeId (اختياري): يُسجَّل مين نفّذ الطلب فعليًا (تسجيل دخول موظف بالجوال) — لإحصائية الأداء
// حجم الطلب يحدد بنود التغليف (قسم 4.4 وقسم 2.4):
// صغير = فقاعات + كيس شحن (بدون كرتون) | وسط (الافتراضي) = فقاعات + كرتون صغير | كبير = فقاعات + كرتون كبير
const PACKAGING_FEE_TYPES = {
  SMALL: ["BUBBLES", "SHIPPING_BAG"],
  MEDIUM: ["BUBBLES", "CARTON_SMALL"],
  LARGE: ["BUBBLES", "CARTON_LARGE"],
};

export async function completeOrder(orderId, { size, employeeId } = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, client: true },
  });
  if (!order) return { error: { status: 404, body: { error: "الطلب غير موجود" } } };
  if (order.status === "FULFILLED") {
    return {
      error: {
        status: 400,
        body: { error: "الطلب مكتمل بالفعل — لا يمكن تكرار الإكمال (يمنع ازدواج رسوم OrderCharge)" },
      },
    };
  }

  const complete = order.items.every((i) => i.quantityVerified === i.quantityRequired);
  if (!complete) {
    return { error: { status: 400, body: { error: "الطلب غير مكتمل بعد — لازم تطابق كل الكتب أولًا" } } };
  }

  const finalSize = size && PACKAGING_FEE_TYPES[size] ? size : "MEDIUM";
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "FULFILLED",
      size: finalSize,
      boxNumber: null, // يتحرر الصندوق الفعلي ليُعاد استخدامه بطلب آخر
      ...(employeeId ? { fulfilledByEmployeeId: employeeId } : {}),
    },
  });

  const [fulfillmentFee, labelFee, shippingFee] = await Promise.all([
    getEffectiveFee("FULFILLMENT", order.clientId),
    getEffectiveFee("LABEL", order.clientId),
    getEffectiveFee("SHIPPING", order.clientId),
  ]);

  // تغليف خاص بالعميل (يستخدم مواده الخاصة) — بدون أي رسوم تغليف مهما كان الحجم
  let packagingFee = 0;
  if (!order.client.usesOwnPackaging) {
    const feeAmounts = await Promise.all(
      PACKAGING_FEE_TYPES[finalSize].map((type) => getEffectiveFee(type, order.clientId))
    );
    packagingFee = feeAmounts.reduce((sum, a) => sum + a, 0);
  }

  await prisma.orderCharge.create({
    data: { orderId, clientId: order.clientId, fulfillmentFee, labelFee, shippingFee, packagingFee },
  });

  return { result: { ok: true } };
}

// تحويل يدوي لـ"قيد التنفيذ" (نقص مخزون) — بديل يدوي للتحويل التلقائي اللي يصير أثناء اللقط
// لو الموظف اكتشف النقص بطريقة ثانية (مثلًا جرد يدوي) قبل ما يوصل لخطوة المسح
export async function markInReview(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: { status: 404, body: { error: "الطلب غير موجود" } } };
  if (order.status !== "PENDING_REVIEW") {
    return { error: { status: 400, body: { error: "الطلب مو بحالة (بانتظار المراجعة) حاليًا" } } };
  }
  await prisma.order.update({ where: { id: orderId }, data: { status: "IN_REVIEW" } });
  return { result: { ok: true } };
}

const SHIPPING_STATUSES = ["NOT_SHIPPED", "SHIPPED", "DELIVERED", "RETURNED"];

// تتبّع شحن يدوي بحت (بدون أي تكامل فعلي مع شركة شحن) — يصير قابل للتعديل فقط
// بعد اكتمال الطلب (FULFILLED)، لتسجيل شركة الشحن ورقم البوليصة وحالته يدويًا
export async function updateShipping(orderId, { shippingStatus, carrierName, trackingNumber }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: { status: 404, body: { error: "الطلب غير موجود" } } };
  if (order.status !== "FULFILLED") {
    return { error: { status: 400, body: { error: "تتبّع الشحن يصير فقط بعد اكتمال الطلب" } } };
  }
  if (!SHIPPING_STATUSES.includes(shippingStatus)) {
    return { error: { status: 400, body: { error: "حالة شحن غير صحيحة" } } };
  }

  const data = {
    shippingStatus,
    carrierName: carrierName?.trim() || null,
    trackingNumber: trackingNumber?.trim() || null,
  };
  if (shippingStatus === "SHIPPED" && !order.shippedAt) data.shippedAt = new Date();
  if (shippingStatus === "DELIVERED" && !order.deliveredAt) data.deliveredAt = new Date();

  const updated = await prisma.order.update({ where: { id: orderId }, data });
  return { result: updated };
}
