# يقرأ ملف تصدير العلامات التجارية من سلة (xlsx)، يكتب JSON نظيف {brandName, logoUrl}
import sys
import json
import openpyxl


def main(xlsx_path, out_path):
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(min_row=2, values_only=True)

    out = []
    for row in rows:
        name = (row[0] or "").strip() if row[0] else None
        logo = (row[2] or "").strip() if row[2] else None
        if not name or not logo:
            continue
        out.append({"brandName": name, "logoUrl": logo})

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"ماركات صالحة: {len(out)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
