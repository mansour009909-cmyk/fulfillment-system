import { prisma } from "../../../../lib/prisma";
import { buildAuthorizeUrl } from "../../../../lib/salla";

function callbackUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host?.includes("localhost") ? "http" : "https");
  return `${proto}://${req.headers.host}/api/integrations/salla/callback`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const clientId = Number(req.query.clientId);
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return res.status(404).json({ error: "العميل غير موجود" });

  try {
    const url = await buildAuthorizeUrl(clientId, callbackUrl(req));
    return res.status(200).json({ url });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
