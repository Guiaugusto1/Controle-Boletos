const jwt = require('jsonwebtoken')

// Devolve os dados do token, ou responde 401 e devolve null
function exigirLogin(req, res) {
  const cabecalho = req.headers.authorization || ''
  try {
    return jwt.verify(cabecalho.replace('Bearer ', ''), process.env.JWT_SECRET)
  } catch {
    res.status(401).json({ erro: 'Faça login.' })
    return null
  }
}

module.exports = { exigirLogin }
