# يقرأ ملف تصدير منتجات سلة (xlsx)، يفلتر "منتج جاهز" فقط، ويكتب JSON نظيف
# {barcode, imageUrl, brandName} — يُستخدم لتحديث Book.imageUrl/brandName الموجودين
# (مطابقة بالباركود فقط، لا يُنشئ كتب جديدة ولا يمس المخزون/الأسعار).
import sys
import json
import openpyxl


def main(xlsx_path, out_path):
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    headers = list(next(rows))
    idx = {h: i for i, h in enumerate(headers)}

    sku_i = idx["رمز المنتج sku"]
    img_i = idx["صورة المنتج"]
    brand_i = idx["الماركة"]
    type_i = idx["نوع المنتج"]

    out = []
    skipped_no_sku = 0
    skipped_not_ready = 0

    for row in rows:
        if row[type_i] != "منتج جاهز":
            skipped_not_ready += 1
            continue
        barcode = row[sku_i]
        if not barcode:
            skipped_no_sku += 1
            continue
        out.append(
            {
                "barcode": str(barcode).strip(),
                "imageUrl": (row[img_i] or "").strip() or None,
                "brandName": (row[brand_i] or "").strip() or None,
            }
        )

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"صفوف صالحة: {len(out)}")
    print(f"متجاهَلة (مو منتج جاهز): {skipped_not_ready}")
    print(f"متجاهَلة (بدون SKU): {skipped_no_sku}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
