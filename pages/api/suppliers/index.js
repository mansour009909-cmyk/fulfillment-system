import { prisma } from "../../../lib/prisma";
import { getSettings } from "../../../lib/settings";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "اسم المورد مطلوب" });
  }

  const settings = await getSettings();
  const supplier = await prisma.supplier.create({
    data: { name, salesPeriodDays: settings.defaultSalesPeriodDays },
  });
  return res.status(201).json({ id: supplier.id });
}
