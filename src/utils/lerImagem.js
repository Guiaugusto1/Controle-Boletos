// Ferramentas para achar o código de barras (ITF) ou o QR Pix em imagens:
// quadros da câmera ao vivo e fotos do boleto. Tenta várias rotações (vertical e
// horizontal), recortes e contraste, porque as barras do boleto são muito finas.
import { ehPix } from './pix'

// Aceita código de barras com 44 números ou QR Code Pix
export function aceitarCodigo(texto) {
  const t = String(texto || '').trim()
  if (ehPix(t)) return true
  return /^\d{44}$/.test(t.replace(/\s/g, ''))
}

export async function criarLeitor() {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')
  const dicas = new Map()
  dicas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.ITF, BarcodeFormat.QR_CODE])
  dicas.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(dicas)
}

// Leitor só para diagnóstico: acha outros tipos de código de barras (que não são de boleto)
// para avisar "li um código, mas não é de boleto" em vez de ficar sem resposta.
export async function criarLeitorOutros() {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')
  const dicas = new Map()
  dicas.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  ])
  dicas.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(dicas)
}

// todos = true: o leitor nativo procura qualquer tipo de código (usado no diagnóstico)
export async function criarDetectorNativo(todos = false) {
  if (!('BarcodeDetector' in window)) return null
  try {
    const suportados = await window.BarcodeDetector.getSupportedFormats()
    const formatos = todos ? suportados : ['itf', 'qr_code'].filter((f) => suportados.includes(f))
    return formatos.length && suportados.includes('itf') ? new window.BarcodeDetector({ formats: formatos }) : null
  } catch {
    return null
  }
}

// Desenha a fonte (vídeo ou imagem) no canvas, girada em "graus" e recortando a faixa
// central ("faixa" = parte da altura que fica, de 0 a 1). Reduz se passar de maxLado.
// Imagens pequenas são ampliadas (até 5x) para dar mais pixels às barras finas.
export function desenhar(canvas, fonte, largura, altura, graus = 0, maxLado = 1920, faixa = 1, filtro = 'none') {
  const girado = graus % 180 !== 0
  const rw = girado ? altura : largura
  const rh = girado ? largura : altura
  const escala = Math.min(5, maxLado / Math.max(rw, rh))
  const cw = Math.max(1, Math.round(rw * escala))
  const ch = Math.max(1, Math.round(rh * escala * faixa))
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cw, ch)
  ctx.filter = filtro
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(cw / 2, ch / 2)
  ctx.rotate((graus * Math.PI) / 180)
  ctx.drawImage(fonte, (-largura * escala) / 2, (-altura * escala) / 2, largura * escala, altura * escala)
  ctx.restore()
  return canvas
}

export function decodificar(leitor, canvas) {
  try {
    return leitor.decodeFromCanvas(canvas).getText()
  } catch {
    return null // não achou nada neste quadro
  }
}

const respirar = () => new Promise((r) => setTimeout(r, 0))

// Lê uma foto (arquivo de imagem).
// Devolve { texto } quando acha um código de boleto/Pix válido; senão { texto: null, outro, largura, altura },
// onde "outro" é o conteúdo de algum código que não é de boleto (se houver).
export async function lerCodigoDeImagem(arquivo) {
  let bitmap
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    bitmap = await createImageBitmap(arquivo)
  }
  const { width: w, height: h } = bitmap
  const canvas = document.createElement('canvas')
  let outro = ''

  // 1) leitor nativo do Chrome, em 4 rotações
  const nativo = await criarDetectorNativo(true)
  if (nativo) {
    for (const graus of [0, 90, 270, 180]) {
      desenhar(canvas, bitmap, w, h, graus, 2400)
      try {
        const achados = await nativo.detect(canvas)
        const bom = achados.find((a) => aceitarCodigo(a.rawValue))
        if (bom) return { texto: bom.rawValue }
        if (!outro && achados[0]?.rawValue) outro = achados[0].rawValue
      } catch {
        /* segue para a próxima tentativa */
      }
      await respirar()
    }
  }

  // 2) ZXing, variando tamanho, rotação, recorte e contraste
  const leitor = await criarLeitor()
  for (const maxLado of [2000, 1400]) {
    for (const graus of [0, 90, 270]) {
      for (const faixa of [1, 0.5]) {
        for (const filtro of ['none', 'grayscale(1) contrast(1.6)']) {
          desenhar(canvas, bitmap, w, h, graus, maxLado, faixa, filtro)
          const texto = decodificar(leitor, canvas)
          if (texto && aceitarCodigo(texto)) return { texto }
          if (texto && !outro) outro = texto
          await respirar()
        }
      }
    }
  }

  // 3) só para avisar: existe algum outro tipo de código de barras na imagem?
  if (!outro) {
    try {
      const outros = await criarLeitorOutros()
      for (const graus of [0, 90]) {
        for (const filtro of ['none', 'grayscale(1) contrast(1.6)']) {
          desenhar(canvas, bitmap, w, h, graus, 1600, 1, filtro)
          const texto = decodificar(outros, canvas)
          if (texto) {
            outro = texto
            break
          }
          await respirar()
        }
        if (outro) break
      }
    } catch {
      /* diagnóstico indisponível */
    }
  }
  return { texto: null, outro, largura: w, altura: h }
}
