import { useState, useRef } from "react";
import { ImagePlus, X } from "lucide-react";

// رفع صورة مباشر (بدل لصق رابط خارجي) — يقرأ الملف محليًا، يرفعه لـ/api/uploads/image،
// ويضبط القيمة على الرابط اللي يرجّعه (يخدم من قاعدة بياناتنا مباشرة)
export function ImageUploadField({ label, value, onChange, uploadUrl = "/api/uploads/image" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذّر رفع الصورة");
        return;
      }
      onChange(data.url);
    } catch {
      setError("تعذّر قراءة الملف");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={value} alt={label} className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -top-1.5 -left-1.5 bg-white border border-gray-200 rounded-full p-0.5 text-gray-500 hover:text-red-600"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="h-16 w-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-300">
            <ImagePlus size={20} />
          </div>
        )}
        <div>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "جاري الرفع..." : value ? "تغيير الصورة" : "اختيار صورة"}
          </button>
          {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
