import { prisma } from "../../../../lib/prisma";
import { verifyWebhookSignature, getSallaApp } from "../../../../lib/salla";

// سلة يستدعي هذا الرابط مباشرة (بدون جلسة إدارية) عند أي طلب جديد بمتجر عميل مربوط —
// شكل الحمولة (event/merchant/data.items[].sku) مبني على أفضل معرفة عامة بويبهوكات سلة،
// يحتاج تأكيد فعلي بأول اختبار حقيقي بعد اعتماد التطبيق.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rawBody = await readRawBody(req);

  const app = await getSallaApp();
  const signature = req.headers["salla-signature"] || req.headers["x-salla-signature"];
  if (app?.accountId && !verifyWebhookSignature(rawBody, signature, app.accountId)) {
    return res.status(401).json({ error: "توقيع غير صالح" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "جسم الطلب غير صالح" });
  }

  if (payload.event !== "order.created") {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const merchantId = payload.merchant ? String(payload.merchant) : null;
  const integration = merchantId
    ? await prisma.integration.findFirst({ where: { provider: "SALLA", accountId: merchantId } })
    : null;
  if (!integration) {
    return res.status(200).json({ ok: true, error: "لم نتعرّف على المتجر — تجاهلنا الإشعار" });
  }

  const sallaOrder = payload.data;
  const orderNumber = `SALLA-${sallaOrder.id}`;

  const existing = await prisma.order.findUnique({ where: { orderNumber } });
  if (existing) {
    return res.status(200).json({ ok: true, alreadyExists: true });
  }

  const lineItems = Array.isArray(sallaOrder.items) ? sallaOrder.items : [];
  const itemsData = [];
  const unmatched = [];
  for (const li of lineItems) {
    const sku = li.sku || li.product?.sku;
    if (!sku) continue;
    const book = await prisma.book.findUnique({ where: { barcode: sku } });
    if (!book) {
      unmatched.push(sku);
      continue;
    }
    itemsData.push({ bookId: book.id, quantityRequired: Number(li.quantity) || 1 });
  }

  if (itemsData.length === 0) {
    return res.status(200).json({ ok: true, error: "ما قدرنا نطابق أي بند بهذا الطلب مع كتالوجنا", unmatched });
  }

  await prisma.order.create({
    data: { orderNumber, clientId: integration.clientId, items: { create: itemsData } },
  });

  return res.status(200).json({ ok: true, unmatched });
}
