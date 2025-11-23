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
  console.log("EVENTO RECEBIDO DA CAKTO =>", body);

  const evento = body.evento;              // ex: compra_aprovada
  const contrato_id = body.assinatura_id;  // ID único da Cakto
  const dados = body;

  // 📌 1 — MAPEAR STATUS
  const STATUS_MAP = {
    compra_aprovada: "ativo",
    assinatura_renovada: "ativo",
    pix_gerado: "pendente",
    boleto_gerado: "pendente",
    compra_recusada: "cancelado",
    assinatura_cancelada: "cancelado",
    chargeback: "cancelado"
  };

  const novoStatus = STATUS_MAP[evento] || "pendente";

  // 📌 2 — VERIFICAR SE O CONTRATO JÁ EXISTE
  const { data: existe } = await supabase
    .from("contratos")
    .select("*")
    .eq("id", contrato_id)
    .maybeSingle();

  // 📌 3 — SE NÃO EXISTE → CRIAR CONTRATO
  if (!existe && evento === "compra_aprovada") {
    const contrato = {
      id: contrato_id,
      plano_id: dados.plano_id,
      plano_nome: dados.plano_nome,
      plano_preco: dados.plano_preco,

      titular_nome: dados.titular_nome,
      titular_cpf: dados.titular_cpf,
      titular_data_n: dados.titular_data_nascimento,
      titular_cep: dados.titular_cep,
      titular_numero: dados.titular_numero,

      dependentes: dados.dependentes || [],
      assinatura_data: new Date(),
      status: novoStatus
    };

    const { error } = await supabase.from("contratos").insert([contrato]);

    if (error) {
      console.error("❌ Erro ao criar contrato:", error);
      return res.status(500).json({ error: "Erro ao criar contrato" });
    }

    console.log("✅ CONTRATO CRIADO!");
    return res.status(200).json({ ok: true });
  }

  // 📌 4 — SE JÁ EXISTE → APENAS ATUALIZAR STATUS
  const { error: updateError } = await supabase
    .from("contratos")
    .update({ status: novoStatus })
    .eq("id", contrato_id);

  if (updateError) {
    console.error("❌ Erro ao atualizar status:", updateError);
    return res.status(500).json({ error: "Erro ao atualizar contrato" });
  }

  console.log("✅ STATUS ATUALIZADO:", novoStatus);

  return res.status(200).json({ ok: true });
}
