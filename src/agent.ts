import { GoogleGenAI, type Content, type FunctionCall } from '@google/genai';
import { toolDeclarations, executeTool } from './tools/index.js';
import {
  startSpinner,
  printToolCall,
  printToolResult,
  printError,
} from './ui.js';

export interface AgentOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  cwd: string;
}

export class GeminiAgent {
  private ai: GoogleGenAI;
  private model: string;
  private systemPrompt: string;
  private cwd: string;
  private history: Content[] = [];

  constructor(opts: AgentOptions) {
    this.ai = new GoogleGenAI({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.systemPrompt = opts.systemPrompt;
    this.cwd = opts.cwd;
  }

  setModel(name: string): void {
    this.model = name;
  }

  async sendMessage(userMessage: string): Promise<void> {
    // Append user turn to history
    this.history.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Agentic loop
    while (true) {
      const functionCalls = await this._callGemini();
      if (functionCalls === null) {
        // API error — last user turn was already removed
        return;
      }

      if (functionCalls.length === 0) {
        // Text response already streamed to stdout — done
        break;
      }

      // Handle tool calls
      const spinner = await startSpinner('Running tools…');
      spinner.stop();

      // Add model turn (function calls) to history
      this.history.push({
        role: 'model',
        parts: functionCalls.map((fc) => ({ functionCall: fc })),
      });

      // Execute tools and collect results
      const toolResultParts: Content['parts'] = [];

      for (const fc of functionCalls) {
        const toolName = fc.name ?? '';
        const toolArgs = (fc.args ?? {}) as Record<string, string>;

        // Print what tool is being called (write/edit/bash print themselves during approval)
        if (!['write_file', 'edit_file', 'bash_command'].includes(toolName)) {
          await printToolCall(toolName, toolArgs);
        }

        let resultText: string;
        let isError = false;

        try {
          resultText = await executeTool(toolName, toolArgs, this.cwd);
        } catch (err: unknown) {
          resultText = err instanceof Error ? err.message : String(err);
          isError = true;
        }

        await printToolResult(resultText, isError);

        toolResultParts.push({
          functionResponse: {
            id: fc.id,
            name: toolName,
            response: { result: resultText },
          },
        });
      }

      // Append tool results and continue the loop
      this.history.push({
        role: 'user',
        parts: toolResultParts,
      });
    }
  }

  /**
   * Call Gemini with streaming.
   * - Streams text tokens directly to stdout.
   * - Returns collected function calls (empty array = text response, null = error).
   */
  private async _callGemini(): Promise<FunctionCall[] | null> {
    const chalk = (await import('chalk')).default;

    let stream: AsyncGenerator<{ text?: string; functionCalls?: FunctionCall[] }>;
    try {
      stream = await this.ai.models.generateContentStream({
        model: this.model,
        contents: this.history,
        config: {
          systemInstruction: this.systemPrompt,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      }) as AsyncGenerator<{ text?: string; functionCalls?: FunctionCall[] }>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await printError(`Gemini API error: ${msg}`);
      this.history.pop(); // Remove the last user turn so user can retry
      return null;
    }

    const collectedFunctionCalls: FunctionCall[] = [];
    let streamedText = '';
    let isFirstChunk = true;

    try {
      for await (const chunk of stream) {
        // Accumulate function calls
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          collectedFunctionCalls.push(...chunk.functionCalls);
        }

        // Stream text to stdout
        const t = chunk.text ?? '';
        if (t) {
          if (isFirstChunk) {
            process.stdout.write('\n'); // blank line before response
            isFirstChunk = false;
          }
          process.stdout.write(chalk.cyan(t));
          streamedText += t;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await printError(`Streaming error: ${msg}`);
      this.history.pop();
      return null;
    }

    // If we got a text response, add trailing newline and save to history
    if (streamedText) {
      process.stdout.write('\n');
      this.history.push({
        role: 'model',
        parts: [{ text: streamedText }],
      });
    }

    return collectedFunctionCalls;
  }

  clearHistory(): void {
    this.history = [];
  }
}
