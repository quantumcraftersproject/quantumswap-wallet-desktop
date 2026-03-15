const DATA_LANG_KEY = "data-lang-key";
const DATA_PLACEHOLDER_KEY = "data-placeholder-key";
const DATA_ALT_KEY = "data-alt-key";
var currentInfoStep = 1;
var currentQuizStep = 1;
var STORAGE_PATH = "";
var langJson = "";

var tempPassword = "";
var tempSeedArray;
var currentWallet;
var currentWalletAddress = "";
var specificWalletAddress = "";
var additionalWalletMode = false; //this means first wallet has alredy been created and user is trying to create additional wallet
var revealSeedArray;

const ADDRESS_TEMPLATE = "[ADDRESS]";
const SHORT_ADDRESS_TEMPLATE = "[SHORT_ADDRESS]";
const STORAGE_PATH_TEMPLATE = "[STORAGE_PATH]";
const ERROR_TEMPLATE = "[ERROR]";

const BLOCK_EXPLORER_DOMAIN_TEMPLATE = "[BLOCK_EXPLORER_DOMAIN]";
const BLOCK_EXPLORER_ACCOUNT_TEMPLATE = "https://[BLOCK_EXPLORER_DOMAIN]/account/[ADDRESS]"
const BLOCK_EXPLORER_TRANSACTION_TEMPLATE = "https://[BLOCK_EXPLORER_DOMAIN]/txn/[TRANSACTION_HASH]"
const zero_address = "0x0000000000000000000000000000000000000000000000000000000000000000"; // 32 bytes hex

const BLOCKCHAIN_NETWORK_INDEX_TEMPLATE = "[BLOCKCHAIN_NETWORK_INDEX]";
const TAB_INDEX_TEMPLATE = "[TAB_INDEX]";
const BLOCKCHAIN_NETWORK_NAME_TEMPLATE = "[BLOCKCHAIN_NETWORK_NAME]";
const BLOCKCHAIN_NETWORK_ID_TEMPLATE = "[BLOCKCHAIN_NETWORK_ID]";
const BLOCKCHAIN_SCAN_API_DOMAIN_TEMPLATE = "[BLOCKCHAIN_SCAN_API_URL]";
const BLOCKCHAIN_TXN_API_DOMAIN_TEMPLATE = "[BLOCKCHAIN_TXN_API_URL]";
const BLOCKCHAIN_EXPLORER_API_DOMAIN_TEMPLATE = "[BLOCKCHAIN_EXPLORER_API_URL]";
const BLOCKCHAIN_RPC_ENDPOINT_TEMPLATE = "[BLOCKCHAIN_RPC_ENDPOINT_URL]";
const TRANSACTION_HASH_TEMPLATE = "[TRANSACTION_HASH]";
const DROPDOWN_TEXT = "&#x25BC;";
const DEFAULT_OFFLINE_TXN_SIGNING_SETTING_KEY = "DefaultOfflineTxnSigningSettingKey";
const maxTokenNameLength = 25;
const maxTokenSymbolLength = 6;
const QuantumCoin = "QuantumCoin"

let walletListRowTemplate = "";
let blockchainNetworkOptionItemTemplate = "";
let currentBlockchainNetworkIndex = -1;
let blockchainNetworkRowTemplate = "";
var currentBlockchainNetwork;
var isRefreshingBalance = false;
let initAccountBalanceBackgroundStarted = false;
let currentBalance = "";
let completedTxnInRowTemplate = "";
let completedTxnOutRowTemplate = "";
let failedTxnInRowTemplate = "";
let failedTxnOutRowTemplate = "";
let currentTxnPageIndex = 0;
let currentTxnPageCount = 0;
let pendingTransactions = [];
let balanceNotificationMap = new Map(); //address => balance
let pendingTransactionsMap = new Map(); //address => last made txn
let autoCompleteInitialized = false;
let autoCompleteInitializedRestore = false;
let autoCompleteBoxes = [];
let autoCompleteBoxesRestore = [];
let isFirstTimeAccountRefresh = true;
let currentWalletTokenList = [];
let currentAccountDetails = null;
let offlineSignEnabled = false;

function InitAccountsWebAssembly() {
    if (!WebAssembly.instantiateStreaming) {
        WebAssembly.instantiateStreaming = async (resp, importObject) => {
            const source = await (await resp).arrayBuffer();
            return await WebAssembly.instantiate(source, importObject);
        };
    }

    const go = new Go();
    let mod, inst;
    WebAssembly.instantiateStreaming(fetch("lib/dp/libgodp.wasm"), go.importObject).then(
        async result => {
            mod = result.module;
            inst = result.instance;
            await go.run(inst);
        }
    );
}

function checkDuplicateIds() {
    var nodes = document.querySelectorAll('[id]');
    var idList = new Map();
    var totalNodes = nodes.length;

    for (var i = 0; i < totalNodes; i++) {
        var currentId = nodes[i].id ? nodes[i].id : "undefined";
        if (idList.has(currentId)) {
            throw new Error("duplicate id " + currentId);
        }
        idList.set(currentId);
    }
}

function getGenericError(error) {
    return langJson.errors.error.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH).replace(ERROR_TEMPLATE, error);
}
async function initApp() {
    checkDuplicateIds();

    var langJsonString = await ReadFile("./json/en-us.json");
    if (langJsonString == null) {
        alert("Error ocurred reading lang json.");
        return;
    }

    langJson = JSON.parse(langJsonString);
    if (langJson == null) {
        alert("Error ocurred parsing json.");
        return;
    }

    let appVersion = await GetAppVersion();
    document.title = langJson.langValues.title + " " + appVersion;

    InitAccountsWebAssembly();
    let seedInit = await initializeSeedWordsFromUrl("lib/seedwords/seedwords.txt");
    if (seedInit == false) {
        throw new Error(langJson.errors.seedInitError);
    }

    STORAGE_PATH = await storageGetPath();
    walletListRowTemplate = document.getElementsByClassName("wallet-row")[0].outerHTML;
    blockchainNetworkOptionItemTemplate = document.getElementsByClassName("network-template")[0].outerHTML;
    blockchainNetworkRowTemplate = document.getElementsByClassName("network-row")[0].outerHTML;
    completedTxnInRowTemplate = document.getElementsByClassName("completed-txn-in-row")[0].outerHTML;    
    completedTxnOutRowTemplate = document.getElementsByClassName("completed-txn-out-row")[0].outerHTML;    
    failedTxnInRowTemplate = document.getElementsByClassName("failed-txn-in-row")[0].outerHTML;    
    failedTxnOutRowTemplate = document.getElementsByClassName("failed-txn-out-row")[0].outerHTML;
    tokenListRowTemplate = document.getElementsByClassName("token-list-row")[0].outerHTML;

    document.getElementById('login-content').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';

    document.getElementById('main-content').style.display = 'none';
    document.getElementById('settings-content').style.display = 'none';
    document.getElementById('wallets-content').style.display = 'none';

    //Set all properties of data-lang-key
    var dataLangList = document.querySelectorAll('[' + DATA_LANG_KEY + ']');
    if (dataLangList.length) {
        for (var i = 0; i < dataLangList.length; i++) {
            var langVal = langJson.langValues[dataLangList[i].getAttribute(DATA_LANG_KEY)];
            if (langVal == null) {
                alert("Lang Value not set " + dataLangList[i].getAttribute(DATA_LANG_KEY));
            }
            dataLangList[i].textContent = langVal;
        }
    }

    var dataPlaceholderList = document.querySelectorAll('[' + DATA_PLACEHOLDER_KEY + ']');
    if (dataPlaceholderList.length) {
        for (var i = 0; i < dataPlaceholderList.length; i++) {
            var langVal = langJson.langValues[dataPlaceholderList[i].getAttribute(DATA_PLACEHOLDER_KEY)];
            if (langVal == null) {
                alert("Placeholder Value not set " + dataPlaceholderList[i].getAttribute(DATA_PLACEHOLDER_KEY));
            }
            dataPlaceholderList[i].placeholder = langVal;
        }
    }

    var dataAltList = document.querySelectorAll('[' + DATA_ALT_KEY + ']');
    if (dataAltList.length) {
        for (var i = 0; i < dataAltList.length; i++) {
            var langVal = langJson.langValues[dataAltList[i].getAttribute(DATA_ALT_KEY)];
            if (langVal == null) {
                alert("Alt Value not set " + dataPlaceholderList[i].getAttribute(DATA_ALT_KEY));
            }
            dataAltList[i].alt = langVal;
        }
    }

    let eulaStatus = await isEulaAccepted();
    if (eulaStatus == false) {
        showEula();
        return;
    }

    resumePostEula();
    resizeBoxes();
}

function resizeBoxes() {
    let maxHeight = "";
    let tokensMaxHeight = "";
    let maxHeightMiddle = "";

    if(screen.height >= 1024) {
        maxHeight = "520px";
        maxHeightMiddle = "550px";
        tokensMaxHeight = "295px";
    } else if(screen.height >= 960) {
        maxHeight = "515px";
        maxHeightMiddle = "545px";
        tokensMaxHeight = "295px";
    } else if(screen.height >= 900) {
        maxHeight = "500px";
        maxHeightMiddle = "530px";
        tokensMaxHeight = "295px";
    } else if(screen.height >= 800) {
        maxHeight = "450px";
        maxHeightMiddle = "495px";
        tokensMaxHeight = "295px";
    } else if(screen.height >= 768) {
        maxHeight = "430px";
        maxHeightMiddle = "480px";
        tokensMaxHeight = "225px";
    } else if(screen.height >= 720) {
        maxHeight = "380px";
        maxHeightMiddle = "450px";
        tokensMaxHeight = "180px";
    } else {
        maxHeight = "275px";
        maxHeightMiddle = "325px";
        tokensMaxHeight = "60px";
    }

    document.getElementById("divMainScreenTokens").style.maxHeight = tokensMaxHeight;
    let elements = document.getElementsByClassName("roundex-box");
    for(let i =0; i < elements.length;i++){
        elements[i].style.maxHeight  = maxHeight;
    }

    elements = document.getElementsByClassName("roundex-box-middle");
    for(let i =0; i < elements.length;i++){
        elements[i].style.maxHeight  = maxHeightMiddle;
    }
}

async function resumePostEula() {
    let readyStatus = await isMainKeyCreated();
    if (readyStatus == true) {
        showUnlockScreen();
    } else {
        showInfoScreen();
    }

    await blockchainNetworksInit();
    await showBlockchainNetworks();
    initConversion(); //don't have to wait on this
}

async function showBlockchainNetworks() {
    let networkMap = await blockchainNetworksList();
    currentBlockchainNetworkIndex = await blockchainNetworkGetDefaultIndex();
    var networkListString = "";

    let startTabIndex = 1;

    for (const [index, networkItem] of networkMap.entries()) {
        var networkString = blockchainNetworkOptionItemTemplate;
        networkString = networkString.replaceAll(BLOCKCHAIN_NETWORK_INDEX_TEMPLATE, index.toString());
        networkString = networkString.replaceAll(BLOCKCHAIN_NETWORK_NAME_TEMPLATE, htmlEncode(networkItem.blockchainName));
        networkString = networkString.replaceAll(BLOCKCHAIN_NETWORK_ID_TEMPLATE, htmlEncode(networkItem.networkId.toString()));
        networkString = networkString.replaceAll(TAB_INDEX_TEMPLATE, startTabIndex.toString());
        startTabIndex = startTabIndex + 1;
        networkListString = networkListString + networkString;
        if (index == currentBlockchainNetworkIndex) {
            document.getElementById("spnNetwork").innerHTML = htmlEncode(networkItem.blockchainName) + DROPDOWN_TEXT;
            document.getElementById("divConversionNetwork").textContent = networkItem.blockchainName;
            document.getElementById("lblNetworkConfirm").textContent = networkItem.blockchainName;
            currentBlockchainNetwork = networkItem;
        }
    }
    document.getElementById("divNetworkListDialog").innerHTML = networkListString;
    let selectedNetworkHtmlId = "optNetwork" + currentBlockchainNetworkIndex.toString();
    
    document.getElementById(selectedNetworkHtmlId).checked = true;

    document.getElementById("divCancelNetwork").tabIndex = startTabIndex.toString();
    startTabIndex = startTabIndex + 1;    
    document.getElementById("divOkNetwork").tabIndex = startTabIndex.toString();
}

async function showBlockchainNetworksTable() {
    let networkMap = await blockchainNetworksList();
    currentBlockchainNetworkIndex = await blockchainNetworkGetDefaultIndex();
    var networkListString = "";
    for (const [index, networkItem] of networkMap.entries()) {
        var networkString = blockchainNetworkRowTemplate;
        networkString = networkString.replaceAll(BLOCKCHAIN_NETWORK_INDEX_TEMPLATE, index.toString());
        networkString = networkString.replaceAll(BLOCKCHAIN_NETWORK_NAME_TEMPLATE, htmlEncode(networkItem.blockchainName));
        networkString = networkString.replaceAll(BLOCKCHAIN_NETWORK_ID_TEMPLATE, htmlEncode(networkItem.networkId.toString()));
        networkString = networkString.replaceAll(BLOCKCHAIN_SCAN_API_DOMAIN_TEMPLATE, htmlEncode(networkItem.scanApiDomain));
        networkString = networkString.replaceAll(BLOCKCHAIN_TXN_API_DOMAIN_TEMPLATE, htmlEncode(networkItem.txnApiDomain));
        networkString = networkString.replaceAll(BLOCKCHAIN_EXPLORER_API_DOMAIN_TEMPLATE, htmlEncode(networkItem.blockExplorerDomain));
        networkString = networkString.replaceAll(BLOCKCHAIN_RPC_ENDPOINT_TEMPLATE, htmlEncode(networkItem.rpcEndpoint));
        networkListString = networkListString + networkString;
    }
    document.getElementById("tbodyNetworkRow").innerHTML = networkListString;
}

async function saveSelectedBlockchainNetwork() {
    const radioButtons = document.querySelectorAll('input[name="network_option"]');
    let selectedValue = "";
    radioButtons.forEach(function (radioButton) {
        if (radioButton.checked) {
            selectedValue = radioButton.value;
        }
    });
    let result = await blockchainNetworkSetDefaultIndex(selectedValue);
    if (result == false) {
        showWarnAlert(getGenericError(""));
    } else {
        await showBlockchainNetworks();
        document.getElementById("spnAccountBalance").textContent = "";
        currentBalance = "";
        await refreshAccountBalance();
        if (document.getElementById("TransactionsScreen").style.display !== "none") {
            await refreshTransactionList();
        }
    }
}

async function showInfoScreen() {
    document.getElementById('login-content').style.display = 'block';
    document.getElementById('welcomeScreen').style.display = 'block';

    displayInfoStep == 1;
    displayInfoStep(1);
}

function displayInfoStep(step) {
    if (step >= 1 && step <= langJson.info.length) {
        currentInfoStep = step;
        totalSteps = langJson.info.length;
        var jsonData = langJson.info[ step - 1 ];

        document.getElementById('welcomeText').textContent = langJson.infoStep.replace("[STEP]", step).replace("[TOTAL_STEPS]", totalSteps);
        document.getElementById('divInfoPanelTitle').textContent = jsonData.title;
        document.getElementById('divInfoPanelDetail').textContent = jsonData.desc.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH);
    }
}

function nextInfoStep() {
    if (currentInfoStep < langJson.info.length) {
        currentInfoStep++;
        displayInfoStep(currentInfoStep);
    } else {
        displayQuizStep();
    }
}

function showCreateWalletPasswordScreen() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('quizScreen').style.display = 'none';
    document.getElementById('createWalletPasswordScreen').style.display = 'block';
    document.getElementById('pwdPassword').focus();
}

function displayQuizStep() {
    if (currentQuizStep > langJson.quiz.length) {
        showCreateWalletPasswordScreen();
        return;
    }

    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('quizScreen').style.display = 'block';

    totalSteps = langJson.quiz.length;
    var quizData = langJson.quiz[currentQuizStep - 1];

    document.getElementById('divSafetyQuizTitle').textContent = langJson.quizStep.replace("[STEP]", currentQuizStep).replace("[TOTAL_STEPS]", totalSteps);
    document.getElementById('divSafetyQuizSubTitle').textContent = quizData.title;
    document.getElementById('divSafetyQuizQuestion').textContent = quizData.question;

    var quizForm = document.getElementById("quizForm");
    quizForm.innerHTML = "";

    var choiceNode = document.getElementById("lblSafetyQuizChoice");
    let tabIndexStart = 350;
    for (var i = 0; i < quizData.choices.length; i++) {
        let choiceCloneNode = choiceNode.cloneNode(true)
        choiceCloneNode.id = "choice" + i;
        choiceNode.innerHTML = choiceNode.innerHTML.replace(TAB_INDEX_TEMPLATE, (i + tabIndexStart).toString());
        choiceCloneNode.innerHTML = choiceNode.innerHTML + htmlEncode(quizData.choices[i].replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH));
        choiceCloneNode.getElementsByClassName("safety_quiz_option")[0].value = i + 1;
        choiceCloneNode.style.display = "block";
        quizForm.appendChild(choiceCloneNode);
    }
}

function submitQuizForm() {
    const radioButtons = document.querySelectorAll('input[name="quiz_option"]');    
    let selectedValue = "";    
    radioButtons.forEach(function (radioButton) {
        if (radioButton.checked) {
            selectedValue = radioButton.value;
        }
    });
    if (selectedValue !== "") {
        var quizData = langJson.quiz[currentQuizStep - 1];
        if (quizData == null) {
            showWarnAlert(langJson.quizNoChoice);
            return;
        }
        if (selectedValue === quizData.correctChoice.toString()) {
            currentQuizStep = currentQuizStep + 1;
            showAlertAndExecuteOnClose(quizData.afterQuizInfo.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH), displayQuizStep);
        } else {
            showWarnAlert(langJson.quizWrongAnswer);
        }
    } else {
        showWarnAlert(langJson.quizNoChoice);
    }
}

function showWalletPath() {
    showAlert(STORAGE_PATH);
}

function throwMockError() {
    throw new Error("This is a mock error for testing.");
}

function checkNewPassword() {
    const minPasswordLength = 12;

    var password = document.getElementById("pwdPassword").value;
    var retypePassword = document.getElementById("pwdRetypePassword").value;

    if (password == null || password.length < minPasswordLength) {
        showWarnAlert(langJson.errors.passwordSpec);
        return false;
    }

    if (password !== password.trim()) {
        showWarnAlert(langJson.errors.passwordSpace);
        return false;
    }

    if (password !== retypePassword) {
        showWarnAlert(langJson.errors.retypePasswordMismatch);
        return false;
    }

    tempPassword = password;

    showCreateWalletPromptScreen();
}

function showCreateWalletPromptScreen() {
    document.getElementById('optNewWallet').checked = false;
    document.getElementById('optRestoreWalletFromSeed').checked = false;
    document.getElementById('optRestoreWalletFromBackupFile').checked = false;

    document.getElementById('createWalletPasswordScreen').style.display = 'none';
    document.getElementById('createWalletPromptScreen').style.display = 'block';
    document.getElementById('verifyWalletPasswordScreen').style.display = 'none';

    document.getElementById('optNewWallet').focus();
}

function walletFormSubmitted() {
    const radioButtons = document.querySelectorAll('input[name="wallet_option"]');

    let selectedValue = "";

    radioButtons.forEach(function (radioButton) {
        if (radioButton.checked) {
            selectedValue = radioButton.value;
        }
    });

    if (selectedValue !== "") {
        if (selectedValue === "new_wallet") {
            showNewSeedScreen();
        } else if (selectedValue === "wallet_from_seed") {
            showRestoreSeedScreen();
        } else if (selectedValue === "restore_wallet_backup_file") {
            showRestoreWalletScreen();
        }
        else {
            showWarnAlert(langJson.errors.wrongAnswer);
        }
    } else {
        showWarnAlert(langJson.errors.selectOption);
    }
}

function showNewSeedScreen() {
    tempSeedArray = cryptoNewSeed();

    document.getElementById('createWalletPromptScreen').style.display = 'none';
    document.getElementById('newSeedScreen').style.display = 'block';
    document.getElementById("divSeedHelp").style.display = "block";
    document.getElementById("divSeedPanel").style.display = "none";
    document.getElementById("divNewSeedButtons").style.display = "none";

    var wordList = getWordListFromSeedArray(tempSeedArray);
    for (let i = 0; i < SEED_LENGTH / 2; i++) {
        document.getElementById("divNewSeed" + i).textContent = wordList[i].toUpperCase();
    }    

    document.getElementById('aRevealSeed').focus();
}

function showRestoreSeedScreen() {
    document.getElementById('createWalletPromptScreen').style.display = 'none';
    document.getElementById('newSeedScreen').style.display = 'none';
    document.getElementById("divSeedHelp").style.display = "none";
    document.getElementById("divSeedPanel").style.display = "none";
    document.getElementById("divNewSeedButtons").style.display = "none";
    document.getElementById("restoreSeedScreen").style.display = "block";

    for (i = 0; i < SEED_FRIENDLY_INDEX_ARRAY.length; i++) {
        document.getElementById("txtRestoreSeed" + SEED_FRIENDLY_INDEX_ARRAY[i].toUpperCase()).textContent = "";
    }

    let seedWordList = getAllSeedWords();
    if (autoCompleteInitializedRestore == false) {
        for (var i = 0; i < SEED_FRIENDLY_INDEX_ARRAY.length; i++) {
            let box = document.getElementById("txtRestoreSeed" + SEED_FRIENDLY_INDEX_ARRAY[i].toUpperCase());
            let myAutoComplete = new AutoCompleteDropdownControl(box);
            box.tabIndex = i + 1;
            myAutoComplete.limitToList = true;
            myAutoComplete.optionValues = seedWordList;
            myAutoComplete.initialize();
            autoCompleteBoxesRestore.push(myAutoComplete);
        }
        autoCompleteInitializedRestore = true;
    } else {
        for (var i = 0; i < autoCompleteBoxesRestore.length; i++) {
            autoCompleteBoxesRestore[i].setSelectedValue('');
            autoCompleteBoxesRestore[i].reset();
        }
    }

    document.getElementById('txtRestoreSeedA1').focus();
}

async function copyNewSeed() {
    var wordList = getWordListFromSeedArray(tempSeedArray);
    var copyText = SEED_FRIENDLY_INDEX_ARRAY[0].toUpperCase() + " = " + wordList[0].toUpperCase() + "\r\n";
    for (let i = 1; i < SEED_LENGTH / 2; i++) {
        copyText = copyText + SEED_FRIENDLY_INDEX_ARRAY[i].toUpperCase() + " = " + wordList[i].toUpperCase() + "\r\n";
    }
    await WriteTextToClipboard(copyText);
}

async function copyRevealSeed() {
    var wordList = getWordListFromSeedArray(revealSeedArray);
    var copyText = SEED_FRIENDLY_INDEX_ARRAY[0].toUpperCase() + " = " + wordList[0].toUpperCase() + "\r\n";
    for (let i = 1; i < SEED_LENGTH / 2; i++) {
        copyText = copyText + SEED_FRIENDLY_INDEX_ARRAY[i].toUpperCase() + " = " + wordList[i].toUpperCase() + "\r\n";
    }
    await WriteTextToClipboard(copyText);
}

function showSeedPanel() {
    document.getElementById("divSeedPanel").style.display = "flex";
    document.getElementById("divSeedHelp").style.display = "none";
    document.getElementById("divNewSeedButtons").style.display = "block";
    return false;
}

function showVerifySeedPanel() {
    for (i = 0; i < SEED_FRIENDLY_INDEX_ARRAY.length; i++) {
        document.getElementById("txtSeed" + SEED_FRIENDLY_INDEX_ARRAY[i].toUpperCase()).textContent = "";
    }

    document.getElementById('seedVerifyScreen').style.display = 'block';    
    document.getElementById('newSeedScreen').style.display = 'none';

    let seedWordList = getAllSeedWords();
    if (autoCompleteInitialized == false) {
        for (var i = 0; i < SEED_FRIENDLY_INDEX_ARRAY.length; i++) {
            let box = document.getElementById("txtSeed" + SEED_FRIENDLY_INDEX_ARRAY[i].toUpperCase());
            let myAutoComplete = new AutoCompleteDropdownControl(box);
            box.tabIndex = i + 1;
            myAutoComplete.limitToList = true;
            myAutoComplete.optionValues = seedWordList;
            myAutoComplete.initialize();
            autoCompleteBoxes.push(myAutoComplete);
        }
        autoCompleteInitialized = true;
    } else {
        for (var i = 0; i < autoCompleteBoxes.length; i++) {
            autoCompleteBoxes[i].setSelectedValue('');
            autoCompleteBoxes[i].reset();
        }
    }
    document.getElementById('txtSeedA1').focus();

    return false;
}

function verifySeedWords() {
    var seedWords = new Array(SEED_LENGTH / 2);
    for (i = 0; i < SEED_FRIENDLY_INDEX_ARRAY.length; i++) {
        var seedWord = document.getElementById("txtSeed" + SEED_FRIENDLY_INDEX_ARRAY[i].toUpperCase()).textContent;
        var seedIndexFriedly = getFriendlySeedIndex(i).toUpperCase();

        if (seedWord === null || seedWord.length < 2) {
            return showWarnAlert(langJson.errors.seedEmpty + seedIndexFriedly);
        }

        seedWord = seedWord.toLowerCase();
        if (doesSeedWordExist(seedWord) === false) {
            return showWarnAlert(langJson.errors.seedDoesNotExist + seedIndexFriedly);
        }

        if (verifySeedWord(i, seedWord, tempSeedArray) === false) {
            return showWarnAlert(langJson.errors.seedMismatch + seedIndexFriedly + " " + seedWord.toUpperCase());
        }
    }

    showVerifyWalletPasswordScreen();
}

function showVerifyWalletPasswordScreen() {
    document.getElementById("pwdVerifyWalletPassword").value = "";
    document.getElementById('restoreSeedScreen').style.display = 'none';
    document.getElementById('seedVerifyScreen').style.display = 'none';
    document.getElementById('restoreWalletScreen').style.display = 'none';
    document.getElementById('verifyWalletPasswordScreen').style.display = 'block';
    document.getElementById('pwdVerifyWalletPassword').focus();
}

function verifyWalletPassword() {
    var password = document.getElementById("pwdVerifyWalletPassword").value;
    if (password == null || password.length < 1) {
        showWarnAlert(langJson.errors.enterWalletPassord);
        return false;
    }
    if (additionalWalletMode == false && password !== tempPassword) {
        showWarnAlert(langJson.errors.walletPasswordMismatch);
        return false;
    } else {
        tempPassword = password;
    }
    
    showLoadingAndExecuteAsync(langJson.langValues.waitWalletSave, saveWallet);
}

function showBackupWalletScreen() {
    document.getElementById('seedVerifyScreen').style.display = 'none';
    document.getElementById('restoreSeedScreen').style.display = 'none';
    document.getElementById('restoreWalletScreen').style.display = 'none';
    document.getElementById('verifyWalletPasswordScreen').style.display = 'none';
    document.getElementById('backupWalletScreen').style.display = 'block';
}

async function saveWallet() {
    try {
        let walletIndex = await walletGetMaxIndex();
        if (walletIndex == -1) {            
            if (additionalWalletMode == true) {
                hideWaitingBox();
                showErrorAndLockup(getGenericError(""));
                return false;
            }
            let mainKeyStatus = await isMainKeyCreated();
            if (mainKeyStatus == true) {
                hideWaitingBox();
                showErrorAndLockup(getGenericError(""));
                return false;
            }
            await storageCreateMainKey(tempPassword);
        }
        if (currentWallet == null) {
            currentWallet = await walletCreateNewWalletFromSeed(tempSeedArray);
        }

        if (walletDoesAddressExistInCache(currentWallet.address)) {
            hideWaitingBox();
            showWarnAlertAndExecuteOnClose(langJson.errors.walletAddressExists.replace(ADDRESS_TEMPLATE, currentWallet.address), createOrRestoreWallet);
            return false;
        }

        let ret = await walletSave(currentWallet, tempPassword);
        if (ret == false) {
            hideWaitingBox();
            showErrorAndLockup(getGenericError(""));
            return false;
        }

        currentWalletAddress = currentWallet.address;

        hideWaitingBox();
        showAlertAndExecuteOnClose(langJson.langValues.walletSaved, showBackupWalletScreen);
    }
    catch (error) {
        hideWaitingBox();
        showWarnAlert(langJson.errors.walletPasswordMismatch + " " + error);
    }
    return true;
}

function saveFile(content, mimeType, filename) {
    const a = document.createElement('a');
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
}

async function showWalletScreen() {
    currentWallet = null;
    tempSeedArray = null;
    specificWalletAddress = "";
    tempPassword = "";
    revealSeedArray = null;
    currentBalance = "";

    document.getElementById('login-content').style.display = 'none';
    document.getElementById('settings-content').style.display = 'none';
    document.getElementById('wallets-content').style.display = 'none';
    document.getElementById('SendScreen').style.display = 'none';
    document.getElementById('OfflineSignScreen').style.display = 'none';
    document.getElementById('SwapScreen').style.display = 'none';
    document.getElementById('ReceiveScreen').style.display = 'none';
    document.getElementById('TransactionsScreen').style.display = 'none';
    document.getElementById('backupWalletScreen').style.display = 'none';
    document.getElementById('ValidatorScreen').style.display = 'none';

    document.getElementById('main-content').style.display = 'block';
    document.getElementById('divMainContent').style.display = 'block';
    document.getElementById('HomeScreen').style.display = 'block';
    document.getElementById('divNetworkDropdown').style.display = 'block';

    document.getElementById('SendScreen').style.display = 'none';
    document.getElementById('SwapScreen').style.display = 'none';
    document.getElementById('ReceiveScreen').style.display = 'none';
    document.getElementById('TransactionsScreen').style.display = 'none';

    document.getElementById('gradient').style.height = '224px';
    document.getElementById('walletAddress').textContent = currentWalletAddress;

    initRefreshAccountBalanceBackground();

    return false;
}

function removeOptions(selectElement) {
    var i, L = selectElement.options.length - 1;
    for(i = L; i >= 0; i--) {
        selectElement.remove(i);
    }
}

function showReceiveScreen() {
    document.getElementById('HomeScreen').style.display = 'none';
    document.getElementById('ReceiveScreen').style.display = 'block';
    document.getElementById('gradient').style.height = '116px';
    document.getElementById('receiveWalletAddress').innerText = currentWalletAddress;
    loadQRcode(currentWalletAddress);
    document.getElementById('divCopyReceiveScreen').focus();

    return false;
}

async function copyAddressReceiveScreen() {
    await WriteTextToClipboard(currentWalletAddress);   
    return false;
}

function backupCurrentWallet() {
    showLoadingAndExecuteAsync(langJson.langValues.backupWait, encryptAndBackupCurrentWallet);
}

async function encryptAndBackupCurrentWallet() {
    let walletJson = walletGetAccountJsonFromWallet(currentWallet, tempPassword);

    var isoStr = new Date().toISOString();
    isoStr = isoStr.replaceAll(":", "-");
    var addr = currentWallet.address.toLowerCase()
    if (addr.startsWith("0x") == true) {
        addr = addr.substring(2, addr.length)
    }
    var filename = "UTC--" + isoStr + "--" + addr + ".wallet"
    var mimetype = 'text/javascript'
    saveFile(walletJson, mimetype, filename)

    hideWaitingBox();
    document.getElementById("backupButton").style.display = "none";
    document.getElementById("nextButtonBackupWalletScreen").style.display = "block";
}

function restoreSeed() {
    var seedWords = new Array(SEED_LENGTH / 2);
    for (i = 0; i < SEED_FRIENDLY_INDEX_ARRAY.length; i++) {
        var seedWord = document.getElementById("txtRestoreSeed" + SEED_FRIENDLY_INDEX_ARRAY[i].toUpperCase()).textContent;
        var seedIndexFriedly = getFriendlySeedIndex(i).toUpperCase();

        if (seedWord === null || seedWord.length < 2) {
            return showWarnAlert(langJson.errors.seedEmpty + seedIndexFriedly);
        }

        seedWord = seedWord.toLowerCase();
        if (doesSeedWordExist(seedWord) === false) {
            return showWarnAlert(langJson.errors.seedDoesNotExist + seedIndexFriedly);
        }

        seedWords[i] = seedWord;
    }

    tempSeedArray = getSeedArrayFromSeedWordList(seedWords);
    if (tempSeedArray == null) {
        return showToastBox(langJson.errors.wordToSeed);
    }

    showVerifyWalletPasswordScreen();
}

function restoreWalletFromFile() {
    var walletFile = document.getElementById("filRestoreWallet");
    if (walletFile.files.length == 0) {
        return showWarnAlert(langJson.errors.selectWalletFile);
    }
    var walletPassword = document.getElementById("pwdRestoreWallet").value;
    if (walletPassword == null || walletPassword.length < 1) {
        return showWarnAlert(langJson.errors.enterWalletFilePassword);
    }

    showLoadingAndExecuteAsync(langJson.langValues.walletFileRestoreWait, restoreWalletFileOpen);
}

async function restoreWalletFileOpen() {
    var file_to_read = document.getElementById("filRestoreWallet").files[0];
    var fileread = new FileReader();
    fileread.onload = function (e) {
        var walletJson = e.target.result;      

        try {            
            let walletDetails = JSON.parse(walletJson);
            if (walletDetails == null) {
                return showWarnAlert(langJson.errors.walletFileOpenError);
            }
            
            var walletPassword = document.getElementById("pwdRestoreWallet").value;
            currentWallet = walletCreateNewWalletFromJson(walletJson, walletPassword);

            hideWaitingBox();
            showVerifyWalletPasswordScreen();
            return;
        } catch (error) {
            hideWaitingBox();
            return showWarnAlert(langJson.errors.walletFileOpenError);
        }        
    };
    fileread.readAsText(file_to_read);
}

function getShortAddress(address) {
    let shortAddress = "";
    if (address.startsWith("0x") == true) {
        shortAddress = address.substring(2, 7);
    } else {
        shortAddress = address.substring(0, 5);
    }

    shortAddress = shortAddress + "..." + address.substring(address.length - 6, address.length);

    return shortAddress;
}

function showWalletListScreen() {

    document.getElementById('gradient').style.height = '116px';
    document.getElementById('login-content').style.display = "none";
    document.getElementById('main-content').style.display = "none";
    document.getElementById('wallets-content').style.display = "block";
    document.getElementById('settings-content').style.display = "none";
    document.getElementById('WalletsScreen').style.display = "block";
    document.getElementById('revealSeedScreen').style.display = "none";
    document.getElementById('backupSpecificWalletScreen').style.display = "none";
    document.getElementById('divNetworkDropdown').style.display = 'none';

    let walletMap = walletGetCachedAddressToIndexMap();
    let tBody = "";
    let tabIndex = 1;
    for (const [address, index] of walletMap.entries()) {
        
        let shortAddress = getShortAddress(address);
        let row = walletListRowTemplate.replaceAll(ADDRESS_TEMPLATE, address);
        row = row.replaceAll(SHORT_ADDRESS_TEMPLATE, shortAddress);

        row = row.replace('[SHORT_ADDRESS_TAB_INDEX]', tabIndex.toString());
        tabIndex = tabIndex + 1;

        row = row.replace('[SCAN_TAB_INDEX]', tabIndex.toString());
        tabIndex = tabIndex + 1;

        row = row.replace('[BACKUP_TAB_INDEX]', tabIndex.toString());
        tabIndex = tabIndex + 1;

        row = row.replace('[SEED_TAB_INDEX]', tabIndex.toString());
        tabIndex = tabIndex + 1;

        tBody = tBody + row;
    }   

    document.getElementById("tbodyWallet").innerHTML = tBody;

    document.getElementById("aCreateNewOrRestore").tabIndex = tabIndex.toString();
    tabIndex = tabIndex + 1;
    document.getElementById("backButtonWalletListScreen").tabIndex = tabIndex.toString();

    return false;
}

async function setWalletAddressAndShowWalletScreen(address) {
    currentWalletAddress = address;
    document.getElementById("spnAccountBalance").value = "";
    await showWalletScreen();
    await refreshAccountBalance();
}

function showSpecificWalletBackupScreen(addr) {
    document.getElementById("pwdBackupSpecificWallet").value = "";
    document.getElementById("WalletsScreen").style.display = "none";
    document.getElementById("revealSeedScreen").style.display = "none";
    document.getElementById("backupSpecificWalletScreen").style.display = "block";
    document.getElementById("divSpecificBackupAddress").textContent = addr;
    
    specificWalletAddress = addr;

    document.getElementById("pwdBackupSpecificWallet").focus();

    return false;
}

function backupSpecificWallet() {
    var password = document.getElementById("pwdBackupSpecificWallet").value;
    if (password == null || password.length < 1) {
        showWarnAlert(langJson.errors.enterWalletPassord)
        return;
    }
    showLoadingAndExecuteAsync(langJson.langValues.backupWait, encryptAndBackupSpecificWallet);
}

async function encryptAndBackupSpecificWallet() {
    var password = document.getElementById("pwdBackupSpecificWallet").value;
    var specificWallet;
    try {
        specificWallet = await walletGetByAddress(password, specificWalletAddress);
        if (specificWallet == null) {
            hideWaitingBox();
            showWarnAlert(langJson.errors.walletOpenError.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH))
            return;
        }
    }
    catch (error) {
        hideWaitingBox();
        showWarnAlert(langJson.errors.walletOpenError.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH) + " " + error)
        return;
    }
    let walletJson = walletGetAccountJsonFromWallet(specificWallet, password);

    var isoStr = new Date().toISOString();
    isoStr = isoStr.replaceAll(":", "-");
    var addr = specificWallet.address.toLowerCase()
    if (addr.startsWith("0x") == true) {
        addr = addr.substring(2, addr.length)
    }
    var filename = "UTC--" + isoStr + "--" + addr + ".wallet"
    var mimetype = 'text/javascript'
    saveFile(walletJson, mimetype, filename)

    hideWaitingBox();
}

function showRevealSeedScreen(addr) {
    for (let i = 0; i < SEED_LENGTH / 2; i++) {
        document.getElementById("divRevealSeed" + i).textContent = "";
    }    
    document.getElementById("pwdRevealSeedScreenPassword").value = "";

    specificWalletAddress = addr;
    document.getElementById("divRevealSeedAddress").textContent = specificWalletAddress;
    document.getElementById("WalletsScreen").style.display = "none";
    document.getElementById("revealSeedScreen").style.display = "block";
    document.getElementById("divRevealSeedHelp").style.display = "block";
    document.getElementById("divRevealSeedPanel").style.display = "none";
    document.getElementById("divCopyRevealSeed").style.display = "none";
    document.getElementById("backupSpecificWalletScreen").style.display = "none";
    document.getElementById("divRevealButton").style.display = "block";

    document.getElementById("pwdRevealSeedScreenPassword").focus();

    return false;
}

function showRevealSeedPanel() {
    var password = document.getElementById("pwdRevealSeedScreenPassword").value;
    if (password == null || password.length < 1) {
        showWarnAlert(langJson.errors.enterWalletPassord)
        return;
    }

    showLoadingAndExecuteAsync(langJson.langValues.waitRevealSeed, revealSeedWallet);

    return false;
}

async function revealSeedWallet() {
    var password = document.getElementById("pwdRevealSeedScreenPassword").value;
    var specificWallet;
    try {
        specificWallet = await walletGetByAddress(password, specificWalletAddress);
        if (specificWallet == null) {
            hideWaitingBox();
            showWarnAlert(langJson.errors.walletOpenError.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH))
            return;
        }
    }
    catch (error) {
        hideWaitingBox();
        showWarnAlert(langJson.errors.walletOpenError.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH) + " " + error)
        return;
    }

    revealSeedArray = specificWallet.getSeedArray();
    if (revealSeedArray == null) {
        hideWaitingBox();
        showWarnAlert(langJson.errors.noSeed);
        return;
    }

    if (specificWallet.address.toLowerCase() !== specificWalletAddress.toLowerCase()) {
        hideWaitingBox();
        showWarnAlert(getGenericError(""));
        return;
    }

    let wordList = getWordListFromSeedArray(revealSeedArray);
    if (wordList == null) {
        hideWaitingBox();
        showWarnAlert(getGenericError(""));
        return;
    }

    for (let i = 0; i < SEED_LENGTH / 2; i++) {
        document.getElementById("divRevealSeed" + i).textContent = wordList[i].toUpperCase();
    }    

    document.getElementById("divRevealSeedHelp").style.display = "none";
    document.getElementById("divRevealButton").style.display = "none";
    document.getElementById("divRevealSeedPanel").style.display = "block";
    hideWaitingBox();
    document.getElementById("divCopyRevealSeed").style.display = "block";
}

function createOrRestoreWallet() {
    additionalWalletMode = true;
    currentWallet = null;
    tempSeedArray = null;
    specificWalletAddress = "";
    tempPassword = "";
    revealSeedArray = null;

    createOrRestorePromptBack = "wallets";
    document.getElementById('login-content').style.display = 'block';
    document.getElementById('wallets-content').style.display = 'none';
    showCreateWalletPromptScreen();
    return false;
}

function showUnlockScreen() {
    document.getElementById('unlockScreen').style.display = "block";
    document.getElementById('login-content').style.display = "block";
    document.getElementById('main-content').style.display = "none";
    document.getElementById('settings-content').style.display = "none";
    document.getElementById('wallets-content').style.display = "none";
    document.getElementById('pwdUnlock').focus();
}

function unlockWallet() {
    var password = document.getElementById("pwdUnlock").value;
    if (password == null || password.length < 1) {
        showWarnAlert(langJson.errors.enterWalletPassord)
        return;
    }

    showLoadingAndExecuteAsync(langJson.langValues.waitUnlock, decryptAndUnlockWallet);

    return false;
}

async function decryptAndUnlockWallet() {
    var password = document.getElementById("pwdUnlock").value;

    try {
        let walletList = await walletLoadAll(password);
        if (walletList == null || walletList.length < 1) {
            hideWaitingBox();
            showWarnAlert(langJson.errors.walletOpenError.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH) + " " + error)
            return;
        }
        let walletReverseMap = walletGetCachedIndexToAddressMap();
        let walletAddress = walletReverseMap.get(0);
        hideWaitingBox();
        document.getElementById("unlockScreen").style.display = "none";
        additionalWalletMode = true;
        setWalletAddressAndShowWalletScreen(walletAddress);
    }
    catch (error) {
        hideWaitingBox();
        showWarnAlert(langJson.errors.walletOpenError.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH) + " " + error)
        return;
    }
    return false;
}

const showRestoreWalletLabel = (event) => {
    const files = event.target.files;
    if (files.length == 0) {
        document.getElementById("divRestoreWalletFilename").textContent = "";
    } else {
        document.getElementById("divRestoreWalletFilename").textContent = files[0].name;
    }
    return;
}

function showRestoreWalletScreen() {
    document.getElementById('createWalletPromptScreen').style.display = 'none';
    document.getElementById('restoreWalletScreen').style.display = 'block';
    document.getElementById("divRestoreWalletFilename").textContent = "";
    document.getElementById("filRestoreWallet").value = '';
    document.getElementById("pwdRestoreWallet").value = '';

    document.getElementById("filRestoreWallet").focus();
}

async function copyAddress() {
    await WriteTextToClipboard(currentWalletAddress);   
}

async function openBlockExplorerAccount() {
    let url = BLOCK_EXPLORER_ACCOUNT_TEMPLATE;
    url = url.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain);
    url = url.replace(ADDRESS_TEMPLATE, currentWalletAddress);

    await OpenUrl(url);
}

function showSettingsScreen() {
    document.getElementById('ahrefWalletPath').focus();
    document.getElementById('gradient').style.height = '116px';
    document.getElementById('login-content').style.display = "none";
    document.getElementById('main-content').style.display = "none";
    document.getElementById('wallets-content').style.display = "none";
    document.getElementById('WalletsScreen').style.display = "none";
    document.getElementById('revealSeedScreen').style.display = "none";
    document.getElementById('backupSpecificWalletScreen').style.display = "none";
    document.getElementById('getCoins1').style.display = "none";
    document.getElementById('OfflineSignConversionScreen').style.display = "none";
    document.getElementById('networkListScreen').style.display = "none";
    document.getElementById('divNetworkDropdown').style.display = 'none';
    document.getElementById('ValidatorScreen').style.display = "none";

    document.getElementById('settings-content').style.display = "block";
    document.getElementById('settingsScreen').style.display = "block";

    return false;
}

function togglePasswordBox(eyeImg, txtBoxId) {
    var txtBox = document.getElementById(txtBoxId);
    if (txtBox.getAttribute('type') == 'password') {
        txtBox.setAttribute('type', 'text');
        eyeImg.src = "assets/svg/eye-off-outline.svg";
    } else {
        txtBox.setAttribute('type', 'password');
        eyeImg.src = "assets/svg/eye-outline.svg";
    }
}

function backFromCreateOrRestoreWallet() {
    document.getElementById('createWalletPromptScreen').style.display = 'none';

    if (additionalWalletMode == true) {
        showWalletListScreen();
    } else {
        showCreateWalletPasswordScreen();
    }
}

function backToCreateWalletPromptScreen() {
    document.getElementById('createWalletPromptScreen').style.display = 'block';
    document.getElementById('restoreSeedScreen').style.display = 'none';
    document.getElementById('newSeedScreen').style.display = 'none';
    document.getElementById('restoreWalletScreen').style.display = 'none';
    document.getElementById('optNewWallet').focus();
}

function backToSeedScreen() {
    document.getElementById('seedVerifyScreen').style.display = 'none';
    document.getElementById('newSeedScreen').style.display = 'block';
    document.getElementById("divSeedPanel").style.display = "none";
    document.getElementById("divSeedHelp").style.display = "block";
    document.getElementById("divNewSeedButtons").style.display = "none";
}

function loadQRcode(qrString) {
    const qrcodeElement = document.getElementById("qrcode");
    qrcodeElement.innerHTML = '';
    const qrcode = new QRCode(qrcodeElement, {
        text: qrString,
        width: 260,
        height: 260,
    });
}
async function showNetworksScreen() {
    document.getElementById('settings-content').style.display = "block";
    document.getElementById('settingsScreen').style.display = "none";
    document.getElementById('networkListScreen').style.display = "block";
    document.getElementById('networkAddScreen').style.display = "none";
    await showBlockchainNetworksTable();
}

function showAddNetworkScreen() {
    document.getElementById('networkListScreen').style.display = "none";
    document.getElementById('networkAddScreen').style.display = "block";
    document.getElementById('txtNetworkJSON').focus();
    return false;
}

function addNetwork() {
    showConfirmAndExecuteOnConfirm(langJson.langValues.addNetworkWarn, checkAndAddNetwork);
}

async function checkAndAddNetwork() {
    try {
        let jsonString = document.getElementById("txtNetworkJSON").value;
        if (jsonString == null || jsonString.length < 1) {
            showWarnAlert(langJson.langValues.invalidNetworkJson);
            return;
        }
        await blockchainNetworkAddNew(jsonString);
        await showBlockchainNetworks();

        showAlertAndExecuteOnClose(langJson.langValues.networkAdded, showNetworksScreen);
    }
    catch (error) {
        showWarnAlert(langJson.errors.invalidNetworkJson + " " + error);
    }
}

async function refreshAccountBalance() {
    try {
        if (isRefreshingBalance == true) {
            return;
        }
        isRefreshingBalance = true;

        currentWalletTokenList = [];
        document.getElementById('divAccountTokens').style.display = 'none';
        document.getElementById('tbodyAccountTokens').innerHTML = '';
        document.getElementById("divRefreshBalance").style.display = "none";
        document.getElementById("divLoadingBalance").style.display = "block";
        document.getElementById("spnAccountBalance").textContent = "";
        currentAccountDetails = null;
        let accountDetails = await getAccountDetails(currentBlockchainNetwork.scanApiDomain, currentWalletAddress);
        if (accountDetails != null) {
            currentAccountDetails = accountDetails;
            currentBalance = await weiToEtherFormatted(accountDetails.balance);
            document.getElementById("spnAccountBalance").textContent = currentBalance;
            balanceNotificationMap.set(currentWalletAddress.toLowerCase(), currentBalance);
        }

        await refreshTokenList();

        setTimeout(() => {
            document.getElementById("divRefreshBalance").style.display = "block";
            document.getElementById("divLoadingBalance").style.display = "none";
            isRefreshingBalance = false;
        }, "500");
    }
    catch (error) {
        document.getElementById("divRefreshBalance").style.display = "block";
        document.getElementById("divLoadingBalance").style.display = "none";
        isRefreshingBalance = false;
        if (isNetworkError(error)) {
            showWarnAlert(langJson.errors.internetDisconnected);
        } else {
            showWarnAlert(langJson.errors.invalidApiResponse + ' ' + error);
        }
    }
}

async function refreshTokenList() {
    //refresh token list/balance
    let tokenListDetails = await listAccountTokens(currentBlockchainNetwork.scanApiDomain, currentWalletAddress, 1); //todo: pagination
    if (tokenListDetails == null || tokenListDetails.tokenList == null || tokenListDetails.tokenList.length === 0) {
        return;
    }

    let tbody = "";
    let filteredTokenList = [];

    for (var i = 0; i < tokenListDetails.tokenList.length; i++) {
        let token = tokenListDetails.tokenList[i];
        if (htmlEncode(token.name) !== token.name || htmlEncode(token.symbol) !== token.symbol) {
            continue;
        }
        filteredTokenList.push(token);
        let tokenRow = tokenListRowTemplate;
        let tokenName = token.name;
        let tokenSymbol = token.symbol;
        let tokenShortContractAddress = getShortAddress(token.contractAddress); //contract address is already verified for correctness in api.js listAccountTokens function

        if (tokenName.length > maxTokenNameLength) {
            tokenName = tokenName.substring(0, maxTokenNameLength - 1);
            tokenName = htmlEncode(tokenName) + "<span style='color:green'>...</span>";
        } else {
            tokenName = htmlEncode(tokenName);
        }

        if (tokenSymbol.length > maxTokenSymbolLength) {
            tokenSymbol = tokenSymbol.substring(0, maxTokenSymbolLength - 1);
            tokenSymbol = htmlEncode(tokenSymbol) + "<span style='color:green'>...</span>";
        } else {
            tokenSymbol = htmlEncode(tokenSymbol);
        }

        tokenRow = tokenRow.replace('[TOKEN_SYMBOL]', tokenSymbol);
        tokenRow = tokenRow.replace('[TOKEN_NAME]', tokenName);
        tokenRow = tokenRow.replace('[TOKEN_CONTRACT]', token.contractAddress);
        tokenRow = tokenRow.replace('[SHORT_CONTRACT]', tokenShortContractAddress);
        tokenRow = tokenRow.replace('[TOKEN_BALANCE]', token.tokenBalance);

        tbody = tbody + tokenRow;
    }

    document.getElementById('tbodyAccountTokens').innerHTML = tbody;
    document.getElementById('divAccountTokens').style.display = '';
    currentWalletTokenList = filteredTokenList;
}

async function initRefreshAccountBalanceBackground() {
    if (initAccountBalanceBackgroundStarted == true) {
        return;
    }
    initAccountBalanceBackgroundStarted = true;
    refreshAccountBalanceBackground();
}

async function refreshAccountBalanceBackground() {
    try {
        if (isRefreshingBalance == true) {
            setTimeout(refreshAccountBalanceBackground, 10.0 * 1000);
            return;
        }
        isRefreshingBalance = true;
        currentWalletTokenList = [];
        document.getElementById("divRefreshBalance").style.display = "none";
        document.getElementById("divLoadingBalance").style.display = "block";
        currentAccountDetails = null;
        let accountDetails = await getAccountDetails(currentBlockchainNetwork.scanApiDomain, currentWalletAddress);
        if (accountDetails != null) {
            currentAccountDetails = accountDetails;
            let curAddrLower = currentWalletAddress.toLowerCase();
            let newBalance = await weiToEtherFormatted(accountDetails.balance);

            if (currentBalance !== "" && newBalance !== "0" && newBalance !== currentBalance) {
                if (pendingTransactionsMap.has(curAddrLower + currentBlockchainNetwork.index.toString()) || (balanceNotificationMap.has(curAddrLower) && balanceNotificationMap.get(curAddrLower) !== newBalance)) {
                    showBalanceChangeNotification(newBalance);
                    balanceNotificationMap.set(currentWalletAddress.toLowerCase(), newBalance);
                }
            }

            currentBalance = newBalance;
            document.getElementById("spnAccountBalance").textContent = newBalance;
        }
        await refreshTokenList();
        document.getElementById("divRefreshBalance").style.display = "block";
        document.getElementById("divLoadingBalance").style.display = "none";
        isRefreshingBalance = false;
        isFirstTimeAccountRefresh = false;
        setTimeout(refreshAccountBalanceBackground, 10.0 * 1000);
    }
    catch (error) {
        document.getElementById("divRefreshBalance").style.display = "block";
        document.getElementById("divLoadingBalance").style.display = "none";

        let backoffJitterDelay = Math.random() * (60 - 20) + 20;
        setTimeout(refreshAccountBalanceBackground, backoffJitterDelay * 1000);
        isRefreshingBalance = false;

        if (isFirstTimeAccountRefresh == true) { //Show error only when wallet screen displayed first time after the app is opened
            isFirstTimeAccountRefresh = false;
            if (isNetworkError(error)) {
                showWarnAlert(langJson.errors.internetDisconnected);
            } else {
                showWarnAlert(langJson.errors.invalidApiResponse + ' ' + error);
            }
        }        
    }
}

function toggleTransactionStatus(index) {
    var add_id = "";
    var rem_id = "";
    var transStatus = "";
    if (index == 0) {
        rem_id = "toggle_trans_status_1";
        add_id = "toggle_trans_status_2";
        transStatus = "completed";

        document.getElementById('divCompleted').classList.remove('disabledhide');
        document.getElementById('divPending').classList.add('disabledhide');

        document.getElementById('divPrevTxnList').style.display = "block";
        document.getElementById('divNextTxnList').style.display = "block";
    } else {
        rem_id = "toggle_trans_status_2";
        add_id = "toggle_trans_status_1";

        transStatus = "pending";

        document.getElementById('divCompleted').classList.add('disabledhide');
        document.getElementById('divPending').classList.remove('disabledhide');

        document.getElementById('divPrevTxnList').style.display = "none";
        document.getElementById('divNextTxnList').style.display = "none";
    }
    var add_el = document.getElementById(add_id);
    var rem_el = document.getElementById(rem_id);

    add_el.classList.add('disabled');
    var children = Array.from(add_el.children);

    children.forEach((innerDiv) => {
        innerDiv.classList.add('disabled');
    });

    rem_el.classList.remove('disabled');
    children = Array.from(rem_el.children);

    children.forEach((innerDiv) => {
        innerDiv.classList.remove('disabled');
    });
}

function showBalanceChangeNotification(value) {
    new Notification(langJson.langValues.balanceChanged, { body: value });
    return false;
}

function getTokenBalance(contactAddress) {
    if(currentWalletTokenList == null) { {
        return null;
    }}
    for(let i = 0;i < currentWalletTokenList.length;i++) {
        if(currentWalletTokenList[i].contractAddress === contactAddress) {
            return currentWalletTokenList[i].tokenBalance;
        }
    }
    return null;
}

function getSwapSymbolFromValue(value) {
    if (!value || value === "Q") return "Q";
    if (currentWalletTokenList == null) return "Q";
    for (let i = 0; i < currentWalletTokenList.length; i++) {
        if (currentWalletTokenList[i].contractAddress === value) {
            return currentWalletTokenList[i].symbol || "Q";
        }
    }
    return "Q";
}

async function getSwapBalanceForSymbol(value) {
    if (!value) return "0";
    if (value === "Q" && currentAccountDetails != null) {
        return await weiToEtherFormatted(currentAccountDetails.balance);
    }
    if (currentWalletTokenList == null) return "0";
    for (let i = 0; i < currentWalletTokenList.length; i++) {
        if (currentWalletTokenList[i].contractAddress === value) {
            return currentWalletTokenList[i].tokenBalance || "0";
        }
    }
    return "0";
}

function getSwapContractAddress(value) {
    return (!value || value === "Q") ? zero_address : value;
}

function updateSwapContractLabels() {
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var toValue = document.getElementById("ddlSwapToToken").value;
    var showFromContract = fromValue && fromValue !== "Q";
    var showToContract = toValue && toValue !== "Q";
    document.getElementById("divSwapFromContractRow").style.display = showFromContract ? "flex" : "none";
    document.getElementById("divSwapToContractRow").style.display = showToContract ? "flex" : "none";
    var explorerBase = currentBlockchainNetwork ? BLOCK_EXPLORER_ACCOUNT_TEMPLATE.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain) : "";
    if (showFromContract) {
        var fromAddr = fromValue;
        document.getElementById("aSwapFromContract").textContent = fromAddr;
        document.getElementById("aSwapFromContract").setAttribute("data-contract-address", fromAddr);
        document.getElementById("aSwapFromContract").href = explorerBase.replace(ADDRESS_TEMPLATE, fromAddr);
    }
    if (showToContract) {
        var toAddr = toValue;
        document.getElementById("aSwapToContract").textContent = toAddr;
        document.getElementById("aSwapToContract").setAttribute("data-contract-address", toAddr);
        document.getElementById("aSwapToContract").href = explorerBase.replace(ADDRESS_TEMPLATE, toAddr);
    }
}

async function openSwapFromContractInExplorer() {
    var addr = document.getElementById("aSwapFromContract").getAttribute("data-contract-address") || getSwapContractAddress(document.getElementById("ddlSwapFromToken").value);
    var url = BLOCK_EXPLORER_ACCOUNT_TEMPLATE.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain).replace(ADDRESS_TEMPLATE, addr);
    await OpenUrl(url);
}

async function openSwapToContractInExplorer() {
    var addr = document.getElementById("aSwapToContract").getAttribute("data-contract-address") || getSwapContractAddress(document.getElementById("ddlSwapToToken").value);
    var url = BLOCK_EXPLORER_ACCOUNT_TEMPLATE.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain).replace(ADDRESS_TEMPLATE, addr);
    await OpenUrl(url);
}

async function copySwapFromContractAddress() {
    var addr = getSwapContractAddress(document.getElementById("ddlSwapFromToken").value);
    await WriteTextToClipboard(addr);
}

async function copySwapToContractAddress() {
    var addr = getSwapContractAddress(document.getElementById("ddlSwapToToken").value);
    await WriteTextToClipboard(addr);
}

function formatTokenAmount(weiStr, decimals) {
    if (!weiStr || String(weiStr).trim() === "" || weiStr === "0") return "0";
    var d = Math.max(0, parseInt(decimals, 10) || 18);
    var div = Math.pow(10, d);
    var big = BigInt(String(weiStr).trim());
    var divBig = BigInt(div);
    var intPart = big / divBig;
    var fracPart = big % divBig;
    var fracStr = fracPart.toString().padStart(d, "0").replace(/0+$/, "");
    if (fracStr === "") return intPart.toString();
    return intPart.toString() + "." + fracStr;
}

async function updateSwapFromAllowanceDisplay() {
    var row = document.getElementById("divSwapFromAllowanceRow");
    var span = document.getElementById("spanSwapFromAllowance");
    if (!row || !span) return;
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    if (!fromValue || !currentBlockchainNetwork) {
        row.style.display = "none";
        return;
    }
    try {
        var allowancePayload = {
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            ownerAddress: currentWalletAddress,
            requiredAmount: "0",
            fromDecimals: getSwapTokenDecimals(fromValue)
        };
        var result = await getSwapCheckAllowance(allowancePayload);
        if (!result || !result.success || !result.allowance) {
            row.style.display = "none";
            return;
        }
        var allowanceWei = String(result.allowance).trim();
        if (allowanceWei === "" || allowanceWei === "0" || BigInt(allowanceWei) === BigInt(0)) {
            row.style.display = "none";
            return;
        }
        var decimals = getSwapTokenDecimals(fromValue);
        span.textContent = formatTokenAmount(allowanceWei, decimals);
        row.style.display = "block";
    } catch (e) {
        row.style.display = "none";
    }
}

async function updateSwapBalanceLabels() {
    var fromSymbol = document.getElementById("ddlSwapFromToken").value;
    var toSymbol = document.getElementById("ddlSwapToToken").value;
    var fromBal = await getSwapBalanceForSymbol(fromSymbol);
    var toBal = await getSwapBalanceForSymbol(toSymbol);
    document.getElementById("spanSwapFromBalance").textContent = fromBal;
    document.getElementById("spanSwapToBalance").textContent = toBal;
    updateSwapContractLabels();
    await updateSwapFromAllowanceDisplay();
}

function normalizeAmountForNumberInput(value) {
    if (value == null || value === "") return "";
    return String(value).replace(/,/g, "").trim();
}

function setSwapFromQuantityToBalance() {
    (async function () {
        var fromSymbol = document.getElementById("ddlSwapFromToken").value;
        var bal = await getSwapBalanceForSymbol(fromSymbol);
        document.getElementById("txtSwapFromQuantity").value = normalizeAmountForNumberInput(bal);
        updateToQuantityFromFrom();
    })();
    return false;
}

function setSwapToQuantityToBalance() {
    (async function () {
        var toSymbol = document.getElementById("ddlSwapToToken").value;
        var bal = await getSwapBalanceForSymbol(toSymbol);
        document.getElementById("txtSwapToQuantity").value = normalizeAmountForNumberInput(bal);
        updateFromQuantityFromTo();
    })();
    return false;
}

async function showTransactionsScreen() {
    document.getElementById('HomeScreen').style.display = 'none';
    document.getElementById('TransactionsScreen').style.display = 'block';
    document.getElementById('gradient').style.height = '116px';

    document.getElementById('divPrevTxnList').style.display = "block";
    document.getElementById('divNextTxnList').style.display = "block";

    document.getElementById('tbodyComplextedTransactions').innerHTML = '';
    currentTxnPageIndex = 0;
    await refreshTransactionList();

    return false;
}

function showSwapScreen() {
    showYesNoConfirm(langJson.langValues.swapEarlyPhaseWarn, function () {
        openSwapScreen();
    });
    return false;
}

function getSwapDropdownDisplayText(tokenName, tokenSymbol, contractAddress) {
    var namePart = (tokenName || "").substring(0, 25);
    var symbolPart = (tokenSymbol || "").substring(0, 6);
    if (!contractAddress || contractAddress === zero_address) {
        return namePart + " (" + symbolPart + ")";
    }
    var addr = contractAddress;
    var addrPart = addr.length >= 10 ? addr.substring(0, 5) + "..." + addr.slice(-5) : addr;
    return namePart + " (" + symbolPart + ") " + addrPart;
}

function getSwapTokenListFromWallet() {
    var list = [];
    if (SWAP_SHOW_NATIVE_COIN) {
        list.push({ value: "Q", displayText: QuantumCoin + " (Q)" });
    }
    if (currentWalletTokenList != null && currentWalletTokenList.length > 0) {
        for (var i = 0; i < currentWalletTokenList.length; i++) {
            var t = currentWalletTokenList[i];
            if (!t.symbol || !t.name || !t.contractAddress) continue;
            if (htmlEncode(t.name) !== t.name || htmlEncode(t.symbol) !== t.symbol) continue;
            if (!SWAP_SHOW_NATIVE_COIN && typeof HEISEN_CONTRACT_ADDRESS !== "undefined" && (t.contractAddress || "").toLowerCase() === (HEISEN_CONTRACT_ADDRESS || "").toLowerCase()) continue;
            list.push({
                value: t.contractAddress,
                displayText: getSwapDropdownDisplayText(t.name, t.symbol, t.contractAddress)
            });
        }
    }
    return list;
}

function populateSwapTokenDropdowns() {
    var swapTokenList = getSwapTokenListFromWallet();
    var ddlFrom = document.getElementById("ddlSwapFromToken");
    var ddlTo = document.getElementById("ddlSwapToToken");
    removeOptions(ddlFrom);
    removeOptions(ddlTo);
    var selectTokenText = (langJson && langJson.langValues && langJson.langValues["select-token"]) ? langJson.langValues["select-token"] : "Select token";
    var optFromPlaceholder = document.createElement("option");
    optFromPlaceholder.value = "";
    optFromPlaceholder.text = selectTokenText;
    ddlFrom.add(optFromPlaceholder);
    var optToPlaceholder = document.createElement("option");
    optToPlaceholder.value = "";
    optToPlaceholder.text = selectTokenText;
    ddlTo.add(optToPlaceholder);
    for (var i = 0; i < swapTokenList.length; i++) {
        var optFrom = document.createElement("option");
        optFrom.text = swapTokenList[i].displayText;
        optFrom.value = swapTokenList[i].value;
        ddlFrom.add(optFrom);
        var optTo = document.createElement("option");
        optTo.text = swapTokenList[i].displayText;
        optTo.value = swapTokenList[i].value;
        ddlTo.add(optTo);
    }
    ddlFrom.selectedIndex = 0;
    ddlTo.selectedIndex = 0;
    updateSwapTokenSymbolCache();
}

function updateSwapTokenSymbolCache() {
    swapTokenSymbolCache = { "Q": "Q" };
    if (currentWalletTokenList != null) {
        for (var i = 0; i < currentWalletTokenList.length; i++) {
            var t = currentWalletTokenList[i];
            if (t.contractAddress && t.symbol) swapTokenSymbolCache[t.contractAddress] = t.symbol;
        }
    }
}

function getSwapCachedSymbol(value) {
    if (!value || value === "Q") return "Q";
    return swapTokenSymbolCache[value] != null ? swapTokenSymbolCache[value] : getSwapSymbolFromValue(value);
}

var swapQuantityUpdating = false;
var swapQuoteFromDebounceId = null;
var swapLastChanged = 'from'; // 'from' | 'to' - which quantity the user last edited
var swapNeedsApproval = false; // true when confirm panel is in "Approve" mode
var swapQuoteToDebounceId = null;
var SWAP_QUOTE_DEBOUNCE_MS = 400;

function getSwapTokenDecimals(value) {
    if (!value || value === "Q") return 18;
    if (currentWalletTokenList != null) {
        for (var i = 0; i < currentWalletTokenList.length; i++) {
            if (currentWalletTokenList[i].contractAddress === value && currentWalletTokenList[i].decimals != null) {
                return currentWalletTokenList[i].decimals;
            }
        }
    }
    return 18;
}

function getSwapRate(fromValue, toValue) {
    var fromSymbol = getSwapSymbolFromValue(fromValue);
    var toSymbol = getSwapSymbolFromValue(toValue);
    if (fromSymbol === toSymbol) return 1;
    var rates = {
        "Q": { "Y2Q": 2, "hei": 1.5, "DP": 0.8, "USDT": 0.1, "ETH": 0.00005, "WBTC": 0.000002 },
        "Y2Q": { "Q": 0.5, "hei": 0.75, "DP": 0.4, "USDT": 0.05, "ETH": 0.000025, "WBTC": 0.000001 },
        "hei": { "Q": 0.67, "Y2Q": 1.33, "DP": 0.53, "USDT": 0.067, "ETH": 0.000033, "WBTC": 0.0000013 },
        "DP": { "Q": 1.25, "Y2Q": 2.5, "hei": 1.9, "USDT": 0.125, "ETH": 0.0000625, "WBTC": 0.0000025 },
        "USDT": { "Q": 10, "Y2Q": 20, "hei": 15, "DP": 8, "ETH": 0.0005, "WBTC": 0.00002 },
        "ETH": { "Q": 20000, "Y2Q": 40000, "hei": 30000, "DP": 16000, "USDT": 2000, "WBTC": 40 },
        "WBTC": { "Q": 500000, "Y2Q": 1000000, "hei": 750000, "DP": 400000, "USDT": 50000, "ETH": 0.025 }
    };
    var fromRates = rates[fromSymbol];
    if (fromRates && fromRates[toSymbol] != null) return fromRates[toSymbol];
    return 1;
}

function showSwapQuoteLoading(show) {
    var el = document.getElementById("divSwapQuoteLoading");
    if (el) el.style.display = show ? "block" : "none";
}

async function updateToQuantityFromFrom() {
    if (swapQuantityUpdating) return;
    swapLastChanged = 'from';
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var toValue = document.getElementById("ddlSwapToToken").value;
    var fromQtyStr = (document.getElementById("txtSwapFromQuantity").value || "").trim();
    var fromQty = parseFloat(fromQtyStr);

    if (!fromQtyStr || isNaN(fromQty) || fromQty < 0) {
        document.getElementById("txtSwapToQuantity").value = "";
        return;
    }
    if (!fromValue || !toValue || fromValue === toValue) {
        document.getElementById("txtSwapToQuantity").value = "";
        return;
    }
    if (!currentBlockchainNetwork) return;

    swapQuantityUpdating = true;
    showSwapQuoteLoading(true);
    try {
        var payload = {
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10) || 123123,
            amountIn: fromQtyStr,
            fromTokenValue: fromValue,
            toTokenValue: toValue,
            fromDecimals: getSwapTokenDecimals(fromValue),
            toDecimals: getSwapTokenDecimals(toValue)
        };
        var result = await getSwapQuoteAmountsOut(payload);
        if (result && result.success && result.amountOut != null) {
            var outStr = String(result.amountOut).replace(/\.?0+$/, "") || result.amountOut;
            document.getElementById("txtSwapToQuantity").value = outStr;
        } else {
            document.getElementById("txtSwapToQuantity").value = "";
            if (result && !result.success && result.error) {
                showWarnAlert(result.error);
            }
        }
    } catch (e) {
        document.getElementById("txtSwapToQuantity").value = "";
        showWarnAlert((e && e.message) ? e.message : String(e));
    } finally {
        showSwapQuoteLoading(false);
        swapQuantityUpdating = false;
    }
}

function debouncedUpdateToQuantityFromFrom() {
    if (swapQuoteFromDebounceId != null) clearTimeout(swapQuoteFromDebounceId);
    swapQuoteFromDebounceId = setTimeout(function () {
        swapQuoteFromDebounceId = null;
        updateToQuantityFromFrom();
    }, SWAP_QUOTE_DEBOUNCE_MS);
}

async function updateFromQuantityFromTo() {
    if (swapQuantityUpdating) return;
    swapLastChanged = 'to';
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var toValue = document.getElementById("ddlSwapToToken").value;
    var toQtyStr = (document.getElementById("txtSwapToQuantity").value || "").trim();
    var toQty = parseFloat(toQtyStr);

    if (!toQtyStr || isNaN(toQty) || toQty < 0) {
        document.getElementById("txtSwapFromQuantity").value = "";
        return;
    }
    if (!fromValue || !toValue || fromValue === toValue) {
        document.getElementById("txtSwapFromQuantity").value = "";
        return;
    }
    if (!currentBlockchainNetwork) return;

    swapQuantityUpdating = true;
    showSwapQuoteLoading(true);
    try {
        var payload = {
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            amountOut: toQtyStr,
            fromTokenValue: fromValue,
            toTokenValue: toValue,
            fromDecimals: getSwapTokenDecimals(fromValue),
            toDecimals: getSwapTokenDecimals(toValue)
        };
        var result = await getSwapQuoteAmountsIn(payload);
        if (result && result.success && result.amountIn != null) {
            var inStr = String(result.amountIn).replace(/\.?0+$/, "") || result.amountIn;
            document.getElementById("txtSwapFromQuantity").value = inStr;
        } else {
            document.getElementById("txtSwapFromQuantity").value = "";
            if (result && !result.success && result.error) {
                showWarnAlert(result.error);
            }
        }
    } catch (e) {
        document.getElementById("txtSwapFromQuantity").value = "";
        showWarnAlert((e && e.message) ? e.message : String(e));
    } finally {
        showSwapQuoteLoading(false);
        swapQuantityUpdating = false;
    }
}

function debouncedUpdateFromQuantityFromTo() {
    if (swapQuoteToDebounceId != null) clearTimeout(swapQuoteToDebounceId);
    swapQuoteToDebounceId = setTimeout(function () {
        swapQuoteToDebounceId = null;
        updateFromQuantityFromTo();
    }, SWAP_QUOTE_DEBOUNCE_MS);
}

async function updateSwapScreenInfo() {
    // Runs when either "from" or "to" token dropdown is changed. Check pair and show same error if pair doesn't exist.
    document.getElementById("txtSwapFromQuantity").value = "";
    document.getElementById("txtSwapToQuantity").value = "";
    updateSwapBalanceLabels();
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var toValue = document.getElementById("ddlSwapToToken").value;
    if (!fromValue || !toValue || fromValue === toValue) {
        return false;
    }
    if (!currentBlockchainNetwork) return false;
    var pairExists = false;
    try {
        var payload = {
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10) || 123123,
            fromTokenValue: fromValue,
            toTokenValue: toValue
        };
        var result = await getSwapCheckPairExists(payload);
        pairExists = result && result.exists === true;
        if (!pairExists) {
            if (result && result.error) {
                showWarnAlert(result.error);
            } else {
                showWarnAlert((langJson && langJson.langValues && langJson.langValues["swap-no-pair"]) || "No pair has been created for these two tokens");
            }
            document.getElementById("txtSwapToQuantity").value = "";
        }
    } catch (e) {
        showWarnAlert((e && e.message) ? e.message : String(e));
        document.getElementById("txtSwapToQuantity").value = "";
    }
    if (pairExists) {
        updateToQuantityFromFrom();
    }
    return false;
}

function openSwapScreen() {
    document.getElementById('divNetworkDropdown').style.display = 'none';
    document.getElementById('HomeScreen').style.display = 'none';
    document.getElementById('SendScreen').style.display = 'none';
    document.getElementById('OfflineSignScreen').style.display = 'none';
    document.getElementById('SwapScreen').style.display = 'block';
    document.getElementById('ReceiveScreen').style.display = 'none';
    document.getElementById('TransactionsScreen').style.display = 'none';
    document.getElementById('gradient').style.height = '116px';

    document.getElementById("divSwapScreenInner").style.display = "block";
    document.getElementById("divSwapConfirmPanel").style.display = "none";
    document.getElementById("divSwapRemoveAllowancePanel").style.display = "none";
    document.getElementById("divSwapAddAllowancePanel").style.display = "none";
    populateSwapTokenDropdowns();
    document.getElementById("txtSwapFromQuantity").value = "";
    document.getElementById("txtSwapToQuantity").value = "";
    document.getElementById("txtSwapFromQuantity").focus();
    updateSwapBalanceLabels();
    return false;
}

var SWAP_GAS_FEE_RATE = 1000 / 21000;
var SWAP_GAS_HIGH_THRESHOLD = 300000;
var SWAP_SHOW_NATIVE_COIN = false;

function setSwapConfirmPanelLoading(show) {
    var loadingEl = document.getElementById("divSwapConfirmLoading");
    var backEl = document.getElementById("divBackSwapScreen");
    var slippageInput = document.getElementById("txtSwapSlippage");
    var gasLimitInput = document.getElementById("txtSwapGasLimit");
    var approvalInput = document.getElementById("txtSwapApprovalQuantity");
    var btnNext = document.getElementById("btnSwapConfirmNext");
    if (loadingEl) loadingEl.style.display = show ? "block" : "none";
    var disabled = !!show;
    if (backEl) { backEl.style.pointerEvents = disabled ? "none" : ""; backEl.setAttribute("aria-disabled", disabled ? "true" : "false"); }
    if (slippageInput) slippageInput.disabled = disabled;
    if (gasLimitInput) gasLimitInput.disabled = disabled;
    if (approvalInput) approvalInput.disabled = disabled;
    if (btnNext) { btnNext.disabled = disabled; btnNext.style.pointerEvents = disabled ? "none" : ""; }
}

async function setSwapApprovalQuantityToMax() {
    document.getElementById("txtSwapApprovalQuantity").value = "999999999999999999";
    onSwapApprovalQuantityInput();
    return false;
}

async function onSwapApprovalQuantityInput() {
    if (!swapNeedsApproval || !currentBlockchainNetwork) {
        updateSwapGasFeeLabel();
        return;
    }
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var approvalAmount = (document.getElementById("txtSwapApprovalQuantity").value || "").trim();
    if (!approvalAmount || parseFloat(approvalAmount) <= 0) {
        updateSwapGasFeeLabel();
        return;
    }
    try {
        var payload = {
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            fromAddress: currentWalletAddress,
            amount: approvalAmount,
            fromDecimals: getSwapTokenDecimals(fromValue)
        };
        var res = await getSwapEstimateApproveGas(payload);
        if (res && res.success && res.gasLimit) {
            document.getElementById("txtSwapGasLimit").value = res.gasLimit;
        }
    } catch (e) { /* keep current gas limit */ }
    updateSwapGasFeeLabel();
}

function updateSwapGasFeeLabel() {
    var gasLimitEl = document.getElementById("txtSwapGasLimit");
    var feeEl = document.getElementById("spanSwapGasFee");
    var warnEl = document.getElementById("divSwapGasHighWarning");
    if (!gasLimitEl || !feeEl || !warnEl) return;
    var gasLimit = parseInt(gasLimitEl.value, 10);
    if (isNaN(gasLimit) || gasLimit < 0) gasLimit = 0;
    var fee = (gasLimit / 21000) * 1000;
    feeEl.textContent = fee.toFixed(4);
    warnEl.style.display = gasLimit > SWAP_GAS_HIGH_THRESHOLD ? "block" : "none";
    if (warnEl.style.display === "block" && langJson && langJson.langValues && langJson.langValues["swap-gas-high-warning"]) {
        warnEl.textContent = langJson.langValues["swap-gas-high-warning"];
    } else if (warnEl.style.display === "block") {
        warnEl.textContent = "Gas limit is high. Consider reviewing before proceeding.";
    }
}

async function onSwapNextClick() {
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var toValue = document.getElementById("ddlSwapToToken").value;
    var fromQty = (document.getElementById("txtSwapFromQuantity").value || "").trim();
    var toQty = (document.getElementById("txtSwapToQuantity").value || "").trim();
    if (!fromQty || parseFloat(fromQty) <= 0) {
        showWarnAlert((langJson.langValues["swap-from-quantity"] || "From quantity") + " " + (langJson.errors && langJson.errors.invalidValue ? langJson.errors.invalidValue : "is required"));
        return false;
    }
    if (!toQty || parseFloat(toQty) <= 0) {
        showWarnAlert((langJson.langValues["swap-to-quantity"] || "To quantity") + " " + (langJson.errors && langJson.errors.invalidValue ? langJson.errors.invalidValue : "is required"));
        return false;
    }
    if (!fromValue || !toValue || fromValue === toValue) {
        showWarnAlert((langJson && langJson.langValues && langJson.langValues["swap-no-pair"]));
        return false;
    }
    if (!currentBlockchainNetwork) return false;
    var pairExists = false;
    try {
        var payload = {
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            toTokenValue: toValue
        };
        var result = await getSwapCheckPairExists(payload);
        pairExists = result && result.exists === true;
        if (!pairExists) {
            if (result && result.error) {
                showWarnAlert(result.error);
            } else {
                showWarnAlert((langJson && langJson.langValues && langJson.langValues["swap-no-pair"]));
            }
            return false;
        }
    } catch (e) {
        showWarnAlert((e && e.message) ? e.message : String(e));
        return false;
    }
    document.getElementById("divSwapScreenInner").style.display = "none";
    setSwapConfirmPanelLoading(true);
    try {
        var allowancePayload = {
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            ownerAddress: currentWalletAddress,
            requiredAmount: fromQty,
            fromDecimals: getSwapTokenDecimals(fromValue)
        };
        var allowanceResult = await getSwapCheckAllowance(allowancePayload);
        if (!allowanceResult || !allowanceResult.success) {
            showWarnAlert((allowanceResult && allowanceResult.error) ? allowanceResult.error : "Failed to check approval");
            setSwapConfirmPanelLoading(false);
            document.getElementById("divSwapScreenInner").style.display = "block";
            return false;
        }
        if (allowanceResult.sufficient) {
            swapSuccessFromToken = fromValue;
            swapSuccessToToken = toValue;
            swapSuccessFromBefore = await getSwapBalanceForSymbol(fromValue);
            swapSuccessToBefore = await getSwapBalanceForSymbol(toValue);
            document.getElementById("divSwapConfirmPanel").style.display = "block";
            document.getElementById("divSwapRemoveAllowancePanel").style.display = "none";
            document.getElementById("divSwapAddAllowancePanel").style.display = "none";
            document.getElementById("txtSwapSlippage").value = "1";
            var gasLimitEl = document.getElementById("txtSwapGasLimit");
            gasLimitEl.value = "210000";
            var slippageRow = document.getElementById("divSwapSlippageRow");
            var approvalRow = document.getElementById("divSwapApprovalQuantityRow");
            var btnConfirmNext = document.getElementById("btnSwapConfirmNext");
            swapNeedsApproval = false;
            slippageRow.style.display = "block";
            approvalRow.style.display = "none";
            btnConfirmNext.textContent = (langJson && langJson.langValues && langJson.langValues["swap"]) ? langJson.langValues["swap"] : "Swap";
            var slippagePercent = parseFloat(document.getElementById("txtSwapSlippage").value) || 1;
            var estimatePayload = {
                rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
                chainId: parseInt(currentBlockchainNetwork.networkId, 10),
                fromTokenValue: fromValue,
                toTokenValue: toValue,
                amountIn: fromQty,
                amountOut: toQty,
                lastChanged: swapLastChanged || "from",
                slippagePercent: slippagePercent,
                fromDecimals: getSwapTokenDecimals(fromValue),
                toDecimals: getSwapTokenDecimals(toValue),
                recipientAddress: currentWalletAddress
            };
            var est = await getSwapEstimateGas(estimatePayload);
            if (est && est.success && est.gasLimit) {
                gasLimitEl.value = est.gasLimit;
            } else {
                gasLimitEl.value = "210000";
                if (est && !est.success && est.error) {
                    showWarnAlert(est.error);
                }
            }
            updateSwapGasFeeLabel();
        } else {
            showAddAllowancePanel(fromValue, fromQty, toValue, toQty);
        }
    } catch (e) {
        showWarnAlert((e && e.message) ? e.message : String(e));
        document.getElementById("divSwapScreenInner").style.display = "block";
    }
    setSwapConfirmPanelLoading(false);
    return false;
}

function showAddAllowancePanel(fromValue, fromQty, toValue, toQty) {
    document.getElementById("divSwapConfirmPanel").style.display = "none";
    document.getElementById("divSwapRemoveAllowancePanel").style.display = "none";
    document.getElementById("divSwapAddAllowancePanel").style.display = "block";
    var contractAddr = getSwapContractAddress(fromValue);
    var aEl = document.getElementById("aAddAllowanceContract");
    if (aEl) { aEl.textContent = contractAddr; aEl.setAttribute("data-contract-address", contractAddr); }
    var fromQtyNum = parseFloat(normalizeAmountForNumberInput(fromQty)) || 0;
    var defaultApprovalQty = Math.ceil(fromQtyNum) || 1;
    document.getElementById("txtAddAllowanceQuantity").value = defaultApprovalQty.toString();
    document.getElementById("txtAddAllowanceGasLimit").value = "210000";
    document.getElementById("divAddAllowanceError").style.display = "none";
    document.getElementById("divAddAllowanceError").textContent = "";
    setAddAllowancePanelWaiting(false);
    (async function () {
        try {
            var approveGasPayload = {
                rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
                chainId: parseInt(currentBlockchainNetwork.networkId, 10),
                fromTokenValue: fromValue,
                fromAddress: currentWalletAddress,
                amount: document.getElementById("txtAddAllowanceQuantity").value,
                fromDecimals: getSwapTokenDecimals(fromValue)
            };
            var res = await getSwapEstimateApproveGas(approveGasPayload);
            if (res && res.success && res.gasLimit) document.getElementById("txtAddAllowanceGasLimit").value = res.gasLimit;
        } catch (e) { /* keep default */ }
        updateAddAllowanceGasFeeLabel();
    })();
}

function showSwapMainPanel() {
    document.getElementById("divSwapConfirmPanel").style.display = "none";
    document.getElementById("divSwapRemoveAllowancePanel").style.display = "none";
    document.getElementById("divSwapAddAllowancePanel").style.display = "none";
    document.getElementById("divSwapScreenInner").style.display = "block";
    updateSwapFromAllowanceDisplay();
    return false;
}

function onSwapScreenBackClick() {
    if (document.getElementById("divSwapRemoveAllowancePanel").style.display !== "none" || document.getElementById("divSwapAddAllowancePanel").style.display !== "none" || document.getElementById("divSwapSuccessPanel").style.display !== "none") {
        goToFirstSwapScreen();
        return false;
    }
    if (document.getElementById("divSwapConfirmPanel").style.display !== "none") {
        showSwapMainPanel();
        return false;
    }
    showWalletScreen();
    return false;
}

var swapApprovalPollingId = null;
var swapApprovalStatusRotateId = null;
var swapApprovalStatusStartTime = 0;
var SWAP_APPROVAL_STATUS_MESSAGES = ["swap-approval-status-close-panel", "swap-approval-status-wait", "swap-approval-status-pending", "swap-approval-status-minute"];

function hexToBytes(hexStr) {
    var s = (hexStr || "").replace(/^0x/i, "");
    var bytes = [];
    for (var i = 0; i < s.length; i += 2) {
        bytes.push(parseInt(s.substr(i, 2), 16));
    }
    return bytes;
}

function showSwapApprovalConfirmDialog() {
    allowanceConfirmMode = "swap";
    var quantity = (document.getElementById("txtSwapApprovalQuantity").value || "").trim();
    var msg = (langJson && langJson.langValues && langJson.langValues["swap-approval-confirm-message"]) ? langJson.langValues["swap-approval-confirm-message"] : "You are approving [QUANTITY] tokens for use in QuantumSwap.";
    msg = msg.replace("[QUANTITY]", quantity);
    document.getElementById("pSwapApprovalConfirmMessage").textContent = msg;
    document.getElementById("txtSwapApprovalIAgree").value = "";
    document.getElementById("txtSwapApprovalPassword").value = "";
    document.getElementById("modalSwapApprovalConfirm").style.display = "block";
    document.getElementById("modalSwapApprovalConfirm").showModal();
    setTimeout(function () {
        var el = document.getElementById("txtSwapApprovalIAgree");
        if (el) el.focus();
    }, 100);
}

function closeSwapApprovalConfirmDialog() {
    document.getElementById("modalSwapApprovalConfirm").style.display = "none";
    document.getElementById("modalSwapApprovalConfirm").close();
}

function showSwapApprovalSubmitDialog() {
    var hint = (langJson && langJson.langValues && langJson.langValues["swap-approval-may-close"]) ? langJson.langValues["swap-approval-may-close"] : "You may close this dialog, the transaction for approval has already been submitted.";
    document.getElementById("pSwapApprovalSubmitCloseHint").textContent = hint;
    updateSwapApprovalSubmitStatusText();
    document.getElementById("divSwapApprovalSubmitError").style.display = "none";
    document.getElementById("divSwapApprovalSubmitError").textContent = "";
    document.getElementById("modalSwapApprovalSubmit").style.display = "block";
    document.getElementById("modalSwapApprovalSubmit").showModal();
    if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
    swapApprovalStatusStartTime = Date.now();
    swapApprovalStatusRotateId = setInterval(updateSwapApprovalSubmitStatusText, 3000);
}

function closeSwapApprovalSubmitDialog() {
    document.getElementById("modalSwapApprovalSubmit").style.display = "none";
    document.getElementById("modalSwapApprovalSubmit").close();
}

function setSwapConfirmPanelWaitingForApprovalTx(waiting) {
    var statusDiv = document.getElementById("divSwapConfirmApprovalTxStatus");
    var slippageInput = document.getElementById("txtSwapSlippage");
    var approvalInput = document.getElementById("txtSwapApprovalQuantity");
    var gasLimitInput = document.getElementById("txtSwapGasLimit");
    var maxLink = document.querySelector("#divSwapApprovalQuantityRow a[onclick*='setSwapApprovalQuantityToMax']");
    var btnNext = document.getElementById("btnSwapConfirmNext");
    var errDiv = document.getElementById("divSwapConfirmApprovalTxError");
    if (statusDiv) statusDiv.style.display = waiting ? "flex" : "none";
    var disabled = !!waiting;
    if (slippageInput) { slippageInput.disabled = disabled; slippageInput.style.opacity = disabled ? "0.6" : ""; }
    if (approvalInput) { approvalInput.disabled = disabled; approvalInput.style.opacity = disabled ? "0.6" : ""; }
    if (gasLimitInput) { gasLimitInput.disabled = disabled; gasLimitInput.style.opacity = disabled ? "0.6" : ""; }
    if (maxLink) { maxLink.style.pointerEvents = disabled ? "none" : ""; maxLink.style.opacity = disabled ? "0.6" : ""; }
    if (btnNext) { btnNext.disabled = disabled; btnNext.style.pointerEvents = disabled ? "none" : ""; btnNext.style.opacity = disabled ? "0.6" : ""; }
    if (errDiv) { errDiv.style.display = "none"; errDiv.textContent = ""; }
    if (waiting) {
        swapApprovalStatusStartTime = Date.now();
        updateSwapApprovalSubmitStatusText();
        if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
        swapApprovalStatusRotateId = setInterval(updateSwapApprovalSubmitStatusText, 3000);
    } else {
        if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
        swapApprovalStatusRotateId = null;
    }
}

async function reloadSwapApprovalContext() {
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var fromQty = (document.getElementById("txtSwapFromQuantity").value || "").trim();
    if (!fromQty || !currentBlockchainNetwork) return;
    try {
        var allowancePayload = {
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            ownerAddress: currentWalletAddress,
            requiredAmount: fromQty,
            fromDecimals: getSwapTokenDecimals(fromValue)
        };
        var allowanceResult = await getSwapCheckAllowance(allowancePayload);
        if (allowanceResult && allowanceResult.success && allowanceResult.sufficient) {
            swapNeedsApproval = false;
            document.getElementById("divSwapSlippageRow").style.display = "block";
            document.getElementById("divSwapApprovalQuantityRow").style.display = "none";
            var btnConfirmNext = document.getElementById("btnSwapConfirmNext");
            btnConfirmNext.textContent = (langJson && langJson.langValues && langJson.langValues["swap"]) ? langJson.langValues["swap"] : "Swap";
            var toQty = (document.getElementById("txtSwapToQuantity").value || "").trim();
            var slippagePercent = parseFloat(document.getElementById("txtSwapSlippage").value) || 1;
            var estimatePayload = {
                rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
                chainId: parseInt(currentBlockchainNetwork.networkId, 10),
                fromTokenValue: fromValue,
                toTokenValue: document.getElementById("ddlSwapToToken").value,
                amountIn: fromQty,
                amountOut: toQty,
                lastChanged: swapLastChanged || "from",
                slippagePercent: slippagePercent,
                fromDecimals: getSwapTokenDecimals(fromValue),
                toDecimals: getSwapTokenDecimals(document.getElementById("ddlSwapToToken").value),
                recipientAddress: currentWalletAddress
            };
            var est = await getSwapEstimateGas(estimatePayload);
            if (est && est.success && est.gasLimit) {
                document.getElementById("txtSwapGasLimit").value = est.gasLimit;
            }
            updateSwapGasFeeLabel();
        }
    } catch (e) { /* ignore */ }
}

async function submitSwapApprovalTransaction(quantumWallet) {
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var approvalAmount = (document.getElementById("txtSwapApprovalQuantity").value || "").trim();
    var gas = parseInt(document.getElementById("txtSwapGasLimit").value, 10) || 84000;
    try {
        var result = await submitSwapApproval({
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            amount: approvalAmount,
            fromDecimals: getSwapTokenDecimals(fromValue),
            privateKey: quantumWallet.getPrivateKey(),
            publicKey: quantumWallet.getPublicKey(),
            gasLimit: gas
        });
        if (!result || !result.success || !result.txHash) {
            setSwapConfirmPanelWaitingForApprovalTx(false);
            var errPanel = document.getElementById("divSwapConfirmApprovalTxError");
            if (errPanel) { errPanel.textContent = htmlEncode((result && result.error) ? String(result.error) : (langJson.errors.transactionSubmissionFailed || "Transaction submission failed.")); errPanel.style.display = "block"; }
            return;
        }
        swapApprovalLastTxHash = result.txHash;
        swapApprovalPollingId = setInterval(pollSwapApprovalTransactionStatus, 9000);
    } catch (err) {
        setSwapConfirmPanelWaitingForApprovalTx(false);
        var errPanel = document.getElementById("divSwapConfirmApprovalTxError");
        if (errPanel) { errPanel.textContent = htmlEncode((err && err.message) ? String(err.message) : String(err)); errPanel.style.display = "block"; }
    }
}

async function submitSwapTransaction(quantumWallet) {
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var toValue = document.getElementById("ddlSwapToToken").value;
    var fromQty = (document.getElementById("txtSwapFromQuantity").value || "").trim();
    var toQty = (document.getElementById("txtSwapToQuantity").value || "").trim();
    var slippagePercent = parseFloat(document.getElementById("txtSwapSlippage").value) || 1;
    var gas = parseInt(document.getElementById("txtSwapGasLimit").value, 10) || 200000;
    try {
        var result = await submitSwapSwap({
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            toTokenValue: toValue,
            amountIn: fromQty,
            amountOut: toQty,
            lastChanged: swapLastChanged || "from",
            slippagePercent: slippagePercent,
            fromDecimals: getSwapTokenDecimals(fromValue),
            toDecimals: getSwapTokenDecimals(toValue),
            recipientAddress: currentWalletAddress,
            privateKey: quantumWallet.getPrivateKey(),
            publicKey: quantumWallet.getPublicKey(),
            gasLimit: gas
        });
        if (!result || !result.success || !result.txHash) {
            setSwapConfirmPanelWaitingForApprovalTx(false);
            var errPanel = document.getElementById("divSwapConfirmApprovalTxError");
            if (errPanel) { errPanel.textContent = htmlEncode((result && result.error) ? String(result.error) : (langJson.errors.transactionSubmissionFailed || "Transaction submission failed.")); errPanel.style.display = "block"; }
            return;
        }
        swapSuccessGasLimit = gas;
        swapApprovalLastTxHash = result.txHash;
        swapConfirmTxMode = "swap";
        swapApprovalPollingId = setInterval(pollSwapApprovalTransactionStatus, 9000);
        if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
        swapApprovalStatusStartTime = Date.now();
        swapApprovalStatusRotateId = setInterval(updateSwapApprovalSubmitStatusText, 3000);
    } catch (err) {
        setSwapConfirmPanelWaitingForApprovalTx(false);
        var errPanel = document.getElementById("divSwapConfirmApprovalTxError");
        if (errPanel) { errPanel.textContent = htmlEncode((err && err.message) ? String(err.message) : String(err)); errPanel.style.display = "block"; }
    }
}

async function submitRemoveAllowanceTransaction(quantumWallet) {
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var gas = parseInt(document.getElementById("txtRemoveAllowanceGasLimit").value, 10) || 84000;
    try {
        var result = await submitSwapRemoveAllowance({
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            privateKey: quantumWallet.getPrivateKey(),
            publicKey: quantumWallet.getPublicKey(),
            gasLimit: gas
        });
        if (!result || !result.success || !result.txHash) {
            setRemoveAllowancePanelWaiting(false);
            var errPanel = document.getElementById("divRemoveAllowanceError");
            if (errPanel) { errPanel.textContent = htmlEncode((result && result.error) ? String(result.error) : (langJson.errors.transactionSubmissionFailed || "Transaction submission failed.")); errPanel.style.display = "block"; }
            return;
        }
        swapApprovalLastTxHash = result.txHash;
        allowancePanelMode = "remove";
        swapApprovalPollingId = setInterval(pollSwapApprovalTransactionStatus, 9000);
    } catch (err) {
        setRemoveAllowancePanelWaiting(false);
        var errPanel = document.getElementById("divRemoveAllowanceError");
        if (errPanel) { errPanel.textContent = htmlEncode((err && err.message) ? String(err.message) : String(err)); errPanel.style.display = "block"; }
    }
}

async function submitAddAllowanceTransaction(quantumWallet) {
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var approvalAmount = (document.getElementById("txtAddAllowanceQuantity").value || "").trim();
    var gas = parseInt(document.getElementById("txtAddAllowanceGasLimit").value, 10) || 84000;
    if (!approvalAmount || parseFloat(approvalAmount) <= 0) {
        setAddAllowancePanelWaiting(false);
        var errPanel = document.getElementById("divAddAllowanceError");
        if (errPanel) { errPanel.textContent = htmlEncode(langJson.errors.approvalQuantityRequired || "Approval quantity is required."); errPanel.style.display = "block"; }
        return;
    }
    try {
        var result = await submitSwapAddAllowance({
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            fromTokenValue: fromValue,
            amount: approvalAmount,
            fromDecimals: getSwapTokenDecimals(fromValue),
            privateKey: quantumWallet.getPrivateKey(),
            publicKey: quantumWallet.getPublicKey(),
            gasLimit: gas
        });
        if (!result || !result.success || !result.txHash) {
            setAddAllowancePanelWaiting(false);
            var errPanel = document.getElementById("divAddAllowanceError");
            if (errPanel) { errPanel.textContent = htmlEncode((result && result.error) ? String(result.error) : (langJson.errors.transactionSubmissionFailed || "Transaction submission failed.")); errPanel.style.display = "block"; }
            return;
        }
        swapApprovalLastTxHash = result.txHash;
        allowancePanelMode = "add";
        swapApprovalPollingId = setInterval(pollSwapApprovalTransactionStatus, 9000);
    } catch (err) {
        setAddAllowancePanelWaiting(false);
        var errPanel = document.getElementById("divAddAllowanceError");
        if (errPanel) { errPanel.textContent = htmlEncode((err && err.message) ? String(err.message) : String(err)); errPanel.style.display = "block"; }
    }
}

var swapApprovalLastTxHash = null;
var allowanceConfirmMode = null;
var allowancePanelMode = null;
var swapConfirmTxMode = null;
var swapSuccessFromToken = null;
var swapSuccessToToken = null;
var swapSuccessFromBefore = null;
var swapSuccessToBefore = null;
var swapSuccessGasLimit = null;
var swapTokenSymbolCache = {};

function goToFirstSwapScreen() {
    document.getElementById("divSwapConfirmPanel").style.display = "none";
    document.getElementById("divSwapRemoveAllowancePanel").style.display = "none";
    document.getElementById("divSwapAddAllowancePanel").style.display = "none";
    document.getElementById("divSwapSuccessPanel").style.display = "none";
    document.getElementById("divSwapScreenInner").style.display = "block";
    updateSwapFromAllowanceDisplay();
}

function setSwapSuccessSymbolAndLink(container, symbol, explorerUrl, shortAddr) {
    if (!container) return;
    container.textContent = "";
    if (!explorerUrl || !shortAddr) {
        container.textContent = symbol || "Q";
        return;
    }
    container.appendChild(document.createTextNode(symbol + " ("));
    var a = document.createElement("a");
    a.href = "#";
    a.textContent = shortAddr;
    a.style.color = "#0066cc";
    a.style.textDecoration = "underline";
    a.onclick = function () { OpenUrl(explorerUrl); return false; };
    container.appendChild(a);
    container.appendChild(document.createTextNode(")"));
}

function showSwapSuccessPanel(fromToken, toToken, fromBefore, toBefore, fromAfter, toAfter, gasFeeCoins) {
    document.getElementById("divSwapScreenInner").style.display = "none";
    document.getElementById("divSwapConfirmPanel").style.display = "none";
    document.getElementById("divSwapRemoveAllowancePanel").style.display = "none";
    document.getElementById("divSwapAddAllowancePanel").style.display = "none";
    document.getElementById("divSwapSuccessPanel").style.display = "block";

    var explorerBase = currentBlockchainNetwork ? BLOCK_EXPLORER_ACCOUNT_TEMPLATE.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain) : "";
    var fromAddr = getSwapContractAddress(fromToken);
    var toAddr = getSwapContractAddress(toToken);
    var fromSymbol = getSwapCachedSymbol(fromToken);
    var toSymbol = getSwapCachedSymbol(toToken);
    function shortAddr(addr) { return (!addr || addr === zero_address) ? "" : (String(addr).length > 10 ? String(addr).slice(0, 6) + "..." + String(addr).slice(-4) : addr); }
    var fromUrl = (fromAddr && fromAddr !== zero_address && explorerBase) ? explorerBase.replace(ADDRESS_TEMPLATE, fromAddr) : "";
    var toUrl = (toAddr && toAddr !== zero_address && explorerBase) ? explorerBase.replace(ADDRESS_TEMPLATE, toAddr) : "";

    setSwapSuccessSymbolAndLink(document.getElementById("spanSwapSuccessFromTokenDisplay"), fromSymbol, fromUrl, shortAddr(fromAddr));
    setSwapSuccessSymbolAndLink(document.getElementById("spanSwapSuccessToTokenDisplay"), toSymbol, toUrl, shortAddr(toAddr));
    setSwapSuccessSymbolAndLink(document.getElementById("tdSwapSuccessFromName"), fromSymbol, fromUrl, shortAddr(fromAddr));
    setSwapSuccessSymbolAndLink(document.getElementById("tdSwapSuccessToName"), toSymbol, toUrl, shortAddr(toAddr));

    document.getElementById("tdSwapSuccessFromBefore").textContent = fromBefore != null ? String(fromBefore) : "0";
    document.getElementById("tdSwapSuccessFromAfter").textContent = fromAfter != null ? String(fromAfter) : "0";
    document.getElementById("tdSwapSuccessToBefore").textContent = toBefore != null ? String(toBefore) : "0";
    document.getElementById("tdSwapSuccessToAfter").textContent = toAfter != null ? String(toAfter) : "0";
    document.getElementById("spanSwapSuccessGasFee").textContent = gasFeeCoins != null ? String(gasFeeCoins) : "0";
}

function onSwapSuccessOkClick() {
    goToFirstSwapScreen();
    updateSwapBalanceLabels();
    return false;
}

function updateSwapApprovalSubmitStatusText() {
    var idx = Math.floor((Date.now() - swapApprovalStatusStartTime) / 3000) % SWAP_APPROVAL_STATUS_MESSAGES.length;
    var key = SWAP_APPROVAL_STATUS_MESSAGES[idx];
    var text = (langJson && langJson.langValues && langJson.langValues[key]) ? langJson.langValues[key] : key;
    var panelEl = document.getElementById("spanSwapConfirmApprovalStatus");
    if (panelEl) panelEl.textContent = text;
    var removeStatusDiv = document.getElementById("divRemoveAllowanceTxStatus");
    var removeSpan = document.getElementById("spanRemoveAllowanceStatus");
    if (removeSpan && removeStatusDiv && removeStatusDiv.style.display === "flex") removeSpan.textContent = text;
    var addStatusDiv = document.getElementById("divAddAllowanceTxStatus");
    var addSpan = document.getElementById("spanAddAllowanceStatus");
    if (addSpan && addStatusDiv && addStatusDiv.style.display === "flex") addSpan.textContent = text;
    var dialogEl = document.getElementById("pSwapApprovalSubmitStatus");
    if (dialogEl) dialogEl.textContent = text;
}

function setRemoveAllowancePanelWaiting(waiting) {
    var statusDiv = document.getElementById("divRemoveAllowanceTxStatus");
    var gasInput = document.getElementById("txtRemoveAllowanceGasLimit");
    var btn = document.getElementById("btnRemoveAllowanceRemove");
    var errDiv = document.getElementById("divRemoveAllowanceError");
    if (statusDiv) statusDiv.style.display = waiting ? "flex" : "none";
    var disabled = !!waiting;
    if (gasInput) { gasInput.disabled = disabled; gasInput.style.opacity = disabled ? "0.6" : ""; }
    if (btn) { btn.disabled = disabled; btn.style.pointerEvents = disabled ? "none" : ""; btn.style.opacity = disabled ? "0.6" : ""; }
    if (errDiv) { errDiv.style.display = "none"; errDiv.textContent = ""; }
    if (waiting) {
        updateSwapApprovalSubmitStatusText();
        if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
        swapApprovalStatusRotateId = setInterval(updateSwapApprovalSubmitStatusText, 3000);
    } else {
        if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
        swapApprovalStatusRotateId = null;
    }
}

function setAddAllowancePanelWaiting(waiting) {
    var statusDiv = document.getElementById("divAddAllowanceTxStatus");
    var gasInput = document.getElementById("txtAddAllowanceGasLimit");
    var qtyInput = document.getElementById("txtAddAllowanceQuantity");
    var maxLink = document.querySelector("#divAddAllowanceQuantityRow a[onclick*='setAddAllowanceQuantityToMax']");
    var btn = document.getElementById("btnAddAllowanceAdd");
    var errDiv = document.getElementById("divAddAllowanceError");
    if (statusDiv) statusDiv.style.display = waiting ? "flex" : "none";
    var disabled = !!waiting;
    if (gasInput) { gasInput.disabled = disabled; gasInput.style.opacity = disabled ? "0.6" : ""; }
    if (qtyInput) { qtyInput.disabled = disabled; qtyInput.style.opacity = disabled ? "0.6" : ""; }
    if (maxLink) { maxLink.style.pointerEvents = disabled ? "none" : ""; maxLink.style.opacity = disabled ? "0.6" : ""; }
    if (btn) { btn.disabled = disabled; btn.style.pointerEvents = disabled ? "none" : ""; btn.style.opacity = disabled ? "0.6" : ""; }
    if (errDiv) { errDiv.style.display = "none"; errDiv.textContent = ""; }
    if (waiting) {
        swapApprovalStatusStartTime = Date.now();
        updateSwapApprovalSubmitStatusText();
        if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
        swapApprovalStatusRotateId = setInterval(updateSwapApprovalSubmitStatusText, 3000);
    } else {
        if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
        swapApprovalStatusRotateId = null;
    }
}

function updateRemoveAllowanceGasFeeLabel() {
    var gasLimitEl = document.getElementById("txtRemoveAllowanceGasLimit");
    var feeEl = document.getElementById("spanRemoveAllowanceGasFee");
    var warnEl = document.getElementById("divRemoveAllowanceGasHighWarning");
    if (!gasLimitEl || !feeEl) return;
    var gas = parseInt(gasLimitEl.value, 10) || 210000;
    var fee = (gas * SWAP_GAS_FEE_RATE).toFixed(6);
    feeEl.textContent = fee;
    if (warnEl) {
        warnEl.style.display = gas > SWAP_GAS_HIGH_THRESHOLD ? "block" : "none";
        if (warnEl.style.display === "block" && langJson && langJson.langValues && langJson.langValues["swap-gas-high-warning"]) {
            warnEl.textContent = langJson.langValues["swap-gas-high-warning"];
        } else if (warnEl.style.display === "block") {
            warnEl.textContent = "Gas limit is high. Consider reviewing before proceeding.";
        }
    }
}

function updateAddAllowanceGasFeeLabel() {
    var gasLimitEl = document.getElementById("txtAddAllowanceGasLimit");
    var feeEl = document.getElementById("spanAddAllowanceGasFee");
    var warnEl = document.getElementById("divAddAllowanceGasHighWarning");
    if (!gasLimitEl || !feeEl) return;
    var gas = parseInt(gasLimitEl.value, 10) || 210000;
    var fee = (gas * SWAP_GAS_FEE_RATE).toFixed(6);
    feeEl.textContent = fee;
    if (warnEl) {
        warnEl.style.display = gas > SWAP_GAS_HIGH_THRESHOLD ? "block" : "none";
        if (warnEl.style.display === "block" && langJson && langJson.langValues && langJson.langValues["swap-gas-high-warning"]) {
            warnEl.textContent = langJson.langValues["swap-gas-high-warning"];
        } else if (warnEl.style.display === "block") {
            warnEl.textContent = "Gas limit is high. Consider reviewing before proceeding.";
        }
    }
}

async function openRemoveAllowanceContractInExplorer() {
    var addr = getSwapContractAddress(document.getElementById("ddlSwapFromToken").value);
    var url = BLOCK_EXPLORER_ACCOUNT_TEMPLATE.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain).replace(ADDRESS_TEMPLATE, addr);
    await OpenUrl(url);
}

async function openAddAllowanceContractInExplorer() {
    var addr = getSwapContractAddress(document.getElementById("ddlSwapFromToken").value);
    var url = BLOCK_EXPLORER_ACCOUNT_TEMPLATE.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain).replace(ADDRESS_TEMPLATE, addr);
    await OpenUrl(url);
}

function showSwapExecuteConfirmDialog() {
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var toValue = document.getElementById("ddlSwapToToken").value;
    var fromAmt = (document.getElementById("txtSwapFromQuantity").value || "").trim();
    var toAmt = (document.getElementById("txtSwapToQuantity").value || "").trim();
    function sym(v) { return v === "Q" ? "Q" : (String(v).length > 10 ? String(v).slice(0, 6) + "..." + String(v).slice(-4) : v); }
    var msg = (langJson && langJson.langValues && langJson.langValues["swap-execute-confirm-message"]) ? langJson.langValues["swap-execute-confirm-message"] : "You are swapping [FROM_AMOUNT] [FROM_SYMBOL] for at least [TO_AMOUNT] [TO_SYMBOL].";
    msg = msg.replace("[FROM_AMOUNT]", fromAmt).replace("[FROM_SYMBOL]", sym(fromValue)).replace("[TO_AMOUNT]", toAmt).replace("[TO_SYMBOL]", sym(toValue));
    showAllowanceConfirmDialog(msg, "swapExecute");
}

function showAllowanceConfirmDialog(message, mode) {
    allowanceConfirmMode = mode;
    document.getElementById("pSwapApprovalConfirmMessage").textContent = message;
    document.getElementById("txtSwapApprovalIAgree").value = "";
    document.getElementById("txtSwapApprovalPassword").value = "";
    var dialog = document.getElementById("modalSwapApprovalConfirm");
    var content = dialog ? dialog.querySelector(".modal-content") : null;
    var inner = content ? content.querySelector("div:first-child") : null;
    if (content) {
        if (mode === "swapExecute") {
            content.style.width = "calc(80% + 50px)";
            if (inner) inner.style.minHeight = "190px"; // 160 + 30
        } else {
            content.style.width = "";
            if (inner) inner.style.minHeight = "";
        }
    }
    dialog.style.display = "block";
    dialog.showModal();
    setTimeout(function () {
        var el = document.getElementById("txtSwapApprovalIAgree");
        if (el) el.focus();
    }, 100);
}

async function pollSwapApprovalTransactionStatus() {
    if (!swapApprovalLastTxHash || !currentBlockchainNetwork) return;
    try {
        var res = await getTransactionStatusByHash(currentBlockchainNetwork.scanApiDomain, currentWalletAddress, swapApprovalLastTxHash);
        if (allowancePanelMode === "remove" || allowancePanelMode === "add") {
            if (res.status === "succeeded") {
                if (swapApprovalPollingId) clearInterval(swapApprovalPollingId);
                swapApprovalPollingId = null;
                if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
                swapApprovalStatusRotateId = null;
                swapApprovalLastTxHash = null;
                var mode = allowancePanelMode;
                allowancePanelMode = null;
                setRemoveAllowancePanelWaiting(false);
                setAddAllowancePanelWaiting(false);
                var msg = (mode === "remove") ? ((langJson && langJson.langValues && langJson.langValues["remove-allowance-succeeded"]) ? langJson.langValues["remove-allowance-succeeded"] : "Remove allowance succeeded.") : ((langJson && langJson.langValues && langJson.langValues["add-allowance-succeeded"]) ? langJson.langValues["add-allowance-succeeded"] : "Add allowance succeeded.");
                showAlertAndExecuteOnClose(msg, goToFirstSwapScreen);
            } else if (res.status === "failed") {
                if (swapApprovalPollingId) clearInterval(swapApprovalPollingId);
                swapApprovalPollingId = null;
                if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
                swapApprovalStatusRotateId = null;
                swapApprovalLastTxHash = null;
                var mode = allowancePanelMode;
                allowancePanelMode = null;
                setRemoveAllowancePanelWaiting(false);
                setAddAllowancePanelWaiting(false);
                showWarnAlert(res.error || (langJson.errors.transactionFailed || "Transaction failed."));
            }
            return;
        }
        if (swapConfirmTxMode === "swap") {
            if (res.status === "succeeded") {
                if (swapApprovalPollingId) clearInterval(swapApprovalPollingId);
                swapApprovalPollingId = null;
                if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
                swapApprovalStatusRotateId = null;
                swapApprovalLastTxHash = null;
                swapConfirmTxMode = null;
                setSwapConfirmPanelWaitingForApprovalTx(false);
                (async function () {
                    await refreshAccountBalance();
                    var fromAfter = await getSwapBalanceForSymbol(swapSuccessFromToken);
                    var toAfter = await getSwapBalanceForSymbol(swapSuccessToToken);
                    var gasFeeCoins = swapSuccessGasLimit != null ? (swapSuccessGasLimit * SWAP_GAS_FEE_RATE).toFixed(6) : "0";
                    showSwapSuccessPanel(swapSuccessFromToken, swapSuccessToToken, swapSuccessFromBefore, swapSuccessToBefore, fromAfter, toAfter, gasFeeCoins);
                    swapSuccessFromToken = null;
                    swapSuccessToToken = null;
                    swapSuccessFromBefore = null;
                    swapSuccessToBefore = null;
                    swapSuccessGasLimit = null;
                })();
            } else if (res.status === "failed") {
                if (swapApprovalPollingId) clearInterval(swapApprovalPollingId);
                swapApprovalPollingId = null;
                if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
                swapApprovalStatusRotateId = null;
                swapApprovalLastTxHash = null;
                swapConfirmTxMode = null;
                setSwapConfirmPanelWaitingForApprovalTx(false);
                var errPanel = document.getElementById("divSwapConfirmApprovalTxError");
                if (errPanel) { errPanel.textContent = htmlEncode(res.error || (langJson.errors.transactionFailed || "Transaction failed.")); errPanel.style.display = "block"; }
            }
            return;
        }
        if (res.status === "succeeded") {
            if (swapApprovalPollingId) clearInterval(swapApprovalPollingId);
            swapApprovalPollingId = null;
            swapApprovalLastTxHash = null;
            setSwapConfirmPanelWaitingForApprovalTx(false);
            await reloadSwapApprovalContext();
        } else if (res.status === "failed") {
            if (swapApprovalPollingId) clearInterval(swapApprovalPollingId);
            swapApprovalPollingId = null;
            setSwapConfirmPanelWaitingForApprovalTx(false);
            var errPanel = document.getElementById("divSwapConfirmApprovalTxError");
            if (errPanel) { errPanel.textContent = htmlEncode(res.error || (langJson.errors.transactionFailed || "Transaction failed.")); errPanel.style.display = "block"; }
        }
    } catch (e) { /* ignore */ }
}

function onSwapApprovalConfirmSubmitClick() {
    var iagree = (document.getElementById("txtSwapApprovalIAgree").value || "").trim().toLowerCase();
    if (iagree !== "i agree") {
        showWarnAlert((langJson && langJson.langValues && langJson.langValues["type-the-words"]) ? langJson.langValues["type-the-words"] + " i agree" : "Type the words i agree");
        return false;
    }
    var password = (document.getElementById("txtSwapApprovalPassword").value || "").trim();
    if (!password) {
        showWarnAlert(langJson.errors.enterQuantumPassword || "Enter password");
        return false;
    }
    showLoadingAndExecuteAsync(langJson.langValues.waitWalletOpen, decryptAndUnlockWalletForSwapApproval);
    return false;
}

async function decryptAndUnlockWalletForSwapApproval() {
    var password = (document.getElementById("txtSwapApprovalPassword").value || "").trim();
    try {
        var quantumWallet = await walletGetByAddress(password, currentWalletAddress);
        if (quantumWallet == null) {
            hideWaitingBox();
            if (allowanceConfirmMode === "remove" || allowanceConfirmMode === "add" || allowanceConfirmMode === "swapExecute") {
                showWarnAlertAndExecuteOnClose(getGenericError(), function () { document.getElementById("txtSwapApprovalPassword").focus(); });
            } else {
                showWarnAlert(getGenericError());
            }
            return;
        }
        hideWaitingBox();
        closeSwapApprovalConfirmDialog();
        if (allowanceConfirmMode === "remove") {
            allowanceConfirmMode = null;
            setRemoveAllowancePanelWaiting(true);
            await submitRemoveAllowanceTransaction(quantumWallet);
        } else if (allowanceConfirmMode === "add") {
            allowanceConfirmMode = null;
            setAddAllowancePanelWaiting(true);
            await submitAddAllowanceTransaction(quantumWallet);
        } else if (allowanceConfirmMode === "swapExecute") {
            allowanceConfirmMode = null;
            setSwapConfirmPanelWaitingForApprovalTx(true);
            await submitSwapTransaction(quantumWallet);
        } else {
            allowanceConfirmMode = null;
            setSwapConfirmPanelWaitingForApprovalTx(true);
            await submitSwapApprovalTransaction(quantumWallet);
        }
    } catch (err) {
        hideWaitingBox();
        if (allowanceConfirmMode === "remove" || allowanceConfirmMode === "add" || allowanceConfirmMode === "swapExecute") {
            showWarnAlertAndExecuteOnClose((err && err.message) ? err.message : String(err), function () { document.getElementById("txtSwapApprovalPassword").focus(); });
        } else {
            showWarnAlert((err && err.message) ? err.message : String(err));
        }
    }
}

function onSwapApprovalSubmitCloseClick() {
    if (swapApprovalPollingId) clearInterval(swapApprovalPollingId);
    swapApprovalPollingId = null;
    if (swapApprovalStatusRotateId) clearInterval(swapApprovalStatusRotateId);
    swapApprovalStatusRotateId = null;
    closeSwapApprovalSubmitDialog();
    return false;
}

function onSwapApprovalConfirmCancelClick() {
    allowanceConfirmMode = null;
    closeSwapApprovalConfirmDialog();
    return false;
}

function onRemoveSwapAllowanceClick() {
    if (!currentBlockchainNetwork) return false;
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    if (!fromValue) return false;
    document.getElementById("divSwapScreenInner").style.display = "none";
    document.getElementById("divSwapConfirmPanel").style.display = "none";
    document.getElementById("divSwapAddAllowancePanel").style.display = "none";
    document.getElementById("divSwapRemoveAllowancePanel").style.display = "block";
    var contractAddr = getSwapContractAddress(fromValue);
    var aEl = document.getElementById("aRemoveAllowanceContract");
    if (aEl) { aEl.textContent = contractAddr; aEl.setAttribute("data-contract-address", contractAddr); }
    document.getElementById("txtRemoveAllowanceGasLimit").value = "210000";
    document.getElementById("divRemoveAllowanceError").style.display = "none";
    document.getElementById("divRemoveAllowanceError").textContent = "";
    setRemoveAllowancePanelWaiting(false);
    (async function () {
        try {
            var approveGasPayload = {
                rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
                chainId: parseInt(currentBlockchainNetwork.networkId, 10),
                fromTokenValue: fromValue,
                fromAddress: currentWalletAddress,
                amount: "0",
                fromDecimals: getSwapTokenDecimals(fromValue)
            };
            var res = await getSwapEstimateApproveGas(approveGasPayload);
            if (res && res.success && res.gasLimit) document.getElementById("txtRemoveAllowanceGasLimit").value = res.gasLimit;
        } catch (e) { /* keep default */ }
        updateRemoveAllowanceGasFeeLabel();
    })();
    return false;
}

function onRemoveAllowanceRemoveClick() {
    var contractAddr = getSwapContractAddress(document.getElementById("ddlSwapFromToken").value);
    var msg = (langJson && langJson.langValues && langJson.langValues["remove-allowance-confirm-message"]) ? langJson.langValues["remove-allowance-confirm-message"] : "You are removing allowance for contract [CONTRACT_ID]";
    msg = msg.replace("[CONTRACT_ID]", contractAddr);
    showAllowanceConfirmDialog(msg, "remove");
    return false;
}

function setAddAllowanceQuantityToMax() {
    document.getElementById("txtAddAllowanceQuantity").value = "999999999999999999";
    onAddAllowanceQuantityInput();
    return false;
}

function onAddAllowanceQuantityInput() {
    if (!currentBlockchainNetwork) return;
    var fromValue = document.getElementById("ddlSwapFromToken").value;
    var amount = (document.getElementById("txtAddAllowanceQuantity").value || "").trim();
    if (!amount || parseFloat(amount) <= 0) return;
    (async function () {
        try {
            var payload = {
                rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
                chainId: parseInt(currentBlockchainNetwork.networkId, 10),
                fromTokenValue: fromValue,
                fromAddress: currentWalletAddress,
                amount: amount,
                fromDecimals: getSwapTokenDecimals(fromValue)
            };
            var res = await getSwapEstimateApproveGas(payload);
            if (res && res.success && res.gasLimit) document.getElementById("txtAddAllowanceGasLimit").value = res.gasLimit;
        } catch (e) { /* keep default */ }
        updateAddAllowanceGasFeeLabel();
    })();
}

function onAddAllowanceAddClick() {
    var contractAddr = getSwapContractAddress(document.getElementById("ddlSwapFromToken").value);
    var msg = (langJson && langJson.langValues && langJson.langValues["add-allowance-confirm-message"]) ? langJson.langValues["add-allowance-confirm-message"] : "You are adding allowance for contract [CONTRACT_ID]";
    msg = msg.replace("[CONTRACT_ID]", contractAddr);
    showAllowanceConfirmDialog(msg, "add");
    return false;
}

function onSwapConfirmNextClick() {
    if (swapNeedsApproval) {
        showSwapApprovalConfirmDialog();
        return false;
    }
    showSwapExecuteConfirmDialog();
    return false;
}

function executeSwap() {
    return onSwapNextClick();
}

async function refreshTransactionList() {
    return await refreshTransactionListWithContext(false);
}

async function refreshTransactionListWithContext(isPrev) {
    try {
        document.getElementById('divTxnRefreshStatus').style.display = "none";
        document.getElementById('divTxnLoadingStatus').style.display = "block";
        document.getElementById('tbodyPendingTransactions').innerHTML = "";
        document.getElementById('tbodyComplextedTransactions').innerHTML = "";

        await refreshTransactionListInner(false, isPrev);
        await refreshTransactionListInner(true, false);

        setTimeout(() => {
            document.getElementById('divTxnRefreshStatus').style.display = "block";
            document.getElementById('divTxnLoadingStatus').style.display = "none";
        }, "500");

        document.getElementById("divTxnRefreshStatus").focus();
    }
    catch (error) {
        if (isNetworkError(error)) {
            showWarnAlert(langJson.errors.internetDisconnected);
        } else {
            showWarnAlert(langJson.errors.invalidApiResponse + ' ' + error);
        }

        setTimeout(() => {
            document.getElementById('divTxnRefreshStatus').style.display = "block";
            document.getElementById('divTxnLoadingStatus').style.display = "none";
        }, "500");
    }
}

async function refreshTransactionListInner(isPending, isPrev) {
    let pageIndex = (isPending) ? 0 : currentTxnPageIndex;
    let tableBody = "";
    let currAddressLower = currentWalletAddress.toLowerCase();
    
    let txnListDetails = await getTransactionDetails(currentBlockchainNetwork.scanApiDomain, currentWalletAddress, pageIndex, isPending);
    if (txnListDetails == null || txnListDetails.transactionList == null) {
        if (isPending) {
            tableBody = getPendingTxnRow(currAddressLower);
            document.getElementById('tbodyPendingTransactions').innerHTML = tableBody;
        } else {
            document.getElementById('tbodyComplextedTransactions').innerHTML = "";
            currentTxnPageIndex = 0;                       
        } 
        return;
    }

    for (var i = 0; i < txnListDetails.transactionList.length; i++) {
        let txn = txnListDetails.transactionList[i];
        let txnRow = "";
        if (isPending) {
            txnRow = completedTxnOutRowTemplate;
        } else {
            if (txn.from.toLowerCase() == currentWalletAddress.toLowerCase()) {
                if (txn.status == true) {
                    txnRow = completedTxnOutRowTemplate;
                } else {
                    txnRow = failedTxnOutRowTemplate;
                }
            } else {
                if (txn.status == true) {
                    txnRow = completedTxnInRowTemplate;
                } else {
                    txnRow = failedTxnInRowTemplate;
                }
            }
        }
        txnRow = txnRow.replaceAll("[FROM]", htmlEncode(txn.from));

        if (txn.to != null) { //to address can be null for smart-contract creation transactions
            txnRow = txnRow.replaceAll("[TO]", htmlEncode(txn.to));
            txnRow = txnRow.replaceAll("[SHORT_TO]", getShortAddress(txn.to));
        } else {
            txnRow = txnRow.replaceAll("[TO]", "");
            txnRow = txnRow.replaceAll("[SHORT_TO]", "");
        }        

        txnRow = txnRow.replaceAll("[HASH]", htmlEncode(txn.hash));
        txnRow = txnRow.replaceAll("[SHORT_FROM]", getShortAddress(txn.from));
        
        txnRow = txnRow.replaceAll("[SHORT_HASH]", getShortAddress(txn.hash));
        txnRow = txnRow.replaceAll("[DATE]", htmlEncode(txn.createdAt.toLocaleString()));
        txnRow = txnRow.replaceAll("[VALUE]", htmlEncode(txn.value.toString()));
        tableBody = tableBody + txnRow;

        if (pendingTransactionsMap.has(currAddressLower + currentBlockchainNetwork.index.toString())) { //if txn appears in current transaction list, remove from pending
            let pendingTxn = pendingTransactionsMap.get(currAddressLower + currentBlockchainNetwork.index.toString());
            if (pendingTxn.hash.toLowerCase() === txn.hash.toLowerCase()) {
                pendingTransactionsMap.delete(currAddressLower + currentBlockchainNetwork.index.toString());
            }
        }
    }

    if (!isPending && !isPrev) {
        if (currentTxnPageIndex == 0) {
            currentTxnPageIndex = txnListDetails.pageCount;
        } else {
            currentTxnPageIndex = currentTxnPageIndex + 1;
        }
    }
    currentTxnPageCount = txnListDetails.pageCount;

    if (isPending) {
        tableBody = tableBody + getPendingTxnRow(currAddressLower);
        document.getElementById('tbodyPendingTransactions').innerHTML = tableBody;
    } else {
        document.getElementById('tbodyComplextedTransactions').innerHTML = tableBody;
    }    
}

function getPendingTxnRow(currAddressLower) {
    if (pendingTransactionsMap.has(currAddressLower + currentBlockchainNetwork.index.toString()) == false) {
        return "";
    }
    let pendingTxn = pendingTransactionsMap.get(currAddressLower + currentBlockchainNetwork.index.toString());
    let txnRow = completedTxnOutRowTemplate;
    txnRow = txnRow.replaceAll("[FROM]", htmlEncode(pendingTxn.from));
    txnRow = txnRow.replaceAll("[TO]", htmlEncode(pendingTxn.to));
    txnRow = txnRow.replaceAll("[HASH]", htmlEncode(pendingTxn.hash));
    txnRow = txnRow.replaceAll("[SHORT_FROM]", getShortAddress(pendingTxn.from));
    txnRow = txnRow.replaceAll("[SHORT_TO]", getShortAddress(pendingTxn.to));
    txnRow = txnRow.replaceAll("[SHORT_HASH]", getShortAddress(pendingTxn.hash));
    txnRow = txnRow.replaceAll("[DATE]", htmlEncode(pendingTxn.createdAt.toLocaleString()));
    txnRow = txnRow.replaceAll("[VALUE]", htmlEncode(pendingTxn.value.toString()));
    return txnRow;
}

async function OpenScanAddress(address) {
    let url = BLOCK_EXPLORER_ACCOUNT_TEMPLATE;
    url = url.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain);
    url = url.replace(ADDRESS_TEMPLATE, address);

    await OpenUrl(url);
}

async function OpenScanTxn(hash) {
    let url = BLOCK_EXPLORER_TRANSACTION_TEMPLATE;
    url = url.replace(BLOCK_EXPLORER_DOMAIN_TEMPLATE, currentBlockchainNetwork.blockExplorerDomain);
    url = url.replace(TRANSACTION_HASH_TEMPLATE, hash);

    await OpenUrl(url);
}

async function showPrevTxnPage() {
    if (currentTxnPageIndex > 1) {
        currentTxnPageIndex = currentTxnPageIndex - 1;
    } else if (currentTxnPageIndex == 1) {
        showWarnAlert(langJson.errors.noMoreTxns);
        return;
    } else if (currentTxnPageIndex == 0 && currentTxnPageCount > 0) {
        currentTxnPageIndex = currentTxnPageCount - 1;
    }
    await refreshTransactionListWithContext(true);
}

async function showNextTxnPage() {
    if (currentTxnPageIndex == 0 || currentTxnPageIndex == currentTxnPageCount) {
        showWarnAlert(langJson.errors.noMoreTxns);
        return;
    }
    currentTxnPageIndex = currentTxnPageIndex + 1;
    await refreshTransactionList();
}

async function showHelp() {
    OpenUrl("https://QuantumCoin.org");
    return false;
}

async function openBlockExplorer() {
    OpenUrl(HTTPS + currentBlockchainNetwork.blockExplorerDomain);
    return false;
}

function clickOnEnter(event, object) {
    if (event.keyCode == 13) {
        object.click();
    }
}

async function offlineTxnSigningSetDefaultValue(value) {
    let itemStoreResult = await storageSetItem(DEFAULT_OFFLINE_TXN_SIGNING_SETTING_KEY, value);
    if (itemStoreResult != true) {
        throw new Error("offlineTxnSigningSetDefaultValue item store failed");
    }

    return true;
}

async function offlineTxnSigningGetDefaultValue() {
    let value = await storageGetItem(DEFAULT_OFFLINE_TXN_SIGNING_SETTING_KEY);
    if (value == null) {
        return false;
    }

    if (value === "enabled") {
        return true;
    }

    return false;
}

async function saveSelectedOfflineTxnSigningSetting() {
    const radioButtons = document.querySelectorAll('input[name="optOfflineTxnSigning"]');
    let selectedValue = "";
    radioButtons.forEach(function (radioButton) {
        if (radioButton.checked) {
            selectedValue = radioButton.value;
        }
    });
    let result = await offlineTxnSigningSetDefaultValue(selectedValue);
    if (result == false) {
        showWarnAlert(getGenericError(""));
    } else {
        return;
    }
}
