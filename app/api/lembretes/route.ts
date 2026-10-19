import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { AssinaturaPush, ItemLembrete, processarLembretes } from "@/lib/lembretesPush";

// Rota chamada todo dia de manhã pelo agendamento da Vercel (vercel.json). Envia o lembrete
// de escala para quem está escalado na semana. Protegida por CRON_SECRET.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function segredoConfere(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !segredoConfere(req.headers.get("authorization"), segredo)) {
    return new Response("Não autorizado", { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const vapidPublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivada = process.env.VAPID_PRIVATE_KEY;
  // O "assunto" identifica quem envia. Os serviços de notificação (principalmente o da Apple, no
  // iPhone) podem recusar um e-mail de mentira, então ele é obrigatório: use o seu e-mail real.
  const assunto = process.env.VAPID_SUBJECT;
  if (!supabaseUrl || !supabaseKey || !vapidPublica || !vapidPrivada || !assunto) {
    return Response.json(
      {
        erro:
          "Faltam variáveis de ambiente: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT " +
          "(ex.: mailto:seu-email@exemplo.com), além das do Supabase. Depois de cadastrá-las, faça um novo deploy.",
      },
      { status: 500 }
    );
  }
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(assunto)) {
    return Response.json(
      { erro: "VAPID_SUBJECT deve começar com mailto: (seu e-mail) ou https:// (ex.: mailto:seu-email@exemplo.com)." },
      { status: 500 }
    );
  }

  const simular = new URL(req.url).searchParams.get("simular") === "1";
  webpush.setVapidDetails(assunto, vapidPublica, vapidPrivada);
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const resumo = await processarLembretes(
      {
        buscar: async () => {
          const { data, error } = await supabase.rpc("push_lembretes", { p_segredo: segredo });
          if (error) throw error;
          return (data ?? []) as ItemLembrete[];
        },
        enviar: async (a: AssinaturaPush, conteudo: string) => {
          try {
            await webpush.sendNotification(
              { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
              conteudo,
              { TTL: 60 * 60 * 24 * 3, urgency: "normal" }
            );
            return "ok";
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            return status === 404 || status === 410 ? "expirada" : "erro";
          }
        },
        marcarEnviado: async (integranteId, cultos) => {
          const { error } = await supabase.rpc("push_marcar_enviado", {
            p_segredo: segredo,
            p_integrante_id: integranteId,
            p_cultos: cultos,
          });
          if (error) throw error;
        },
        removerAssinatura: async (endpoint) => {
          await supabase.rpc("push_remover_assinatura", { p_segredo: segredo, p_endpoint: endpoint });
        },
      },
      { simular }
    );
    return Response.json(resumo);
  } catch (e) {
    const mensagem = (e as { message?: string })?.message ?? "erro";
    return Response.json({ erro: `Falha ao processar os lembretes: ${mensagem}` }, { status: 500 });
  }
}
