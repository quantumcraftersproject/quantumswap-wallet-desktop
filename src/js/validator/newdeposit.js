const NEW_DEPOSIT_GAS = 250000;

async function newDeposit() {
    let validatorAddress = document.getElementById("txtValidatorAddress").value;
    let validatorDepositCoins = document.getElementById("txtValidatorDepositCoins").value;
    var password = document.getElementById("pwdValidator").value;

    if (validatorAddress == null || validatorAddress.length < ADDRESS_LENGTH_CHECK || await IsValidAddress(validatorAddress) == false) {
        showWarnAlert(langJson.errors.quantumAddr);
        return false;
    }

    if (currentWalletAddress.toLowerCase().trim() === validatorAddress.toLowerCase().trim()) {
        showWarnAlert(langJson.errors.validatorDepositorAddress);
        return false;
    }

    if (validatorDepositCoins == null || validatorDepositCoins.length < 1) {
        showWarnAlert(langJson.errors.enterAmount);
        return false;
    }

    let okQuantity = await isValidEther(validatorDepositCoins);
    if (isValidEther(okQuantity) == false) {
        showWarnAlert(langJson.errors.enterAmount);
        return false;
    }

    offlineSignEnabled = await offlineTxnSigningGetDefaultValue();
    if (offlineSignEnabled === true) {
        let currentNonce = document.getElementById("txtCurrentNonceValidator").value;
        if (currentNonce == null || currentNonce.length < 1) {
            showWarnAlert(langJson.errors.enterCurrentNonce);
            return false;
        }

        let tempNonce = parseInt(currentNonce);
        if (Number.isInteger(tempNonce) == false || tempNonce < 0) {
            showWarnAlert(langJson.errors.enterCurrentNonce);
            return false;
        }
    }

    if (password == null || password.length < 2) {
        showWarnAlert(langJson.errors.enterQuantumPassword);
        return false;
    }

    let msg = langJson.langValues.validatorNewDepositConfirm;
    msg = msg.replace("[QUANTITY]", validatorDepositCoins);
    showConfirmAndExecuteOnConfirm(msg, onNewDepositConfirm);
}

async function onNewDepositConfirm() {
    showLoadingAndExecuteAsync(langJson.langValues.waitWalletOpen, decryptAndUnlockWalletNewDeposit);
}

async function decryptAndUnlockWalletNewDeposit() {
    var password = document.getElementById("pwdValidator").value;
    try {
        let quantumWallet = await walletGetByAddress(password, currentWalletAddress);
        if (quantumWallet == null) {
            hideWaitingBox();
            showWarnAlert(getGenericError());
            return;
        }
        newDepositSubmit(quantumWallet);
    }
    catch (error) {
        hideWaitingBox();
        showWarnAlert(langJson.errors.walletOpenError.replace(STORAGE_PATH_TEMPLATE, STORAGE_PATH) + " " + error)
        return;
    }
    return false;
}

async function newDepositSubmit(quantumWallet) {
    offlineSignEnabled = await offlineTxnSigningGetDefaultValue();
    if (offlineSignEnabled === true) {
        await newDepositOfflineSign(quantumWallet);
        return;
    }

    updateWaitingBox(langJson.langValues.pleaseWaitSubmit);
    let validatorAddress = document.getElementById("txtValidatorAddress").value;
    let validatorDepositCoins = document.getElementById("txtValidatorDepositCoins").value;

    try {
        var result = await submitStakingContract({
            rpcEndpoint: currentBlockchainNetwork.rpcEndpoint,
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            method: "newDeposit",
            methodArgs: [validatorAddress],
            value: validatorDepositCoins,
            gasLimit: NEW_DEPOSIT_GAS,
            privateKey: await quantumWallet.getPrivateKey(),
            publicKey: await quantumWallet.getPublicKey(),
            advancedSigningEnabled: await advancedSigningGetDefaultValue()
        });

        if (result && result.success && result.txHash) {
            let currentDate = new Date();
            let pendingTxn = new TransactionDetails(result.txHash, currentDate, quantumWallet.address, STAKING_CONTRACT_ADDRESS, validatorDepositCoins, true);
            pendingTransactionsMap.set(quantumWallet.address.toLowerCase() + currentBlockchainNetwork.index.toString(), pendingTxn);

            setTimeout(() => {
                hideWaitingBox();
                showAlertAndExecuteOnClose(langJson.langValues.sendRequest.replace(TRANSACTION_HASH_TEMPLATE, result.txHash), showWalletScreen);
            }, 1000);
        } else {
            hideWaitingBox();
            showWarnAlert((result && result.error) ? result.error : langJson.errors.invalidApiResponse);
        }
    }
    catch (error) {
        hideWaitingBox();

        if (isNetworkError(error)) {
            showWarnAlert(langJson.errors.internetDisconnected);
        } else {
            showWarnAlert(langJson.errors.invalidApiResponse + ' ' + error);
        }
    }
}

async function newDepositOfflineSign(quantumWallet) {
    updateWaitingBox(langJson.langValues.pleaseWaitSubmit);
    let validatorAddress = document.getElementById("txtValidatorAddress").value;
    let validatorDepositCoins = document.getElementById("txtValidatorDepositCoins").value;
    let currentNonce = document.getElementById("txtCurrentNonceValidator").value;

    try {
        var result = await offlineSignStakingContract({
            chainId: parseInt(currentBlockchainNetwork.networkId, 10),
            method: "newDeposit",
            methodArgs: [validatorAddress],
            value: validatorDepositCoins,
            gasLimit: NEW_DEPOSIT_GAS,
            nonce: parseInt(currentNonce),
            privateKey: await quantumWallet.getPrivateKey(),
            publicKey: await quantumWallet.getPublicKey(),
            advancedSigningEnabled: await advancedSigningGetDefaultValue()
        });

        if (result && result.success && result.txData) {
            hideWaitingBox();
            await showOfflineSignatureDialog(result.txData);
        } else {
            hideWaitingBox();
            showWarnAlert((result && result.error) ? result.error : langJson.errors.unexpectedError);
        }
    }
    catch (error) {
        hideWaitingBox();
        showWarnAlert(langJson.errors.genericError + ' ' + error);
    }
}
