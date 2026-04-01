import { TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';
import type { Finding, AlertEvent } from '../types/index.js';
import { loadConfig } from '../config/index.js';
import { getHcsClient } from './client.js';
import { getLogger } from '../utils/logger.js';
import { markPublished } from '../db/repos/findings.js';

// HCS hard limit is 4096 bytes per message chunk.
// Keep well under it so we never need multi-chunk submissions.
const HCS_MAX_BYTES = 3800;

/**
 * Truncate signals until the serialized event fits within HCS_MAX_BYTES.
 * Highest-severity signals are kept — they matter most.
 * Returns the (possibly reduced) signal list and whether truncation occurred.
 */
function fitToHcsLimit(event: AlertEvent): AlertEvent {
  // Sort by severity priority so we drop lowest-impact signals first
  const prioritized = [...event.signals].sort((a, b) => {
    const order = { high: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  let signals = prioritized;
  while (signals.length > 0) {
    const candidate = { ...event, signals, signalsTruncated: signals.length < event.signals.length };
    if (Buffer.byteLength(JSON.stringify(candidate), 'utf8') <= HCS_MAX_BYTES) {
      return candidate;
    }
    signals = signals.slice(0, signals.length - 1);
  }

  // Fallback: no signals but still within limit
  return { ...event, signals: [], signalsTruncated: true };
}

/**
 * Publish a finding as a structured alert event to the configured HCS topic.
 * Marks the finding as published in the DB on success.
 */
export async function publishAlert(finding: Finding): Promise<void> {
  const config = loadConfig();
  const logger = getLogger();

  if (!config.HCS_TOPIC_ID) {
    logger.warn({ findingId: finding.id }, 'HCS_TOPIC_ID not set — skipping publish');
    return;
  }

  const raw: AlertEvent = {
    type: 'package_alert',
    version: 1,
    timestamp: new Date().toISOString(),
    package: finding.packageName,
    releaseVersion: finding.version,
    previousVersion: finding.previousVersion,
    severity: finding.severity,
    signals: finding.signals,
    findingId: finding.id,
  };

  const event = fitToHcsLimit(raw);
  if (event.signalsTruncated) {
    logger.warn(
      { findingId: finding.id, kept: event.signals.length, total: finding.signals.length },
      'signals truncated to fit HCS message limit',
    );
  }

  const message = JSON.stringify(event);
  const client = getHcsClient();

  const txResponse = await new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(config.HCS_TOPIC_ID))
    .setMessage(message)
    .execute(client);

  const receipt = await txResponse.getReceipt(client);
  logger.info(
    {
      findingId: finding.id,
      topicId: config.HCS_TOPIC_ID,
      sequenceNumber: receipt.topicSequenceNumber?.toString(),
      signalsTruncated: event.signalsTruncated ?? false,
    },
    'alert published to HCS',
  );

  markPublished(finding.id);
}
