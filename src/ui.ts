import * as readline from 'readline';
import * as diffLib from 'diff';

// Lazy-loaded ESM modules
let _chalk: typeof import('chalk').default | null = null;
let _ora: typeof import('ora').default | null = null;

async function getChalk() {
  if (!_chalk) {
    const m = await import('chalk');
    _chalk = m.default;
  }
  return _chalk;
}

async function getOra() {
  if (!_ora) {
    const m = await import('ora');
    _ora = m.default;
  }
  return _ora;
}

export type SpinnerHandle = { stop: () => void };

export async function startSpinner(text: string): Promise<SpinnerHandle> {
  const ora = await getOra();
  const spinner = ora({ text, color: 'cyan' }).start();
  return {
    stop: () => spinner.stop(),
  };
}

export async function printUser(text: string): Promise<void> {
  const chalk = await getChalk();
  process.stdout.write(chalk.bold.white('\nYou: ') + chalk.white(text) + '\n');
}

export async function printAssistant(text: string): Promise<void> {
  const chalk = await getChalk();
  process.stdout.write('\n' + chalk.cyan(text) + '\n');
}

export async function printToolCall(name: string, args: Record<string, unknown>): Promise<void> {
  const chalk = await getChalk();
  const argsStr = Object.entries(args)
    .map(([k, v]) => `  ${chalk.gray(k)}: ${chalk.white(String(v)).substring(0, 120)}`)
    .join('\n');
  process.stdout.write(chalk.yellow(`\n⚡ Tool: ${name}\n`) + argsStr + '\n');
}

export async function printToolResult(result: string, isError = false): Promise<void> {
  const chalk = await getChalk();
  if (isError) {
    process.stdout.write(chalk.red(`\n✗ Error: ${result}\n`));
  } else {
    const preview = result.length > 500 ? result.substring(0, 500) + '…' : result;
    process.stdout.write(chalk.gray(`\n  → ${preview}\n`));
  }
}

export async function printError(msg: string): Promise<void> {
  const chalk = await getChalk();
  process.stderr.write(chalk.red(`\nError: ${msg}\n`));
}

export async function printInfo(msg: string): Promise<void> {
  const chalk = await getChalk();
  process.stdout.write(chalk.blue(msg) + '\n');
}

export async function printDiff(oldContent: string, newContent: string, filename: string): Promise<void> {
  const chalk = await getChalk();
  const patch = diffLib.createPatch(filename, oldContent, newContent, 'original', 'modified');
  const lines = patch.split('\n');
  process.stdout.write('\n');
  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      process.stdout.write(chalk.bold(line) + '\n');
    } else if (line.startsWith('+')) {
      process.stdout.write(chalk.green(line) + '\n');
    } else if (line.startsWith('-')) {
      process.stdout.write(chalk.red(line) + '\n');
    } else if (line.startsWith('@@')) {
      process.stdout.write(chalk.cyan(line) + '\n');
    } else {
      process.stdout.write(chalk.gray(line) + '\n');
    }
  }
}

export async function askApproval(question: string): Promise<'yes' | 'no' | 'quit'> {
  const chalk = await getChalk();
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    const prompt = chalk.bold.yellow(`\n${question} [y/n/q] `);
    process.stdout.write(prompt);

    rl.once('line', (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === 'y' || a === 'yes') resolve('yes');
      else if (a === 'q' || a === 'quit') resolve('quit');
      else resolve('no');
    });

    // Handle EOF (non-interactive / piped input) — auto-approve
    rl.once('close', () => resolve('yes'));
  });
}

export function createREPL(
  onLine: (line: string) => Promise<void>,
  onClose: () => void,
): readline.Interface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: '',
  });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (trimmed) {
      await onLine(trimmed);
    }
    rl.prompt();
  });

  rl.on('close', onClose);
  return rl;
}
