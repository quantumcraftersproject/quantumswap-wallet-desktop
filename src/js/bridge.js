async function WriteTextToClipboard(text) {
    await ClipboardApi.send('ClipboardWriteText', text);
}

async function OpenUrl(url) {
    (async () => {
        await ClipboardApi.send('OpenUrlInShell', url);
        return false;
    })().catch(e => {
        console.log(e);
    });    

    return false;
}

async function GetAppVersion() {
    let appVersion = await AppApi.send('AppApiGetVersion', null);
    return appVersion;
}

async function ReadFile(seedfile) {
    array = await FileApi.send('FileApiReadFile', seedfile);
    return array;
}

async function getLocalStoragePath() {
    keyStore = await LocalStorageApi.send('StorageApiGetPath', null);
    return keyStore;
}

async function phraseToWalletsEth(phrase) {
    walletList = await EthersApi.send('EthersApiPhraseToWallets', phrase);
    return walletList;
}

async function phraseToKeyPairsEth(phrase) {
    walletList = await EthersApi.send('EthersApiPhraseToKeyPairs', phrase);
    return walletList;

}

async function signEthMessageWithPhrase(phrase, index, message) {
    const signingRequest = {
        phrase: phrase,
        index: index,
        message: message
    }
    sig = await EthersApi.send('EthersApiSignMessageWithPhrase', signingRequest);
    return sig;
}

async function verifyEthSignature(message, signature, address) {
    const verifyRequest = {
        message: message,
        signature: signature,
        address: address
    }
    let ok = await EthersApi.send('EthersApiVerify', verifyRequest);
    return ok;
}

async function walletEthFromKey(privateKey) {
    wallet = await EthersApi.send('EthersApiWalletFromKey', privateKey);
    return wallet;
}

async function signEthMessageWithKey(key, message) {
    const signingRequest = {
        key: key,
        message: message
    }
    sig = await EthersApi.send('EthersApiSignMessageWithKey', signingRequest);
    return sig;
}

async function keyStoreAccountEthFromJson(json, password) {
    const decryptRequest = {
        json: json,
        password: password
    }
    keyStore = await EthersApi.send('EthersApiKeyStoreAccountFromJson', decryptRequest);
    return keyStore;
}

async function weiToEther(wei) {
    let eth = await FormatApi.send('FormatApiWeiToEther', wei);
    return eth
}

async function etherToWei(eth) {
    let wei = await FormatApi.send('FormatApiEtherToWei', eth);
    return wei
}

function commify(value) {
    const match = value.match(/^(-?)([0-9]*)(\.?)([0-9]*)$/);
    if (!match || (!match[2] && !match[4])) {
        throw new Error(`bad formatted number: ${JSON.stringify(value)}`);
    }

    const neg = match[1];
    const whole = BigInt(match[2] || 0).toLocaleString("en-us");
    const frac = match[4] ? match[4].match(/^(.*?)0*$/)[1] : "0";

    return `${neg}${whole}.${frac}`;
}

async function weiToEtherFormatted(wei) {
    let eth = await FormatApi.send('FormatApiWeiToEther', wei);
    eth = commify(eth);

    if (eth.endsWith(".")) {
        eth = eth.substring(0, eth.length - 1);
    }

    return eth
}

async function hexWeiToEthFormatted(hex) {
    let wei = BigInt(hex).toString();
    let eth = await weiToEtherFormatted(wei);
    return eth;
}

async function isValidEther(quantity) {
    let isValid = await FormatApi.send('FormatApiIsValidEther', quantity);
    return isValid
}

async function compareEther(val1, val2) {
    const compareRequest = {
        num1: val1,
        num2: val2
    }
    let ret = await FormatApi.send('FormatApiCompareEther', compareRequest);
    return ret;
}

async function getSwapQuoteAmountsOut(payload) {
    return await SwapQuoteApi.send('SwapQuoteGetAmountsOut', payload);
}

async function getSwapQuoteAmountsIn(payload) {
    return await SwapQuoteApi.send('SwapQuoteGetAmountsIn', payload);
}

async function getSwapCheckPairExists(payload) {
    return await SwapQuoteApi.send('SwapQuoteCheckPairExists', payload);
}

async function getSwapEstimateGas(payload) {
    return await SwapQuoteApi.send('SwapQuoteEstimateGas', payload);
}

async function getSwapCheckAllowance(payload) {
    return await SwapQuoteApi.send('SwapQuoteCheckAllowance', payload);
}

async function getSwapEstimateApproveGas(payload) {
    return await SwapQuoteApi.send('SwapQuoteEstimateApproveGas', payload);
}

async function getSwapApproveContractData(payload) {
    return await SwapQuoteApi.send('SwapQuoteGetApproveContractData', payload);
}

async function getSwapRouterAddress() {
    return await SwapQuoteApi.send('SwapQuoteGetRouterAddress', {});
}

async function getSwapSwapContractData(payload) {
    return await SwapQuoteApi.send('SwapQuoteGetSwapContractData', payload);
}

async function submitSwapApproval(payload) {
    return await SwapQuoteApi.send('SwapSubmitApproval', payload);
}

async function submitSwapSwap(payload) {
    return await SwapQuoteApi.send('SwapSubmitSwap', payload);
}

async function submitSwapRemoveAllowance(payload) {
    return await SwapQuoteApi.send('SwapSubmitRemoveAllowance', payload);
}

async function submitSwapAddAllowance(payload) {
    return await SwapQuoteApi.send('SwapSubmitAddAllowance', payload);
}