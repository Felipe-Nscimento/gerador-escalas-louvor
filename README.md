# Gerador de Escalas de Louvor

Aplicativo para gerar e organizar escalas mensais do grupo de louvor. Funciona
100% offline com **LocalStorage** — e, se você conectar um projeto Supabase
(veja abaixo), o líder consegue revisar, editar e aprovar a escala remotamente,
de qualquer aparelho.

## Como rodar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

Para gerar uma versão de produção (mais rápida):

```bash
npm run build
npm run start
```

## Como usar

1. **Instrumentos** — cadastre as funções que existem no seu grupo (Voz, Violão,
   Teclado, Bateria, Baixo já vêm por padrão; adicione outras como Percussão,
   Segunda voz, Violino etc.). Marque como **obrigatório** o que a geração
   automática deve sempre tentar preencher.
2. **Integrantes** — cadastre cada pessoa e marque quais instrumentos ela toca.
3. **Configurações** — mês, ano, quantidade de domingos, domingo do solo e as
   regras gerais.
4. **Escala** — clique em **Gerar escala**. Cada função aceita **mais de uma
   pessoa**: use "+ adicionar" para abrir um segundo (ou terceiro) seletor na
   mesma função, e o ícone de lixeira para remover um deles.
   - **Surpreenda-me**: gera uma combinação totalmente nova, mantendo as regras.
   - **Restaurar original**: desfaz edições manuais e volta à geração automática.
   - **Adicionar culto extra**: inclui um culto avulso em qualquer dia da semana
     (vigília, culto de oração, culto de jovens etc.), com escalação própria.
   - **Salvar**: guarda a escala como rascunho neste aparelho.
   - **Exportar PDF**: abre a caixa de impressão do navegador — "Salvar como PDF".
5. **Histórico** — rascunhos deste aparelho e (se configurado) as escalas
   enviadas para aprovação remota.

### Fluxo de aprovação

Sem Supabase configurado, a aprovação é só local: **Aprovar aqui** /
**Cancelar aprovação**, no mesmo aparelho.

Com Supabase configurado e você logado:

- **Enviar para o líder** manda a escala para a nuvem com status
  **Aguardando aprovação**.
- O líder entra com a própria conta em **qualquer aparelho** (aba Histórico →
  Aprovação remota) e vê a escala na lista.
- Ele pode **editar** qualquer posição direto ali — inclusive adicionar mais
  gente na mesma função — antes de decidir:
  - **Aprovar**: trava a escala (só o líder pode mexer depois disso) e libera
    o botão "Copiar para WhatsApp" para quem montou.
  - **Devolver**: manda de volta para ajustes, com um motivo — o status vira
    "Devolvida" e quem montou pode editar e reenviar.
- Ao copiar para o WhatsApp uma escala aprovada, ela é marcada automaticamente
  como **Publicada**.

### Configurar o Supabase (opcional, para aprovação remota)

1. Crie um projeto em [supabase.com](https://supabase.com) (grátis).
2. No **SQL Editor** do projeto, rode o arquivo `supabase/schema.sql` deste
   repositório — ele cria as tabelas `escalas_aprovacao` e `profiles`, com as
   políticas de segurança (RLS) já configuradas.
3. Em **Project Settings → API**, copie a **Project URL** e a **anon public
   key**.
4. Copie `.env.local.example` para `.env.local` e preencha as duas variáveis.
   Ao publicar no Vercel, configure as mesmas duas variáveis em
   **Settings → Environment Variables**.
5. Cada pessoa (montador e líder) cria a própria conta pelo formulário de
   e-mail/senha dentro do app (aba Histórico). Toda conta nova entra como
   `montador`.
6. Para transformar alguém em líder, rode no SQL Editor (com o UUID da conta
   dela, visível em **Authentication → Users**):
   ```sql
   update public.profiles set role='lider', nome='Nome do Líder' where id='UUID_DO_USUARIO';
   ```

Sem essas variáveis configuradas, o app funciona normalmente offline — só a
aprovação remota fica desligada (o aviso aparece na aba Escala/Histórico).

### Instalar como aplicativo no celular

O app tem um manifesto e funciona offline, então dá pra instalar como um app
de verdade:

- **Android (Chrome)**: abra o site publicado (ex: Vercel) → menu (⋮) →
  "Adicionar à tela inicial" ou "Instalar app".
- **iPhone (Safari)**: abra o site → toque no ícone de compartilhar →
  "Adicionar à Tela de Início".

Depois de instalado, ele abre em tela cheia com ícone próprio, sem a barra do
navegador.

## Observação sobre os dados

Integrantes, instrumentos, configurações e rascunhos ficam no LocalStorage do
navegador (por aparelho). Escalas enviadas para aprovação remota ficam também
no seu banco Supabase, protegidas por RLS: qualquer pessoa autenticada pode
ler, mas só quem criou (enquanto não aprovada) ou o líder pode editar.

## Stack

Next.js 14 · React 18 · TypeScript · Tailwind CSS · lucide-react · Supabase (auth + Postgres, opcional)
