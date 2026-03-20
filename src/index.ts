import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import minimist from 'minimist';
import { GeminiAgent } from './agent.js';
import { printError, printInfo } from './ui.js';

const VERSION = '0.1.0';
const DEFAULT_MODEL = 'gemini-2.0-flash';

const HELP = `
gemini-code — A Gemini-powered CLI coding assistant

Usage:
  gemini-code [options]

Options:
  --model <model>   Gemini model to use (default: ${DEFAULT_MODEL})
  --api-key <key>   Gemini API key (or set GEMINI_API_KEY env var)
  --version         Print version and exit
  --help            Show this help

Interactive commands (inside the REPL):
  /clear            Clear conversation history
  /exit, /quit      Exit the session
  /model <name>     Switch Gemini model mid-session

Example:
  GEMINI_API_KEY=your_key gemini-code
  gemini-code --model gemini-1.5-pro

Get a Gemini API key at: https://aistudio.google.com/apikey
`;

function buildSystemPrompt(cwd: string): string {
  let prompt = `You are GeminiCode, an expert AI coding assistant running in the terminal.
You help users with software engineering tasks: reading and writing code, running shell commands, git operations, debugging, and explaining code.

You have access to the following tools:
- read_file: Read file contents
- write_file: Write or create a file (shows diff, asks for approval)
- edit_file: Make a targeted edit to a file using exact string replacement (shows diff, asks for approval)
- bash_command: Run a shell command (shows command, asks for approval)
- list_directory: List directory contents
- grep_search: Search for patterns in files
- glob_search: Find files by name/pattern

Guidelines:
- Always read a file before editing it to understand its current contents
- Prefer edit_file over write_file for modifying existing files (smaller diffs, less risk)
- When writing code, follow the conventions already present in the codebase
- Run tests after making changes when a test suite exists
- Keep changes minimal and focused on the user's request
- Explain what you're doing and why

Current working directory: ${cwd}
`;

  // Load GEMINI.md if present
  const geminiMd = path.join(cwd, 'GEMINI.md');
  if (fs.existsSync(geminiMd)) {
    try {
      const content = fs.readFileSync(geminiMd, 'utf-8');
      prompt += `\n## Project context (from GEMINI.md):\n${content}\n`;
    } catch {
      // Ignore read errors
    }
  }

  return prompt;
}

async function printBanner(): Promise<void> {
  const { default: chalk } = await import('chalk');
  console.log(chalk.bold.cyan(`
  ╔═══════════════════════════════╗
  ║        gemini-code v${VERSION}       ║
  ║  AI coding assistant for CLI  ║
  ╚═══════════════════════════════╝
`));
  console.log(chalk.gray('Type your request in natural language.'));
  console.log(chalk.gray('Commands: /clear  /model <name>  /exit\n'));
}

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), {
    string: ['model', 'api-key'],
    boolean: ['version', 'help'],
    alias: { k: 'api-key', m: 'model', v: 'version', h: 'help' },
  });

  if (argv.version) {
    console.log(`gemini-code v${VERSION}`);
    process.exit(0);
  }

  if (argv.help) {
    console.log(HELP);
    process.exit(0);
  }

  const apiKey = (argv['api-key'] as string) || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    await printError(
      'No Gemini API key found.\n' +
        '  Set the GEMINI_API_KEY environment variable or use --api-key <key>.\n' +
        '  Get a key at: https://aistudio.google.com/apikey',
    );
    process.exit(1);
  }

  const model = (argv.model as string) || DEFAULT_MODEL;
  const cwd = process.cwd();
  const systemPrompt = buildSystemPrompt(cwd);

  const agent = new GeminiAgent({ apiKey, model, systemPrompt, cwd });

  await printBanner();
  await printInfo(`Model: ${model}  |  CWD: ${cwd}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // Show prompt
  const showPrompt = async () => {
    const { default: chalk } = await import('chalk');
    process.stdout.write(chalk.bold.green('\n❯ '));
  };

  await showPrompt();

  rl.on('line', async (rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      await showPrompt();
      return;
    }

    // Handle slash commands
    if (line.startsWith('/')) {
      const parts = line.slice(1).split(' ');
      const cmd = parts[0].toLowerCase();

      switch (cmd) {
        case 'exit':
        case 'quit':
          console.log('\nGoodbye!');
          rl.close();
          process.exit(0);
          break;

        case 'clear':
          agent.clearHistory();
          await printInfo('Conversation history cleared.');
          break;

        case 'model': {
          const newModel = parts[1];
          if (!newModel) {
            await printError('Usage: /model <model-name>');
          } else {
            // Re-create agent with new model
            (agent as unknown as { model: string }).model = newModel;
            await printInfo(`Model switched to: ${newModel}`);
          }
          break;
        }

        case 'help':
          console.log(HELP);
          break;

        default:
          await printError(`Unknown command: /${cmd}. Try /help.`);
      }

      await showPrompt();
      return;
    }

    // Regular message — send to agent
    try {
      await agent.sendMessage(line);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await printError(msg);
    }

    await showPrompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nInterrupted. Type /exit to quit or press Ctrl+D.');
    showPrompt();
  });
}

main().catch(async (err) => {
  await printError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
