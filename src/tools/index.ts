import { Type, type FunctionDeclaration } from '@google/genai';
import { readFile, writeFile, editFile, listDirectory } from './file.js';
import { bashCommand } from './shell.js';
import { grepSearch, globSearch } from './search.js';

// Gemini FunctionDeclarations
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'read_file',
    description:
      'Read the contents of a file at the given path. Use this to understand existing code before making changes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'The file path to read (absolute or relative to cwd).',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write content to a file. Creates the file if it does not exist. Shows a diff and asks for approval before writing.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'The file path to write.',
        },
        content: {
          type: Type.STRING,
          description: 'The full content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description:
      'Edit a file by replacing an exact string. The old_string must appear exactly once in the file. Shows a diff and asks for approval before applying.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'The file path to edit.',
        },
        old_string: {
          type: Type.STRING,
          description: 'The exact string to find and replace. Must match exactly, including whitespace.',
        },
        new_string: {
          type: Type.STRING,
          description: 'The new string to replace old_string with.',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'bash_command',
    description:
      'Execute a shell command. Shows the command and asks for approval before running. Use for git operations, running tests, installing packages, etc.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: {
          type: Type.STRING,
          description: 'The shell command to execute.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories at the given path.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'The directory path to list. Defaults to the current directory.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'grep_search',
    description:
      'Search for a pattern in files using grep/ripgrep. Returns matching lines with file and line number.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: {
          type: Type.STRING,
          description: 'The regex or text pattern to search for.',
        },
        path: {
          type: Type.STRING,
          description: 'Directory or file to search in. Defaults to current directory.',
        },
        file_glob: {
          type: Type.STRING,
          description: 'Optional glob pattern to filter files (e.g. "*.ts", "*.py").',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'glob_search',
    description: 'Find files matching a glob pattern (e.g. "**/*.ts", "src/**/*.test.js").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: {
          type: Type.STRING,
          description: 'The glob pattern to match files against.',
        },
      },
      required: ['pattern'],
    },
  },
];

// Tool executor — dispatches to the right implementation
export async function executeTool(
  name: string,
  args: Record<string, string>,
  cwd: string,
): Promise<string> {
  switch (name) {
    case 'read_file':
      return readFile(args.path);

    case 'write_file':
      return writeFile(args.path, args.content);

    case 'edit_file':
      return editFile(args.path, args.old_string, args.new_string);

    case 'bash_command':
      return bashCommand(args.command, cwd);

    case 'list_directory':
      return listDirectory(args.path || cwd);

    case 'grep_search':
      return grepSearch(args.pattern, args.path || cwd, args.file_glob);

    case 'glob_search':
      return globSearch(args.pattern, cwd);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
