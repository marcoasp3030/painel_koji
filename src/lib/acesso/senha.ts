/** Regras de senha do ENTRADA1. Lista local — a senha não sai do servidor. */

export const SENHA_MIN = 12;
export const SENHA_MAX = 72;

/** Subconjunto das senhas mais comuns (pt/en). Comparação sem acento e minúscula. */
const COMUNS = new Set(
  [
    "123456",
    "123456789",
    "12345678",
    "1234567890",
    "password",
    "password1",
    "password123",
    "qwerty",
    "qwerty123",
    "abc123",
    "111111",
    "123123",
    "senha",
    "senha123",
    "senha1234",
    "senha12345",
    "admin",
    "admin123",
    "administrador",
    "welcome",
    "welcome1",
    "iloveyou",
    "monkey",
    "dragon",
    "master",
    "login",
    "princess",
    "football",
    "baseball",
    "soccer",
    "letmein",
    "starwars",
    "passw0rd",
    "passwort",
    "changeme",
    "trustno1",
    "access",
    "shadow",
    "sunshine",
    "ashley",
    "bailey",
    "pass1234",
    "senha@123",
    "brasil",
    "brasil123",
    "luxtia",
    "luxtia123",
    "empresa",
    "empresa123",
    "1234567",
    "000000",
    "1q2w3e4r",
    "qwertyuiop",
    "asdfgh",
    "zxcvbn",
    "abcdef",
    "abc12345",
    "password!",
    "p@ssw0rd",
    "p@ssword",
    "senha!",
    "root",
    "toor",
    "test",
    "teste",
    "teste123",
    "guest",
    "default",
    "temp",
    "temporaria",
    "temporario",
  ].map((s) => s.toLowerCase()),
);

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function senhaComum(senha: string) {
  const n = normalizar(senha);
  if (COMUNS.has(n)) return true;
  // Sequências óbvias
  if (/^(.)\1{5,}$/.test(n)) return true;
  if (/^(0123456789|9876543210|abcdefghijklmnopqrstuvwxyz)/.test(n) && n.length <= 16)
    return true;
  return false;
}

export type ForcaSenha = {
  nota: 0 | 1 | 2 | 3 | 4;
  rotulo: string;
  avisos: string[];
};

export function forcaSenha(senha: string): ForcaSenha {
  const avisos: string[] = [];
  if (senha.length < SENHA_MIN) avisos.push(`Use pelo menos ${SENHA_MIN} caracteres.`);
  if (senhaComum(senha)) avisos.push("Essa senha é muito comum. Escolha outra.");
  let pontos = 0;
  if (senha.length >= SENHA_MIN) pontos += 1;
  if (senha.length >= 16) pontos += 1;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos += 1;
  if (/\d/.test(senha)) pontos += 1;
  if (/[^A-Za-z0-9]/.test(senha)) pontos += 1;
  if (senhaComum(senha) || senha.length < SENHA_MIN) pontos = Math.min(pontos, 1);
  const nota = Math.min(4, pontos) as ForcaSenha["nota"];
  const rotulo =
    nota <= 1 ? "Fraca" : nota === 2 ? "Razoável" : nota === 3 ? "Boa" : "Forte";
  return { nota, rotulo, avisos };
}

/** Valida no servidor antes de gravar. */
export function validarSenhaNova(senha: string, confirma?: string) {
  if (senha.length < SENHA_MIN) {
    return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  }
  if (senha.length > SENHA_MAX) return "A senha é longa demais.";
  if (senhaComum(senha)) return "Essa senha é muito comum. Escolha outra.";
  if (confirma !== undefined && senha !== confirma) return "As senhas não conferem.";
  return null;
}
