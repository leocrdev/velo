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
  // Just click finalize to go to order
  await page.getByRole('button', { name: 'Finalizar Pedido' }).click();
  await page.waitForURL('**/order');
  // Fill form
  await page.getByTestId('checkout-name').fill('John');
  await page.getByTestId('checkout-lastname').fill('Doe');
  await page.getByTestId('checkout-email').fill('john.doe@example.com');
  await page.getByTestId('checkout-phone').fill('11999999999');
  await page.getByTestId('checkout-document').fill('00000000000'); // Valid? No.
  // We need a valid CPF. Let's use 12345678909
  await page.getByTestId('checkout-document').fill('12345678909'); // Not valid, need valid CPF... wait, the test uses valid CPFs. Let's just run the playwright test with DEBUG.
  await browser.close();
})();
