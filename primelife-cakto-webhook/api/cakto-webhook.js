import { supabase } from "../supabaseClient.js";

export default async function handler(req, res) {
  // 1. CORS + métodos
  if (req.method !== "POST") {
    return res.status(200).json({ received: true });
  }

  // 2. Segurança (se quiser usar)
  const secret = req.query.secret;
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body;
  console.log("📩 Evento recebido da Cakto:", body);

  // ----------------------------------------
  // 3. Normalizar dados vindos da Cakto
  // ----------------------------------------
  const cliente = {
    nome: body.fullname || body.name || "",
    cpf: body.cpf || "",
    email: body.email || "",
    telefone: body.phone || "",
  };

  const contrato = {
    plano_id: body.product_id,
    plano_nome: body.product_name,
    plano_preco: body.product_price,
    status: body.status, // paid, pending, canceled, etc.
    titular_nome: cliente.nome,
    titular_cpf: cliente.cpf,
    assinatura_data: body.created_at,
    pagamento_id: body.payment_id
  };

  // ----------------------------------------
  // 4. Criar ou atualizar CLIENTE
  // ----------------------------------------
  const { data: clienteExistente } = await supabase
    .from("clientes")
    .select("*")
    .eq("cpf", cliente.cpf)
    .maybeSingle();

  let cliente_id;

  if (clienteExistente) {
    // Atualizar cliente
    await supabase
      .from("clientes")
      .update(cliente)
      .eq("id", clienteExistente.id);

    cliente_id = clienteExistente.id;
  } else {
    // Criar novo cliente
    const { data: novoCliente } = await supabase
      .from("clientes")
      .insert(cliente)
      .select()
      .single();

    cliente_id = novoCliente.id;
  }

  // ------------------------------
  // 5. Criar ou atualizar CONTRATO
  // ------------------------------
  const { data: contratoExistente } = await supabase
    .from("contratos")
    .select("*")
    .eq("pagamento_id", body.payment_id)
    .maybeSingle();

  if (contratoExistente) {
    // Atualizar status automaticamente
    await supabase
      .from("contratos")
      .update({
        status: contrato.status,
        plano_preco: contrato.plano_preco,
        plano_nome: contrato.plano_nome,
      })
      .eq("id", contratoExistente.id);
  } else {
    // Criar contrato novo
    await supabase.from("contratos").insert({
      ...contrato,
      cliente_id,
    });
  }

  console.log("✅ Dados salvos com sucesso!");
  return res.status(200).json({ ok: true });
}
