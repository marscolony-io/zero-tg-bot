/****************************************************
 * land-bot.ts
 ****************************************************/

import { config as dotEnvConfig } from "dotenv";
dotEnvConfig(); // Load .env variables
import { ethers } from "ethers";
import { Bot } from "grammy";
import fs from "fs";

// --- ENV variables ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN) {
  throw new Error("[ERROR] BOT_TOKEN not set in .env");
}
if (!CHAT_ID) {
  throw new Error("[ERROR] CHAT_ID not set in .env");
}

// --- Telegram Bot ---
const bot = new Bot(BOT_TOKEN);

// --- Ethers Provider & Contract Setup ---
const provider = new ethers.JsonRpcProvider(
  "https://zero-network.calderachain.xyz/http"
);

const contractAddress = "0x13a42408eaa5526c5e7796828C7ea244009e2439";
const contractABI = ["function totalSupply() view returns (uint256)"];
const contract = new ethers.Contract(contractAddress, contractABI, provider);

// --- Supply File Management ---
const supplyFilePath = "supply.txt";

/**
 * Reads the previously stored supply from `supply.txt`.
 * Creates the file with "0" if it does not exist.
 */
function readPreviousSupplyFromFile(): number {
  if (!fs.existsSync(supplyFilePath)) {
    console.log("[LOG] supply.txt not found. Creating a new one with 0.");
    fs.writeFileSync(supplyFilePath, "0", "utf-8");
    return 0;
  }

  const content = fs.readFileSync(supplyFilePath, "utf-8");
  const parsed = parseInt(content, 10);

  if (isNaN(parsed)) {
    console.warn(
      `[WARN] supply.txt contains invalid data: "${content}". Using 0.`
    );
    return 0;
  }

  return parsed;
}

/**
 * Writes the new supply to `supply.txt`.
 */
function writeSupplyToFile(newSupply: number): void {
  fs.writeFileSync(supplyFilePath, String(newSupply), "utf-8");
  console.log(`[LOG] Updated supply.txt with new supply: ${newSupply}`);
}

// --- Initialize previousSupply from file ---
let previousSupply = readPreviousSupplyFromFile();
console.log(`[LOG] Starting bot with previousSupply = ${previousSupply}.`);

/**
 * Checks the contract for `totalSupply`, compares with `previousSupply`.
 * If newSupply is higher, send a message and save it to file.
 */
async function checkAndPost() {
  console.log("\n[LOG] Checking totalSupply from the contract...");

  try {
    const supplyBN = await contract.totalSupply();
    console.log({ supplyBN });
    const newSupply = supplyBN.toString();

    console.log(
      `[LOG] Current totalSupply = ${newSupply}; previousSupply = ${previousSupply}.`
    );

    // If new lands have been claimed, post an update
    if (newSupply.toString() !== previousSupply.toString()) {
      console.log(
        "[LOG] New lands claimed. Posting message to Telegram chat..."
      );

      previousSupply = newSupply;
      writeSupplyToFile(newSupply);

      const landsLeft = 21000 - newSupply;

      const formattedLandsLeft = landsLeft.toLocaleString();
      const message =
        "🚀 Zero Colony Land Update 🌍\n\n" +
        `- Land plots claimed: ${newSupply}\n` +
        `- Land plots availalbe: ${formattedLandsLeft}\n\n` +
        `🔗 Claim your land plot now: https://zerocolony.fun`;

      await bot.api.sendMessage(CHAT_ID!, message);
      console.log("[LOG] Message sent successfully.");
    } else {
      console.log("[LOG] No new lands claimed. No message will be sent.");
    }
  } catch (error) {
    console.error(
      "[ERROR] Failed to check totalSupply or post a message:",
      error
    );
  }
}

// --- Start the bot (required for grammy) ---
bot.start();
console.log("[LOG] Bot has started.");

// --- Schedule checks every 20 minutes ---
const TWENTY_MINUTES = 20 * 60 * 1000; // 20 minutes in milliseconds

// Calculate delay until next 20-minute mark
const now = new Date();
const minutes = now.getMinutes();
const nextCheckMinute = Math.ceil(minutes / 20) * 20;
const delay = ((nextCheckMinute - minutes) * 60 - now.getSeconds()) * 1000;

// Initial check after calculated delay
setTimeout(() => {
  checkAndPost();
  // Then schedule subsequent checks every 20 minutes
  setInterval(checkAndPost, TWENTY_MINUTES);
}, delay);

console.log(
  "[LOG] Bot will check totalSupply every 20 minutes (at :00, :20, :40)."
);
