export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * 除法。除零必须抛错，这是本项目的"红线"之一。
 * 门禁的测试用例会锁住这个行为。
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("division by zero");
  }
  return a / b;
}

/**
 * 取余。除数为零时返回 NaN（与除法不同，这里是刻意设计的分支）。
 */
export function modulo(a: number, b: number): number {
  if (b === 0) {
    return Number.NaN;
  }
  return a % b;
}
