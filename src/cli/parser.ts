/**
 * Parsed command-line arguments (Phase 1 backward compatible)
 */
export interface ParsedArgs {
  subcommand: string | null;
  args: string[];
  errors: string[];
  flags?: Record<string, any>; // Phase 2: parsed flags
  globalFlags?: GlobalFlags; // Phase 2: global flags
}

/**
 * Global flags applicable to all commands
 */
export interface GlobalFlags {
  help: boolean;
  version: boolean;
  json: boolean;
  debug: boolean;
  noColor: boolean;
}

/**
 * Flag schema definition
 */
export interface FlagSchema {
  type: "string" | "number" | "boolean" | "enum" | "array";
  description: string;
  short?: string; // Shorthand flag (e.g., 'c' for --context)
  values?: string[]; // For enum type
  default?: any;
  required?: boolean;
}

/**
 * Command schema for validation
 */
export interface CommandSchema {
  description: string;
  requiredPositional?: number; // Number of required positional args
  flags?: Record<string, FlagSchema>;
}

/**
 * All command schemas
 */
export const commandSchemas: Record<string, CommandSchema> = {
  capture: {
    description: "Capture a deferred decision with context",
    requiredPositional: 1,
    flags: {
      context: {
        type: "string",
        description: "Additional context or reasoning",
        short: "c",
      },
      priority: {
        type: "enum",
        description: "Priority level",
        short: "p",
        values: ["low", "medium", "high"],
      },
      tags: { type: "array", description: "Comma-separated tags", short: "t" },
      high: { type: "boolean", description: "Shorthand for --priority high" },
    },
  },
  list: {
    description: "List deferred items with optional filtering",
    flags: {
      status: {
        type: "enum",
        description: "Filter by status",
        short: "s",
        values: ["pending", "in-progress", "done", "archived"],
      },
      priority: {
        type: "enum",
        description: "Filter by priority",
        short: "p",
        values: ["low", "medium", "high"],
      },
      tags: {
        type: "array",
        description: "Filter by tags (OR logic)",
        short: "t",
      },
      limit: {
        type: "number",
        description: "Maximum number of items",
        short: "l",
      },
    },
  },
  show: {
    description: "Show full details of a specific item",
    requiredPositional: 1,
  },
  do: {
    description: "Mark item as in-progress and get todo guidance",
    requiredPositional: 1,
  },
  update: {
    description: "Update an existing deferred item",
    requiredPositional: 1,
    flags: {
      decision: {
        type: "string",
        description: "Updated decision text",
        short: "d",
      },
      context: { type: "string", description: "Updated context", short: "c" },
      priority: {
        type: "enum",
        description: "Updated priority",
        short: "p",
        values: ["low", "medium", "high"],
      },
      status: {
        type: "enum",
        description: "Updated status",
        short: "s",
        values: ["pending", "in-progress", "done", "archived"],
      },
      tags: { type: "array", description: "Replace tags", short: "t" },
      "add-tags": { type: "array", description: "Add tags to existing" },
      "remove-tags": {
        type: "array",
        description: "Remove tags from existing",
      },
      deps: {
        type: "array",
        description: "Set dependencies (comma-separated IDs)",
      },
    },
  },
  delete: {
    description: "Delete a deferred item",
    requiredPositional: 1,
    flags: {
      hard: {
        type: "boolean",
        description: "Permanently delete (default: soft delete)",
      },
    },
  },
  "bulk-update": {
    description: "Update multiple items at once",
    requiredPositional: 1,
    flags: {
      decision: {
        type: "string",
        description: "Updated decision text for all",
      },
      context: { type: "string", description: "Updated context for all" },
      priority: {
        type: "enum",
        description: "Updated priority for all",
        values: ["low", "medium", "high"],
      },
      status: {
        type: "enum",
        description: "Updated status for all",
        values: ["pending", "in-progress", "done", "archived"],
      },
      tags: { type: "array", description: "Replace tags for all" },
      "add-tags": { type: "array", description: "Add tags to all" },
    },
  },
  "bulk-delete": {
    description: "Delete multiple items at once",
    requiredPositional: 1,
    flags: {
      hard: {
        type: "boolean",
        description: "Permanently delete all (default: soft delete)",
      },
    },
  },
  search: {
    description: "Full-text search across items with relevance scoring",
    requiredPositional: 1,
    flags: {
      fields: {
        type: "array",
        description: "Fields to search (decision,context,tags)",
      },
      limit: { type: "number", description: "Maximum results", default: 10 },
      "min-score": {
        type: "number",
        description: "Minimum relevance score",
        default: 0.01,
      },
    },
  },
};

/**
 * Parse command-line arguments with full flag support
 *
 * Backward compatible with Phase 1 for simple parsing.
 * Enhanced with flag parsing and validation for Phase 2.
 *
 * @param argv - Process argv array (typically process.argv.slice(2))
 * @returns Parsed arguments with subcommand, args, flags, and errors
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const errors: string[] = [];

  // If no arguments, return null subcommand
  if (argv.length === 0) {
    return {
      subcommand: null,
      args: [],
      errors: ['No subcommand provided. Try: later capture "text"'],
      flags: {},
      globalFlags: {
        help: false,
        version: false,
        json: false,
        debug: false,
        noColor: false,
      },
    };
  }

  // Parse global flags first
  const globalFlags: GlobalFlags = {
    help: argv.includes("--help") || argv.includes("-h"),
    version: argv.includes("--version") || argv.includes("-v"),
    json: argv.includes("--json"),
    debug: argv.includes("--debug"),
    noColor: argv.includes("--no-color"),
  };

  // Filter out global flags to get command args
  const filteredArgv = argv.filter(
    (arg) =>
      ![
        "--help",
        "-h",
        "--version",
        "-v",
        "--json",
        "--debug",
        "--no-color",
      ].includes(arg),
  );

  // If no arguments after filtering global flags
  if (filteredArgv.length === 0) {
    return {
      subcommand: null,
      args: [],
      errors:
        globalFlags.help || globalFlags.version
          ? []
          : ['No subcommand provided. Try: later capture "text"'],
      flags: {},
      globalFlags,
    };
  }

  // First argument is the subcommand
  const subcommand = filteredArgv[0];

  // Validate subcommand
  const validCommands = Object.keys(commandSchemas);
  if (!validCommands.includes(subcommand)) {
    errors.push(`Unknown subcommand: ${subcommand}`);
    errors.push(`Valid commands: ${validCommands.join(", ")}`);
  }

  // Parse flags and positional args
  const remainingArgs = filteredArgv.slice(1);
  const {
    positional,
    flags: parsedFlags,
    errors: parseErrors,
  } = parseFlags(remainingArgs, subcommand);

  errors.push(...parseErrors);

  // Validate against schema if command is valid
  if (validCommands.includes(subcommand)) {
    const schema = commandSchemas[subcommand];
    const validationErrors = validateArgs(
      subcommand,
      positional,
      parsedFlags,
      schema,
    );
    errors.push(...validationErrors);
  }

  return {
    subcommand,
    args: positional,
    flags: parsedFlags,
    globalFlags,
    errors,
  };
}

/**
 * Parse flags from arguments
 */
function parseFlags(
  args: string[],
  subcommand: string,
): { positional: string[]; flags: Record<string, any>; errors: string[] } {
  const positional: string[] = [];
  const flags: Record<string, any> = {};
  const errors: string[] = [];
  const schema = commandSchemas[subcommand];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // Check if it's a negative number (treat as positional, not flag)
    const isNegativeNumber =
      arg.startsWith("-") && arg.length > 1 && /^-\d+(\.\d+)?$/.test(arg);

    // Check if it's a flag
    if (arg.startsWith("--") && !isNegativeNumber) {
      const flagName = arg.substring(2);
      const flagSchema = schema?.flags?.[flagName];

      if (!flagSchema) {
        errors.push(`Unknown flag: ${arg}`);
        i++;
        continue;
      }

      // Boolean flags don't need a value
      if (flagSchema.type === "boolean") {
        flags[flagName] = true;
        i++;
        continue;
      }

      // Other flags need a value
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
        errors.push(`Flag ${arg} requires a value`);
        i++;
        continue;
      }

      const value = args[i + 1];
      flags[flagName] = coerceValue(value, flagSchema, flagName, errors);
      i += 2;
    } else if (arg.startsWith("-") && arg.length === 2 && !isNegativeNumber) {
      // Short flag
      const shortFlag = arg[1];
      const flagName = findFlagByShort(shortFlag, schema);

      if (!flagName) {
        errors.push(`Unknown flag: ${arg}`);
        i++;
        continue;
      }

      const flagSchema = schema!.flags![flagName];

      // Boolean flags (no current short flags are boolean type)
      if (flagSchema.type === "boolean") {
        flags[flagName] = true;
        i++;
        continue;
      }

      // Other flags need a value
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
        errors.push(`Flag -${shortFlag} requires a value`);
        i++;
        continue;
      }

      const value = args[i + 1];
      flags[flagName] = coerceValue(value, flagSchema, flagName, errors);
      i += 2;
    } else {
      // Positional argument
      positional.push(arg);
      i++;
    }
  }

  return { positional, flags, errors };
}

/**
 * Find flag name by short form
 */
function findFlagByShort(short: string, schema?: CommandSchema): string | null {
  if (!schema?.flags) return null;

  for (const [name, flagSchema] of Object.entries(schema.flags)) {
    if (flagSchema.short === short) {
      return name;
    }
  }

  return null;
}

/**
 * Coerce value to the correct type
 */
function coerceValue(
  value: string,
  schema: FlagSchema,
  flagName: string,
  errors: string[],
): any {
  switch (schema.type) {
    case "number": {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`Flag --${flagName} expects a number, got: ${value}`);
        return value;
      }
      return num;
    }

    case "array": {
      // Split by comma and trim
      return value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }

    case "enum": {
      if (schema.values && !schema.values.includes(value)) {
        errors.push(
          `Flag --${flagName} must be one of: ${schema.values.join(", ")}`,
        );
        return value;
      }
      return value;
    }

    case "string":
    default:
      return value;
  }
}

/**
 * Validate parsed arguments against schema
 */
function validateArgs(
  subcommand: string,
  positional: string[],
  flags: Record<string, any>,
  schema: CommandSchema,
): string[] {
  const errors: string[] = [];

  // Check required positional arguments
  if (
    schema.requiredPositional &&
    positional.length < schema.requiredPositional
  ) {
    errors.push(
      `Command '${subcommand}' requires ${schema.requiredPositional} argument${schema.requiredPositional > 1 ? "s" : ""}, got ${positional.length}`,
    );
  }

  // Check required flags
  if (schema.flags) {
    for (const [name, flagSchema] of Object.entries(schema.flags)) {
      if (flagSchema.required && !(name in flags)) {
        errors.push(`Required flag --${name} is missing`);
      }
    }
  }

  return errors;
}
