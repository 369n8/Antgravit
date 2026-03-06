# Diretiva Técnica: Rebrand de UI - Dashboard de Veículos (FrotaApp)

> Este é um SOP (Procedimento Operacional Padrão) técnico e de design para guiar a reconstrução visual e de integração do Dashboard de Veículos do FrotaApp.

## 1. Regras de Design e UI (Aparência Inegociável)

O design deve transmitir leveza, modernidade e organização, inspirado em interfaces de aplicativos de saúde orientados a dados.

*   **Identidade Visual e Cores:**
    *   **Fundo Principal (Background):** Creme claro (`#F5F5F0`).
    *   **Fundo dos Cards/Containers:** Branco puro (`#FFFFFF`).
*   **Layout (Bento Grid):**
    *   O dashboard deve ser construído estritamente utilizando a arquitetura visual "Bento Grid" (cards assimétricos que se encaixam em uma grade responsiva).
*   **Estilização de Elementos (Bordas e Sombras):**
    *   **Bordas (Border Radius):** Todos os cards do Bento Grid devem ter arredondamento de `24px` (`rounded-[24px]` no Tailwind).
    *   **Sombras (Dropshadow):** Utilizar sombras muito suaves e difusas para destacar os cards do fundo creme sem pesar a interface (ex: `box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)`).

## 2. Regras de Integração (Supabase)

O frontend deve se integrar obrigatoriamente e exclusivamente ao Supabase do projeto, substituindo qualquer dado estático.

*   **Credenciais do Projeto:**
    *   **Project ID:** `bmwvigbtrypgkcbxlxi`
*   **Armazenamento de Imagens (Storage):**
    *   As fotos/capas dos veículos devem ser requisitadas diretamente do bucket público chamado `vehicles` no Supabase Storage.
*   **Dados Táticos (Database):**
    *   As métricas exibidas nos cards do Bento Grid (ex: KM, lucro, rentabilidade, alertas) devem ser consultadas ativamente da tabela `vehicle_stats`.

## 3. Comportamento Específico de Componentes

*   **Botão "Conectar Telegram" (Sidebar):**
    *   O menu lateral (Sidebar) deve incluir um botão de call-to-action primário "Conectar Telegram".
    *   Ao ser ativado, o botão deve abrir um Modal minimalista sobreposto à tela.

*   **Modal de Conexão do Telegram:**
    *   **Design:** O modal deve seguir rigidamente a linguagem Bento Grid. Fundo branco (`#FFFFFF`), cantos arredondados de `24px` e sombra difusa para gerar profundidade sem poluição visual. Sem excesso de bordas demarcadas.
    *   **Funcionamento:** O modal conterá um campo de input simples para o usuário inserir seu `@username` do Telegram.
    *   **Integração:** Ao salvar, o frontend fará uma chamada ao Supabase (`@supabase/supabase-js`) para realizar um *upsert* ou *update* salvando o `@username` do Telegram fornecido na tabela de registro de perfis ou usuários (ex: `profiles` ou tabela vinculada ao usuário autenticado).

## Resumo da Execução Esperada

Quando for instruído a implementar esta Diretiva, o agente (ou dev) deverá:
1. Reestruturar a view atual do dashboard em `execution/frontend/` para o layout Bento Grid.
2. Aplicar os tokens de cor (`#F5F5F0` e `#FFFFFF`), bordas (`24px`) e sombras.
3. Configurar a chamada ao `@supabase/supabase-js` para buscar URLs de imagem do bucket `vehicles` e dados da tabela `vehicle_stats`.
4. Renderizar o botão "Conectar Telegram" na Sidebar e implementar a lógica de UI do Modal Bento Grid.
5. Configurar o evento de salvamento do Modal para escrever o `@username` do Telegram na tabela de usuários/perfis no Supabase.
6. Nenhum código de roteamento de hooks de backend em `execution/backend/` deverá ser acoplado à interface frontend neste momento.
