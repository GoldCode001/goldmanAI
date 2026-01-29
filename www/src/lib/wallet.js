import CoinbaseWalletSDK from "@coinbase/wallet-sdk";
import { Wallet } from "ethers";

const APP_NAME = "Goldman AI";
const APP_LOGO_URL = "https://goldmanai-production.up.railway.app/logo.png";
const BASE_RPC = "https://mainnet.base.org";

let provider = null;
let walletAddress = null;
let invisibleWallet = null;

/**
 * Create or retrieve an invisible wallet (burner wallet) stored in localStorage
 * This allows "non-crypto" users to have a wallet without interactions
 */
export async function createInvisibleWallet() {
  // Check if we already have a private key
  let privateKey = localStorage.getItem("invisible_wallet_pk");

  if (!privateKey) {
    // Generate new random wallet
    const wallet = Wallet.createRandom();
    privateKey = wallet.privateKey;
    localStorage.setItem("invisible_wallet_pk", privateKey);
    console.log("Created new invisible wallet:", wallet.address);
  }

  // Initialize wallet from key
  invisibleWallet = new Wallet(privateKey);
  walletAddress = invisibleWallet.address;
  localStorage.setItem("wallet_address", walletAddress);

  return walletAddress;
}

export async function initWallet() {
  // For now, always use the invisible wallet for seamless experience
  return await createInvisibleWallet();
}

export function getWalletAddress() {
  return walletAddress || localStorage.getItem("wallet_address");
}

export async function signMessage(message) {
  if (!invisibleWallet) await createInvisibleWallet();
  
  if (invisibleWallet) {
    // Sign using local invisible wallet (no popup)
    return await invisibleWallet.signMessage(message);
  }

  // Fallback to provider (if we ever switch back to manual connect)
  if (!provider) throw new Error("Wallet not initialized");
  
  const from = walletAddress;
  if (!from) throw new Error("Wallet not connected");

  const msgHex = `0x${Array.from(message).map(c => c.charCodeAt(0).toString(16)).join('')}`;
  return await provider.request({
    method: "personal_sign",
    params: [msgHex, from]
  });
}
