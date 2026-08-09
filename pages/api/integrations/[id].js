import { prisma } from "../../../lib/prisma";

export default async function handler(req, res) {
  const id = Number(req.query.id);

  if (req.method === "DELETE") {
    const integration = await prisma.integration.findUnique({ where: { id } });
    if (!integration) return res.status(404).json({ error: "الربط غير موجود" });
    await prisma.integration.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
