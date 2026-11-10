import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home.jsx'
import Boletos from './pages/Boletos.jsx'
import NovoBoleto from './pages/NovoBoleto.jsx'
import Despesas from './pages/Despesas.jsx'
import Vendas from './pages/Vendas.jsx'
import Fiados from './pages/Fiados.jsx'
import Relatorios from './pages/Relatorios.jsx'
import Configuracoes from './pages/Configuracoes.jsx'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/boletos" element={<Boletos />} />
        <Route path="/boletos/novo" element={<NovoBoleto />} />
        <Route path="/boletos/:id/editar" element={<NovoBoleto />} />
        <Route path="/despesas" element={<Despesas />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/fiados" element={<Fiados />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
