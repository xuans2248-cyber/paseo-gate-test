import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { add, divide, modulo, subtract } from "../src/calc.ts";

describe("add", () => {
  it("正数相加", () => {
    assert.equal(add(1, 2), 3);
  });
  it("含负数", () => {
    assert.equal(add(-1, 1), 0);
  });
  it("浮点相加有精度误差是已知行为", () => {
    assert.ok(Math.abs(add(0.1, 0.2) - 0.3) < 1e-10);
  });
});

describe("subtract", () => {
  it("正常相减", () => {
    assert.equal(subtract(5, 3), 2);
  });
});

describe("divide", () => {
  it("正常除法", () => {
    assert.equal(divide(10, 2), 5);
  });

  // 红线：除零必须抛错。改动这里会让门禁变红。
  it("除零必须抛错", () => {
    assert.throws(() => divide(1, 0), /division by zero/);
  });
});

describe("modulo", () => {
  it("正常取余", () => {
    assert.equal(modulo(10, 3), 1);
  });
  it("除数为零返回 NaN", () => {
    assert.ok(Number.isNaN(modulo(10, 0)));
  });
});
