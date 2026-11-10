// Tema baseado no Manual de Marca do Empório Balaio Mineiro
// Cores oficiais: creme #FFF1D3, vinho #5C1B17, marrom #2B1507
import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  config: { initialColorMode: 'light', useSystemColorMode: false },
  fonts: {
    // Montserrat é a fonte usada nos títulos do manual.
    // Crimson Pro substitui a Mongolian Baiti (fonte do "EMPÓRIO"), que não existe na web.
    heading: "'Crimson Pro', Georgia, 'Times New Roman', serif",
    body: "'Montserrat', 'Segoe UI', system-ui, sans-serif",
  },
  colors: {
    creme: {
      50: '#FFFCF5',
      100: '#FFF8EA',
      200: '#FFF1D3', // oficial
      300: '#F3E2BE',
      400: '#E6D0A3',
      500: '#D4B887',
      600: '#B39563',
      700: '#8C7246',
      800: '#64502F',
      900: '#3D301B',
    },
    vinho: {
      50: '#F8ECEA',
      100: '#EBCFCB',
      200: '#D4A39D',
      300: '#B5716A',
      400: '#86372F',
      500: '#5C1B17', // oficial
      600: '#4C1612',
      700: '#3C110E',
      800: '#2C0C0A',
      900: '#1C0806',
    },
    marrom: {
      50: '#F4EEEA',
      100: '#E0D2C8',
      200: '#C2A897',
      300: '#9A7A64',
      400: '#6B4A35',
      500: '#2B1507', // oficial
      600: '#241105',
      700: '#1C0D04',
      800: '#140903',
      900: '#0C0502',
    },
    // Cores de situação, em tons terrosos para combinar com a marca
    pago: { 50: '#EEF4EC', 100: '#D3E4CF', 500: '#3F6B3A', 600: '#335730', 700: '#284425' },
    alerta: { 50: '#FDF3E1', 100: '#F8E0B0', 500: '#B7791F', 600: '#975A16', 700: '#744210' },
    atraso: { 50: '#FBEAE8', 100: '#F3C9C4', 500: '#A3261E', 600: '#861F18', 700: '#6A1813' },
    // Avisos e notificações do Chakra (toasts, alertas) nos mesmos tons terrosos
    green: { 50: '#EEF4EC', 100: '#D3E4CF', 200: '#B2CFAC', 300: '#8DB585', 400: '#5F8C58', 500: '#3F6B3A', 600: '#335730', 700: '#284425', 800: '#1D311B', 900: '#121F11' },
    orange: { 50: '#FDF3E1', 100: '#F8E0B0', 200: '#F0C77A', 300: '#E2A94A', 400: '#CD8F2C', 500: '#B7791F', 600: '#975A16', 700: '#744210', 800: '#55300C', 900: '#371F08' },
    red: { 50: '#FBEAE8', 100: '#F3C9C4', 200: '#E6A19A', 300: '#D2756C', 400: '#BB4A40', 500: '#A3261E', 600: '#861F18', 700: '#6A1813', 800: '#4E120E', 900: '#330C09' },
  },
  styles: {
    global: {
      'html, body': {
        bg: 'creme.100',
        color: 'marrom.500',
        fontFeatureSettings: '"tnum"', // números alinhados nas tabelas
      },
      '::selection': { bg: 'vinho.100' },
    },
  },
  components: {
    Heading: {
      baseStyle: { fontWeight: 600, letterSpacing: '-0.01em', color: 'marrom.500' },
    },
    Button: {
      baseStyle: { borderRadius: 'lg', fontWeight: 600 },
      defaultProps: { colorScheme: 'vinho' },
    },
    Input: {
      defaultProps: { focusBorderColor: 'vinho.400' },
      variants: {
        outline: { field: { bg: 'white', borderColor: 'creme.400', _hover: { borderColor: 'creme.600' } } },
      },
    },
    Select: {
      defaultProps: { focusBorderColor: 'vinho.400' },
      variants: {
        outline: { field: { bg: 'white', borderColor: 'creme.400', _hover: { borderColor: 'creme.600' } } },
      },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'vinho.400' },
      variants: { outline: { bg: 'white', borderColor: 'creme.400' } },
    },
    FormLabel: { baseStyle: { fontSize: 'sm', fontWeight: 600, color: 'marrom.400', mb: 1 } },
    Table: {
      variants: {
        simple: {
          th: {
            fontFamily: 'body',
            textTransform: 'none',
            letterSpacing: 'normal',
            fontSize: 'xs',
            fontWeight: 700,
            color: 'marrom.300',
            borderColor: 'creme.300',
            bg: 'creme.50',
          },
          td: { borderColor: 'creme.300', fontSize: 'sm' },
        },
      },
    },
    Modal: { baseStyle: { dialog: { bg: 'creme.50', borderRadius: 'xl' } } },
    Drawer: { baseStyle: { dialog: { bg: 'creme.50' } } },
    Tag: { baseStyle: { container: { fontWeight: 600 } } },
  },
})

export default theme
