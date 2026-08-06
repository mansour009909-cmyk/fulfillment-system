import ExcelJS from "exceljs";
import { prisma } from "../../../../../lib/prisma";

// يصدّر ملف Excel لقائمة "المطلوب" النهائية لطلبية مورد — جاهز للإرسال المباشر للمورد (قسم 8.8)
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orderId = Number(req.query.orderId);
  const order = await prisma.supplierOrder.findUnique({
    where: { id: orderId },
    include: { supplier: true, items: { include: { book: true }, where: { included: true } } },
  });
  if (!order) {
    return res.status(404).json({ error: "الطلبية غير موجودة" });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("المطلوب", { views: [{ rightToLeft: true }] });

  sheet.columns = [
    { header: "الباركود", key: "barcode", width: 18 },
    { header: "العنوان", key: "title", width: 45 },
    { header: "الكمية المطلوبة", key: "qty", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const item of order.items) {
    sheet.addRow({ barcode: item.book.barcode, title: item.book.title, qty: item.quantityFinal });
  }

  const totalRow = sheet.addRow({ title: "الإجمالي", qty: order.items.reduce((s, i) => s + i.quantityFinal, 0) });
  totalRow.font = { bold: true };

  const fileName = `طلبية-${order.supplier.name}-${order.id}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

  await workbook.xlsx.write(res);
  res.end();
}
