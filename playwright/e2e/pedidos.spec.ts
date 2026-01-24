import { test, expect } from '@playwright/test'

/// AAA - Arrange, Act, Assert

test('deve consultar um pedido aprovado', async ({ page }) => {
    // Arrange
    await page.goto('http://localhost:5173/')
    await expect(page.getByTestId('hero-section').getByRole('heading')).toContainText('Velô Sprint')
    await page.getByRole('link', { name: 'Consultar Pedido' }).click()
    await expect(page.getByRole('heading')).toContainText('Consultar Pedido') // AAA - Arrange

    // Act
    await page.getByRole('textbox', { name: 'Número do Pedido' }).fill('VLO-18DYA3')
    
    // await page.getByLabel('Número do Pedido').fill('VLO-18DYA3')

    // await page.getByPlaceholder('Ex: VLO-ABC123').fill('VLO-18DYA3')
   
    await page.getByRole('button', { name: 'Buscar Pedido' }).click()


    // Assert
    await expect(page.getByTestId('order-result-VLO-18DYA3')).toContainText('VLO-18DYA3')
    await expect(page.getByText('VLO-18DYA3')).toBeVisible({timeout: 10_000})
    
    await expect(page.getByTestId('order-result-VLO-18DYA3')).toContainText('APROVADO')
    await expect(page.getByText('APROVADO')).toBeVisible()

})