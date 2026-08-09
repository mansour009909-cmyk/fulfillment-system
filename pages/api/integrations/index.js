import { prisma } from "../../../lib/prisma";
import { PROVIDER_CATALOG } from "../../../lib/integrations";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const integrations = await prisma.integration.findMany({
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return res.status(200).json(integrations);
  }

  if (req.method === "POST") {
    const { provider, clientId, apiKey, apiSecret, accountId } = req.body;

    const catalog = PROVIDER_CATALOG[provider];
    if (!catalog) return res.status(400).json({ error: "مزوّد غير معروف" });

    const normalizedClientId = catalog.scope === "CLIENT" ? Number(clientId) : null;
    if (catalog.scope === "CLIENT" && !normalizedClientId) {
      return res.status(400).json({ error: "لازم تختار العميل (المتجر) لهذا الربط" });
    }
    if (catalog.scope === "CLIENT") {
      const client = await prisma.client.findUnique({ where: { id: normalizedClientId } });
      if (!client) return res.status(404).json({ error: "العميل غير موجود" });
    }

    const data = {
      apiKey: apiKey?.trim() || null,
      apiSecret: apiSecret?.trim() || null,
      accountId: accountId?.trim() || null,
    };

    const existing = await prisma.integration.findFirst({
      where: { provider, clientId: normalizedClientId },
    });
    const integration = existing
      ? await prisma.integration.update({ where: { id: existing.id }, data })
      : await prisma.integration.create({ data: { provider, clientId: normalizedClientId, ...data } });

    return res.status(200).json(integration);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
