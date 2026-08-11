import { prisma } from "./prisma";

const MAX_BYTES = 8 * 1024 * 1024; // 8 ميجا — كافي لصور أغلفة/شعارات، يمنع رفع ملفات ضخمة بالغلط

// يحفظ صورة مرفوعة مباشرة (data URL: "data:image/jpeg;base64,...") ويرجّع رابط تقديمها
export async function saveImage(dataUrl) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return { error: { status: 400, body: { error: "صيغة الصورة غير صحيحة" } } };

  const [, mimeType, base64] = match;
  if (!mimeType.startsWith("image/")) {
    return { error: { status: 400, body: { error: "الملف لازم يكون صورة" } } };
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_BYTES) {
    return { error: { status: 400, body: { error: "حجم الصورة كبير جدًا (الحد الأقصى 8 ميجا)" } } };
  }

  const image = await prisma.uploadedImage.create({ data: { data: buffer, mimeType } });
  return { result: { url: `/api/uploads/image/${image.id}` } };
}
