import { chromium } from 'playwright';

async function runDetailedAudit() {
  console.log('--- INICIANDO AUDITORIA DETALHADA MYFROT ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const results = {
    multa_valor: 'PENDING',
    checkin_campos: 'PENDING',
    multa_campos: 'PENDING',
    motorista_rating: 'PENDING'
  };

  try {
    console.log('Efetuando login...');
    await page.goto('https://myfrot-ai.netlify.app');
    await page.fill('input[type="email"]', 'teste@frotaapp.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // 1 & 3: Validar Multas (Cadastro e Campos)
    console.log('Navegando para Multas...');
    const finesLink = page.locator('a:has-text("Multas"), :text("Multas")').first();
    if (await finesLink.isVisible()) {
      await finesLink.click();
      await page.waitForTimeout(3000);
      
      const addFineBtn = page.locator('button:has-text("Adicionar"), button:has-text("Nova Multa"), [aria-label*="nova multa"]').first();
      if (await addFineBtn.isVisible()) {
        await addFineBtn.click();
        await page.waitForTimeout(2000);

        // Verificação 3: Campos Descrição e Código
        const descField = page.locator('textarea, input[placeholder*="Descrição"], label:has-text("Descrição"), input[name*="description"]').first();
        const codeField = page.locator('input[placeholder*="Código"], label:has-text("Código"), label:has-text("Infração"), input[name*="code"]').first();
        results.multa_campos = (await descField.isVisible() && await codeField.isVisible()) ? 'PASS' : 'FAIL';
        console.log(`- Campos Multa: ${results.multa_campos}`);

        // Verificação 1: Cadastrar R$130,16
        const amountField = page.locator('input[type="number"], input[placeholder*="Valor"], label:has-text("Valor"), input[name*="amount"]').first();
        await amountField.fill('130.16');
        if (await descField.isVisible()) await descField.fill('Auditoria Benny - Teste Valor');
        if (await codeField.isVisible()) await codeField.fill('5001');

        const saveBtn = page.locator('button:has-text("Salvar"), button:has-text("Confirmar"), button[type="submit"]').first();
        await saveBtn.click();
        await page.waitForTimeout(3000);

        // Validar na listagem
        const fineRow = page.locator(':text("130.16"), :text("130,16")').first();
        results.multa_valor = (await fineRow.isVisible()) ? 'PASS' : 'FAIL';
        console.log(`- Valor Multa (130.16): ${results.multa_valor}`);
        await page.screenshot({ path: 'execution/audit_multa.png', fullPage: true });
      }
    }

    // 2: Verificação Check-in (KM e Combustível)
    console.log('Navegando para Operações/Check-in...');
    const opsLink = page.locator('a:has-text("Operações"), a:has-text("Check-in"), :text("Check-in"), :text("Inspeção")').first();
    if (await opsLink.isVisible()) {
      await opsLink.click();
      await page.waitForTimeout(3000);
      
      const kmField = page.locator('label:has-text("KM"), input[placeholder*="quilometragem"], input[name*="km"], input[placeholder*="KM"]').first();
      const fuelField = page.locator('label:has-text("Combustível"), select, [placeholder*="combustível"], label:has-text("Gasolina")').first();
      
      results.checkin_campos = (await kmField.isVisible() && await fuelField.isVisible()) ? 'PASS' : 'FAIL';
      console.log(`- Campos Check-in (KM/Combustível): ${results.checkin_campos}`);
      await page.screenshot({ path: 'execution/audit_checkin.png', fullPage: true });
    }

    // 4: Cadastro Motorista Rating 4.8
    console.log('Navegando para Motoristas...');
    const driversLink = page.locator('a:has-text("Motoristas"), :text("Motoristas"), :text("Condutores")').first();
    if (await driversLink.isVisible()) {
      await driversLink.click();
      await page.waitForTimeout(3000);

      const addDriverBtn = page.locator('button:has-text("Adicionar"), button:has-text("Novo Motorista")').first();
      if (await addDriverBtn.isVisible()) {
          await addDriverBtn.click();
          await page.waitForTimeout(2000);

          await page.fill('input[placeholder*="Nome"], input[name*="name"]', 'Motorista Auditoria');
          const ratingField = page.locator('input[type="number"][step*="0.1"], input[placeholder*="Avaliação"], label:has-text("Avaliação"), input[name*="rating"]').first();
          if (await ratingField.isVisible()) {
            await ratingField.fill('4.8');
            await page.click('button:has-text("Salvar"), button:has-text("Confirmar"), button[type="submit"]');
            await page.waitForTimeout(3000);

            const ratingVal = page.locator(':text("4.8")').first();
            results.motorista_rating = (await ratingVal.isVisible()) ? 'PASS' : 'FAIL';
            console.log(`- Rating Motorista (4.8): ${results.motorista_rating}`);
            await page.screenshot({ path: 'execution/audit_motorista.png', fullPage: true });
          }
      }
    }


  } catch (e) {
    console.error('ERRO NA AUDITORIA:', e);
  } finally {
    console.log('\n--- RESULTADOS FINAIS ---');
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}

runDetailedAudit();
