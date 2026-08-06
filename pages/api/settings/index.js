import { prisma } from "../../../lib/prisma";
import { getSettings } from "../../../lib/settings";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const settings = await getSettings();
    return res.status(200).json(settings);
  }

  if (req.method === "POST") {
    const {
      warehouseName,
      importantSupplierSharePercent,
      minOrderQtyTotal,
      minOrderQtyPerTitle,
      defaultSalesPeriodDays,
      delayDaysDomestic,
      delayDaysInternational,
    } = req.body;
    const sharePercent = Number(importantSupplierSharePercent);
    const qtyTotal = Number(minOrderQtyTotal);
    const qtyPerTitle = Number(minOrderQtyPerTitle);
    const salesPeriod = Number(defaultSalesPeriodDays);
    const delayDomestic = Number(delayDaysDomestic);
    const delayInternational = Number(delayDaysInternational);

    if (!warehouseName) {
      return res.status(400).json({ error: "اسم المستودع مطلوب" });
    }
    if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) {
      return res.status(400).json({ error: "نسبة الطلب الآلي يجب أن تكون بين 0 و100" });
    }
    if (!Number.isFinite(qtyTotal) || qtyTotal < 0) {
      return res.status(400).json({ error: "الحد الأدنى الإجمالي غير صحيح" });
    }
    if (!Number.isFinite(qtyPerTitle) || qtyPerTitle < 1) {
      return res.status(400).json({ error: "الحد الأدنى لكل عنوان غير صحيح" });
    }
    if (!Number.isFinite(salesPeriod) || salesPeriod < 1) {
      return res.status(400).json({ error: "الفترة الافتراضية لحساب المبيعات غير صحيحة" });
    }
    if (!Number.isFinite(delayDomestic) || delayDomestic < 1) {
      return res.status(400).json({ error: "مدة تأخير المورد الداخلي غير صحيحة" });
    }
    if (!Number.isFinite(delayInternational) || delayInternational < 1) {
      return res.status(400).json({ error: "مدة تأخير المورد الخارجي غير صحيحة" });
    }

    await getSettings(); // يضمن وجود الصف
    const updated = await prisma.systemSetting.update({
      where: { id: 1 },
      data: {
        warehouseName,
        importantSupplierSharePercent: sharePercent,
        minOrderQtyTotal: qtyTotal,
        minOrderQtyPerTitle: qtyPerTitle,
        defaultSalesPeriodDays: salesPeriod,
        delayDaysDomestic: delayDomestic,
        delayDaysInternational: delayInternational,
      },
    });
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
