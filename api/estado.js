// GET /api/estado  -> { dados, versao }   (dados = null se ainda não existe)
// PUT /api/estado  { dados, versao }       -> { versao }
// "versao" evita que um aparelho apague, sem querer, o que outro salvou antes:
// se a versão enviada não for a atual, o servidor responde 409.
const { getSql, iniciar } = require('./_db')
const { exigirLogin } = require('./_auth')

const ID = 'loja'

module.exports = async (req, res) => {
  if (!exigirLogin(req, res)) return

  try {
    await iniciar()
    const sql = getSql()

    if (req.method === 'GET') {
      const linhas = await sql`SELECT dados, versao FROM estado WHERE id = ${ID}`
      if (!linhas.length) return res.status(200).json({ dados: null, versao: 0 })
      return res.status(200).json({ dados: linhas[0].dados, versao: linhas[0].versao })
    }

    if (req.method === 'PUT') {
      const { dados, versao } = req.body || {}
      if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        return res.status(400).json({ erro: 'Dados inválidos.' })
      }
      const texto = JSON.stringify(dados)
      const v = Number(versao) || 0

      const linhas = v === 0
        ? await sql`INSERT INTO estado (id, dados, versao) VALUES (${ID}, ${texto}::jsonb, 1)
                    ON CONFLICT (id) DO NOTHING RETURNING versao`
        : await sql`UPDATE estado SET dados = ${texto}::jsonb, versao = versao + 1, atualizado_em = now()
                    WHERE id = ${ID} AND versao = ${v} RETURNING versao`

      if (!linhas.length) return res.status(409).json({ erro: 'Os dados foram alterados em outro aparelho.' })
      return res.status(200).json({ versao: linhas[0].versao })
    }

    res.status(405).json({ erro: 'Método não permitido.' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ erro: 'Erro no servidor.' })
  }
}
