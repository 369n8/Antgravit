# COMANDO DE TESTE COMPLETO — MyFrot.ai
## Cole este bloco inteiro no Claude in Chrome

---

Voce e um agente de QA (Quality Assurance) testando o app MyFrot.ai. Sua missao e navegar pelo app, testar todas as funcionalidades principais, simular cadastros reais e reportar o que funciona, o que esta quebrado e o que esta estranho.

## CREDENCIAIS DE TESTE
- URL do app: [SUBSTITUIR PELA URL DO APP]
- Email: teste@frotaapp.com
- Senha: 12345678

## INSTRUCOES GERAIS
- Tire screenshot antes e depois de cada acao importante
- Se encontrar erro, anote o texto exato do erro
- Se encontrar comportamento inesperado, descreva
- Preencha os campos com dados ficticios realistas (nao use "teste123")
- Ao final, gere um relatorio completo

---

## PASSO 1 — LOGIN
1. Acesse a URL do app
2. Faca login com as credenciais acima
3. Confirme: voce chegou no Dashboard?
4. O que aparece no Dashboard? KPIs, alertas, graficos?
5. Ha algum erro visivelno console ou na tela?

---

## PASSO 2 — DASHBOARD
1. Leia todos os numeros e KPIs exibidos
2. Ha alertas de vencimento? De que tipo?
3. O Lunara Hero (resumo central da frota) aparece?
4. Tente clicar em cada card/metrica — algo e clicavel?
5. Mude para DashboardV2 se houver opcao — funciona?

---

## PASSO 3 — CADASTRAR VEICULO
1. Va para a pagina de Veiculos
2. Clique em "Adicionar Veiculo" ou similar
3. Preencha com dados ficticios realistas:
   - Tipo: Carro
   - Marca: Honda
   - Modelo: Civic
   - Ano: 2022
   - Placa: ABC1D23
   - Cor: Prata
   - KM: 45000
   - Combustivel: 75%
   - Pneus: Bom
   - Aluguel semanal: R$ 450
   - IPVA vencimento: 2026-12-31
   - Seguro vencimento: 2026-09-15
4. Salve e confirme: o veiculo aparece na lista?
5. Clique no veiculo — os detalhes abrem corretamente?

---

## PASSO 4 — CADASTRAR MOTORISTA (LOCATARIO)
1. Va para a pagina de Locatarios/Motoristas
2. Clique em "Adicionar Motorista" ou similar
3. Preencha com dados ficticios:
   - Nome: Carlos Eduardo Santos
   - CPF: 123.456.789-09
   - Telefone: (11) 99887-6655
   - Email: carlos.motorista@gmail.com
   - CNH: 12345678901
   - Vencimento CNH: 2027-06-30
   - Categoria CNH: B
   - App: Uber
   - Avaliacao: 4.8
   - Aluguel semanal: R$ 450
4. Salve e confirme: o motorista aparece na lista?

---

## PASSO 5 — CRIAR CONTRATO / VINCULAR MOTORISTA AO VEICULO
1. Ainda na pagina de Locatarios, encontre Carlos Eduardo
2. Tente vincular ele ao Honda Civic cadastrado
3. Se houver botao "Criar Contrato" — clique e veja o que acontece
4. O sistema vincula motorista ao veiculo?
5. O status do veiculo muda para "Locado"?

---

## PASSO 6 — FAZER CHECK-IN DO VEICULO
1. Va para Veiculos
2. Selecione o Honda Civic
3. Tente registrar um Check-in (entrega do veiculo)
4. Preencha: KM 45000, Combustivel 75%, tire screenshot
5. O check-in e salvo com sucesso?

---

## PASSO 7 — PAGAMENTOS
1. Va para a pagina de Pagamentos
2. Carlos Eduardo aparece com cobranca pendente?
3. Tente marcar um pagamento como pago
4. Metodo: Pix, valor: R$ 450
5. O status muda para pago?
6. Tente enviar cobranca via Telegram (se houver botao) — o que acontece?

---

## PASSO 8 — MULTAS (MOCK)
1. Va para a pagina de Multas
2. Tente registrar uma multa manualmente:
   - Veiculo: ABC1D23 (Honda Civic)
   - Valor: R$ 130,16
   - Data: hoje
   - Descricao: Excesso de velocidade 15-20km/h
   - Codigo: 55412
3. A multa e salva e aparece na lista?
4. Ha opcao de atribuir a multa ao motorista Carlos Eduardo?
5. Se houver botao para disparar o scanner mock — clique e veja o que acontece

---

## PASSO 9 — MANUTENCAO
1. Va para Manutencao / Frota
2. Cadastre uma despesa:
   - Veiculo: Honda Civic
   - Tipo: Revisao
   - Valor: R$ 280
   - Data: hoje
   - Descricao: Troca de oleo e filtros
3. A despesa aparece na lista?
4. Agende uma manutencao futura — funciona?

---

## PASSO 10 — PORTAL DO MOTORISTA
1. Volte para Locatarios
2. Procure um botao "Portal do Motorista" ou "Link do Portal"
3. Copie o link gerado
4. Abra o link em uma aba anonima
5. O portal carrega sem fazer login?
6. O motorista consegue ver suas informacoes?

---

## PASSO 11 — AUTOMACAO IA (SE DISPONIVEL)
1. Procure a secao de Automacao IA no menu
2. O que aparece? Funciona?
3. Ha indicador de status do bot Telegram?

---

## PASSO 12 — CHECAR CONSOLE DE ERROS
1. Abra o DevTools do Chrome (F12)
2. Va na aba Console
3. Anote TODOS os erros em vermelho que aparecerem
4. Anote warnings importantes em amarelo
5. Ha chamadas de API falhando na aba Network?

---

## RELATORIO FINAL
Ao terminar todos os passos, gere um relatorio no seguinte formato:

### RESUMO EXECUTIVO
- Total de funcionalidades testadas: X
- Funcionando corretamente: X
- Com problemas: X
- Criticos (app quebra): X

### O QUE FUNCIONA BEM
Liste cada funcionalidade que passou no teste

### BUGS ENCONTRADOS
Para cada bug:
- Onde: [pagina/funcionalidade]
- O que acontece: [descricao]
- Mensagem de erro: [texto exato]
- Severidade: Critico / Alto / Medio / Baixo

### ERROS DE CONSOLE
Liste todos os erros do DevTools

### RECOMENDACOES
Top 3 coisas para corrigir primeiro

---

*Teste executado em: [DATA/HORA]*
*Ambiente: [URL do app]*
