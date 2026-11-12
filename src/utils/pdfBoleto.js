import { lerCodigoBoleto } from './boleto'

export async function importarBoletoPDF(file) {
  if (!file) return { ok: false, erro: 'Arquivo inválido.' }

  try {
    const texto = await file.text()
    const match = String(texto).match(/[0-9]{44,48}/)
    if (!match) {
      return { ok: false, erro: 'Nenhum código de boleto foi encontrado no PDF.', parcial: null }
    }
    return lerCodigoBoleto(match[0])
  } catch (error) {
    console.error(error)
    return { ok: false, erro: 'Não foi possível ler o PDF do boleto.', parcial: null }
  }
}

export default { importarBoletoPDF }
