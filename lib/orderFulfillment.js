import { prisma } from "./prisma";
import { getEffectiveFee } from "./fees";

// طبقة منطق مشتركة للقط/التحقق/الإكمال — تُستخدم من مسارات الويب الحالية (pages/api/orders/**)
// ومن مسارات الجوال الجديدة (pages/api/mobile/**) بدون تكرار الكود. كل دالة ترجّع
// { result } عند النجاح أو { error: { status, body } } عند الفشل — الأغلفة (routes) تحوّلها لاستجابة HTTP.

export const remainingOf = (i) => i.quantityRequired - i.quantityPicked - i.quantityShort;

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
  const updatedItem = await prisma.orderItem.update({
    where: { id: item.id },
    data: { quantityPicked: { increment: 1 } },
  });

  const stillNeeding = await prisma.orderItem.findMany({ where: { bookId: book.id, order: orderWhere } });
  const remainingForBook = stillNeeding.reduce((sum, i) => sum + Math.max(0, remainingOf(i)), 0);

  return {
    result: {
      book: { title: book.title, barcode: book.barcode, imageUrl: book.imageUrl, brandName: book.brandName },
      orderId: item.order.id,
      orderNumber: item.order.orderNumber,
      boxNumber: item.order.pickingBatchOrder?.boxNumber ?? null,
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

// راجع قسم 4.4 خطوة 1: مسح باركود الصندوق (= رقم الطلب) قبل البدء بالتحقق
export async function scanBox(orderId, barcode) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: { status: 404, body: { error: "الطلب غير موجود" } } };
  if (barcode !== order.orderNumber) {
    return { error: { status: 400, body: { error: "باركود الصندوق لا يطابق رقم هذا الطلب" } } };
  }
  await prisma.order.update({ where: { id: orderId }, data: { boxScanned: true } });
  return { result: { ok: true } };
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
export async function completeOrder(orderId, { size, employeeId } = {}) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
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

  const finalSize = size || null;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "FULFILLED",
      size: finalSize,
      ...(employeeId ? { fulfilledByEmployeeId: employeeId } : {}),
    },
  });

  const [fulfillmentFee, labelFee, shippingFee] = await Promise.all([
    getEffectiveFee("FULFILLMENT", order.clientId),
    getEffectiveFee("LABEL", order.clientId),
    getEffectiveFee("SHIPPING", order.clientId),
  ]);

  const [cartonFee, bubblesFee, bagFee] = await Promise.all([
    getEffectiveFee(finalSize === "LARGE" ? "CARTON_LARGE" : "CARTON_SMALL", order.clientId),
    getEffectiveFee("BUBBLES", order.clientId),
    getEffectiveFee("SHIPPING_BAG", order.clientId),
  ]);
  const packagingFee = cartonFee + bubblesFee + bagFee;

  await prisma.orderCharge.create({
    data: { orderId, clientId: order.clientId, fulfillmentFee, labelFee, shippingFee, packagingFee },
  });

  return { result: { ok: true } };
}
