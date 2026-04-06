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
const { parseEther, formatEther, FixedNumber } = require("quantumcoin");
const crypto = require('crypto');
const AES_ALGORITHM = 'aes-256-cbc';

function signingOverrides(wallet, data, base) {
    const fullSign = data && data.advancedSigningEnabled === true;
    return { ...base, signingContext: wallet.getSigningContext(fullSign) };
}

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

ipcMain.handle('CryptoRandomBytes', async (event, data) => {
    const size = Number(data);
    if (!Number.isInteger(size) || size < 1 || size > 1024) {
        throw new Error("CryptoRandomBytes: invalid size");
    }
    const buf = crypto.randomBytes(size);
    return bytesToBase64(new Uint8Array(buf));
})

ipcMain.handle('WalletFromSeed', async (event, data) => {
    const { Initialize } = require("quantumcoin/config");
    const { Wallet } = require("quantumcoin");

    await Initialize(null);
    const seedNumbers = Array.from(data.seed);
    const wallet = Wallet.fromSeed(seedNumbers);
    const privBytes = wallet.signingKey.privateKeyBytes;
    const pubBytes = wallet.signingKey.publicKeyBytes;
    return {
        address: wallet.address,
        privateKey: bytesToBase64(privBytes),
        publicKey: bytesToBase64(pubBytes)
    };
})

ipcMain.handle('WalletEncryptJson', async (event, data) => {
    const { Initialize } = require("quantumcoin/config");
    const { Wallet } = require("quantumcoin");

    await Initialize(null);
    const privBytes = Buffer.from(data.privateKey, "base64");
    const pubBytes = Buffer.from(data.publicKey, "base64");
    const wallet = Wallet.fromKeys(privBytes, pubBytes);
    return wallet.encryptSync(data.passphrase);
})

ipcMain.handle('WalletDecryptJson', async (event, data) => {
    const { Initialize } = require("quantumcoin/config");
    const { Wallet } = require("quantumcoin");

    await Initialize(null);
    const wallet = Wallet.fromEncryptedJsonSync(data.json, data.passphrase);
    const privBytes = wallet.signingKey.privateKeyBytes;
    const pubBytes = wallet.signingKey.publicKeyBytes;
    return {
        address: wallet.address,
        privateKey: bytesToBase64(privBytes),
        publicKey: bytesToBase64(pubBytes)
    };
})

ipcMain.handle('ComputeAddress', async (event, data) => {
    const { Initialize } = require("quantumcoin/config");
    const { computeAddress } = require("quantumcoin");

    await Initialize(null);
    const pubBytes = Buffer.from(data, "base64");
    return computeAddress(pubBytes);
})

ipcMain.handle('IsValidAddress', async (event, data) => {
    const { Initialize } = require("quantumcoin/config");
    const { isAddress } = require("quantumcoin");

    await Initialize(null);
    return isAddress(data);
})

ipcMain.handle('ScryptDerive', async (event, data) => {
    const { scryptSync } = require("quantumcoin");

    const passwordBytes = new Uint8Array(Buffer.from(data.secret, "utf8"));
    const saltBytes = base64ToBytes(data.salt);
    const hexKey = scryptSync(passwordBytes, saltBytes, 262144, 8, 1, 32);
    const keyBytes = Buffer.from(hexKey.startsWith("0x") ? hexKey.slice(2) : hexKey, "hex");
    return bytesToBase64(new Uint8Array(keyBytes));
})

ipcMain.handle('FormatApiEtherToWei', async (event, data) => {
    const etherAmount = parseEther(data)
    return etherAmount;
})

ipcMain.handle('FormatApiWeiToEther', async (event, data) => {
    const etherAmount = formatEther(data)
    return etherAmount;
})

ipcMain.handle('FormatApiWeiToEtherCommified', async (event, data) => {
    const etherAmount = formatEther(data)
    return etherAmount.toLocaleString();
})

ipcMain.handle('FormatApiIsValidEther', async (event, data) => {
    try {
        if (data.startsWith("0")) {
            return false;
        }
        const number = FixedNumber.fromString(data);
        let isNegative = number.isNegative();
        return !isNegative;
    }
    catch (error) {
        return false;
    }
})

ipcMain.handle('FormatApiCompareEther', async (event, data) => {
    try {
        const number1 = FixedNumber.fromString(data.num1.replaceAll(",", ""));
        const number2 = FixedNumber.fromString(data.num2.replaceAll(",", ""));
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
const SWAP_WQ_CONTRACT_ADDRESS = "0x0E49c26cd1ca19bF8ddA2C8985B96783288458754757F4C9E00a5439A7291628";
const SWAP_FACTORY_CONTRACT_ADDRESS = "0xbbF45a1B60044669793B444eD01Eb33e03Bb8cf3c5b6ae7887B218D05C5Cbf1d";
const SWAP_ROUTER_V2_CONTRACT_ADDRESS = "0x41323EF72662185f44a03ea0ad8094a0C9e925aB1102679D8e957e838054aac5";

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
        const tx = await token.approve(getAddress(SWAP_ROUTER_V2_CONTRACT_ADDRESS), amountWei, signingOverrides(wallet, data, { gasLimit }));
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
            signingOverrides(wallet, data, { gasLimit })
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
        const tx = await token.approve(getAddress(SWAP_ROUTER_V2_CONTRACT_ADDRESS), 0n, signingOverrides(wallet, data, { gasLimit }));
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
        const tx = await token.approve(getAddress(SWAP_ROUTER_V2_CONTRACT_ADDRESS), amountWei, signingOverrides(wallet, data, { gasLimit }));
        return { success: true, txHash: tx.hash, error: null };
    } catch (err) {
        return { success: false, txHash: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('OfflineSignCoinTransaction', async (event, data) => {
    try {
        const { Initialize } = require("quantumcoin/config");
        const { Wallet, parseUnits, getAddress } = require("quantumcoin");

        if (!data.privateKey || !data.publicKey) return { success: false, txData: null, error: "Wallet keys required" };
        if (!data.toAddress) return { success: false, txData: null, error: "Recipient address required" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txData: null, error: "Invalid chain ID" };
        const nonce = Number(data.nonce);
        if (!Number.isInteger(nonce) || nonce < 0) return { success: false, txData: null, error: "Invalid nonce" };

        await Initialize(null);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes);

        const valueWei = parseUnits(normalizeAmountString(data.amount), 18);
        const gasLimit = Number(data.gasLimit) || 21000;

        const txData = await wallet.signTransaction(signingOverrides(wallet, data, {
            to: getAddress(data.toAddress),
            value: valueWei,
            nonce: nonce,
            chainId: chainId,
            gasLimit: gasLimit
        }));
        return { success: true, txData: txData, error: null };
    } catch (err) {
        return { success: false, txData: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('OfflineSignTokenTransaction', async (event, data) => {
    try {
        const { Initialize } = require("quantumcoin/config");
        const { Wallet, parseUnits, getAddress } = require("quantumcoin");
        const { IERC20 } = require("quantumswap");

        if (!data.privateKey || !data.publicKey) return { success: false, txData: null, error: "Wallet keys required" };
        if (!data.toAddress) return { success: false, txData: null, error: "Recipient address required" };
        if (!data.contractAddress) return { success: false, txData: null, error: "Token contract address required" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txData: null, error: "Invalid chain ID" };
        const nonce = Number(data.nonce);
        if (!Number.isInteger(nonce) || nonce < 0) return { success: false, txData: null, error: "Invalid nonce" };

        await Initialize(null);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes);

        const decimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const amountWei = parseUnits(normalizeAmountString(data.amount), decimals);
        const gasLimit = Number(data.gasLimit) || 84000;

        const token = IERC20.connect(getAddress(data.contractAddress), wallet);
        const txReq = await token.populateTransaction.transfer(getAddress(data.toAddress), amountWei, signingOverrides(wallet, data, { gasLimit }));

        const txData = await wallet.signTransaction(signingOverrides(wallet, data, {
            ...txReq,
            nonce: nonce,
            chainId: chainId
        }));
        return { success: true, txData: txData, error: null };
    } catch (err) {
        return { success: false, txData: null, error: (err && err.message) ? err.message : String(err) };
    }
});

const STAKING_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000001000";
const STAKING_ABI_JSON = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":true,"internalType":"address","name":"oldValidatorAddress","type":"address"},{"indexed":true,"internalType":"address","name":"newValidatorAddress","type":"address"}],"name":"OnChangeValidator","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"withdrawalQuantity","type":"uint256"}],"name":"OnCompletePartialWithdrawal","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"netBalance","type":"uint256"}],"name":"OnCompleteWithdrawal","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"oldBalance","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newBalance","type":"uint256"}],"name":"OnIncreaseDeposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"withdrawalBlock","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"withdrawalQuantity","type":"uint256"}],"name":"OnInitiatePartialWithdrawal","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":true,"internalType":"address","name":"validatorAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"blockNumber","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"blockTime","type":"uint256"}],"name":"OnNewDeposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":false,"internalType":"address","name":"validatorAddress","type":"address"}],"name":"OnPauseValidation","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":false,"internalType":"address","name":"validatorAddress","type":"address"}],"name":"OnResumeValidation","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"rewardAmount","type":"uint256"}],"name":"OnReward","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositorAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"slashedAmount","type":"uint256"}],"name":"OnSlashing","type":"event"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"},{"internalType":"uint256","name":"rewardAmount","type":"uint256"}],"name":"addDepositorReward","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"},{"internalType":"uint256","name":"slashAmount","type":"uint256"}],"name":"addDepositorSlashing","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newValidatorAddress","type":"address"}],"name":"changeValidator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"completePartialWithdrawal","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"completeWithdrawal","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"}],"name":"didDepositorEverExist","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"validatorAddress","type":"address"}],"name":"didValidatorEverExist","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"}],"name":"doesDepositorExist","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"validatorAddress","type":"address"}],"name":"doesValidatorExist","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"}],"name":"getBalanceOfDepositor","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getDepositorCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"validatorAddress","type":"address"}],"name":"getDepositorOfValidator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"}],"name":"getDepositorRewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"}],"name":"getDepositorSlashings","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"}],"name":"getNetBalanceOfDepositor","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"validatorAddress","type":"address"}],"name":"getStakingDetails","outputs":[{"components":[{"internalType":"address","name":"Depositor","type":"address"},{"internalType":"address","name":"Validator","type":"address"},{"internalType":"uint256","name":"Balance","type":"uint256"},{"internalType":"uint256","name":"NetBalance","type":"uint256"},{"internalType":"uint256","name":"BlockRewards","type":"uint256"},{"internalType":"uint256","name":"Slashings","type":"uint256"},{"internalType":"bool","name":"IsValidationPaused","type":"bool"},{"internalType":"uint256","name":"WithdrawalBlock","type":"uint256"},{"internalType":"uint256","name":"WithdrawalAmount","type":"uint256"},{"internalType":"uint256","name":"LastNilBlockNumber","type":"uint256"},{"internalType":"uint256","name":"NilBlockCount","type":"uint256"}],"internalType":"struct IStakingContract.StakingDetails","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTotalDepositedBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"}],"name":"getValidatorOfDepositor","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"depositorAddress","type":"address"}],"name":"getWithdrawalBlock","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"increaseDeposit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"initiatePartialWithdrawal","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"validatorAddress","type":"address"}],"name":"isValidationPaused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"listValidators","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"validatorAddress","type":"address"}],"name":"newDeposit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"pauseValidation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"validatorAddress","type":"address"}],"name":"resetNilBlock","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"resumeValidation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"validatorAddress","type":"address"}],"name":"setNilBlock","outputs":[],"stateMutability":"nonpayable","type":"function"}];

const STAKING_ALLOWED_METHODS = ["newDeposit", "increaseDeposit", "initiatePartialWithdrawal", "completePartialWithdrawal", "pauseValidation", "resumeValidation"];

function prepareStakingMethodArgs(abi, method, rawArgs) {
    const { parseUnits, getAddress } = require("quantumcoin");
    const fn = abi.find(f => f.type === "function" && f.name === method);
    if (!fn || !fn.inputs) return rawArgs || [];
    const args = rawArgs || [];
    return fn.inputs.map((input, i) => {
        const val = args[i];
        if (val == null) return val;
        if (input.type === "address") return getAddress(val);
        if (input.type === "uint256") return parseUnits(normalizeAmountString(String(val)), 18);
        return val;
    });
}

ipcMain.handle('StakingContractSubmit', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, Wallet, Contract, parseUnits, getAddress } = require("quantumcoin");

        if (!data.method || !STAKING_ALLOWED_METHODS.includes(data.method)) return { success: false, txHash: null, error: "Invalid staking method" };
        if (!data.privateKey || !data.publicKey) return { success: false, txHash: null, error: "Wallet keys required" };
        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, txHash: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txHash: null, error: "Invalid chain ID" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes, provider);

        const contract = new Contract(STAKING_CONTRACT_ADDRESS, STAKING_ABI_JSON, wallet);
        const methodArgs = prepareStakingMethodArgs(STAKING_ABI_JSON, data.method, data.methodArgs);
        const gasLimit = Number(data.gasLimit) || 250000;
        const overrides = signingOverrides(wallet, data, { gasLimit });
        if (data.value && data.value !== "0" && data.value !== "0.0") {
            overrides.value = parseUnits(normalizeAmountString(data.value), 18);
        }
        methodArgs.push(overrides);

        const tx = await contract[data.method](...methodArgs);
        return { success: true, txHash: tx.hash, error: null };
    } catch (err) {
        return { success: false, txHash: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('StakingContractOfflineSign', async (event, data) => {
    try {
        const { Initialize } = require("quantumcoin/config");
        const { Wallet, Contract, parseUnits, getAddress } = require("quantumcoin");

        if (!data.method || !STAKING_ALLOWED_METHODS.includes(data.method)) return { success: false, txData: null, error: "Invalid staking method" };
        if (!data.privateKey || !data.publicKey) return { success: false, txData: null, error: "Wallet keys required" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txData: null, error: "Invalid chain ID" };
        const nonce = Number(data.nonce);
        if (!Number.isInteger(nonce) || nonce < 0) return { success: false, txData: null, error: "Invalid nonce" };

        await Initialize(null);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes);

        const contract = new Contract(STAKING_CONTRACT_ADDRESS, STAKING_ABI_JSON, wallet);
        const methodArgs = prepareStakingMethodArgs(STAKING_ABI_JSON, data.method, data.methodArgs);
        const gasLimit = Number(data.gasLimit) || 250000;
        const overrides = signingOverrides(wallet, data, { gasLimit });
        if (data.value && data.value !== "0" && data.value !== "0.0") {
            overrides.value = parseUnits(normalizeAmountString(data.value), 18);
        }
        methodArgs.push(overrides);

        const txReq = await contract.populateTransaction[data.method](...methodArgs);
        const txData = await wallet.signTransaction(signingOverrides(wallet, data, { ...txReq, nonce: nonce, chainId: chainId }));
        return { success: true, txData: txData, error: null };
    } catch (err) {
        return { success: false, txData: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SendCoinsSubmit', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, Wallet, parseUnits, getAddress } = require("quantumcoin");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, txHash: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txHash: null, error: "Invalid chain ID" };
        if (!data.privateKey || !data.publicKey) return { success: false, txHash: null, error: "Wallet keys required" };
        if (!data.toAddress) return { success: false, txHash: null, error: "Recipient address required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes, provider);

        const valueWei = parseUnits(normalizeAmountString(data.amount), 18);
        const gasLimit = Number(data.gasLimit) || 21000;

        const tx = await wallet.sendTransaction(signingOverrides(wallet, data, {
            to: getAddress(data.toAddress),
            value: valueWei,
            gasLimit: gasLimit
        }));
        return { success: true, txHash: tx.hash, error: null };
    } catch (err) {
        return { success: false, txHash: null, error: (err && err.message) ? err.message : String(err) };
    }
});

ipcMain.handle('SendTokensSubmit', async (event, data) => {
    try {
        const { Initialize, Config } = require("quantumcoin/config");
        const { JsonRpcProvider, Wallet, parseUnits, getAddress } = require("quantumcoin");
        const { IERC20 } = require("quantumswap");

        const rpcUrl = buildSwapRpcUrl(data.rpcEndpoint);
        if (!rpcUrl) return { success: false, txHash: null, error: "Invalid RPC endpoint" };
        const chainId = Number(data.chainId);
        if (!Number.isInteger(chainId)) return { success: false, txHash: null, error: "Invalid chain ID" };
        if (!data.privateKey || !data.publicKey) return { success: false, txHash: null, error: "Wallet keys required" };
        if (!data.toAddress) return { success: false, txHash: null, error: "Recipient address required" };
        if (!data.contractAddress) return { success: false, txHash: null, error: "Token contract address required" };

        await Initialize(new Config(chainId, rpcUrl));
        const provider = new JsonRpcProvider(rpcUrl, chainId);
        const privBytes = Buffer.from(data.privateKey, "base64");
        const pubBytes = Buffer.from(data.publicKey, "base64");
        const wallet = Wallet.fromKeys(privBytes, pubBytes, provider);

        const decimals = typeof data.fromDecimals === "number" ? data.fromDecimals : 18;
        const amountWei = parseUnits(normalizeAmountString(data.amount), decimals);
        const gasLimit = Number(data.gasLimit) || 84000;

        const token = IERC20.connect(getAddress(data.contractAddress), wallet);
        const tx = await token.transfer(getAddress(data.toAddress), amountWei, signingOverrides(wallet, data, { gasLimit }));
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
