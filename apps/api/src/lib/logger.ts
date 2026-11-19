import type { LogLevel } from './config.js'

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

export interface LogEntry {
  timestamp: string
  level: Exclude<LogLevel, 'silent'>
  msg: string
  [key: string]: unknown
}

export interface Logger {
  debug: (msg: string, context?: Record<string, unknown>) => void
  info: (msg: string, context?: Record<string, unknown>) => void
  warn: (msg: string, context?: Record<string, unknown>) => void
  error: (msg: string, context?: Record<string, unknown>) => void
}

export interface LoggerOptions {
  level?: LogLevel
  write?: (line: string) => void
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info')
  const minWeight = LEVEL_WEIGHT[level]
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`))

  const emit = (entryLevel: Exclude<LogLevel, 'silent'>, msg: string, context?: Record<string, unknown>) => {
    if (LEVEL_WEIGHT[entryLevel] < minWeight) return
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: entryLevel,
      msg,
      ...context,
    }
    write(JSON.stringify(entry))
  }

  return {
    debug: (msg, context) => emit('debug', msg, context),
    info: (msg, context) => emit('info', msg, context),
    warn: (msg, context) => emit('warn', msg, context),
    error: (msg, context) => emit('error', msg, context),
  }
}
