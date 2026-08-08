import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

const COLS = 2;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;

function Label({ code, title }) {
  const svgRef = useRef(null);
  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, code, { format: "CODE128", width: 2, height: 60, fontSize: 14 });
    }
  }, [code]);

  return (
    <div className="label-cell">
      <div className="label-title">{title}</div>
      <svg ref={svgRef}></svg>
    </div>
  );
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ورقة ملصقات باركود موحّدة (رفوف/كتب/صناديق طلبات) — صفحة 100×150مم، عدة ملصقات بكل صفحة.
// items: [{ id, code, title }]
export function BarcodeLabelSheet({ items }) {
  const pages = chunk(items, PER_PAGE);

  return (
    <div className="hidden print:block">
      {pages.map((page, i) => (
        <div key={i} className="label-page">
          {page.map((item) => (
            <Label key={item.id} code={item.code} title={item.title} />
          ))}
        </div>
      ))}

      <style jsx global>{`
        @media print {
          @page {
            size: 100mm 150mm;
            margin: 5mm;
          }
          body * {
            visibility: hidden;
          }
          .label-page,
          .label-page * {
            visibility: visible;
          }
          .label-page {
            display: grid;
            grid-template-columns: repeat(${COLS}, 1fr);
            grid-auto-rows: 1fr;
            gap: 2mm;
            width: 90mm;
            height: 140mm;
            break-after: page;
          }
          .label-cell {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 1px dashed #ccc;
            padding: 1mm;
            overflow: hidden;
          }
          .label-title {
            font-size: 7px;
            margin-bottom: 1mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 42mm;
            text-align: center;
          }
          .label-cell svg {
            width: 40mm !important;
            height: auto !important;
            max-height: 18mm;
          }
        }
      `}</style>
    </div>
  );
}
