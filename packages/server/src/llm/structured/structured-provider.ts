/**
 * Structured LLM Provider
 *
 * Extends LLM provider with guaranteed structured output
 * Supports multiple providers (OpenAI, Anthropic, etc.)
 *
 * @module llm/structured
 */

import type { z } from 'zod';
import { createLogger } from '../../core/logging';

const logger = createLogger('structured-llm');

// ============================================================================
// Type Definitions
// ============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; [key: string]: any }>;
  tool_call_id?: string;
  name?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StructuredChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeout?: number;
  retries?: number;
}

export interface StructuredLLMProvider {
  /**
   * Chat with guaranteed structured output
   */
  chatStructured<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    systemPrompt?: string,
    options?: StructuredChatOptions
  ): Promise<{
    data: T;
    usage: TokenUsage;
    model: string;
  }>;

  /**
   * Get provider name
   */
  getProviderName(): string;

  /**
   * Get current model
   */
  getModel(): string;
}

// ============================================================================
// OpenAI Structured Provider
// ============================================================================

export class OpenAIStructuredProvider implements StructuredLLMProvider {
  private client: any;
  private model: string;
  private fallbackModel?: string;

  constructor(
    apiKey: string,
    model: string = 'gpt-4o-2024-08-06',
    fallbackModel?: string
  ) {
    try {
      const OpenAI = require('openai');
      this.client = new OpenAI({ apiKey });
      this.model = model;
      this.fallbackModel = fallbackModel;
      logger.info({ model, fallbackModel }, 'OpenAI Structured Provider initialized');
    } catch (error) {
      throw new Error('OpenAI package not installed. Run: npm install openai');
    }
  }

  getProviderName(): string {
    return 'openai';
  }

  getModel(): string {
    return this.model;
  }

  async chatStructured<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    systemPrompt?: string,
    options: StructuredChatOptions = {}
  ): Promise<{ data: T; usage: TokenUsage; model: string }> {
    // Convert Zod schema to JSON Schema
    const jsonSchema = this.zodToJsonSchema(schema);

    const formattedMessages = [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      ...messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }))
    ];

    let retries = options.retries || 3;
    let lastError: Error | undefined;
    let currentModel = this.model;

    while (retries > 0) {
      try {
        logger.info({ model: currentModel, retries }, 'Attempting structured chat');

        const response = await this.client.chat.completions.create({
          model: currentModel,
          messages: formattedMessages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'agent_response',
              strict: true,
              schema: jsonSchema
            }
          },
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4096,
          top_p: options.topP || 1,
          timeout: options.timeout || 90000
        });

        const content = response.choices[0].message.content || '{}';
        const parsed = JSON.parse(content);

        // Validate against schema
        const validated = schema.safeParse(parsed);
        if (!validated.success) {
          logger.error({ errors: validated.error.errors }, 'Schema validation failed');
          throw new Error(`Schema validation failed: ${validated.error.errors.map(e => e.message).join(', ')}`);
        }

        return {
          data: validated.data,
          usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0
          },
          model: currentModel
        };
      } catch (error) {
        lastError = error as Error;
        logger.error({ err: lastError, retriesLeft: retries }, 'Structured chat failed');

        retries--;

        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Try fallback model if available and this is the last retry
          if (this.fallbackModel && retries === 0) {
            logger.info('Switching to fallback model', { fallbackModel: this.fallbackModel });
            currentModel = this.fallbackModel;
          }
        }
      }
    }

    throw lastError || new Error('Structured output request failed after retries');
  }

  /**
   * Convert Zod schema to JSON Schema
   * Simple implementation for common types
   */
  private zodToJsonSchema(zodSchema: z.ZodSchema<any>): any {
    // Get the Zod type
    const zodType = zodSchema._def;

    // Handle object schemas
    if (zodType.typeName === 'ZodObject') {
      const properties: any = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(zodType.shape())) {
        const fieldDef = (value as any)._def;
        properties[key] = this.zodTypeToJsonSchemaType(fieldDef);

        // Check if field is required
        if (!fieldDef.isOptional?.() && !fieldDef.defaultValue) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }

    // Handle other schemas
    return {
      type: 'object',
      properties: {},
      additionalProperties: true
    };
  }

  private zodTypeToJsonSchemaType(zodType: any): any {
    const typeName = zodType.typeName;

    switch (typeName) {
      case 'ZodString':
        return { type: 'string' };

      case 'ZodNumber':
        return { type: 'number' };

      case 'ZodBoolean':
        return { type: 'boolean' };

      case 'ZodArray':
        return {
          type: 'array',
          items: this.zodTypeToJsonSchemaType(zodType.element)
        };

      case 'ZodObject':
        return this.zodToJsonSchema({ _def: zodType });

      case 'ZodOptional':
      case 'ZodDefault':
        return this.zodTypeToJsonSchemaType(zodType.innerType);

      case 'ZodLiteral':
        return {
          type: typeof zodType.value,
          const: zodType.value
        };

      case 'ZodEnum':
        return {
          type: 'string',
          enum: zodType.values
        };

      case 'ZodEffects':
        return this.zodTypeToJsonSchemaType(zodType._def);

      default:
        logger.warn({ typeName }, 'Unknown Zod type, using any');
        return {};
    }
  }
}

// ============================================================================
// Anthropic Structured Provider
// ============================================================================

export class AnthropicStructuredProvider implements StructuredLLMProvider {
  private client: any;
  private model: string;

  constructor(
    apiKey: string,
    model: string = 'claude-sonnet-4-20250514'
  ) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey });
      this.model = model;
      logger.info({ model }, 'Anthropic Structured Provider initialized');
    } catch (error) {
      throw new Error('Anthropic package not installed. Run: npm install @anthropic-ai/sdk');
    }
  }

  getProviderName(): string {
    return 'anthropic';
  }

  getModel(): string {
    return this.model;
  }

  async chatStructured<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    systemPrompt?: string,
    options: StructuredChatOptions = {}
  ): Promise<{ data: T; usage: TokenUsage; model: string }> {
    // Convert Zod schema to JSON Schema
    const jsonSchema = this.zodToJsonSchema(schema);

    // Build system prompt with schema instructions
    const schemaInstructions = `
You must respond with a JSON object matching this schema:
${JSON.stringify(jsonSchema, null, 2)}

Respond ONLY with valid JSON. No additional text or explanation.
`;

    const formattedMessages = messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));

    try {
      const response = await this.client.messages.create({
        model: this.model,
        system: (systemPrompt || '') + schemaInstructions,
        messages: formattedMessages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        top_p: options.topP || 1
      });

      let parsed: any;

      // Extract content from response
      const content = response.content[0];
      if (content.type === 'text') {
        parsed = JSON.parse(content.text);
      } else if (content.type === 'tool_use' && content.input) {
        parsed = content.input;
      } else {
        throw new Error('Unexpected response format from Anthropic');
      }

      // Validate against schema
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        logger.error({ errors: validated.error.errors }, 'Schema validation failed');
        throw new Error(`Schema validation failed: ${validated.error.errors.map(e => e.message).join(', ')}`);
      }

      return {
        data: validated.data,
        usage: {
          promptTokens: response.usage?.input_tokens || 0,
          completionTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        },
        model: this.model
      };
    } catch (error) {
      logger.error({ err: error as Error }, 'Anthropic structured chat failed');
      throw error;
    }
  }

  /**
   * Convert Zod schema to JSON Schema (simplified for Anthropic)
   */
  private zodToJsonSchema(zodSchema: z.ZodSchema<any>): any {
    const zodType = zodSchema._def;

    if (zodType.typeName === 'ZodObject') {
      const properties: any = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(zodType.shape())) {
        const fieldDef = (value as any)._def;
        properties[key] = this.zodTypeToJsonSchemaType(fieldDef);

        if (!fieldDef.isOptional?.() && !fieldDef.defaultValue) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }

    return {
      type: 'object',
      properties: {},
      additionalProperties: true
    };
  }

  private zodTypeToJsonSchemaType(zodType: any): any {
    const typeName = zodType.typeName;

    switch (typeName) {
      case 'ZodString':
        return { type: 'string' };
      case 'ZodNumber':
        return { type: 'number' };
      case 'ZodBoolean':
        return { type: 'boolean' };
      case 'ZodArray':
        return {
          type: 'array',
          items: this.zodTypeToJsonSchemaType(zodType.element)
        };
      case 'ZodObject':
        return this.zodToJsonSchema({ _def: zodType });
      case 'ZodOptional':
      case 'ZodDefault':
        return this.zodTypeToJsonSchemaType(zodType.innerType);
      case 'ZodLiteral':
        return {
          type: typeof zodType.value,
          const: zodType.value
        };
      case 'ZodEnum':
        return {
          type: 'string',
          enum: zodType.values
        };
      case 'ZodEffects':
        return this.zodTypeToJsonSchemaType(zodType._def);
      default:
        return {};
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createStructuredLLMProvider(
  provider: 'openai' | 'anthropic',
  apiKey: string,
  model?: string,
  fallbackModel?: string
): StructuredLLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIStructuredProvider(apiKey, model, fallbackModel);
    case 'anthropic':
      return new AnthropicStructuredProvider(apiKey, model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Create from environment variables
 */
export function createStructuredLLMFromEnv(): StructuredLLMProvider | null {
  const provider = process.env.SEDIMAN_PROVIDER || 'openai';
  const apiKey = process.env.SEDIMAN_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn('No API key found for structured LLM provider');
    return null;
  }

  const model = process.env.SEDIMAN_MODEL;

  if (provider === 'openai' || provider === 'anthropic') {
    return createStructuredLLMProvider(provider as 'openai' | 'anthropic', apiKey, model);
  }

  logger.warn({ provider }, 'Unknown provider for structured LLM');
  return null;
}
