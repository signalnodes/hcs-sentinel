import 'dotenv/config';
import {
  Client,
  PrivateKey,
  TopicCreateTransaction
} from "@hashgraph/sdk";

const accountId = process.env.HEDERA_ACCOUNT_ID!;
const privateKeyHex = process.env.HEDERA_PRIVATE_KEY!;

async function main() {
  if (!accountId || !privateKeyHex) {
    throw new Error("Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY in .env");
  }

  // Force ECDSA parsing (this is the key fix)
  const privateKey = PrivateKey.fromStringECDSA(privateKeyHex);

  const client = Client.forTestnet().setOperator(
    accountId,
    privateKey
  );

  console.log("Creating HCS topic on testnet...");

  const tx = await new TopicCreateTransaction()
    .setTopicMemo("hcs-sentinel: package security alerts")
    .execute(client);

  const receipt = await tx.getReceipt(client);

  console.log("✅ Topic created successfully");
  console.log(`Topic ID: ${receipt.topicId}`);
}

main().catch((err) => {
  console.error("❌ Failed to create topic:");
  console.error(err);
});
