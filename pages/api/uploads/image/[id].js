import { prisma } from "../../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const image = await prisma.uploadedImage.findUnique({ where: { id: Number(req.query.id) } });
  if (!image) return res.status(404).end();

  res.setHeader("Content-Type", image.mimeType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return res.status(200).send(image.data);
}
