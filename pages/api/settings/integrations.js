import { prisma } from "../../../lib/prisma";
import { getSettings } from "../../../lib/settings";

// إعدادات تكامل دفترة وشركة الشحن — كلها اختيارية (شكل جاهز، الربط الفعلي لاحقًا)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { daftraApiKey, daftraSubdomain, shippingCarrier, shippingApiKey, shippingAccountNumber } = req.body;

  await getSettings();
  const updated = await prisma.systemSetting.update({
    where: { id: 1 },
    data: {
      daftraApiKey: daftraApiKey?.trim() || null,
      daftraSubdomain: daftraSubdomain?.trim() || null,
      shippingCarrier: shippingCarrier?.trim() || null,
      shippingApiKey: shippingApiKey?.trim() || null,
      shippingAccountNumber: shippingAccountNumber?.trim() || null,
    },
  });

  return res.status(200).json(updated);
}
