import {
  Box,
  Flex,
  VStack,
  Text,
  Icon,
  IconButton,
  Image,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { FiHome, FiFileText, FiShoppingBag, FiTrendingUp, FiBookOpen, FiBarChart2, FiSettings, FiMenu } from 'react-icons/fi'
import { useLoja } from '../contexts/LojaContext'

const menu = [
  { label: 'Início', path: '/', icon: FiHome },
  { label: 'Boletos', path: '/boletos', icon: FiFileText },
  { label: 'Despesas', path: '/despesas', icon: FiShoppingBag },
  { label: 'Vendas', path: '/vendas', icon: FiTrendingUp },
  { label: 'Fiado', path: '/fiados', icon: FiBookOpen },
  { label: 'Relatórios', path: '/relatorios', icon: FiBarChart2 },
  { label: 'Configurações', path: '/configuracoes', icon: FiSettings },
]

function Menu({ aoNavegar }) {
  const { boletos, config } = useLoja()
  // Mostra no menu quantos boletos estão vencidos ou vencendo
  const urgentes = boletos.filter((b) => {
    if (b.pago || !b.vencimento) return false
    const [a, m, d] = b.vencimento.split('-').map(Number)
    const dias = Math.round((new Date(a, m - 1, d) - new Date(new Date().toDateString())) / 86400000)
    return dias <= config.diasAlerta
  }).length

  return (
    <Flex direction="column" h="100%" bg="marrom.500" color="creme.200">
      <Box px={6} pt={8} pb={6} textAlign="center">
        <Image src="/logo.png" alt={config.nomeLoja} boxSize="132px" mx="auto" />
      </Box>
      <VStack as="nav" spacing={1} align="stretch" px={3} flex="1" aria-label="Menu principal">
        {menu.map((item) => (
          <Flex
            key={item.path}
            as={NavLink}
            to={item.path}
            end={item.path === '/'}
            onClick={aoNavegar}
            align="center"
            gap={3}
            px={4}
            py={2.5}
            borderRadius="lg"
            fontWeight={600}
            fontSize="sm"
            color="creme.300"
            transition="background 0.15s"
            _hover={{ bg: 'whiteAlpha.100', color: 'creme.200' }}
            _focusVisible={{ outline: '2px solid', outlineColor: 'creme.200' }}
            sx={{ '&.active': { bg: 'vinho.500', color: 'creme.200' } }}
          >
            <Icon as={item.icon} boxSize={4} />
            <Text flex="1">{item.label}</Text>
            {item.path === '/boletos' && urgentes > 0 && (
              <Box
                bg="creme.200"
                color="vinho.500"
                fontSize="xs"
                fontWeight={700}
                minW="22px"
                h="22px"
                lineHeight="22px"
                textAlign="center"
                borderRadius="full"
                title={`${urgentes} boleto(s) vencido(s) ou vencendo`}
              >
                {urgentes}
              </Box>
            )}
          </Flex>
        ))}
      </VStack>
      <Text px={6} py={5} fontSize="xs" color="marrom.200">
        Dados salvos neste navegador. Faça backup em Configurações.
      </Text>
    </Flex>
  )
}

function Layout() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { erroSalvar } = useLoja()
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <Flex minH="100vh">
      {/* Menu lateral no computador */}
      <Box w="248px" flexShrink={0} display={{ base: 'none', lg: 'block' }} position="sticky" top={0} h="100vh">
        <Menu />
      </Box>

      {/* Menu em gaveta no celular */}
      <Drawer isOpen={isOpen} onClose={onClose} placement="left">
        <DrawerOverlay />
        <DrawerContent maxW="260px" bg="marrom.500">
          <DrawerCloseButton color="creme.200" />
          <Menu aoNavegar={onClose} />
        </DrawerContent>
      </Drawer>

      <Box flex="1" minW={0}>
        <Flex
          display={{ base: 'flex', lg: 'none' }}
          bg="marrom.500"
          color="creme.200"
          align="center"
          gap={3}
          px={3}
          py={2}
          position="sticky"
          top={0}
          zIndex={10}
        >
          <IconButton
            icon={<FiMenu />}
            aria-label="Abrir menu"
            variant="ghost"
            color="creme.200"
            _hover={{ bg: 'whiteAlpha.200' }}
            onClick={onOpen}
          />
          <Image src="/logo.png" alt="" boxSize="36px" />
          <Text fontFamily="heading" fontSize="lg" fontWeight={600}>
            Balaio Mineiro
          </Text>
        </Flex>

        <Box as="main" px={{ base: 4, md: 8 }} py={{ base: 5, md: 8 }} maxW="1200px">
          {erroSalvar && (
            <Alert status="error" mb={4} borderRadius="lg">
              <AlertIcon />
              Não foi possível salvar os dados no navegador. Faça um backup agora em Configurações.
            </Alert>
          )}
          <Outlet />
        </Box>
      </Box>
    </Flex>
  )
}

export default Layout
