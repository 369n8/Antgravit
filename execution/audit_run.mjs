import { chromium } from 'playwright';

async function runTest() {
  console.log('--- INICIANDO AUDITORIA MYFROT ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    console.log('1. Acessando https://myfrot-ai.netlify.app...');
    await page.goto('https://myfrot-ai.netlify.app', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'execution/login.png' });
    console.log('✔ Screenshot do Login salvo em execution/login.png');

    console.log('2. Realizando Login...');
    // Tenta encontrar campos de email e senha de forma resiliente
    const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="email"]' ).first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], [placeholder*="senha"]' ).first();
    const loginButton = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")').first();

    await emailInput.fill('teste@frotaapp.com');
    await passwordInput.fill('12345678');
    await loginButton.click();

    console.log('Aguardando Dashboard...');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => console.log('Aviso: Timeout na navegação, verificando conteúdo...'));
    await page.waitForTimeout(5000); // Garante renderização dos charts/dados
    
    await page.screenshot({ path: 'execution/dashboard.png', fullPage: true });
    console.log('✔ Screenshot do Dashboard salvo em execution/dashboard.png');

    console.log('3. Navegando para Veículos...');
    const vehiclesMenu = page.locator('a:has-text("Veículos"), a:has-text("Frota"), nav >> text=Veículos').first();
    if (await vehiclesMenu.isVisible()) {
        await vehiclesMenu.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'execution/veiculos.png', fullPage: true });
        console.log('✔ Screenshot de Veículos salvo em execution/veiculos.png');
    } else {
        console.log('✘ Menu de Veículos não encontrado ou visível.');
    }

    console.log('4. Navegando para Portal do Motorista...');
    // Tenta voltar ao dashboard ou encontrar link direto
    const driverPortal = page.locator('a:has-text("Motorista"), a:has-text("Portal"), :text("Meus Veículos")').first();
    if (await driverPortal.isVisible()) {
        await driverPortal.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'execution/motorista.png', fullPage: true });
        console.log('✔ Screenshot do Portal do Motorista salvo em execution/motorista.png');
    } else {
        console.log('✘ Menu do Motorista não encontrado.');
    }

  } catch (error) {
    console.error('CRITICAL ERROR DURANTE AUDITORIA:', error);
    await page.screenshot({ path: 'execution/error_audit.png' });
  } finally {
    await browser.close();
    console.log('--- AUDITORIA FINALIZADA ---');
  }
}

runTest();
