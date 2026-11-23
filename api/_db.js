// Conexão com o Postgres (Neon). A variável DATABASE_URL é criada pela Vercel
// quando você conecta o banco ao projeto.
const { neon } = require('@neondatabase/serverless')

let sql
let pronto

function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
    if (!url) throw new Error('Falta a variável DATABASE_URL.')
    sql = neon(url)
  }
  return sql
}

// Cria a tabela na primeira chamada (não faz nada se ela já existir)
async function iniciar() {
  if (!pronto) {
    pronto = getSql()`
      CREATE TABLE IF NOT EXISTS estado (
        id TEXT PRIMARY KEY,
        dados JSONB NOT NULL,
        versao INTEGER NOT NULL DEFAULT 1,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      )`.then(() => undefined).catch((e) => { pronto = null; throw e })
  }
  return pronto
}

module.exports = { getSql, iniciar }
