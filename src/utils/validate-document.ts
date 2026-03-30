export function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');

  if (digits.length !== 14) return false;

  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(base[i], 10) * w, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const firstDigit = calcDigit(digits, firstWeights);
  if (firstDigit !== parseInt(digits[12], 10)) return false;

  const secondDigit = calcDigit(digits, secondWeights);
  if (secondDigit !== parseInt(digits[13], 10)) return false;

  return true;
}

export function validarCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) return false;

  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  const firstDigit = remainder === 10 ? 0 : remainder;
  if (firstDigit !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  const secondDigit = remainder === 10 ? 0 : remainder;
  if (secondDigit !== parseInt(digits[10], 10)) return false;

  return true;
}
