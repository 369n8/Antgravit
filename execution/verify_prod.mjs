import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Acessando https://myfrot-ai.netlify.app');
    await page.goto('https://myfrot-ai.netlify.app');
    
    // Login
    await page.fill('input[type="email"]', 'teste@frotaapp.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(5000); // Esperar carregamento do dashboard
    
    // Screenshot do Dashboard (Gráfico e Sidebar)
    await page.screenshot({ path: '/Users/goat/Desktop/_CENTRAL/MyFrot/execution/prod_dashboard.png', fullPage: false });
    console.log('Screenshot do Dashboard salvo.');

    // Verificar Sidebar
    const sidebarText = await page.textContent('aside.sidebar');
    console.log('Sidebar Text Check:', {
      minhaFrota: sidebarText.includes('Minha Frota'),
      manutencao: sidebarText.includes('Manutenção'),
      multasCNH: sidebarText.includes('Multas & CNH'),
      motoristas: sidebarText.includes('Motoristas'),
      motorIA: sidebarText.includes('Motor IA')
    });

    // Navegar para Multas
    const finesBtn = await page.waitForSelector('button:has-text("Multas & CNH")');
    await finesBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/Users/goat/Desktop/_CENTRAL/MyFrot/execution/prod_fines.png' });
    
    const hasAiButton = await page.isVisible('button:has-text("Analisar com IA")');
    console.log('Botão Analisar com IA presente:', hasAiButton);

    // Navegar para Motoristas
    const tenantsBtn = await page.waitForSelector('button:has-text("Motoristas")');
    await tenantsBtn.click();
    await page.waitForTimeout(3000);
    
    // Abrir modal de detalhe/edit
    const firstTenant = await page.waitForSelector('div[style*="cursor: pointer"]');
    await firstTenant.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/Users/goat/Desktop/_CENTRAL/MyFrot/execution/prod_tenant_detail.png' });
    
    const hasContractButton = await page.isVisible('button:has-text("GERAR CONTRATO PDF")');
    console.log('Botão Gerar Contrato presente:', hasContractButton);

  } catch (err) {
    console.error('Erro na auditoria de produção:', err);
    await page.screenshot({ path: '/Users/goat/Desktop/_CENTRAL/MyFrot/execution/prod_error.png' });
  } finally {
    await browser.close();
  }
})();
