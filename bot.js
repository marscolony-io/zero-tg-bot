"use strict";
/****************************************************
 * land-bot.ts
 ****************************************************/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)(); // Load .env variables
const ethers_1 = require("ethers");
const grammy_1 = require("grammy");
const fs_1 = __importDefault(require("fs"));
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
const bot = new grammy_1.Bot(BOT_TOKEN);
// --- Ethers Provider & Contract Setup ---
const provider = new ethers_1.ethers.JsonRpcProvider("https://zero-network.calderachain.xyz/http");
const contractAddress = "0x13a42408eaa5526c5e7796828C7ea244009e2439";
const contractABI = ["function totalSupply() view returns (uint256)"];
const contract = new ethers_1.ethers.Contract(contractAddress, contractABI, provider);
// --- Supply File Management ---
const supplyFilePath = "supply.txt";
/**
 * Reads the previously stored supply from `supply.txt`.
 * Creates the file with "0" if it does not exist.
 */
function readPreviousSupplyFromFile() {
    if (!fs_1.default.existsSync(supplyFilePath)) {
        console.log("[LOG] supply.txt not found. Creating a new one with 0.");
        fs_1.default.writeFileSync(supplyFilePath, "0", "utf-8");
        return 0;
    }
    const content = fs_1.default.readFileSync(supplyFilePath, "utf-8");
    const parsed = parseInt(content, 10);
    if (isNaN(parsed)) {
        console.warn(`[WARN] supply.txt contains invalid data: "${content}". Using 0.`);
        return 0;
    }
    return parsed;
}
/**
 * Writes the new supply to `supply.txt`.
 */
function writeSupplyToFile(newSupply) {
    fs_1.default.writeFileSync(supplyFilePath, String(newSupply), "utf-8");
    console.log(`[LOG] Updated supply.txt with new supply: ${newSupply}`);
}
// --- Initialize previousSupply from file ---
let previousSupply = readPreviousSupplyFromFile();
console.log(`[LOG] Starting bot with previousSupply = ${previousSupply}.`);
/**
 * Checks the contract for `totalSupply`, compares with `previousSupply`.
 * If newSupply is higher, send a message and save it to file.
 */
function checkAndPost() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\n[LOG] Checking totalSupply from the contract...");
        try {
            const supplyBN = yield contract.totalSupply();
            const newSupply = supplyBN.toNumber();
            console.log(`[LOG] Current totalSupply = ${newSupply}; previousSupply = ${previousSupply}.`);
            // If new lands have been claimed, post an update
            if (newSupply > previousSupply) {
                console.log("[LOG] New lands claimed. Posting message to Telegram chat...");
                previousSupply = newSupply;
                writeSupplyToFile(newSupply);
                const landsLeft = 21000 - newSupply;
                const message = `Lands claimed: ${newSupply}\n` +
                    `Lands left: ${landsLeft}\n\n` +
                    `Claim your lands here: https://zerocolony.fun`;
                yield bot.api.sendMessage(CHAT_ID, message);
                console.log("[LOG] Message sent successfully.");
            }
            else {
                console.log("[LOG] No new lands claimed. No message will be sent.");
            }
        }
        catch (error) {
            console.error("[ERROR] Failed to check totalSupply or post a message:", error);
        }
    });
}
// --- Start the bot (required for grammy) ---
bot.start();
console.log("[LOG] Bot has started.");
// --- Immediately do a check on startup ---
checkAndPost();
// --- Schedule subsequent checks every hour (3600000 ms) ---
setInterval(checkAndPost, 3600000);
console.log("[LOG] Bot will check totalSupply every hour.");
