import { getSession } from "../../../../lib/webAuth";
import { getThread, sendMessage, markRead } from "../../../../lib/chat";

export default async function handler(req, res) {
  const session = await getSession(req, "CLIENT");
  if (!session || session.role !== "CLIENT") return res.status(401).json({ error: "غير مصرّح" });

  if (req.method === "GET") {
    await markRead("CLIENT", session.id, "CLIENT");
    const messages = await getThread("CLIENT", session.id);
    return res.status(200).json(messages);
  }

  if (req.method === "POST") {
    const { result, error } = await sendMessage("CLIENT", session.id, "CLIENT", req.body.body);
    if (error) return res.status(error.status).json(error.body);
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
