// Validação de CPF (dígitos verificadores).
function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }

function cpfValido(valor) {
  const c = soDigitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9)) === Number(c[9]) && dv(c.slice(0, 10)) === Number(c[10]);
}

function mascararCpf(valor) {
  const c = soDigitos(valor);
  if (c.length !== 11) return '';
  return `${c.slice(0, 3)}.***.***-${c.slice(9)}`;
}

module.exports = { soDigitos, cpfValido, mascararCpf };
