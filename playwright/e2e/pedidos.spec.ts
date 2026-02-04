import { test, expect } from '@playwright/test'

import { generateOrderCode } from '../support/helpers'

/// AAA - Arrange, Act, Assert

test.describe('Consulta de Pedido', () => {

    test.beforeEach(async ({ page }) => {
        // Arrange
        await page.goto('http://localhost:5173/')
        await expect(page.getByTestId('hero-section').getByRole('heading')).toContainText('Velô Sprint')

        await page.getByRole('link', { name: 'Consultar Pedido' }).click()
        await expect(page.getByRole('heading')).toContainText('Consultar Pedido') // AAA - Arrange
    })


    test('deve consultar um pedido aprovado', async ({ page }) => {

        // Test Data

        // const order = 'VLO-18DYA3'

        const order = {
            number: 'VLO-18DYA3',
            color: 'Lunar White',
            wheels: 'sport Wheels',
            status: 'APROVADO',
            customer: {
                name: 'Leonardo Cunha',
                email: 'leoc.ribeiro222@hotmail.com'
            },
                payment: 'À Vista',
            }
        

        // Act
        await page.getByRole('textbox', { name: 'Número do Pedido' }).fill(order.number)

        await page.getByRole('button', { name: 'Buscar Pedido' }).click()


        // Assert
       
       await expect(page.getByTestId(`order-result-${order.number}`)).toMatchAriaSnapshot(`
         - img
         - paragraph: Pedido
         - paragraph: ${order.number}
         - img
         - text: ${order.status}
         - img "Velô Sprint"
         - paragraph: Modelo
         - paragraph: Velô Sprint
         - paragraph: Cor
         - paragraph: ${order.color}
         - paragraph: Interior
         - paragraph: cream
         - paragraph: Rodas
         - paragraph: ${order.wheels}
         - heading "Dados do Cliente" [level=4]
         - paragraph: Nome
         - paragraph: ${order.customer.name}
         - paragraph: Email
         - paragraph: ${order.customer.email}
         - paragraph: Loja de Retirada
         - paragraph
         - paragraph: Data do Pedido
         - paragraph: /\\d+\\/\\d+\\/\\d+/
         - heading "Pagamento" [level=4]
         - paragraph: ${order.payment}
         - paragraph: /R\\$ \\d+\\.\\d+,\\d+/
         `);
     });

     test('deve consultar um pedido reprovado', async ({ page }) => {

        // Test Data

        // const order = 'VLO-ID6LIY'

        const order = {
            number: 'VLO-ID6LIY',
            color: 'Midnight Black',
            wheels: 'sport Wheels',
            status: 'REPROVADO',
            customer: {
                name: 'Steve Jobs',
                email: 'stevejobs@iphone.com'
            },
                payment: 'À Vista',
            }
        

        // Act
        await page.getByRole('textbox', { name: 'Número do Pedido' }).fill(order.number)

        await page.getByRole('button', { name: 'Buscar Pedido' }).click()


        // Assert
       
       await expect(page.getByTestId(`order-result-${order.number}`)).toMatchAriaSnapshot(`
         - img
         - paragraph: Pedido
         - paragraph: ${order.number}
         - img
         - text: ${order.status}
         - img "Velô Sprint"
         - paragraph: Modelo
         - paragraph: Velô Sprint
         - paragraph: Cor
         - paragraph: ${order.color}
         - paragraph: Interior
         - paragraph: cream
         - paragraph: Rodas
         - paragraph: ${order.wheels}
         - heading "Dados do Cliente" [level=4]
         - paragraph: Nome
         - paragraph: ${order.customer.name}
         - paragraph: Email
         - paragraph: ${order.customer.email}
         - paragraph: Loja de Retirada
         - paragraph
         - paragraph: Data do Pedido
         - paragraph: /\\d+\\/\\d+\\/\\d+/
         - heading "Pagamento" [level=4]
         - paragraph: ${order.payment}
         - paragraph: /R\\$ \\d+\\.\\d+,\\d+/
         `);
     });

    test('deve exibir mensagem quando o pedido não é encontrado', async ({ page }) => {

        const order = generateOrderCode()

        await page.getByRole('textbox', { name: 'Número do Pedido' }).fill(order)
        await page.getByRole('button', { name: 'Buscar Pedido' }).click()

        await expect(page.locator('#root')).toMatchAriaSnapshot(`
            - img
            - heading "Pedido não encontrado" [level=3]
            - paragraph: Verifique o número do pedido e tente novamente
            `)

    })
});

