import { supabase } from '../supabaseClient.js';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ received: true });
  }

  const secret = req.query.secret;

  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body;

  console.log("Evento recebido da Cakto =>", body);

  // EXEMPLO: salvar evento na tabela "eventos_cakto"
  const { error } = await supabase
    .from("eventos_cakto")
    .insert({
      evento: body.event || null,
      dados: body,
      recebido_em: new Date()
    });

  if (error) {
    console.error("Erro ao salvar no Supabase:", error);
    return res.status(500).json({ error: "Erro ao salvar no Supabase" });
  }

  return res.status(200).json({ ok: true });
}
