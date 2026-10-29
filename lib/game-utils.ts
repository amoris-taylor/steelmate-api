import type { PlayerAction } from "@steelmate/engine";

export function actionsEqual(a: PlayerAction, b: PlayerAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function randomInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
