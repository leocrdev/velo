import { Page, Locator, expect } from '@playwright/test'

type OrderStatus = 'APROVADO' | 'REPROVADO' | 'EM_ANALISE'

interface StatusConfig {
    bgClass: RegExp
    textClass: RegExp
    iconClass: RegExp
}

export class OrderLockupPage {
    private readonly page: Page

    // Locators principais
    private readonly orderNumberInput: Locator
    private readonly searchButton: Locator

    // Configuração centralizada de todos os status
    private readonly statusConfig: Record<OrderStatus, StatusConfig> = {
        'APROVADO': {
            bgClass: /bg-green-100/,
            textClass: /text-green-700/,
            iconClass: /lucide-circle-check-big/
        },
        'REPROVADO': {
            bgClass: /bg-red-100/,
            textClass: /text-red-700/,
            iconClass: /lucide lucide-circle-x/
        },
        'EM_ANALISE': {
            bgClass: /bg-amber-100/,
            textClass: /text-amber-700/,
            iconClass: /lucide-clock/
        }
    }

    constructor(page: Page) {
        this.page = page
        this.orderNumberInput = page.getByRole('textbox', { name: 'Número do Pedido' })
        this.searchButton = page.getByRole('button', { name: 'Buscar Pedido' })
    }

    /**
     * Realiza a busca de um pedido pelo número
     */
    async searchOrder(numero: string) {
        await this.orderNumberInput.fill(numero)
        await this.searchButton.click()
    }

    /**
     * Obtém o badge de status filtrado pelo texto do status
     */
    private getStatusBadge(statusText: string): Locator {
        return this.page.getByRole('status').filter({ hasText: statusText })
    }

    /**
     * Valida o badge de status de forma genérica
     * Usa a configuração centralizada para validar cores e ícone
     */
    async validateStatusBadge(status: OrderStatus) {
        const config = this.statusConfig[status]
        const statusBadge = this.getStatusBadge(status)
        const statusIcon = statusBadge.locator('svg')

        await expect(statusBadge).toHaveClass(config.bgClass)
        await expect(statusBadge).toHaveClass(config.textClass)
        await expect(statusIcon).toHaveClass(config.iconClass)
    }

    /**
     * Métodos específicos para cada status (opcional - para legibilidade)
     * Agora são apenas wrappers simples que chamam o método genérico
     */
    async validateApprovedStatusBadge() {
        await this.validateStatusBadge('APROVADO')
    }

    async validateRejectedStatusBadge() {
        await this.validateStatusBadge('REPROVADO')
    }

    async validatePendingStatusBadge() {
        await this.validateStatusBadge('EM_ANALISE')
    }
}