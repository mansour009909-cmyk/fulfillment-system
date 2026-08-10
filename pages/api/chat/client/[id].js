import { getThread, sendMessage, markRead } from "../../../../lib/chat";

export default async function handler(req, res) {
  const clientId = Number(req.query.id);

  if (req.method === "GET") {
    await markRead("CLIENT", clientId, "ADMIN");
    const messages = await getThread("CLIENT", clientId);
    return res.status(200).json(messages);
  }

  if (req.method === "POST") {
    const { result, error } = await sendMessage("CLIENT", clientId, "ADMIN", req.body.body);
    if (error) return res.status(error.status).json(error.body);
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
