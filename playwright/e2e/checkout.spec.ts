import { test, expect } from '../support/fixtures'

import { deleteOrderByEmail, deleteOrderByNumber } from '../support/database/orderRepository'

test.describe('Checkout', () => {



  test.describe('Validações de campos obrigatórios', () => {

    let alerts: any

    test.beforeEach(async ({ page, app }) => {
      await page.goto('/order')
      await expect(page.getByRole('heading', { name: 'Finalizar Pedido' })).toBeVisible()

      alerts = app.checkout.elements.alerts
    })


    test('deve validar obrigatoriedade de todos os campos em branco', async ({ app }) => {
      // Act
      await app.checkout.submit()

      // Assert
      await expect(alerts.name).toHaveText('Nome deve ter pelo menos 2 caracteres')
      await expect(alerts.lastname).toHaveText('Sobrenome deve ter pelo menos 2 caracteres')
      await expect(alerts.email).toHaveText('Email inválido')
      await expect(alerts.phone).toHaveText('Telefone inválido')
      await expect(alerts.document).toHaveText('CPF inválido')
      await expect(alerts.store).toHaveText('Selecione uma loja')
      await expect(alerts.terms).toHaveText('Aceite os termos')
    })

    test('deve validar limite mínimo de caracteres para Nome e Sobrenome', async ({ app }) => {

      const customer = {
        name: 'A',
        lastname: 'B',
        email: 'leo@teste.com',
        document: '00000014141',
        phone: '(11) 99999-9999'
      }

      // Arrange
      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore('Velô Paulista')
      await app.checkout.acceptTerms()

      // Act
      await app.checkout.submit()

      // Assert
      await expect(alerts.name).toHaveText('Nome deve ter pelo menos 2 caracteres')
      await expect(alerts.lastname).toHaveText('Sobrenome deve ter pelo menos 2 caracteres')
    })

    test('deve exibir erro para e-mail com formato inválido', async ({ app }) => {
      const customer = {
        name: 'Leo',
        lastname: 'Ribeiro',
        email: 'leoteste@.com',
        document: '00000014141',
        phone: '(11) 99999-9999'
      }

      // Arrange
      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore('Velô Paulista')
      await app.checkout.acceptTerms()

      // Act
      await app.checkout.submit()

      // Assert
      await expect(alerts.email).toHaveText('Email inválido')
    })

    test('deve exibir erro para CPF inválido', async ({ app }) => {

      const customer = {
        name: 'Leo',
        lastname: 'Ribeiro',
        email: 'leo@test.com',
        document: '00000014199',
        phone: '(11) 99999-9999'
      }

      // Arrange
      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore('Velô Paulista')
      await app.checkout.acceptTerms()

      // Act
      await app.checkout.submit()

      // Assert
      await expect(alerts.document).toHaveText('CPF inválido')
    })

    test('deve exigir o aceite dos termos ao finalizar com dados válidos', async ({ app }) => {

      const customer = {
        name: 'Leo',
        lastname: 'Ribeiro',
        email: 'leo@test.com',
        document: '00000014199',
        phone: '(11) 99999-9999'
      }

      // Arrange
      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore('Velô Paulista')

      await expect(app.checkout.elements.terms).not.toBeChecked()

      // Act
      await app.checkout.submit()

      // Assert
      await expect(alerts.terms).toHaveText('Aceite os termos')
    })
  })

  test.describe('Pagamento e Confirmação', () => {

    test('deve criar um pedido com sucesso para pagamento a vista', async ({ page, app }) => {

      const customer = {
        name: 'Leo',
        lastname: 'Ribeiro',
        email: 'leo@teste.com',
        document: '05366127068',
        phone: '(11) 99999-9999',
        store: 'Velô Paulista',
        paymentMethod: 'À Vista',
        totalPrice: 'R$ 40.000,00'
      }

      await deleteOrderByEmail(customer.email)

      // Arrange
      await page.goto('/')
      await page.getByRole('link', { name: /Configure Agora/i }).click()

      await app.configurator.selectColor('Glacier Blue')
      await app.configurator.selectWheels(/aero/i)

      await app.configurator.expectPrice(customer.totalPrice)
      await app.configurator.finishConfigurator()
      await app.checkout.expectLoaded()

      // Act
      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore(customer.store)
      await app.checkout.selectPaymentMethod(customer.paymentMethod)
      await app.checkout.expectSummaryTotal(customer.totalPrice)
      await app.checkout.acceptTerms()
      await app.checkout.submit()

      // Assert
      await expect(page).toHaveURL(/\/success/, { timeout: 10000 })
      await expect(page.getByRole('heading', { name: 'Pedido Aprovado!' })).toBeVisible({ timeout: 10000 })

      const orderId = await page.getByTestId('order-id').textContent()
      if (orderId) {
        await deleteOrderByNumber(orderId)
      }
    })

    test('deve criar um pedido em análise para financiamento com score médio', async ({ page, app }) => {
      const customer = {
        name: 'Ana',
        lastname: 'Silva',
        email: 'ana.silva@teste.com',
        document: '74428274033',
        phone: '(11) 99999-9999',
        store: 'Velô Paulista',
        paymentMethod: 'Financiamento',
        totalPrice: 'R$ 40.800,00'
      }

      await deleteOrderByEmail(customer.email)

      // Mock credit analysis to return score in [501, 700] range
      await page.route('**/functions/v1/credit-analysis', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ score: 600 })
        })
      })

      // Arrange
      await page.goto('/')
      await page.getByRole('link', { name: /Configure Agora/i }).click()

      await app.configurator.selectColor('Glacier Blue')
      await app.configurator.selectWheels(/aero/i)
      await app.configurator.finishConfigurator()
      await app.checkout.expectLoaded()

      // Act
      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore(customer.store)
      await app.checkout.selectPaymentMethod(customer.paymentMethod)
      await page.getByTestId('input-entry-value').fill('0')
      await app.checkout.expectSummaryTotal(customer.totalPrice)
      await app.checkout.acceptTerms()
      await app.checkout.submit()

      // Assert
      await expect(page).toHaveURL(/\/success/, { timeout: 10000 })
      await expect(page.getByRole('heading', { name: 'Pedido em Análise!' })).toBeVisible({ timeout: 10000 })

      const orderId = await page.getByTestId('order-id').textContent()
      expect(orderId).not.toBeNull()

      // Go to lookup page to verify status "EM_ANALISE"
      await page.getByTestId('goto-consultar').click()
      await expect(page).toHaveURL(/\/lookup/, { timeout: 10000 })

      if (orderId) {
        await app.orderLookup.searchOrder(orderId)
        await app.orderLookup.validateOrderDetails({
          number: orderId,
          status: 'EM_ANALISE',
          color: 'Glacier Blue',
          wheels: 'aero Wheels',
          customer: {
            name: `${customer.name} ${customer.lastname}`,
            email: customer.email,
            document: customer.document,
            phone: customer.phone
          },
          payment: 'Financiamento 12x',
          total_price: '40800'
        })
        await app.orderLookup.validateStatusBadge('EM_ANALISE')

        // Cleanup
        await deleteOrderByNumber(orderId)
      }
    })
    test('deve reprovar financiamento com score baixo sem entrada', async ({ page, app }) => {

      const customer = {
        name: 'Leo',
        lastname: 'Ribeiro',
        email: 'leo-score-baixo-sem-entrada@teste.com',
        document: '43804598021',
        phone: '(11) 99999-9999',
        store: 'Velô Paulista',
        paymentMethod: 'Financiamento',
        totalPrice: 'R$ 40.800,00'
      }

      await deleteOrderByEmail(customer.email)

      // Mock credit analysis to return score <= 500
      await page.route('**/functions/v1/credit-analysis', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ score: 500 })
        })
      })

      // Arrange
      await page.goto('/')
      await page.getByRole('link', { name: /Configure Agora/i }).click()

      await app.configurator.selectColor('Glacier Blue')
      await app.configurator.selectWheels(/aero/i)

      await app.configurator.finishConfigurator()
      await app.checkout.expectLoaded()

      // Act
      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore(customer.store)
      await app.checkout.selectPaymentMethod(customer.paymentMethod)

      // Sem entrada
      await page.getByTestId('input-entry-value').fill('0')

      await app.checkout.expectSummaryTotal(customer.totalPrice)
      await app.checkout.acceptTerms()
      await app.checkout.submit()

      // Assert
      await expect(page).toHaveURL(/\/success/, { timeout: 10000 })

      await expect(
        page.getByRole('heading', { name: 'Crédito Reprovado' })
      ).toBeVisible({ timeout: 10000 })

      const orderId = await page.getByTestId('order-id').textContent()

      expect(orderId).not.toBeNull()

      if (orderId) {
        await deleteOrderByNumber(orderId)
      }
    })
    test('deve reprovar financiamento com score baixo e entrada menor que 50%', async ({ page, app }) => {

      const customer = {
        name: 'Leo',
        lastname: 'Ribeiro',
        email: 'leo-score-baixo-entrada@teste.com',
        document: '43804598021',
        phone: '(11) 99999-9999',
        store: 'Velô Paulista',
        paymentMethod: 'Financiamento',
        totalPrice: 'R$ 40.800,00',
        downPayment: '10000'
      }

      await deleteOrderByEmail(customer.email)

      // Mock credit analysis to return score <= 500
      await page.route('**/functions/v1/credit-analysis', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ score: 500 })
        })
      })

      // Arrange
      await page.goto('/')
      await page.getByRole('link', { name: /Configure Agora/i }).click()

      await app.configurator.selectColor('Glacier Blue')
      await app.configurator.selectWheels(/aero/i)

      await app.configurator.finishConfigurator()
      await app.checkout.expectLoaded()

      // Act
      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore(customer.store)
      await app.checkout.selectPaymentMethod(customer.paymentMethod)

      // Entrada parcial (< 50%)
      await app.checkout.fillDownPayment(customer.downPayment)
      await app.checkout.acceptTerms()
      await app.checkout.submit()

      // Assert
      await expect(page).toHaveURL(/\/success/, { timeout: 10000 })

      await expect(
        page.getByRole('heading', { name: 'Crédito Reprovado' })
      ).toBeVisible({ timeout: 10000 })

      const orderId = await page.getByTestId('order-id').textContent()

      expect(orderId).not.toBeNull()

      if (orderId) {
        await deleteOrderByNumber(orderId)
      }
    })
  })
})
