import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatPrice,
  calculateTotalPrice,
  calculateInstallment,
  useConfiguratorStore,
  Order
} from './configuratorStore';

describe('Configurator Store - Funções Puras', () => {
  it('Deve formatar corretamente o preço para BRL', () => {
    // Usamos expressão regular pois a formatação de espaço pode variar entre versões do Intl
    expect(formatPrice(40000)).toMatch(/R\$\s*40\.000,00/);
  });

  it('Deve calcular o preço total base (sem opcionais)', () => {
    const total = calculateTotalPrice({
      exteriorColor: 'glacier-blue',
      interiorColor: 'carbon-black',
      wheelType: 'aero',
      optionals: []
    });
    expect(total).toBe(40000); // Apenas preço base
  });

  it('Deve somar corretamente o valor das rodas sport e opcionais', () => {
    const total = calculateTotalPrice({
      exteriorColor: 'glacier-blue',
      interiorColor: 'carbon-black',
      wheelType: 'sport',
      optionals: ['precision-park', 'flux-capacitor']
    });
    // Base (40000) + Sport (2000) + Precision (5500) + Flux (5000) = 52500
    expect(total).toBe(52500);
  });

  it('Deve calcular corretamente o valor da parcela (12x, 2% juros)', () => {
    const installment = calculateInstallment(40000);
    // Base 40000 = ~3782.38
    expect(installment).toBe(3782.38);
  });

  it('Deve calcular corretamente a parcela com opcionais inclusos', () => {
    const installment = calculateInstallment(52500);
    // Base 52500 = ~4964.39
    expect(installment).toBe(4964.38);
  });
});

describe('Configurator Store - Estado Global (Zustand)', () => {
  beforeEach(() => {
    const store = useConfiguratorStore.getState();
    store.resetConfiguration();
    useConfiguratorStore.setState({
      orders: [],
      currentUserEmail: null,
      viewMode: 'exterior'
    });
  });

  describe('Gerenciamento de Opcionais e Configuração', () => {
    it('Deve alternar opcionais corretamente (adicionar e remover)', () => {
      const store = useConfiguratorStore.getState();
      
      // Inicialmente não tem opcionais
      expect(store.configuration.optionals).toEqual([]);

      // Adiciona o opcional
      store.toggleOptional('precision-park');
      expect(useConfiguratorStore.getState().configuration.optionals).toEqual(['precision-park']);

      // Remove o opcional
      store.toggleOptional('precision-park');
      expect(useConfiguratorStore.getState().configuration.optionals).toEqual([]);
    });

    it('Deve restaurar configurações padrões ao chamar resetConfiguration', () => {
      const store = useConfiguratorStore.getState();

      // Altera o estado padrão
      store.setExteriorColor('midnight-black');
      store.setWheelType('sport');
      store.toggleOptional('flux-capacitor');

      // Verifica as mudanças
      let current = useConfiguratorStore.getState().configuration;
      expect(current.exteriorColor).toBe('midnight-black');
      expect(current.wheelType).toBe('sport');
      expect(current.optionals).toEqual(['flux-capacitor']);

      // Executa o reset
      store.resetConfiguration();

      // Valida o retorno aos valores padrão
      current = useConfiguratorStore.getState().configuration;
      expect(current.exteriorColor).toBe('glacier-blue');
      expect(current.wheelType).toBe('aero');
      expect(current.optionals).toEqual([]);
    });
  });

  describe('Fluxo de Login e Histórico de Pedidos', () => {
    const mockOrder: Order = {
      id: 'VLO-123456',
      totalPrice: 40000,
      paymentMethod: 'avista',
      status: 'APROVADO',
      createdAt: new Date().toISOString(),
      configuration: {
        exteriorColor: 'glacier-blue',
        interiorColor: 'carbon-black',
        wheelType: 'aero',
        optionals: []
      },
      customer: {
        name: 'Ana',
        surname: 'Silva',
        email: 'ana@teste.com',
        phone: '11999999999',
        cpf: '12345678901',
        store: 'Matriz'
      }
    };

    it('Deve falhar no login se o e-mail não tiver pedidos anteriores', () => {
      const store = useConfiguratorStore.getState();
      const loginSuccess = store.login('outro@teste.com');
      
      expect(loginSuccess).toBe(false);
      expect(useConfiguratorStore.getState().currentUserEmail).toBeNull();
    });

    it('Deve logar com sucesso se o e-mail tiver pedidos anteriores', () => {
      const store = useConfiguratorStore.getState();
      
      // Adiciona pedido mockado
      store.addOrder(mockOrder);

      // Tenta logar
      const loginSuccess = store.login('ana@teste.com');
      
      expect(loginSuccess).toBe(true);
      expect(useConfiguratorStore.getState().currentUserEmail).toBe('ana@teste.com');
    });

    it('Deve retornar apenas os pedidos do usuário logado', () => {
      const store = useConfiguratorStore.getState();

      // Pedido de outro usuário
      const otherOrder: Order = {
        ...mockOrder,
        id: 'VLO-654321',
        customer: { ...mockOrder.customer, email: 'joao@teste.com' }
      };

      store.addOrder(mockOrder);
      store.addOrder(otherOrder);

      // Sem usuário logado, retorna vazio
      expect(store.getUserOrders()).toEqual([]);

      // Loga como Ana
      store.login('ana@teste.com');
      const anaOrders = store.getUserOrders();
      expect(anaOrders.length).toBe(1);
      expect(anaOrders[0].customer.email).toBe('ana@teste.com');

      // Logout limpa a sessão
      store.logout();
      expect(useConfiguratorStore.getState().currentUserEmail).toBeNull();
      expect(store.getUserOrders()).toEqual([]);
    });
  });
});
