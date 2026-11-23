// Leitura do QR Code Pix ("Pix copia e cola", padrão EMV do Banco Central).
// O QR do boleto traz, quando existe: valor, nome de quem recebe e a chave Pix.
// Ele NÃO traz o vencimento (esse vem do código de barras).

function tlv(texto) {
  const campos = {}
  let i = 0
  while (i + 4 <= texto.length) {
    const id = texto.slice(i, i + 2)
    const tamanho = Number(texto.slice(i + 2, i + 4))
    if (!Number.isInteger(tamanho)) break
    const valor = texto.slice(i + 4, i + 4 + tamanho)
    if (valor.length < tamanho) break
    campos[id] = valor
    i += 4 + tamanho
  }
  return campos
}

function crc16(texto) {
  let crc = 0xffff
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function ehPix(texto) {
  return /^000201/.test(String(texto || '').trim())
}

// true quando o código está inteiro e o CRC final confere
export function pixCompleto(texto) {
  const s = String(texto || '').trim()
  return s.length >= 30 && s.slice(-8, -4) === '6304' && crc16(s.slice(0, -4)) === s.slice(-4).toUpperCase()
}

function formatarCnpj(d) {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function lerPix(texto) {
  const s = String(texto || '').trim()
  if (!ehPix(s)) return { ok: false, erro: 'Isto não é um código Pix.' }
  if (!pixCompleto(s)) return { ok: false, erro: 'Código Pix incompleto ou com erro. Copie ou leia de novo.' }

  const topo = tlv(s)
  let chave = ''
  let url = ''
  for (let id = 26; id <= 51; id++) {
    const sub = topo[String(id)] ? tlv(topo[String(id)]) : null
    if (sub && /br\.gov\.bcb\.pix/i.test(sub['00'] || '')) {
      chave = sub['01'] || ''
      url = sub['25'] || ''
      break
    }
  }
  const soDigitos = chave.replace(/\D/g, '')
  const valor = topo['54'] ? Number(topo['54']) : 0

  return {
    ok: true,
    valor: Number.isFinite(valor) ? valor : 0,
    nome: topo['59'] || '',
    cidade: topo['60'] || '',
    chave,
    cnpj: soDigitos.length === 14 && chave === soDigitos ? formatarCnpj(soDigitos) : '',
    dinamico: Boolean(url) || topo['01'] === '12',
  }
}
