# MyFrot.ai - Impeccable UI v2 (Reference UI Kit)

Esta diretiva sobrepõe a V1 (Bento Grid) e define um novo padrão rigoroso focado nas referências visuais mais recentes: limpo, moderno, "sem cara de IA", inspirado em kits UI premium.

## 🎨 1. Design Tokens Básicos (Baseado na Referência Quente)
- **Background Root:** Creme/Off-white quente (`#F5F5F0` ou `#F9F9F8`)
- **Superfícies (Cards):** Creme ligeiramente mais escuro / Taupe claríssimo (`#EFEFEB` ou `#F0EFEA`)
- **Primary / Accent:** Amarelo Vibrante (`#FACC15`)
- **Secundários (Gráficos/Tags):** Verde Oliva pastel (`#A3B18A` ou `#8e9e82`), Rosa/Pêssego pastel (`#E8D1D1` ou `#ebd2d3`)
- **Bordas Fixas:** Sem bordas sólidas, ou apenas contraste sutil via cor de fundo (`#E6E6DF`).
- **Textos:**
  - Primário (Títulos, Valores): Cinza muito escuro / Preto (`#2C2C2A` ou `#1A1A1A`)
  - Secundário (Labels, Hints): Cinza quente / Taupe médio (`#8C8C82` ou `#737367`)
- **Alerta:** Vermelho/Coral suave (`#E06B65`) rodeado por círculo borda vermelha fina.

## 🔲 2. Formas e Radii (Essencial para o visual das imagens)
- **Botões (Primários e Secundários):** Formato "Pill" absoluto (`border-radius: 999px`).
- **Inputs de Texto:** Formato "Pill" absoluto (bordas totalmente circulares, `999px`).
- **Cards e Popups:** Arredondamento elegante mas não circular completo, entre `24px` e `32px`.

## 🌑 3. Profundidade e Sombras
- O design é predominantemente *flat* e delimitado por linhas orgânicas.
- **Pop-ups e Dropdowns:** Possuem uma sombra muito ampla e difusa para se destacar sem usar bordas duras. Ex: `box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08)`.

## 🔘 4. Botões e Interações
- **Primary Button:** Fundo amarelo sólido, texto preto em negrito, sem borda.
- **Secondary Button:** Fundo branco/transparente, borda fina cinza (`1px solid #E5E7EB`), texto preto.
- **Active State (Paginação/Tabs):** O item selecionado recebe um círculo perfeito amarelo atrás do botão ou ícone.

## 🖥 5. Tipografia
- Fonte sem serifa hiper-legível (system-ui, Inter, Roboto).
- Labels de campos de texto vêm *acima* do input ou flutuantes sobre a borda, sempre em texto pequeno, uppercase ou title-case em cinza claro.

## 💡 Princípio da Componentização:
Qualquer nova tela de listagem, pagamento ou cadastro deve evocar a sensação de que é um app "premium" de iOS ou SaaS super financiado:
*Nada deve ser quadrado. Espaçamento (whitespace) é rei.*
