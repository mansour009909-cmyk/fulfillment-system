import { prisma } from "./prisma";
import { remainingOf, ensureBoxNumber } from "./orderFulfillment";

const MAX_ORDERS_PER_BATCH = 30;

export async function getActiveBatch() {
  return prisma.pickingBatch.findFirst({ where: { status: "IN_PROGRESS" } });
}

// يسحب أقدم 30 طلب PENDING_REVIEW ما دخل دفعة من قبل (قسم 4.3 — دفعة جديدة لموظف بتطبيق الجوال)
export async function createBatch(employeeId) {
  const active = await getActiveBatch();
  if (active) {
    return { error: { status: 409, body: { error: "يوجد دفعة قيد التنفيذ حاليًا، أكملها قبل إنشاء دفعة جديدة" } } };
  }

  const orders = await prisma.order.findMany({
    where: { status: "PENDING_REVIEW", pickingBatchOrder: null },
    orderBy: { createdAt: "asc" },
    take: MAX_ORDERS_PER_BATCH,
  });
  if (orders.length === 0) {
    return { error: { status: 404, body: { error: "ما فيه طلبات بانتظار المراجعة حاليًا" } } };
  }

  // كل طلب بالدفعة ياخذ رقم صندوق من نفس المجموعة الثابتة العامة (Order.boxNumber) اللي
  // يستخدمها مسار الويب أيضًا — عشان رقم الصندوق اللي يشوفه الموظف أثناء اللقط هو
  // بالضبط نفسه اللي يُتحقق منه لاحقًا عند مسح باركود الصندوق الفعلي (BOX-xx)
  const batch = await prisma.pickingBatch.create({ data: { employeeId } });
  const assignedOrderIds = [];
  for (const order of orders) {
    const boxNumber = await ensureBoxNumber(order.id);
    if (!boxNumber) {
      await prisma.pickingBatchOrder.deleteMany({ where: { batchId: batch.id } });
      await prisma.order.updateMany({ where: { id: { in: assignedOrderIds } }, data: { boxNumber: null } });
      await prisma.pickingBatch.delete({ where: { id: batch.id } });
      return {
        error: {
          status: 409,
          body: { error: "كل الصناديق مشغولة حاليًا بطلبات نشطة أخرى — أكمل بعضها قبل بدء دفعة جديدة" },
        },
      };
    }
    assignedOrderIds.push(order.id);
    await prisma.pickingBatchOrder.create({ data: { batchId: batch.id, orderId: order.id, boxNumber } });
  }

  return { result: await getBatchRoute(batch.id) };
}

// المسار: فقط الرفوف اللي فيها منتج له طلب متبقٍّ بهذي الدفعة، مرتّبة حسب موقعها بالمستودع
export async function getBatchRoute(batchId) {
  const batch = await prisma.pickingBatch.findUnique({
    where: { id: batchId },
    include: { orders: { include: { order: { include: { items: true } } } } },
  });
  if (!batch) return null;

  // طلبات غير PENDING_REVIEW (تحوّلت لـ"قيد التنفيذ" لنفاد مخزون بند فيها) خرجت من مسار
  // اللقط الآلي فعليًا — pickBookByBarcode ما يطابقها بعد كذا، فلازم نستبعد بقية بنودها
  // هنا وإلا تبقى "عالقة" بمسار الرفوف للأبد بدون أي طريقة تُلقَط فيها
  const remainingBookIds = new Set();
  for (const bo of batch.orders) {
    if (bo.order.status !== "PENDING_REVIEW") continue;
    for (const item of bo.order.items) {
      if (remainingOf(item) > 0) remainingBookIds.add(item.bookId);
    }
  }

  const shelves = await prisma.shelf.findMany({
    where: {
      stock: { some: { ownership: "SHARED", clientId: null, bookId: { in: [...remainingBookIds] } } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const route = shelves.map((shelf) => ({
    shelfId: shelf.id,
    barcode: shelf.barcode,
    name: shelf.name,
    sortOrder: shelf.sortOrder,
    done: false, // كل رف بالقائمة أصلًا فيه شيء متبقٍّ (فُلتر أعلاه) — done تُحسب فعليًا وقت فتح الرف
  }));

  return {
    batchId: batch.id,
    status: batch.status,
    orderCount: batch.orders.length,
    route,
    allShelvesDone: route.length === 0,
  };
}

// قائمة اللقط لرف معيّن ضمن دفعة: كل كتاب مطلوب منه بهذا الرف + تفصيل لكل صندوق
export async function getShelfPickList(batchId, shelfId) {
  const batch = await prisma.pickingBatch.findUnique({
    where: { id: batchId },
    include: {
      orders: {
        orderBy: { boxNumber: "asc" },
        include: { order: { include: { items: { include: { book: true } } } } },
      },
    },
  });
  if (!batch) return null;

  const shelfStock = await prisma.shelfStock.findMany({
    where: { shelfId, ownership: "SHARED", clientId: null },
  });
  const shelfBookIds = new Set(shelfStock.map((s) => s.bookId));

  const bySku = new Map();
  for (const bo of batch.orders) {
    if (bo.order.status !== "PENDING_REVIEW") continue; // نفس الاستبعاد أعلاه — راجع getBatchRoute
    for (const item of bo.order.items) {
      if (!shelfBookIds.has(item.bookId)) continue;
      const remaining = remainingOf(item);
      if (remaining <= 0) continue;

      if (!bySku.has(item.bookId)) {
        bySku.set(item.bookId, {
          bookId: item.bookId,
          barcode: item.book.barcode,
          title: item.book.title,
          imageUrl: item.book.imageUrl,
          brandName: item.book.brandName,
          totalRemaining: 0,
          breakdown: [],
        });
      }
      const info = bySku.get(item.bookId);
      info.totalRemaining += remaining;
      info.breakdown.push({ boxNumber: bo.boxNumber, orderNumber: bo.order.orderNumber, qty: remaining });
    }
  }

  return [...bySku.values()].sort((a, b) => a.title.localeCompare(b.title, "ar"));
}

export async function getBatchSummary(batchId) {
  const batch = await prisma.pickingBatch.findUnique({
    where: { id: batchId },
    include: {
      orders: {
        orderBy: { boxNumber: "asc" },
        include: { order: { include: { items: { include: { book: true }, }, client: true } } },
      },
    },
  });
  if (!batch) return null;

  return batch.orders.map((bo) => {
    const missing = bo.order.items.filter((i) => remainingOf(i) > 0);
    return {
      orderId: bo.order.id,
      boxNumber: bo.boxNumber,
      orderNumber: bo.order.orderNumber,
      clientName: bo.order.client.name,
      fulfilled: missing.length === 0,
      missingItems: missing.map((i) => ({
        bookId: i.bookId,
        title: i.book.title,
        missing: remainingOf(i),
        outOfStock: i.quantityShort > 0,
      })),
    };
  });
}

// يقفل الدفعة: أي طلب فيه نقص فعلي متبقٍّ يتحوّل لحالة "قيد التنفيذ" (نفس سلوك نفاد المخزون الحالي)
export async function completeBatchService(batchId) {
  const batch = await prisma.pickingBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { error: { status: 404, body: { error: "الدفعة غير موجودة" } } };
  if (batch.status === "COMPLETED") {
    return { error: { status: 409, body: { error: "الدفعة مكتملة مسبقًا" } } };
  }

  const summary = await getBatchSummary(batchId);
  for (const o of summary) {
    if (!o.fulfilled) {
      await prisma.order.update({ where: { id: o.orderId }, data: { status: "IN_REVIEW" } });
    }
  }

  await prisma.pickingBatch.update({
    where: { id: batchId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  return { result: summary };
}
