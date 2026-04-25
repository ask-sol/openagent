import type { Tool, ToolResult, ToolContext } from "../types.js";

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  content: string;
  status: TodoStatus;
  activeForm?: string;
}

export interface TodoState {
  items: TodoItem[];
}

const state: TodoState = { items: [] };
const listeners = new Set<(s: TodoState) => void>();

export function subscribeTodos(fn: (s: TodoState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getTodos(): TodoState {
  return state;
}

export function clearTodos(): void {
  state.items = [];
  for (const l of listeners) l(state);
}

function notify() {
  for (const l of listeners) l({ items: state.items });
}

export const todoWriteTool: Tool = {
  name: "TodoWrite",
  description:
    "Maintain a structured task list visible to the user. Use this for any non-trivial multi-step work (3+ steps). Provide the FULL list every call; the previous list is replaced. " +
    "Mark exactly one task in_progress while working on it; mark completed AS SOON AS done — do not batch. " +
    "Never use this for trivial single-step requests, conversational chat, or work already finished.",
  parameters: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "The complete updated todo list",
        items: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Imperative description of the task (e.g. 'Run the tests')",
            },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed"],
              description: "Current status",
            },
            activeForm: {
              type: "string",
              description:
                "Optional present-continuous form shown while in_progress (e.g. 'Running the tests'). Falls back to content.",
            },
          },
          required: ["content", "status"],
        },
      },
    },
    required: ["todos"],
  },

  async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const todos = (input.todos as TodoItem[]) || [];

    const cleaned: TodoItem[] = todos
      .filter((t) => t && typeof t.content === "string" && t.content.trim())
      .map((t) => ({
        content: t.content.trim(),
        status:
          t.status === "in_progress" || t.status === "completed"
            ? t.status
            : "pending",
        activeForm: t.activeForm?.trim() || undefined,
      }));

    state.items = cleaned;
    notify();

    const summary = cleaned.length
      ? `Updated ${cleaned.length} task${cleaned.length === 1 ? "" : "s"}: ` +
        cleaned
          .map(
            (t) =>
              `[${t.status === "completed" ? "x" : t.status === "in_progress" ? "~" : " "}] ${t.content}`,
          )
          .join("; ")
      : "Cleared todo list";

    return { output: summary };
  },
};
