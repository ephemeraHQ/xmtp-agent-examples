import type { MessageContext, AgentMiddleware } from "@xmtp/agent-sdk";
import {
  ContentTypeActions,
  type Action,
  type ActionsContent,
} from "./types/ActionsContent";
import { type IntentContent } from "./types/IntentContent";

/**
 * Action handler function type
 */
export type ActionHandler = (
  ctx: MessageContext,
  metadata?: Record<string, string | number | boolean | null>,
) => Promise<void>;

/**
 * Action registry to store action handlers
 */
class ActionRegistry {
  private handlers = new Map<string, ActionHandler>();

  register(actionId: string, handler: ActionHandler): void {
    this.handlers.set(actionId, handler);
  }

  get(actionId: string): ActionHandler | undefined {
    return this.handlers.get(actionId);
  }

  has(actionId: string): boolean {
    return this.handlers.has(actionId);
  }

  getAll(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Global action registry instance
 */
const globalActionRegistry = new ActionRegistry();

/**
 * Inline Actions Middleware
 * Automatically handles intent messages and routes them to registered handlers
 */
export const inlineActionsMiddleware: AgentMiddleware = async (ctx, next) => {
  const message = ctx.message;

  // Check if this is an intent message
  if (message.contentType?.typeId === "intent") {
    console.log("🎯 Processing intent message via middleware");
    const intentContent = message.content as IntentContent;
    const handler = globalActionRegistry.get(intentContent.actionId);

    if (handler) {
      console.log(`🎯 Found handler for action: ${intentContent.actionId}`);
      try {
        await handler(ctx, undefined);
      } catch (error) {
        console.error(
          `❌ Error in action handler for ${intentContent.actionId}:`,
          error,
        );
        await ctx.conversation.send(
          `❌ Error processing action: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      console.log(
        `❌ No handler registered for action: ${intentContent.actionId}`,
      );
      await ctx.conversation.send(
        `❌ Unknown action: ${intentContent.actionId}`,
      );
    }

    // Don't continue to other handlers for intent messages
    return;
  }

  // Continue to next middleware for non-intent messages
  await next();
};

/**
 * Register an action handler
 */
export function registerAction(actionId: string, handler: ActionHandler): void {
  globalActionRegistry.register(actionId, handler);
  console.log(`✅ Registered action handler: ${actionId}`);
}

/**
 * Action Builder - Fluent interface for creating actions
 */
export class ActionBuilder {
  private actions: Action[] = [];
  private actionDescription = "";
  private actionId = "";

  static create(id: string, description: string): ActionBuilder {
    const builder = new ActionBuilder();
    builder.actionId = id;
    builder.actionDescription = description;
    return builder;
  }

  add(
    id: string,
    label: string,
    style?: "primary" | "secondary" | "danger",
    imageUrl?: string,
    expiresAt?: string,
  ): this {
    this.actions.push({
      id,
      label,
      style,
      imageUrl,
      expiresAt,
    });
    return this;
  }

  // Keep legacy methods for backward compatibility
  addAction(
    id: string,
    label: string,
    options?: {
      style?: "primary" | "secondary" | "danger";
      imageUrl?: string;
      expiresAt?: string;
    },
  ): this {
    this.actions.push({
      id,
      label,
      ...options,
    });
    return this;
  }

  build(): ActionsContent {
    return {
      id: this.actionId,
      description: this.actionDescription,
      actions: this.actions,
    };
  }
}

/**
 * Quick helper to send actions to a conversation
 */
export async function sendActions(
  ctx: MessageContext,
  actionsContent: ActionsContent,
): Promise<void> {
  await ctx.conversation.send(actionsContent, ContentTypeActions);
}

/**
 * Quick helper to create and send simple yes/no confirmation
 */
export async function sendConfirmation(
  ctx: MessageContext,
  message: string,
  yesActionId: string = "confirm-yes",
  noActionId: string = "confirm-no",
): Promise<void> {
  const actions = ActionBuilder.create(`confirmation-${Date.now()}`, message)
    .add(yesActionId, "✅ Yes")
    .add(noActionId, "❌ No")
    .build();

  await sendActions(ctx, actions);
}

/**
 * Quick helper to create and send a selection menu
 */
export async function sendSelection(
  ctx: MessageContext,
  message: string,
  options: Array<{
    id: string;
    label: string;
    style?: "primary" | "secondary" | "danger";
    imageUrl?: string;
    expiresAt?: string;
  }>,
): Promise<void> {
  const builder = ActionBuilder.create(`selection-${Date.now()}`, message);

  options.forEach((option) => {
    builder.add(
      option.id,
      option.label,
      option.style,
      option.imageUrl,
      option.expiresAt,
    );
  });

  await sendActions(ctx, builder.build());
}

/**
 * Utility to check if all required actions are registered
 */
export function validateRegisteredActions(requiredActions: string[]): {
  valid: boolean;
  missing: string[];
} {
  const missing = requiredActions.filter(
    (actionId) => !globalActionRegistry.has(actionId),
  );
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get list of all registered actions (for debugging)
 */
export function getRegisteredActions(): string[] {
  return globalActionRegistry.getAll();
}
