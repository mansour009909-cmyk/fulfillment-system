import { prisma } from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
    });
    return res.status(200).json(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        hasPortalAccess: Boolean(c.passwordHash),
        orderCount: c._count.orders,
      }))
    );
  }

  if (req.method === "POST") {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "اسم العميل مطلوب" });
    const client = await prisma.client.create({ data: { name } });
    return res.status(201).json({ id: client.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
