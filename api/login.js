// POST /api/login  { email, senha }  ->  { token }
// O e-mail e a senha ficam nas variáveis ADMIN_EMAIL e ADMIN_SENHA da Vercel.
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

function iguais(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' })

  const { ADMIN_EMAIL, ADMIN_SENHA, JWT_SECRET } = process.env
  if (!ADMIN_EMAIL || !ADMIN_SENHA || !JWT_SECRET) {
    return res.status(500).json({ erro: 'O login ainda não foi configurado no servidor.' })
  }

  const { email, senha } = req.body || {}
  const emailOk = iguais(String(email || '').trim().toLowerCase(), ADMIN_EMAIL.trim().toLowerCase())
  const senhaOk = iguais(senha || '', ADMIN_SENHA)

  if (!(emailOk && senhaOk)) {
    await new Promise((r) => setTimeout(r, 800)) // atrasa tentativas erradas
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  }

  const token = jwt.sign({ loja: true }, JWT_SECRET, { expiresIn: '30d' })
  res.status(200).json({ token })
}
