import { useState } from "react";

// صورة صغيرة (شعار ماركة عادةً) قابلة للنقر لتكبيرها بنافذة فوق باقي الصفحة
export function ZoomableImage({ src, alt, className }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
        title={alt || "تكبير"}
      >
        <img src={src} alt={alt || ""} className="h-full w-full object-contain" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <img
            src={src}
            alt={alt || ""}
            className="max-h-[80vh] max-w-[90vw] rounded-lg bg-white p-4 object-contain"
          />
        </div>
      )}
    </>
  );
}
