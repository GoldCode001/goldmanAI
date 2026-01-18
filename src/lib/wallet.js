import CoinbaseWalletSDK from "@coinbase/wallet-sdk";

const APP_NAME = "Goldman AI";
const APP_LOGO_URL = "https://goldmanai.app/logo.png";
const BASE_RPC = "https://mainnet.base.org";

let provider = null;
let walletAddress = null;

export async function initWallet() {
  if (walletAddress) return walletAddress;

  const coinbaseWallet = new CoinbaseWalletSDK({
    appName: APP_NAME,
    appLogoUrl: APP_LOGO_URL,
    darkMode: true
  });

  provider = coinbaseWallet.makeWeb3Provider(BASE_RPC, 8453);

  const accounts = await provider.request({
    method: "eth_requestAccounts"
  });

  walletAddress = accounts[0];
  localStorage.setItem("wallet_address", walletAddress);

  return walletAddress;
}

export function getWalletAddress() {
  return walletAddress || localStorage.getItem("wallet_address");
}
