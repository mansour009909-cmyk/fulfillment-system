import { getSession } from "../../../../lib/webAuth";
import { getThread, sendMessage, markRead } from "../../../../lib/chat";

export default async function handler(req, res) {
  const session = await getSession(req, "SUPPLIER");
  if (!session || session.role !== "SUPPLIER") return res.status(401).json({ error: "غير مصرّح" });

  if (req.method === "GET") {
    await markRead("SUPPLIER", session.id, "SUPPLIER");
    const messages = await getThread("SUPPLIER", session.id);
    return res.status(200).json(messages);
  }

  if (req.method === "POST") {
    const { result, error } = await sendMessage("SUPPLIER", session.id, "SUPPLIER", req.body.body);
    if (error) return res.status(error.status).json(error.body);
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
