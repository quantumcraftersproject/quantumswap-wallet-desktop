const {
    app,
    protocol,
    BrowserWindow,
    session,
    ipcMain,
    Menu,
    clipboard,
    shell
} = require("electron");

const path = require('path');
const sjcl = require('sjcl');
const fs = require('fs');
const readline = require('readline');
const { ethers } = require('ethers');
const { utils, BigNumber, message } = require('ethers');
const crypto = require('crypto');
const AES_ALGORITHM = 'aes-256-cbc';

const additionalData = { myKey: 'myValue' }
const gotTheLock = app.requestSingleInstanceLock(additionalData)
var startFilename = "index.html";
let currentWindow;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 625,
      height: 800,
      webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: false,
          nodeIntegrationInWorker: false,
          nodeIntegrationInSubFrames: false,
          contextIsolation: true,
          enableRemoteModule: false,
      },
      autoHideMenuBar: true
  });

  currentWindow = mainWindow;

  // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, startFilename));

  // Open the DevTools.
    mainWindow.webContents.openDevTools();

    if (process.platform === 'win32') {
        app.setAppUserModelId('Quantum Coin Wallet');
    }
};

if (!gotTheLock) {
    startFilename = 'instance.html';
} else {
    app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
        // Someone tried to run a second instance, we should focus our window.
        if (currentWindow) {
            if (currentWindow.isMinimized()) {
                currentWindow.restore();
            }
            currentWindow.focus();
        }
    })
}

app.whenReady().then(() => {
    createWindow();
    
    app.on('activate', () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
//app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


ipcMain.handle('AppApiGetVersion', async (event, data) => {
    return app.getVersion();
})


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.handle('ClipboardWriteText', async (event, data) => {
    clipboard.writeText(data);
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.handle('OpenUrlInShell', async (event, data) => {
    shell.openExternal(data);
})

ipcMain.handle('FileApiReadFile', async (event, data) => {
    let filename = path.join(__dirname, data);

    if (fs == null || fs == undefined) {
        return null;
    }

    return fs.readFileSync(filename).toString();
})

ipcMain.handle('EthersApiPhraseToWallets', async (event, data) => {   
    const wallestList = [];
    const mnemonic = ethers.Mnemonic.fromPhrase(data);
    for (let index = 0; index < 100; index++) {
        const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
        wallestList.push(wallet);
    }

    return wallestList;
})

ipcMain.handle('EthersApiPhraseToKeyPairs', async (event, data) => {
    const keyList = [];
    const mnemonic = ethers.Mnemonic.fromPhrase(data);
    for (let index = 0; index < 100; index++) {
        const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
        const keyPair = {
            privateKey: wallet.privateKey,
            publicKey: wallet.publicKey
        }
        keyList.push(keyPair);
    }

    return keyList;
})

ipcMain.handle('EthersApiSignMessageWithPhrase', async (event, data) => {
    const mnemonic = ethers.Mnemonic.fromPhrase(data.phrase)
    const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${data.index}`);
    let sig = await wallet.signMessage(data.message);
    return sig;
})

ipcMain.handle('EthersApiWalletFromKey', async (event, data) => {
    let wallet = new ethers.Wallet(data);
    return wallet;
})

ipcMain.handle('EthersApiSignMessageWithKey', async (event, data) => {
    let wallet = new ethers.Wallet(data.key);
    let sig = await wallet.signMessage(data.message);
    return sig;
})

ipcMain.handle('EthersApiKeyStoreAccountFromJson', async (event, data) => {
    let keyStoreAccount = ethers.decryptKeystoreJsonSync(data.json, data.password);
    return keyStoreAccount;
})

ipcMain.handle('EthersApiVerify', async (event, data) => {
    try {
        const signerAddr = await ethers.verifyMessage(data.message, data.signature);
        if (signerAddr.toString().toLowerCase() !== data.address.toString().toLowerCase()) {
            return false;
        }
        return true;
    } catch (err) {
        return false;
    }
})

function base64ToBytes(base64) {
    const binString = atob(base64);
    return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

function bytesToBase64(bytes) {
    const binString = Array.from(bytes, (byte) =>
        String.fromCodePoint(byte),
    ).join("");
    return btoa(binString);
}

ipcMain.handle('StorageApiGetPath', async (event, data) => {
    return require('electron').app.getPath('userData');
})

ipcMain.handle('CryptoApiEncrypt', async (event, data) => {
    const aesKey = base64ToBytes(data.key);
    const aesIV = base64ToBytes(data.iv);

    const cipher = crypto.createCipheriv(AES_ALGORITHM, aesKey, aesIV);
    let cipherText = cipher.update(data.plainText, 'utf8', 'base64');
    cipherText += cipher.final('base64');

    return cipherText;
})

ipcMain.handle('CryptoApiDecrypt', async (event, data) => {
    const aesKey = base64ToBytes(data.key);
    const aesIV = base64ToBytes(data.iv);

    const decipher = crypto.createDecipheriv(AES_ALGORITHM, aesKey, aesIV);
    let plainText = decipher.update(data.cipherText, 'base64', 'utf8');
    plainText += decipher.final();

    return plainText;
})

ipcMain.handle('CryptoApiScrypt', async (event, data) => {
    const salt = base64ToBytes(data.salt);

    return crypto.scryptSync(data.secret, salt, 32, { N: 16384, p: 1, r: 8 });
})

ipcMain.handle('FormatApiEtherToWei', async (event, data) => {
    const etherAmount = ethers.parseUnits(data, "ether")
    return etherAmount;
})

ipcMain.handle('FormatApiWeiToEther', async (event, data) => {
    const etherAmount = ethers.formatEther(data)
    return etherAmount;
})

ipcMain.handle('FormatApiWeiToEtherCommified', async (event, data) => {
    const etherAmount = ethers.formatEther(data)
    return etherAmount.toLocaleString();
})

ipcMain.handle('FormatApiIsValidEther', async (event, data) => {
    try {
        if (data.startsWith("0")) {
            return false;
        }
        const number = ethers.FixedNumber.fromString(data);
        let isNegative = number.isNegative();
        return !isNegative;
    }
    catch (error) {
        return false;
    }
})

ipcMain.handle('FormatApiCompareEther', async (event, data) => {
    try {
        const number1 = ethers.FixedNumber.fromString(data.num1.replaceAll(",", ""));
        const number2 = ethers.FixedNumber.fromString(data.num2.replaceAll(",", ""));
        if (number1.isNegative() || number2.isNegative()) {
            throw new Error("error parsing numbers. negative values.");
        }

        if (number1.eq(number2)) {
            return 0;
        } else if (number1.gt(number2)) {
            return 1;
        } else {
            return -1;
        }
    }
    catch (error) {
        throw new Error("error parsing numbers");
    }
})

// Swap quote: QuantumCoin + QuantumSwap SDKs (Test Release Dec 2025 addresses)
const SWAP_WQ_CONTRACT_ADDRESS = "0x80d5866b054028aef6b8519b451bec113c07077c67aa01496e91d3d21161af50";
const SWAP_FACTORY_CONTRACT_ADDRESS = "0x6202be3cb1646a4f9ffda104aad4cb901a7ab414a89ade12ce2151b46ad241cf";
const SWAP_ROUTER_V2_CONTRACT_ADDRESS = "0xd62870a65193504674ac9bbbc001b7d333f91e477193b7f88bfbccd8e3eea182";

function buildSwapRpcUrl(rpcEndpoint) {
    if (!rpcEndpoint || typeof rpcEndpoint !== "string") return null;
    const s = rpcEndpoint.trim();
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    const isIpAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(s);
    const isLocalhost = /^localhost(:\d+)?$/i.test(s);
    return (isIpAddress || isLocalhost ? "http://" : "https://") + s;
}

ipcMain.handle('SwapQuoteGetAmountsOut', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, parseUnits, formatUnits, getAddress } = require("quantumcoin");
        const { QuantumSwapV2Router02 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, error: "Invalid chain ID" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const router = QuantumSwapV2Router02.connect(SWAP_ROUTER_V2_CONTRACT_ADDRESS, provider);

        const fromAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const toAddr = data.toTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.toTokenValue;
        const path = [getAddress(fromAddr), getAddress(toAddr)];

        const fromDecimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const toDecimals = typeof data.toDecimals === "number" ? data.toDecimals : 18;
        const amountInWei = parseUnits(String(data.amountIn), fromDecimals);

        const amounts = await router.getAmountsOut(amountInWei, path);
        const amountOutWei = Array.isArray(amounts) ? amounts[amounts.length - 1] : amounts;
        const amountOut = formatUnits(amountOutWei, toDecimals);

        return { success: true, amountOut };
    } catch (err) {
        return { success: false, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapQuoteCheckPairExists', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, getAddress, ZeroAddress } = require("quantumcoin");
        const { QuantumSwapV2Factory } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { exists: false, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { exists: false, error: "Invalid chain ID" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const factory = QuantumSwapV2Factory.connect(SWAP_FACTORY_CONTRACT_ADDRESS, provider);

        const tokenA = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const tokenB = data.toTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.toTokenValue;
        const pairAddr = await factory.getPair(getAddress(tokenA), getAddress(tokenB));
        const pairAddrStr = typeof pairAddr === "string" ? pairAddr : (pairAddr && pairAddr.toString ? pairAddr.toString() : String(pairAddr));
        const zeroAddr = ZeroAddress || "0x0000000000000000000000000000000000000000000000000000000000000000";
        const exists = !!(pairAddrStr && pairAddrStr !== zeroAddr && pairAddrStr !== "0x" + "0".repeat(64));

        return { exists, error: null };
    } catch (err) {
        return { exists: false, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapQuoteGetAmountsIn', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, parseUnits, formatUnits, getAddress } = require("quantumcoin");
        const { QuantumSwapV2Router02 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, error: "Invalid chain ID" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const router = QuantumSwapV2Router02.connect(SWAP_ROUTER_V2_CONTRACT_ADDRESS, provider);

        const fromAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const toAddr = data.toTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.toTokenValue;
        const path = [getAddress(fromAddr), getAddress(toAddr)];

        const fromDecimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const toDecimals = typeof data.toDecimals === "number" ? data.toDecimals : 18;
        const amountOutWei = parseUnits(String(data.amountOut), toDecimals);

        const amounts = await router.getAmountsIn(amountOutWei, path);
        const amountInWei = Array.isArray(amounts) ? amounts[0] : amounts;
        const amountIn = formatUnits(amountInWei, fromDecimals);

        return { success: true, amountIn };
    } catch (err) {
        return { success: false, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapQuoteEstimateGas', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, parseUnits, getAddress } = require("quantumcoin");
        const { QuantumSwapV2Router02 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, gasLimit: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, gasLimit: null, error: "Invalid chain ID" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const router = QuantumSwapV2Router02.connect(SWAP_ROUTER_V2_CONTRACT_ADDRESS, provider);

        const fromAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const toAddr = data.toTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.toTokenValue;
        const path = [getAddress(fromAddr), getAddress(toAddr)];
        const fromDecimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const toDecimals = typeof data.toDecimals === "number" ? data.toDecimals : 18;
        const toAddress = data.recipientAddress || data.toAddress;
        if (!toAddress) return { success: false, gasLimit: null, error: "Recipient address required" };
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
        const lastChanged = data.lastChanged === "to" ? "to" : "from";
        const slippagePercent = Math.max(0, Math.min(100, Number(data.slippagePercent) || 1));

        let amountInWei;
        let amountOutMinWei;
        if (lastChanged === "to") {
            const amountOutWei = parseUnits(String(data.amountOut), toDecimals);
            const amountsIn = await router.getAmountsIn(amountOutWei, path);
            amountInWei = Array.isArray(amountsIn) ? amountsIn[0] : amountsIn;
            amountOutMinWei = (amountOutWei * BigInt(100 - slippagePercent)) / 100n;
        } else {
            amountInWei = parseUnits(String(data.amountIn), fromDecimals);
            const amountsOut = await router.getAmountsOut(amountInWei, path);
            const expectedAmountOutWei = Array.isArray(amountsOut) ? amountsOut[amountsOut.length - 1] : amountsOut;
            amountOutMinWei = (expectedAmountOutWei * BigInt(100 - slippagePercent)) / 100n;
        }
        const tx = await router.populateTransaction.swapExactTokensForTokens(
            amountInWei,
            amountOutMinWei,
            path,
            getAddress(toAddress),
            deadline
        );
        const txWithFrom = { ...tx, from: getAddress(toAddress) };
        const gasLimit = await provider.estimateGas(txWithFrom);
        const gasLimitStr = typeof gasLimit === "bigint" ? gasLimit.toString() : String(gasLimit);
        return { success: true, gasLimit: gasLimitStr, error: null };
    } catch (err) {
        return { success: false, gasLimit: null, error: (err && err.message) ? err.message : String(err) };
    }
});

// Strip locale formatting (e.g. commas) so parseUnits gets a valid numeric string
function normalizeAmountString(value) {
    if (value == null) return "0";
    return String(value).replace(/,/g, "").trim() || "0";
}

ipcMain.handle('SwapQuoteCheckAllowance', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, parseUnits, getAddress } = require("quantumcoin");
        const { IERC20 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, sufficient: false, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, sufficient: false, error: "Invalid chain ID" };
        if (!data.ownerAddress) return { success: false, sufficient: false, error: "Owner address required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const tokenAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const spenderAddr = SWAP_ROUTER_V2_CONTRACT_ADDRESS;
        const decimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const requiredWei = parseUnits(normalizeAmountString(data.requiredAmount), decimals);
        const token = IERC20.connect(getAddress(tokenAddr), provider);
        let allowanceWei;
        if (typeof token.allowance !== "function") {
            allowanceWei = 0n;
        } else {
            try {
                allowanceWei = await token.allowance(getAddress(data.ownerAddress), getAddress(spenderAddr));
            } catch (allowanceErr) {
                allowanceWei = 0n;
            }
        }
        const allowanceStr = typeof allowanceWei === "bigint" ? allowanceWei.toString() : String(allowanceWei);
        const sufficient = (typeof allowanceWei === "bigint" ? allowanceWei : BigInt(allowanceStr)) >= requiredWei;
        return { success: true, sufficient, allowance: allowanceStr, error: null };
    } catch (err) {
        return { success: false, sufficient: false, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapQuoteEstimateApproveGas', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, parseUnits, getAddress } = require("quantumcoin");
        const { IERC20 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, gasLimit: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, gasLimit: null, error: "Invalid chain ID" };
        if (!data.fromAddress) return { success: false, gasLimit: null, error: "From address required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const tokenAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const spenderAddr = SWAP_ROUTER_V2_CONTRACT_ADDRESS;
        const decimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const amountWei = parseUnits(normalizeAmountString(data.amount), decimals);

        const token = IERC20.connect(getAddress(tokenAddr), provider);
        const tx = await token.populateTransaction.approve(getAddress(spenderAddr), amountWei);
        const txWithFrom = { ...tx, from: getAddress(data.fromAddress) };
        const gasLimit = await provider.estimateGas(txWithFrom);
        const gasLimitStr = typeof gasLimit === "bigint" ? gasLimit.toString() : String(gasLimit);
        return { success: true, gasLimit: gasLimitStr, error: null };
    } catch (err) {
        return { success: false, gasLimit: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapQuoteGetRouterAddress', async () => {
    return { success: true, routerAddress: SWAP_ROUTER_V2_CONTRACT_ADDRESS, error: null };
});

ipcMain.handle('SwapQuoteGetSwapContractData', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, parseUnits, getAddress } = require("quantumcoin");
        const { QuantumSwapV2Router02 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, dataHex: null, toAddress: null, valueHex: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, dataHex: null, toAddress: null, valueHex: null, error: "Invalid chain ID" };
        const toAddress = data.recipientAddress || data.toAddress;
        if (!toAddress) return { success: false, dataHex: null, toAddress: null, valueHex: null, error: "Recipient address required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const router = QuantumSwapV2Router02.connect(SWAP_ROUTER_V2_CONTRACT_ADDRESS, provider);

        const fromAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const toAddr = data.toTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.toTokenValue;
        const path = [getAddress(fromAddr), getAddress(toAddr)];
        const fromDecimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const toDecimals = typeof data.toDecimals === "number" ? data.toDecimals : 18;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
        const lastChanged = data.lastChanged === "to" ? "to" : "from";
        const slippagePercent = Math.max(0, Math.min(100, Number(data.slippagePercent) || 1));

        let amountInWei;
        let amountOutMinWei;
        if (lastChanged === "to") {
            const amountOutWei = parseUnits(String(data.amountOut), toDecimals);
            const amountsIn = await router.getAmountsIn(amountOutWei, path);
            amountInWei = Array.isArray(amountsIn) ? amountsIn[0] : amountsIn;
            amountOutMinWei = (amountOutWei * BigInt(100 - slippagePercent)) / 100n;
        } else {
            amountInWei = parseUnits(String(data.amountIn), fromDecimals);
            const amountsOut = await router.getAmountsOut(amountInWei, path);
            const expectedAmountOutWei = Array.isArray(amountsOut) ? amountsOut[amountsOut.length - 1] : amountsOut;
            amountOutMinWei = (expectedAmountOutWei * BigInt(100 - slippagePercent)) / 100n;
        }
        const tx = await router.populateTransaction.swapExactTokensForTokens(
            amountInWei,
            amountOutMinWei,
            path,
            getAddress(toAddress),
            deadline
        );
        const dataHex = tx && tx.data ? (typeof tx.data === "string" ? tx.data : String(tx.data)) : null;
        if (!dataHex) return { success: false, dataHex: null, toAddress: null, valueHex: null, error: "No contract data" };
        const valueHex = tx.value != null && tx.value !== 0n ? "0x" + tx.value.toString(16) : "0x0";
        return { success: true, dataHex, toAddress: SWAP_ROUTER_V2_CONTRACT_ADDRESS, valueHex, error: null };
    } catch (err) {
        return { success: false, dataHex: null, toAddress: null, valueHex: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapSubmitApproval', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, Wallet, parseUnits, getAddress } = require("quantumcoin");
        const { IERC20 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, txHash: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txHash: null, error: "Invalid chain ID" };
        if (!data.privateKey || !data.publicKey) return { success: false, txHash: null, error: "Wallet keys required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes, provider);

        const tokenAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const decimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const amountWei = parseUnits(normalizeAmountString(data.amount), decimals);
        const gasLimit = Number(data.gasLimit) || 84000;

        const token = IERC20.connect(getAddress(tokenAddr), wallet);
        const tx = await token.approve(getAddress(SWAP_ROUTER_V2_CONTRACT_ADDRESS), amountWei, { gasLimit });
        return { success: true, txHash: tx.hash, error: null };
    } catch (err) {
        return { success: false, txHash: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapSubmitSwap', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, Wallet, parseUnits, getAddress } = require("quantumcoin");
        const { QuantumSwapV2Router02 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, txHash: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txHash: null, error: "Invalid chain ID" };
        const recipientAddress = data.recipientAddress;
        if (!recipientAddress) return { success: false, txHash: null, error: "Recipient address required" };
        if (!data.privateKey || !data.publicKey) return { success: false, txHash: null, error: "Wallet keys required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes, provider);

        const router = QuantumSwapV2Router02.connect(SWAP_ROUTER_V2_CONTRACT_ADDRESS, wallet);
        const fromAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const toAddr = data.toTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.toTokenValue;
        const path = [getAddress(fromAddr), getAddress(toAddr)];
        const fromDecimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const toDecimals = typeof data.toDecimals === "number" ? data.toDecimals : 18;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
        const lastChanged = data.lastChanged === "to" ? "to" : "from";
        const slippagePercent = Math.max(0, Math.min(100, Number(data.slippagePercent) || 1));
        const gasLimit = Number(data.gasLimit) || 200000;

        let amountInWei;
        let amountOutMinWei;
        if (lastChanged === "to") {
            const amountOutWei = parseUnits(String(data.amountOut), toDecimals);
            const amountsIn = await router.getAmountsIn(amountOutWei, path);
            amountInWei = Array.isArray(amountsIn) ? amountsIn[0] : amountsIn;
            amountOutMinWei = (amountOutWei * BigInt(100 - slippagePercent)) / 100n;
        } else {
            amountInWei = parseUnits(String(data.amountIn), fromDecimals);
            const amountsOut = await router.getAmountsOut(amountInWei, path);
            const expectedAmountOutWei = Array.isArray(amountsOut) ? amountsOut[amountsOut.length - 1] : amountsOut;
            amountOutMinWei = (expectedAmountOutWei * BigInt(100 - slippagePercent)) / 100n;
        }

        const tx = await router.swapExactTokensForTokens(
            amountInWei,
            amountOutMinWei,
            path,
            getAddress(recipientAddress),
            deadline,
            { gasLimit }
        );
        return { success: true, txHash: tx.hash, error: null };
    } catch (err) {
        return { success: false, txHash: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapSubmitRemoveAllowance', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, Wallet, getAddress } = require("quantumcoin");
        const { IERC20 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, txHash: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txHash: null, error: "Invalid chain ID" };
        if (!data.privateKey || !data.publicKey) return { success: false, txHash: null, error: "Wallet keys required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes, provider);

        const tokenAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const gasLimit = Number(data.gasLimit) || 84000;

        const token = IERC20.connect(getAddress(tokenAddr), wallet);
        const tx = await token.approve(getAddress(SWAP_ROUTER_V2_CONTRACT_ADDRESS), 0n, { gasLimit });
        return { success: true, txHash: tx.hash, error: null };
    } catch (err) {
        return { success: false, txHash: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapSubmitAddAllowance', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, Wallet, parseUnits, getAddress } = require("quantumcoin");
        const { IERC20 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, txHash: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txHash: null, error: "Invalid chain ID" };
        if (!data.privateKey || !data.publicKey) return { success: false, txHash: null, error: "Wallet keys required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes, provider);

        const tokenAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const decimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const amountWei = parseUnits(normalizeAmountString(data.amount), decimals);
        const gasLimit = Number(data.gasLimit) || 84000;

        const token = IERC20.connect(getAddress(tokenAddr), wallet);
        const tx = await token.approve(getAddress(SWAP_ROUTER_V2_CONTRACT_ADDRESS), amountWei, { gasLimit });
        return { success: true, txHash: tx.hash, error: null };
    } catch (err) {
        return { success: false, txHash: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SwapQuoteGetApproveContractData', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, parseUnits, getAddress } = require("quantumcoin");
        const { IERC20 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, dataHex: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, dataHex: null, error: "Invalid chain ID" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const tokenAddr = data.fromTokenValue === "Q" ? SWAP_WQ_CONTRACT_ADDRESS : data.fromTokenValue;
        const spenderAddr = SWAP_ROUTER_V2_CONTRACT_ADDRESS;
        const decimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const amountWei = parseUnits(normalizeAmountString(data.amount), decimals);

        const token = IERC20.connect(getAddress(tokenAddr), provider);
        const tx = await token.populateTransaction.approve(getAddress(spenderAddr), amountWei);
        const dataHex = tx && tx.data ? (typeof tx.data === "string" ? tx.data : String(tx.data)) : null;
        if (!dataHex) return { success: false, dataHex: null, tokenAddress: null, error: "No contract data" };
        return { success: true, dataHex, tokenAddress: tokenAddr, error: null };
    } catch (err) {
        return { success: false, dataHex: null, tokenAddress: null, error: (err && err.message) ? err.message : String(err) };
    }
});
