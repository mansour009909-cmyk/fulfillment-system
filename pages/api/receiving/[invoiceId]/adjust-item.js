import { adjustReceivingItem } from "../../../../lib/receiving";

// راجع قسم 6.3: الموظف يملك صلاحية تعديل الكمية المتوقعة لإقفال فروقات الجرد
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { bookId, quantityExpected } = req.body;
  const { result, error } = await adjustReceivingItem(Number(req.query.invoiceId), Number(bookId), quantityExpected);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
