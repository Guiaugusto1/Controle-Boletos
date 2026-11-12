// API do Controle da Loja: Express + Postgres (Render)
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')

const { DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_SENHA, FRONTEND_URL } = process.env
const PORT = process.env.PORT || 3000

if (!DATABASE_URL || !JWT_SECRET) {
  console.error('Faltam as variáveis DATABASE_URL e JWT_SECRET.')
  process.exit(1)
}

// O endereço interno do Render não usa SSL; o externo (…render.com) usa.
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
})

const app = express()
app.use(express.json({ limit: '5mb' }))
app.use(cors({ origin: FRONTEND_URL ? FRONTEND_URL.split(',') : false }))

// ---------- banco ----------
async function iniciarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS registros (
      colecao TEXT NOT NULL,
      id TEXT NOT NULL,
      dados JSONB NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (colecao, id)
    );
  `)
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios')
  if (rows[0].n === 0 && ADMIN_EMAIL && ADMIN_SENHA) {
    const hash = await bcrypt.hash(ADMIN_SENHA, 10)
    await pool.query('INSERT INTO usuarios (email, senha_hash) VALUES ($1, $2)', [ADMIN_EMAIL.toLowerCase(), hash])
    console.log('Usuário inicial criado:', ADMIN_EMAIL)
  }
}

// ---------- login ----------
const tentativas = new Map() // ip -> { n, ate }
function limitarLogin(req, res, next) {
  const ip = req.ip
  const t = tentativas.get(ip)
  if (t && t.ate > Date.now() && t.n >= 10) {
    return res.status(429).json({ erro: 'Muitas tentativas. Espere 15 minutos.' })
  }
  next()
}

app.get('/health', (_req, res) => res.send('ok'))

app.post('/api/login', limitarLogin, async (req, res) => {
  const { email, senha } = req.body || {}
  const ip = req.ip
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [String(email || '').toLowerCase()])
  const ok = rows[0] && (await bcrypt.compare(String(senha || ''), rows[0].senha_hash))
  if (!ok) {
    const t = tentativas.get(ip)
    tentativas.set(ip, t && t.ate > Date.now() ? { n: t.n + 1, ate: t.ate } : { n: 1, ate: Date.now() + 15 * 60 * 1000 })
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  }
  tentativas.delete(ip)
  const token = jwt.sign({ uid: rows[0].id }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token })
})

function exigirLogin(req, res, next) {
  const h = req.headers.authorization || ''
  try {
    req.usuario = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ erro: 'Faça login.' })
  }
}
app.use('/api', exigirLogin)

// ---------- backup ----------
// Baixa tudo: { boletos: [...], despesas: [...], ... }
app.get('/api/exportar', async (_req, res) => {
  const { rows } = await pool.query('SELECT colecao, id, dados FROM registros ORDER BY criado_em')
  const saida = {}
  rows.forEach((r) => {
    ;(saida[r.colecao] = saida[r.colecao] || []).push({ ...r.dados, id: r.id })
  })
  res.json(saida)
})

// Importa o backup antigo: { boletos: [...], despesas: [...] }
app.post('/api/importar', async (req, res) => {
  const corpo = req.body || {}
  const client = await pool.connect()
  let total = 0
  try {
    await client.query('BEGIN')
    for (const [colecao, itens] of Object.entries(corpo)) {
      if (!COLECAO_OK.test(colecao) || !Array.isArray(itens)) continue
      for (const item of itens) {
        if (!item || typeof item !== 'object') continue
        const { id, ...dados } = item
        await client.query(
          `INSERT INTO registros (colecao, id, dados) VALUES ($1, $2, $3)
           ON CONFLICT (colecao, id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`,
          [colecao, String(id ?? crypto.randomUUID()), dados]
        )
        total++
      }
    }
    await client.query('COMMIT')
    res.json({ importados: total })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ erro: 'Falha ao importar.' })
  } finally {
    client.release()
  }
})

// ---------- coleções (boletos, despesas, vendas, clientes...) ----------
const COLECAO_OK = /^[a-z][a-z0-9_]{0,29}$/
function validarColecao(req, res, next) {
  if (!COLECAO_OK.test(req.params.colecao)) return res.status(400).json({ erro: 'Coleção inválida.' })
  next()
}

app.get('/api/:colecao', validarColecao, async (req, res) => {
  const { rows } = await pool.query('SELECT id, dados FROM registros WHERE colecao = $1 ORDER BY criado_em', [req.params.colecao])
  res.json(rows.map((r) => ({ ...r.dados, id: r.id })))
})

app.post('/api/:colecao', validarColecao, async (req, res) => {
  const { id, ...dados } = req.body || {}
  const novoId = String(id ?? crypto.randomUUID())
  await pool.query(
    `INSERT INTO registros (colecao, id, dados) VALUES ($1, $2, $3)
     ON CONFLICT (colecao, id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`,
    [req.params.colecao, novoId, dados]
  )
  res.status(201).json({ ...dados, id: novoId })
})

app.put('/api/:colecao/:id', validarColecao, async (req, res) => {
  const { id: _ignorado, ...dados } = req.body || {}
  const r = await pool.query(
    'UPDATE registros SET dados = $3, atualizado_em = now() WHERE colecao = $1 AND id = $2',
    [req.params.colecao, req.params.id, dados]
  )
  if (!r.rowCount) return res.status(404).json({ erro: 'Não encontrado.' })
  res.json({ ...dados, id: req.params.id })
})

app.delete('/api/:colecao/:id', validarColecao, async (req, res) => {
  await pool.query('DELETE FROM registros WHERE colecao = $1 AND id = $2', [req.params.colecao, req.params.id])
  res.status(204).end()
})

// erros inesperados não derrubam a API
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ erro: 'Erro interno.' })
})

iniciarBanco()
  .then(() => app.listen(PORT, () => console.log('API na porta', PORT)))
  .catch((e) => {
    console.error('Erro ao iniciar o banco:', e)
    process.exit(1)
  })
