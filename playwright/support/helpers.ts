
export function generateOrderCode() {
    const prefix = 'VLO';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
  
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      randomPart += chars[randomIndex];
    }
  
    return `${prefix}-${randomPart}`;
  }
  
  // Exemplo de uso
  const order = generateOrderCode();
  console.log(order); // Ex: VLO-6E2J20


  import { Page } from '@playwright/test'

  export async function searchOrder(page: Page, orderNumber: string) {
    await page.getByRole('textbox', { name: 'Número do Pedido' }).fill(orderNumber)
    await page.getByRole('button', { name: 'Buscar Pedido' }).click()
  }