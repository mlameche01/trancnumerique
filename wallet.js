// wallet.js
const TOKEN_ADDRESS = "0x64e73E00a9d37188C0e25EC5cfdDCD856Ad7a77D";
const RPC = "https://mainnet.xo-dex.com/rpc";
const FRN_TO_DZD = 120; // 1 FRN = 120 DZD

let provider, wallet, signer, token, decimals = 18;
let scanner;

window.onload = () => {
  const pin = localStorage.getItem("frn_pin");
  if (pin) {
    document.getElementById("pinLoginBox").style.display = "block";
  } else {
    document.getElementById("pinSetupBox").style.display = "block";
  }
};

function saveNewPIN() {
  const pin = document.getElementById("newPin").value.trim();
  if (pin.length < 4) return alert("Le code PIN doit contenir au moins 4 chiffres");
  localStorage.setItem("frn_pin", pin);
  document.getElementById("pinSetupBox").style.display = "none";
  document.getElementById("walletBox").style.display = "block";
  initWallet();
}

function checkPIN() {
  const entered = document.getElementById("pinInput").value;
  const saved = localStorage.getItem("frn_pin");
  if (entered === saved) {
    document.getElementById("pinLoginBox").style.display = "none";
    document.getElementById("walletBox").style.display = "block";
    initWallet();
  } else {
    alert("❌ Code PIN incorrect");
  }
}

async function initWallet() {
  provider = new ethers.providers.JsonRpcProvider(RPC);
  const savedPK = localStorage.getItem("frn_key");
  wallet = savedPK ? new ethers.Wallet(savedPK) : ethers.Wallet.createRandom();
  if (!savedPK) localStorage.setItem("frn_key", wallet.privateKey);
  signer = wallet.connect(provider);

  token = new ethers.Contract(TOKEN_ADDRESS, [
    { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" },
    { constant: false, inputs: [{ name: "_to", type: "address" }, { name: "_value", type: "uint256" }], name: "transfer", outputs: [{ name: "success", type: "bool" }], type: "function" },
    { constant: true, inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], type: "function" }
  ], signer);

  document.getElementById("address").innerText = wallet.address;
  document.getElementById("privateKeyBox").value = wallet.privateKey;
  generateQRCode(wallet.address);
  loadHistory();
  updateBalance();
}

async function updateBalance() {
  try {
    decimals = await token.decimals();
    const raw = await token.balanceOf(wallet.address);
    const frn = parseFloat(ethers.utils.formatUnits(raw, decimals));
    document.getElementById("balance").innerText = frn.toFixed(4) + " FRN";

    const dzdValue = frn * FRN_TO_DZD;
    document.getElementById("usdValue").innerText = "≈ " + dzdValue.toFixed(2) + " DZD";
  } catch (err) {
    document.getElementById("balance").innerText = "Erreur de lecture";
    console.error(err);
  }
}

function togglePrivateKey() {
  const box = document.getElementById("privateKeyBox");
  box.style.display = box.style.display === "none" ? "block" : "none";
}

async function sendTokens() {
  const to = document.getElementById("to").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const status = document.getElementById("status");

  if (!ethers.utils.isAddress(to)) return alert("Adresse invalide");
  if (!to || !amount) return alert("Adresse et montant requis");

  try {
    const tx = await token.transfer(to, ethers.utils.parseUnits(amount, decimals));
    status.innerText = "⏳ Envoi en cours...";
    await tx.wait();
    status.innerText = "✅ Envoyé avec succès !";
    saveToHistory({ to, amount, date: new Date().toLocaleString() });
    updateBalance();
    loadHistory();
  } catch (err) {
    status.innerText = "❌ Erreur: " + err.message;
    console.error(err);
  }
}

function saveToHistory(entry) {
  const history = JSON.parse(localStorage.getItem("frn_history") || "[]");
  history.unshift(entry);
  localStorage.setItem("frn_history", JSON.stringify(history.slice(0, 10)));
}

function loadHistory() {
  const history = JSON.parse(localStorage.getItem("frn_history") || "[]");
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  history.forEach(h => {
    const li = document.createElement("li");
    li.textContent = `Envoyé ${h.amount} FRN à ${h.to} le ${h.date}`;
    list.appendChild(li);
  });
}

function generateQRCode(address) {
  const qrContainer = document.getElementById("qrcode");
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: address,
    width: 128,
    height: 128,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function startScanner() {
  const reader = document.getElementById("reader");
  reader.style.display = "block";

  if (scanner) {
    scanner.stop().then(() => {
      scanner.clear();
      runScanner();
    });
  } else {
    runScanner();
  }
}

function runScanner() {
  scanner = new Html5Qrcode("reader");
  scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      if (ethers.utils.isAddress(decodedText.trim())) {
        document.getElementById("to").value = decodedText.trim();
        scanner.stop().then(() => {
          document.getElementById("reader").style.display = "none";
          scanner.clear();
          scanner = null;
        });
      } else {
        alert("QR Code invalide : pas une adresse Ethereum");
      }
    },
    (err) => {}
  ).catch(err => {
    alert("Erreur accès caméra : " + err);
  });
}
