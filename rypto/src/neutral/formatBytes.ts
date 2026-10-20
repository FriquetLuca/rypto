const units = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'R', 'Q'];
export type ByteFormat = 'decimal' | 'binary';

const toBinLog = (x: number) => Math.floor(Math.log2(x) / 10);
const toDecLog = (x: number) => Math.floor(Math.log10(x) / 3);

const toBinary = (x: number) => Math.pow(2, 10 * x);
const toDecimal = (x: number) => Math.pow(10, 3 * x);

const binUnits = ['B', ...units.slice(1).map((u) => `${u.toUpperCase()}iB`)];
const decUnits = units.map((u) => `${u}B`);

export function formatBytes(
  bytes: number,
  format: ByteFormat = 'binary'
): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError('bytes must be a finite, non-negative number');
  }
  const [log, exp, unitList] =
    format === 'binary'
      ? [toBinLog, toBinary, binUnits]
      : [toDecLog, toDecimal, decUnits];
  const base = Math.min(log(bytes), unitList.length - 1);
  if (base === 0) {
    return `${bytes.toFixed(0)} B`;
  }
  const unit = unitList[base];
  const value = bytes / exp(base);
  return `${value.toFixed(2)} ${unit}`;
}
