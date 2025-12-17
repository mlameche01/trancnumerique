// wallet.js — VERSION CORRIGÉE POLYGON

const TOKEN_ADDRESS = "0x7EFd1F12A949ba65f0965A21A427d6cb8D03210c"; // ALG
const RPC = "https://rpc.ankr.com/polygon"; // RPC Polygon stable
const ALG_TO_DZD = 250;

let provider, wallet, token, tokenWithSigner;
let decimals = 18;
let scanner;

/* =========================
   PIN MANAGEMENT
========================= */

window.onload = () => {
  const pin = localStorage.getItem("frn_pin");
  document.getElementById(pin ? "pinLoginBox" : "pinSetupBox").style.display = "block";
};

function saveNewPIN() {
  const pin = document.getElementById("newPin").value.trim();
  if (pin.length < 4) return alert("PIN minimum 4 chiffres");
  localStorage.setItem("frn_pin", pin);
  document.getElementById("pinSetupBox").style.display = "none";
  document.getElementById("walletBox").style.display = "block";
  initWallet();
}

function checkPIN() {
  if (document.getElementById("pinInput").value === localStorage.getItem("frn_pin")) {
    document.getElementById("pinLoginBox").style.display = "none";
    document.getElementById("walletBox").style.display = "block";
    initWallet();
  } else {
    alert("❌ PIN incorrect");
  }
}

/* =========================
   WALLET INIT
========================= */

async function initWallet() {
  provider = new ethers.providers.JsonRpcProvider(RPC);

  let pk = localStorage.getItem("frn_key");
  if (!pk) {
    pk = ethers.Wallet.createRandom().privateKey;
    localStorage.setItem("frn_key", pk);
  }

  wallet = new ethers.Wallet(pk, provider);

  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address,uint256) returns (bool)"
  ];

  token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
  tokenWithSigner = token.connect(wallet);

  document.getElementById("address").innerText = wallet.address;
  document.getElementById("privateKeyBox").value = wallet.privateKey;

  generateQRCode(wallet.address);
  updateBalance();
  loadHistory();
}

/* =========================
   BALANCE
========================= */

async function updateBalance() {
  try {
    const raw = await token.balanceOf(wallet.address);

    try {
      decimals = await token.decimals();
    } catch {
      decimals = 18;
    }

    const alg = parseFloat(
      ethers.utils.formatUnits(raw, decimals)
    );

    document.getElementById("balance").innerText =
      alg.toFixed(4) + " ALG";

    document.getElementById("usdValue").innerText =
      "≈ " + (alg * ALG_TO_DZD).toFixed(2) + " DZD";

  } catch (e) {
    console.error("BALANCE ERROR:", e);
    document.getElementById("balance").innerText =
      "❌ Erreur de lecture";
  }
}

/* =========================
   SEND TOKENS
========================= */

async function sendTokens() {
  const to = document.getElementById("to").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const status = document.getElementById("status");

  if (!ethers.utils.isAddress(to)) return alert("Adresse invalide");
  if (!amount || amount <= 0) return alert("Montant invalide");

  try {
    status.innerText = "⏳ Transaction en cours...";
    const tx = await tokenWithSigner.transfer(
      to,
      ethers.utils.parseUnits(amount, decimals)
    );
    await tx.wait();

    status.innerText = "✅ Transaction confirmée";

    saveToHistory({ to, amount, date: new Date().toLocaleString() });
    updateBalance();
    loadHistory();

  } catch (e) {
    console.error(e);
    status.innerText = "❌ Échec transaction";
  }
}

/* =========================
   HISTORY
========================= */

function saveToHistory(entry) {
  const h = JSON.parse(localStorage.getItem("frn_history") || "[]");
  h.unshift(entry);
  localStorage.setItem("frn_history", JSON.stringify(h.slice(0, 10)));
}

function loadHistory() {
  const h = JSON.parse(localStorage.getItem("frn_history") || "[]");
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  h.forEach(tx => {
    const li = document.createElement("li");
    li.textContent = `${tx.amount} ALG → ${tx.to}`;
    list.appendChild(li);
  });
}

/* =========================
   UI UTILITIES
========================= */

function togglePrivateKey() {
  const box = document.getElementById("privateKeyBox");
  box.style.display = box.style.display === "none" ? "block" : "none";
}

function generateQRCode(address) {
  document.getElementById("qrcode").innerHTML = "";
  new QRCode("qrcode", {
    text: address,
    width: 128,
    height: 128
  });
}
