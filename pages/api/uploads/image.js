import { saveImage } from "../../../lib/uploads";

// Data URLs base64 يمكن تكون كبيرة (صور) — نرفع حد Next.js الافتراضي (1mb) لحجم جسم الطلب
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { result, error } = await saveImage(req.body.data);
  if (error) return res.status(error.status).json(error.body);
  return res.status(200).json(result);
}
