import { supabase } from "./supabase";

const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type EstadoLembretes =
  | "indisponivel" // sem chave configurada ou navegador sem suporte
  | "ios_instalar" // iPhone: precisa adicionar o app à tela inicial primeiro
  | "bloqueado" // o usuário negou a permissão
  | "desativado"
  | "ativo";

/** Como o aparelho foi identificado: integrante (/escala) ou Líder/Montador logado. */
export type ModoLembretes = { tipo: "integrante"; nome: string; senha: string } | { tipo: "equipe" };

export type ResultadoLembretes = { ok: true } | { ok: false; mensagem: string };

const MENSAGENS: Record<string, string> = {
  credenciais_invalidas: "Nome ou data de aniversário não conferem. Saia e entre de novo.",
  dados_invalidos: "Nome ou senha inválidos. Saia e entre de novo.",
  muitas_tentativas: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  assinatura_invalida: "Este aparelho não aceitou o registro. Tente de novo.",
  sem_cadastro: "Seu e-mail de login não está ligado a nenhum integrante. Cadastre o mesmo e-mail em Integrantes.",
};

export function ehIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function estaInstalado(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function suportaPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function chaveParaBytes(base64Url: string): Uint8Array {
  const preenchimento = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

export async function estadoDosLembretes(): Promise<EstadoLembretes> {
  if (!CHAVE_PUBLICA || !supabase) return "indisponivel";
  if (!suportaPush()) return ehIOS() && !estaInstalado() ? "ios_instalar" : "indisponivel";
  if (Notification.permission === "denied") return "bloqueado";
  const registro = await navigator.serviceWorker.getRegistration();
  const assinatura = await registro?.pushManager.getSubscription();
  return assinatura && Notification.permission === "granted" ? "ativo" : "desativado";
}

async function registrarNoBanco(modo: ModoLembretes, sub: PushSubscription): Promise<ResultadoLembretes> {
  const j = sub.toJSON();
  const p256dh = j.keys?.p256dh;
  const auth = j.keys?.auth;
  if (!j.endpoint || !p256dh || !auth) return { ok: false, mensagem: MENSAGENS.assinatura_invalida };
  const { data, error } =
    modo.tipo === "integrante"
      ? await supabase!.rpc("push_registrar", {
          p_nome: modo.nome,
          p_senha: modo.senha,
          p_endpoint: j.endpoint,
          p_p256dh: p256dh,
          p_auth: auth,
        })
      : await supabase!.rpc("push_registrar_equipe", { p_endpoint: j.endpoint, p_p256dh: p256dh, p_auth: auth });
  if (error) return { ok: false, mensagem: "Não foi possível ativar agora. Confira a internet e tente de novo." };
  const r = data as { ok: boolean; motivo?: string };
  return r?.ok ? { ok: true } : { ok: false, mensagem: MENSAGENS[r?.motivo ?? ""] ?? "Não foi possível ativar os lembretes." };
}

/** Pede permissão, cria a assinatura do aparelho e registra no banco. */
export async function ativarLembretes(modo: ModoLembretes): Promise<ResultadoLembretes> {
  if (!CHAVE_PUBLICA || !supabase || !suportaPush()) {
    return { ok: false, mensagem: "Este aparelho não suporta lembretes." };
  }
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    return { ok: false, mensagem: "Sem a permissão de notificações não dá para enviar os lembretes." };
  }
  try {
    const registro = await navigator.serviceWorker.ready;
    let sub = await registro.pushManager.getSubscription();
    if (!sub) {
      sub = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(CHAVE_PUBLICA) as BufferSource,
      });
    }
    const r = await registrarNoBanco(modo, sub);
    if (r.ok) {
      // confirmação na hora, para a pessoa ver que funciona
      await registro.showNotification("Lembretes ativados 🎶", {
        body: "Você vai receber um aviso na semana em que estiver escalado.",
        icon: "/icons/icon-192.png",
        tag: "lembretes-ativados",
        data: { url: "/escala" },
      });
    }
    return r;
  } catch {
    return { ok: false, mensagem: "Não foi possível ativar os lembretes neste aparelho." };
  }
}

/** Desliga os lembretes neste aparelho (avisa o banco e cancela a assinatura). */
export async function desativarLembretes(modo: ModoLembretes): Promise<void> {
  const registro = await navigator.serviceWorker.getRegistration();
  const sub = await registro?.pushManager.getSubscription();
  if (!sub) return;
  try {
    if (supabase) {
      if (modo.tipo === "integrante") {
        await supabase.rpc("push_cancelar", { p_nome: modo.nome, p_senha: modo.senha, p_endpoint: sub.endpoint });
      } else {
        await supabase.rpc("push_cancelar_equipe", { p_endpoint: sub.endpoint });
      }
    }
  } finally {
    await sub.unsubscribe().catch(() => {});
  }
}

/** Ao sair do app: para de receber lembretes neste aparelho, sem mostrar nada na tela. */
export function cancelarLembretesSilencioso(modo: ModoLembretes): void {
  if (!suportaPush()) return;
  desativarLembretes(modo).catch(() => {});
}
