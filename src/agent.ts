import { GoogleGenAI, type Content } from '@google/genai';
import { toolDeclarations, executeTool } from './tools/index.js';
import {
  startSpinner,
  printAssistant,
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

  async sendMessage(userMessage: string): Promise<void> {
    // Append user turn to history
    this.history.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Agentic loop
    while (true) {
      const spinner = await startSpinner('Thinking…');

      let response;
      try {
        response = await this.ai.models.generateContent({
          model: this.model,
          contents: this.history,
          config: {
            systemInstruction: this.systemPrompt,
            tools: [{ functionDeclarations: toolDeclarations }],
          },
        });
      } catch (err: unknown) {
        spinner.stop();
        const msg = err instanceof Error ? err.message : String(err);
        await printError(`Gemini API error: ${msg}`);
        // Remove the last user turn so user can retry
        this.history.pop();
        return;
      }

      spinner.stop();

      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // Add the model turn (with function calls) to history
        this.history.push({
          role: 'model',
          parts: functionCalls.map((fc) => ({ functionCall: fc })),
        });

        // Execute each tool and collect results
        const toolResultParts: Content['parts'] = [];

        for (const fc of functionCalls) {
          const toolName = fc.name ?? '';
          const toolArgs = (fc.args ?? {}) as Record<string, string>;

          // Print what tool is being called (unless it's write/edit which print themselves)
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

        // Append tool results as user turn, continue loop
        this.history.push({
          role: 'user',
          parts: toolResultParts,
        });

        // Continue the loop to let the model reason about tool results
        continue;
      }

      // No more tool calls — print the final text response
      const text = response.text;
      if (text) {
        await printAssistant(text);

        // Append model's final response to history
        this.history.push({
          role: 'model',
          parts: [{ text }],
        });
      }

      break;
    }
  }

  clearHistory(): void {
    this.history = [];
  }
}
