import { getThread, sendMessage, markRead } from "../../../../lib/chat";

export default async function handler(req, res) {
  const supplierId = Number(req.query.id);

  if (req.method === "GET") {
    await markRead("SUPPLIER", supplierId, "ADMIN");
    const messages = await getThread("SUPPLIER", supplierId);
    return res.status(200).json(messages);
  }

  if (req.method === "POST") {
    const { result, error } = await sendMessage("SUPPLIER", supplierId, "ADMIN", req.body.body);
    if (error) return res.status(error.status).json(error.body);
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
