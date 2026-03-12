# TICKET-corrigir-deploy: Sincronização MyFrot-ai com GitHub

## Problema
O repositório local/remoto possui o commit `7d3f4e8` ("feat: UX melhorias sidebar...") desde às 07:11 AM, mas o Netlify (`myfrot-ai`) está exibindo uma versão de 01:25 AM. O site está desconectado do Git (Manual Deploy), impedindo atualizações automáticas.
Impacto: Usuário vê versão antiga; desalinhamento técnico entre código e produção.

## Tabelas do Supabase
Nenhuma.

## Lógica de Negócio
1. Entrar em `execution/frontend`.
2. Verificar se o `netlify-cli` está instalado.
3. Executar o build: `npm run build`.
4. Realizar o deploy manual forçado: `netlify deploy --prod --dir=dist`.
5. (Ideal) Se possível via CLI, reconectar o site ao repositório `https://github.com/369n8/Antgravit` para habilitar Continuous Deployment.

## Critério de Aceite
- Build sem erros.
- Deploy realizado no Netlify.
- Versão online refletindo as mudanças do commit `7d3f4e8`.
- Registro do sucesso em `auditorias/log-trabalho.md`.
