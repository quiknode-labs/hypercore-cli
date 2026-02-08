import type {
  NormalizedBookUpdateEvent,
  NormalizedEvent,
  NormalizedOrderEvent,
  NormalizedSystemEvent,
  NormalizedTradeEvent,
  NormalizedTwapEvent,
  NormalizedWriterActionEvent,
} from '../types/stream';
import type { OutputWriter, WriterInitContext } from './types';

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
    default:
      return JSON.stringify(event);
  }
}

function formatOrderEvent(event: NormalizedOrderEvent): string {
  return `[${event.blockNumber}] ORDERS ${event.status.toUpperCase()} ${event.user} ${event.coin} ${event.side} ${event.size ?? '-'} @ ${event.limitPx ?? '-'}`;
}

function formatTradeEvent(event: NormalizedTradeEvent): string {
  return `[${event.blockNumber}] TRADES ${event.user} ${event.coin} ${event.side} ${event.size} @ ${event.price}`;
}

function formatSystemEvent(event: NormalizedSystemEvent): string {
  const qualifier = event.deltaType ? `${event.eventType}:${event.deltaType}` : event.eventType;
  return `[${event.blockNumber}] EVENTS ${qualifier} users=${event.users.length}`;
}

function formatBookUpdateEvent(event: NormalizedBookUpdateEvent): string {
  const sizeSegment = event.diffType === 'new' ? ` size=${event.size ?? '-'}` : '';
  return `[${event.blockNumber}] BOOK ${event.coin} ${event.side} ${event.price} ${event.diffType.toUpperCase()}${sizeSegment}`;
}

function formatTwapEvent(event: NormalizedTwapEvent): string {
  return `[${event.blockNumber}] TWAP ${event.status.toUpperCase()} id=${event.twapId} ${event.coin} ${event.side} ${event.size} executed=${event.executedSize ?? '0.0'}`;
}

function formatWriterActionEvent(event: NormalizedWriterActionEvent): string {
  return `[${event.blockNumber}] WRITER_ACTIONS ${event.actionType} user=${event.user} token=${event.token ?? '-'} destination=${event.destination ?? '-'} wei=${event.wei ?? '-'}`;
}
