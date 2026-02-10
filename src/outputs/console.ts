import type {
  NormalizedBlockEvent,
  NormalizedBookUpdateEvent,
  NormalizedEvent,
  NormalizedOrderEvent,
  NormalizedSystemEvent,
  NormalizedTradeEvent,
  NormalizedTwapEvent,
  NormalizedWriterActionEvent,
} from '../types/stream';
import type { OutputWriter, WriterInitContext } from './types';
import { stdoutColors as c } from '../utils/ansi';

export class ConsoleWriter implements OutputWriter {
  async init(_context: WriterInitContext): Promise<void> {
    return Promise.resolve();
  }

  async write(event: NormalizedEvent): Promise<void> {
    process.stdout.write(`${formatEvent(event)}\n`);
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

function formatEvent(event: NormalizedEvent): string {
  switch (event.stream) {
    case 'orders':
      return formatOrderEvent(event);
    case 'trades':
      return formatTradeEvent(event);
    case 'events':
      return formatSystemEvent(event);
    case 'book_updates':
      return formatBookUpdateEvent(event);
    case 'twap':
      return formatTwapEvent(event);
    case 'writer_actions':
      return formatWriterActionEvent(event);
    case 'blocks':
      return formatBlockEvent(event);
    default:
      return JSON.stringify(event);
  }
}

function colorSide(side: string): string {
  const lower = side.toLowerCase();
  if (lower === 'buy' || lower === 'bid') return c.green(side);
  if (lower === 'sell' || lower === 'ask') return c.red(side);
  return side;
}

function colorStatus(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'open') return c.yellow(status.toUpperCase());
  if (lower === 'filled') return c.green(status.toUpperCase());
  if (lower === 'canceled' || lower === 'cancelled') return c.red(status.toUpperCase());
  return c.cyan(status.toUpperCase());
}

function formatOrderEvent(event: NormalizedOrderEvent): string {
  return `[${event.blockNumber}] ${c.bold('ORDERS')} ${colorStatus(event.status)} ${event.user} ${c.cyan(event.coin)} ${colorSide(event.side)} ${event.size ?? '-'} @ ${event.limitPx ?? '-'}`;
}

function formatTradeEvent(event: NormalizedTradeEvent): string {
  return `[${event.blockNumber}] ${c.bold('TRADES')} ${event.user} ${c.cyan(event.coin)} ${colorSide(event.side)} ${event.size} @ ${event.price}`;
}

function formatSystemEvent(event: NormalizedSystemEvent): string {
  const qualifier = event.deltaType ? `${event.eventType}:${event.deltaType}` : event.eventType;
  return `[${event.blockNumber}] ${c.bold('EVENTS')} ${qualifier} users=${event.users.length}`;
}

function formatBookUpdateEvent(event: NormalizedBookUpdateEvent): string {
  const sizeSegment = event.diffType === 'new' ? ` size=${event.size ?? '-'}` : '';
  return `[${event.blockNumber}] ${c.bold('BOOK')} ${c.cyan(event.coin)} ${colorSide(event.side)} ${event.price} ${event.diffType.toUpperCase()}${sizeSegment}`;
}

function formatTwapEvent(event: NormalizedTwapEvent): string {
  return `[${event.blockNumber}] ${c.bold('TWAP')} ${colorStatus(event.status)} id=${event.twapId} ${c.cyan(event.coin)} ${colorSide(event.side)} ${event.size} executed=${event.executedSize ?? '0.0'}`;
}

function formatWriterActionEvent(event: NormalizedWriterActionEvent): string {
  return `[${event.blockNumber}] ${c.bold('WRITER_ACTIONS')} ${event.actionType} user=${event.user} token=${event.token ? c.cyan(event.token) : '-'} destination=${event.destination ?? '-'} wei=${event.wei ?? '-'}`;
}

function formatBlockEvent(event: NormalizedBlockEvent): string {
  let body: string;
  try {
    const parsed = JSON.parse(event.dataJson);
    body = JSON.stringify(parsed, null, 2);
  } catch {
    body = event.dataJson;
  }
  const indented = body.replace(/\n/g, '\n  ');
  const header = `${c.bold('---')} [${c.yellow(String(event.blockNumber))}] ${c.bold('BLOCK')} ${c.cyan(event.blockTime)} ${c.bold('---')}`;
  return `${header}\n  ${indented}`;
}
