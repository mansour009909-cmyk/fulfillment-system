import { proposeSupplierOrder } from "../../../../../lib/supplierDemand";

// ينشئ طلبية مقترحة جديدة لمورد (قسم 8.1، 8.3) — يحسب "المطلوب" من كتالوج المورد وسرعة مبيعاته
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supplierId = Number(req.query.id);

  try {
    const orderId = await proposeSupplierOrder(supplierId);
    return res.status(201).json({ id: orderId });
  } catch (err) {
    return res.status(400).json({ error: err.message || "حدث خطأ" });
  }
}
