import { prisma } from "../../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { daftraClientId } = req.body;
  await prisma.client.update({
    where: { id: Number(req.query.id) },
    data: { daftraClientId: daftraClientId?.trim() || null },
  });
  return res.status(200).json({ ok: true });
}
