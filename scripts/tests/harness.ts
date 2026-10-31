/** A minimal test harness: register tests, run them in order, report failures. */

type TestFn = () => void | Promise<void>;
const tests: Array<{ name: string; fn: TestFn }> = [];
let currentFailures: string[] = [];

export function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

export function expect(condition: boolean, message: string): void {
  if (!condition) currentFailures.push(message);
}

export function close(actual: number, expected: number, message: string, tolerance = 1e-8): void {
  const ok = Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected));
  expect(ok, `${message}: expected ${expected}, got ${actual}`);
}

export async function run(): Promise<number> {
  let failed = 0;
  const started = Date.now();
  for (const t of tests) {
    currentFailures = [];
    try {
      await t.fn();
    } catch (error) {
      currentFailures.push(`threw: ${(error as Error).stack ?? error}`);
    }
    if (currentFailures.length) {
      failed += 1;
      console.log(`  ✗ ${t.name}`);
      currentFailures.slice(0, 6).forEach((f) => console.log(`      ${f}`));
      if (currentFailures.length > 6) console.log(`      … and ${currentFailures.length - 6} more`);
    } else {
      console.log(`  ✓ ${t.name}`);
    }
  }
  console.log(`\n${tests.length - failed} of ${tests.length} tests passed in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  return failed;
}
