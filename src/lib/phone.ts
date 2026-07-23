/** Normalize Philippine mobile numbers to 09XXXXXXXXX. */
export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("63") && local.length === 12) {
    local = `0${local.slice(2)}`;
  }
  if (local.startsWith("9") && local.length === 10) {
    local = `0${local}`;
  }
  if (!/^09\d{9}$/.test(local)) return null;
  return local;
}

/** Semaphore / intl style: 639XXXXXXXXX */
export function toPhIntl(mobile09: string): string {
  return `63${mobile09.slice(1)}`;
}

export function maskPhone(mobile09: string): string {
  return `${mobile09.slice(0, 4)}***${mobile09.slice(-2)}`;
}
