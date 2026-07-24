import { OfflineSignedTransaction, WriteTextToClipboard, offlineSignTransactionBundle, prepareOfflineSigning } from "../lib/bridge";
import { walletGetByAddress } from "../lib/wallet";
import { byId, networkStore, walletStore } from "./state";
import { hideWaitingBox, showOfflineSignatureDialog, showWaitingBox, showWarnAlert, TransactionReviewSubmission } from "./dialog";
import { advancedSigningGetDefaultValue } from "./settings";
import { applySwapReleaseToPayload } from "./release";
export { amountAfterSlippage } from "./offline-flow-core";

export type OfflineStepKind = "approve" | "swap" | "createPair" | "deployToken" | "addLiquidity" | "removeLiquidity";

export interface OfflineBundleStep {
    kind: OfflineStepKind;
    label: string;
    gasLimit: number;
    data: Record<string, unknown>;
}

let currentBundle: OfflineSignedTransaction[] = [];
let bundleBound = false;

function closeBundle(): void {
    const dialog = byId<HTMLDialogElement>("modalOfflineBundle");
    dialog.style.display = "none";
    if (dialog.open) dialog.close();
    currentBundle = [];
}

function showBundle(transactions: OfflineSignedTransaction[]): void {
    currentBundle = transactions;
    const container = byId("divOfflineBundleTransactions");
    container.textContent = "";
    for (const transaction of transactions) {
        const section = document.createElement("div");
        section.style.marginTop = "12px";
        const heading = document.createElement("div");
        heading.className = "heading medium";
        heading.textContent = transaction.label + " (nonce " + transaction.nonce + ")";
        // Same look as the send flow's offline-signature box (#txtOfflineSignature):
        // soft-wrapped hex with a vertical scrollbar. border-box keeps the
        // 100%-wide textarea (padding + border included) inside the dialog
        // instead of overflowing its right edge.
        const text = document.createElement("textarea");
        text.readOnly = true;
        text.value = transaction.txData;
        text.rows = 8;
        text.style.width = "100%";
        text.style.boxSizing = "border-box";
        text.style.overflow = "auto";
        section.appendChild(heading);
        if (transaction.contractAddress) {
            const address = document.createElement("div");
            address.textContent = "Contract: " + transaction.contractAddress;
            address.style.wordBreak = "break-all";
            section.appendChild(address);
        }
        section.appendChild(text);
        container.appendChild(section);
    }
    if (!bundleBound) {
        bundleBound = true;
        byId("btnOfflineBundleClose").addEventListener("click", closeBundle);
        byId("btnOfflineBundleCopy").addEventListener("click", () => {
            void WriteTextToClipboard(JSON.stringify(currentBundle, null, 2));
        });
    }
    const dialog = byId<HTMLDialogElement>("modalOfflineBundle");
    dialog.style.display = "block";
    dialog.showModal();
}

export async function signOfflineBundle(
    steps: OfflineBundleStep[],
    submission: TransactionReviewSubmission,
): Promise<boolean> {
    if (submission.startingNonce == null) return false;
    showWaitingBox("Signing transactions offline...");
    try {
        const wallet = await walletGetByAddress(submission.password, walletStore.currentWalletAddress);
        if (!wallet) {
            showWarnAlert("Unable to open wallet.");
            return false;
        }
        const network = networkStore.currentBlockchainNetwork;
        if (!network) throw new Error("Network required");
        const payload = applySwapReleaseToPayload({
            chainId: Number(network.networkId),
            startingNonce: submission.startingNonce,
            privateKey: await wallet.getPrivateKey(),
            publicKey: await wallet.getPublicKey(),
            advancedSigningEnabled: await advancedSigningGetDefaultValue(),
            steps,
        });
        const result = await offlineSignTransactionBundle(payload);
        if (!result.success || !result.transactions) {
            showWarnAlert(result.error || "Unable to sign offline transactions.");
            return false;
        }
        setTimeout(() => showBundle(result.transactions!), 0);
        return true;
    } catch (err: any) {
        showWarnAlert(err && err.message ? String(err.message) : String(err));
        return false;
    } finally {
        hideWaitingBox();
    }
}

export async function signOfflineStep(
    step: OfflineBundleStep,
    submission: TransactionReviewSubmission,
    onSignatureClose: () => void,
): Promise<boolean> {
    if (submission.startingNonce == null) return false;
    showWaitingBox("Signing transaction offline...");
    try {
        const wallet = await walletGetByAddress(submission.password, walletStore.currentWalletAddress);
        if (!wallet) {
            showWarnAlert("Unable to open wallet.");
            return false;
        }
        const network = networkStore.currentBlockchainNetwork;
        if (!network) throw new Error("Network required");
        const payload = applySwapReleaseToPayload({
            chainId: Number(network.networkId),
            startingNonce: submission.startingNonce,
            privateKey: await wallet.getPrivateKey(),
            publicKey: await wallet.getPublicKey(),
            advancedSigningEnabled: await advancedSigningGetDefaultValue(),
            steps: [step],
        });
        const result = await offlineSignTransactionBundle(payload);
        if (!result.success || !result.transactions || result.transactions.length !== 1) {
            showWarnAlert(result.error || "Unable to sign offline transaction.");
            return false;
        }
        const txData = result.transactions[0].txData;
        setTimeout(() => { void showOfflineSignatureDialog(txData, onSignatureClose); }, 0);
        return true;
    } catch (err: any) {
        showWarnAlert(err && err.message ? String(err.message) : String(err));
        return false;
    } finally {
        hideWaitingBox();
    }
}

export function offlineDeadline(seconds = 1200): string {
    return String(Math.floor(Date.now() / 1000) + seconds);
}

export async function prepareOfflineDefaults(): Promise<{ nonce: string; deadline: string; fromRpc: boolean }> {
    const network = networkStore.currentBlockchainNetwork;
    if (network) {
        const result = await prepareOfflineSigning({
            rpcEndpoint: network.rpcEndpoint,
            chainId: Number(network.networkId),
            ownerAddress: walletStore.currentWalletAddress,
        });
        if (result.success) {
            return {
                nonce: result.nonce == null ? "" : String(result.nonce),
                deadline: String((result.chainTimestamp || Math.floor(Date.now() / 1000)) + 1200),
                fromRpc: true,
            };
        }
    }
    return { nonce: "", deadline: offlineDeadline(), fromRpc: false };
}

