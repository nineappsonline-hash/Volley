import { emptyInput, type InputState } from "./types";

/** Each finger/key owns its input; releasing one cannot cancel another. */
export class GameInputController {
  private sources = new Map<string, Partial<InputState>>();
  set(source: string, input: Partial<InputState>) { this.sources.set(source, input); return this.value(); }
  release(source: string) { this.sources.delete(source); return this.value(); }
  clear() { this.sources.clear(); return emptyInput(); }
  value(): InputState {
    const result = emptyInput();
    for (const input of this.sources.values()) for (const key of Object.keys(result) as (keyof InputState)[]) result[key] ||= input[key] === true;
    return result;
  }
}

export function gameKeyInput(key: string): Partial<InputState> | null {
  switch (key.toLowerCase()) {
    case "a": case "arrowleft": return {left:true};
    case "d": case "arrowright": return {right:true};
    case "w": case "arrowup": case " ": return {jump:true};
    case "j": return {hit:true};
    case "k": return {tip:true,hit:true};
    default: return null;
  }
}
