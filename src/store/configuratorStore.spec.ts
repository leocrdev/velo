import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  calculateTotalPrice,
  calculateInstallment,
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
