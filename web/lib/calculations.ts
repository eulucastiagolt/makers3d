export interface CalculationInputs {
  precoRoloFilamento: number;
  pesoRoloFilamento: number;
  pesoPeca: number;
  tempoImpressao: number;
  potenciaImpressora: number;
  tarifaEnergia: number;
  precoImpressora: number;
  vidaUtilHoras: number;
  percentualManutencao: number;
  taxaFalhaPercentual: number;
  valorHoraTrabalho: number;
  tempoPreparacao: number;
  tempoPosProcessamento: number;
  margemLucro: number;
}

export interface CalculationResult {
  custoFilamento: number;
  custoEnergia: number;
  custoDepreciacao: number;
  custoManutencao: number;
  custoMaoDeObra: number;
  subtotal: number;
  custoTaxaFalha: number;
  custoTotal: number;
  precoVenda: number;
  lucroEstimado: number;
  custoPorGrama: number;
  custoHoraMaquina: number;
}

export function calcularPreco(inputs: CalculationInputs): CalculationResult {
  const p = inputs ?? ({} as CalculationInputs);

  const custoPorGrama = (p.pesoRoloFilamento ?? 1) > 0
    ? (p.precoRoloFilamento ?? 0) / (p.pesoRoloFilamento ?? 1)
    : 0;
  const custoFilamento = custoPorGrama * (p.pesoPeca ?? 0);

  const consumoKwh = ((p.potenciaImpressora ?? 0) / 1000) * (p.tempoImpressao ?? 0);
  const custoEnergia = consumoKwh * (p.tarifaEnergia ?? 0);

  const custoHoraMaquina = (p.vidaUtilHoras ?? 1) > 0
    ? (p.precoImpressora ?? 0) / (p.vidaUtilHoras ?? 1)
    : 0;
  const custoDepreciacao = custoHoraMaquina * (p.tempoImpressao ?? 0);

  const custoManutencao = custoDepreciacao * ((p.percentualManutencao ?? 0) / 100);

  const tempoTotalTrabalhoHoras = ((p.tempoPreparacao ?? 0) + (p.tempoPosProcessamento ?? 0)) / 60;
  const custoMaoDeObra = tempoTotalTrabalhoHoras * (p.valorHoraTrabalho ?? 0);

  const subtotal = custoFilamento + custoEnergia + custoDepreciacao + custoManutencao + custoMaoDeObra;
  const custoTaxaFalha = subtotal * ((p.taxaFalhaPercentual ?? 0) / 100);
  const custoTotal = subtotal + custoTaxaFalha;

  const precoVenda = custoTotal * (1 + (p.margemLucro ?? 0) / 100);
  const lucroEstimado = precoVenda - custoTotal;

  return {
    custoFilamento: round(custoFilamento),
    custoEnergia: round(custoEnergia),
    custoDepreciacao: round(custoDepreciacao),
    custoManutencao: round(custoManutencao),
    custoMaoDeObra: round(custoMaoDeObra),
    subtotal: round(subtotal),
    custoTaxaFalha: round(custoTaxaFalha),
    custoTotal: round(custoTotal),
    precoVenda: round(precoVenda),
    lucroEstimado: round(lucroEstimado),
    custoPorGrama: round(custoPorGrama),
    custoHoraMaquina: round(custoHoraMaquina),
  };
}

function round(v: number): number {
  return Math.round((v ?? 0) * 100) / 100;
}

export const defaultInputs: CalculationInputs = {
  precoRoloFilamento: 100,
  pesoRoloFilamento: 1000,
  pesoPeca: 20,
  tempoImpressao: 2,
  potenciaImpressora: 300,
  tarifaEnergia: 1.0,
  precoImpressora: 1500,
  vidaUtilHoras: 4000,
  percentualManutencao: 10,
  taxaFalhaPercentual: 10,
  valorHoraTrabalho: 20,
  tempoPreparacao: 15,
  tempoPosProcessamento: 15,
  margemLucro: 80,
};
