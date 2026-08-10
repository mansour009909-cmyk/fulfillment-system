import { listThreadsForAdmin } from "../../../lib/chat";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const threads = await listThreadsForAdmin();
  return res.status(200).json(threads);
}
