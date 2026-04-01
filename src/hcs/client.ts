import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';
import { loadConfig } from '../config/index.js';

let _client: Client | null = null;

/**
 * Returns a shared Hedera client.
 * Throws if credentials are not configured.
 */
export function getHcsClient(): Client {
  if (_client) return _client;

  const config = loadConfig();

  if (!config.HEDERA_ACCOUNT_ID || !config.HEDERA_PRIVATE_KEY) {
    throw new Error(
      'HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set to publish to HCS',
    );
  }

  const accountId = AccountId.fromString(config.HEDERA_ACCOUNT_ID);

  const rawKey = config.HEDERA_PRIVATE_KEY.trim();

  // 🔐 Explicit key parsing (no ambiguity)
  let privateKey: PrivateKey;

  if (rawKey.startsWith('0x') || rawKey.length === 64 || rawKey.length === 66) {
    // ECDSA raw hex (your case)
    privateKey = PrivateKey.fromStringECDSA(rawKey);
  } else if (rawKey.startsWith('302e') || rawKey.startsWith('3030')) {
    // DER-encoded key
    privateKey = PrivateKey.fromStringDer(rawKey);
  } else {
    throw new Error('Unrecognized private key format');
  }

  // 🌐 Network selection
  if (config.HEDERA_NETWORK === 'mainnet') {
    _client = Client.forMainnet();
  } else if (config.HEDERA_NETWORK === 'previewnet') {
    _client = Client.forPreviewnet();
  } else {
    _client = Client.forTestnet();
  }

  _client.setOperator(accountId, privateKey);

  return _client;
}

export function closeHcsClient(): void {
  if (_client) {
    _client.close();
    _client = null;
  }
}