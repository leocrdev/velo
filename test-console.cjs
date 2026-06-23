const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('BAD RESPONSE:', response.url(), response.status());
    }
  });
  await page.goto('https://velo-woad.vercel.app/configure');
  await page.getByRole('button', { name: 'Finalizar Pedido' }).click();
  await page.waitForURL('**/order');
  await page.getByTestId('checkout-name').fill('John');
  await page.getByTestId('checkout-lastname').fill('Doe');
  await page.getByTestId('checkout-email').fill('john.doe@example.com');
  await page.getByTestId('checkout-phone').fill('11999999999');
  await page.getByTestId('checkout-document').fill('12345678909'); // CPFs in test are mocked or ignored? Wait, the CPF validation happens. Let's use '60555620023' which is a valid CPF.
  await page.getByTestId('checkout-document').fill('60555620023');
  await page.getByTestId('checkout-store').click();
  await page.getByRole('option', { name: 'Velô Paulista - Av. Paulista, 1000' }).click();
  await page.getByTestId('checkout-terms').check();
  await page.getByRole('button', { name: 'Confirmar Pedido' }).click();
  
  await page.waitForTimeout(5000);
  await browser.close();
})();
