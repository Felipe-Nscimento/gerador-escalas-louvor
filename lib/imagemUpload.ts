/**
 * Prepara a foto para envio ao Storage: reduz (lado maior = 800px) e converte
 * para WebP (ou JPEG nos navegadores que não geram WebP). Mantém a imagem
 * pequena (normalmente < 200 KB) sem guardar nada em base64 no banco.
 */
export interface FotoPreparada {
  blob: Blob;
  ext: "webp" | "jpg";
  tipo: "image/webp" | "image/jpeg";
}

const LADO_MAXIMO = 800;

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function canvasParaBlob(
  canvas: HTMLCanvasElement,
  tipo: string,
  qualidade: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), tipo, qualidade));
}

export async function prepararFoto(file: File): Promise<FotoPreparada> {
  const img = await carregarImagem(file);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const largura = Math.max(1, Math.round(img.width * escala));
  const altura = Math.max(1, Math.round(img.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.fillStyle = "#ffffff"; // PNG com transparência não vira fundo preto no JPEG
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(img, 0, 0, largura, altura);

  const webp = await canvasParaBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") {
    return { blob: webp, ext: "webp", tipo: "image/webp" };
  }
  const jpeg = await canvasParaBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("Não foi possível processar a imagem.");
  return { blob: jpeg, ext: "jpg", tipo: "image/jpeg" };
}
