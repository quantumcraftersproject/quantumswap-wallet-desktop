// Settings -> Advanced screens (children of #settings-content): the Advanced
// hub plus the Tokens (create token), Pools (pair table + create pair) and
// Liquidity (positions / add / remove) feature screens. Ported from the
// quantumswap-web-app's createToken / poolExplorer / createPair /
// addLiquidity / removeLiquidity / positions views.
import { el } from "../ui/dom";
import type { ScreenModule } from "../ui/screens";
import { showWalletScreen } from "../app/app";
import {
    onCreatePairClick,
    onCreatePairGasIconClick,
    onCreateTokenClick,
    onCreateTokenGasIconClick,
    onCreateTokenInput,
    onAddLiquidityClick,
    onRemoveLiquidityClick,
    onLiquidityAmountInput,
    openAdvancedTokenPicker,
    onLiquidityBackClick,
    onLiquiditySlippageInput,
    onLiquidityTokenChange,
    onPoolsBackClick,
    onPoolsTokenChange,
    onRemovePercentChange,
    onRemoveSlippageInput,
    refreshLiquidityPositions,
    refreshPoolsTable,
    setRemovePercentPreset,
    showAdvancedScreen,
    showLiquidityAddPanel,
    showLiquidityOfflineRemovePanel,
    showLiquidityScreen,
    showPoolsCreatePanel,
    showPoolsScreen,
    showTokenCreateScreen,
} from "../app/advanced";

const ADV_INPUT_STYLE = "text-align: left; width: 100%; border: none; outline: none; font-weight: 500; color: black;";
const ADV_INFO_ROW_STYLE = "font-size: 0.85em; color: #ffffff; margin-top: 3px;";
const ADV_CONTRACT_ROW_STYLE = "font-size: 0.85em; color: #ffffff; margin-top: 4px; display: none; flex-wrap: nowrap; align-items: center; gap: 6px;";
const ADV_CONTRACT_LINK_STYLE = "color: inherit; text-decoration: underline; word-break: break-all; min-width:0; flex:1;";
// Scrollable content areas keep a right padding so inputs / dropdowns end
// before the overlay scrollbar instead of running under it.
const ADV_SCROLL_PAD = "padding-right: 14px;";

type MenuAction = () => unknown;

function menuLink(langKey: string, textContent: string, tabindex: string, action: MenuAction): HTMLElement {
    return el("div", { class: "vertical-menu-item" }, [
        el("a", {
            href: "#",
            "data-lang-key": langKey,
            tabindex,
            onclick: (event: Event) => { event.preventDefault(); void action(); },
        }, [textContent]),
    ]);
}

// Token picker: the swap screen's selectwrapper + selectbox combo so the
// dropdown fills the row like the textboxes do.
function tokenPicker(selectId: string, tabindex: string, onchange: () => unknown): HTMLElement {
    return el("div", { style: "width:100%;" }, [
        el("button", {
            id: "btn" + selectId + "Picker", class: "token-picker-trigger", type: "button",
            tabindex, onclick: () => openAdvancedTokenPicker(selectId),
        }, ["Select token"]),
        el("div", { class: "selectwrapper", style: "display:none;" }, [
            el("select", { id: selectId, class: "selectbox", onchange: () => { void onchange(); } }),
        ]),
    ]);
}

// Label above an offline-signing-only input (these inputs are prefilled, so
// the placeholder alone is usually hidden and the field looks unlabeled).
function offlineFieldLabel(textContent: string): HTMLElement {
    return el("div", { class: "heading medium" }, [textContent]);
}

// Right-aligned in-flow action button row (no float, so it always takes
// vertical space and cannot overlap the content above or the box border).
function actionButtonRow(buttonId: string, langKey: string, textContent: string, tabindex: string, onclick: () => unknown, marginBottom = "0"): HTMLElement {
    return el("div", { style: "display:flex; justify-content:flex-end; margin-top:10px; margin-bottom:" + marginBottom + ";" }, [
        el("div", { class: "large_button_container heading large", "data-lang-key": langKey, role: "button", tabindex, id: buttonId, onclick: () => { void onclick(); } }, [textContent]),
    ]);
}

// Balance line + full contract-address row under a token picker. The link /
// copy handlers are (re)bound by app/advanced.ts when the selection changes.
function pickerInfoRows(suffix: string): HTMLElement[] {
    return [
        el("div", { id: "divAdvBalanceRow" + suffix, style: ADV_INFO_ROW_STYLE + " display:none;" }, [
            el("span", { "data-lang-key": "balance" }, ["Balance"]),
            ": ",
            el("span", { id: "spanAdvBalance" + suffix }, ["0"]),
        ]),
        el("div", { id: "divAdvContractRow" + suffix, style: ADV_CONTRACT_ROW_STYLE }, [
            el("a", { href: "#", id: "aAdvContract" + suffix, style: ADV_CONTRACT_LINK_STYLE }, ["..."]),
            el("span", { class: "copy-container copy-container-small", role: "button", style: "flex-shrink: 0; width:15px; height:15px; cursor:pointer;", id: "divAdvCopyContract" + suffix, title: "Copy" }),
        ]),
    ];
}

// Header row with a gas fee label + gas icon pinned to the right (same
// structure as the send / swap screens' gas-header-row).
function gasHeaderRow(headingLangKey: string, headingText: string, gasFeeId: string, gasIconId: string, gasTabIndex: string, onGasClick: () => unknown, tokenLoadingId?: string): HTMLElement {
    const rightChildren: HTMLElement[] = [];
    if (tokenLoadingId) {
        rightChildren.push(el("div", { id: tokenLoadingId, style: "display:none; width:30px; height:30px;" }, [
            el("img", { src: "assets/icons/loading.gif", alt: "Loading tokens", style: "width:30px; height:30px;" }),
        ]));
    }
    rightChildren.push(el("span", { id: gasFeeId, class: "gas-fee-label" }));
    rightChildren.push(el("div", { id: gasIconId, class: "gas-container", role: "button", tabindex: gasTabIndex, onclick: () => { void onGasClick(); } }));
    return el("div", { class: "gas-header-row" }, [
        el("div", { class: "heading bold", "data-lang-key": headingLangKey }, [headingText]),
        el("div", { class: "gas-header-right" }, rightChildren),
    ]);
}

// Heading with a refresh icon pinned to the top-right corner of the box. A
// hidden spinner (id = refreshId + "Loading") replaces the icon while the
// list is being fetched (same pattern as the home screen's balance refresh).
function refreshHeaderRow(headingClass: string, headingLangKey: string, headingText: string, refreshId: string, refreshTabIndex: string, onRefresh: () => unknown): HTMLElement {
    return el("div", { style: "display:flex; align-items:center; justify-content:space-between;" }, [
        el("div", { class: headingClass, "data-lang-key": headingLangKey }, [headingText]),
        el("div", { style: "flex-shrink:0; display:flex; align-items:center;" }, [
            el("div", { class: "refresh-container", role: "button", id: refreshId, title: "Refresh", tabindex: refreshTabIndex, onclick: () => { void onRefresh(); } }),
            el("div", { id: refreshId + "Loading", style: "display:none; width:30px; height:30px;" }, [
                el("img", { src: "assets/icons/loading.gif", alt: "Loading", style: "width:30px; height:30px;" }),
            ]),
        ]),
    ]);
}

function buildAdvancedScreen(): HTMLElement {
    return el("div", { class: "content", id: "advancedScreen", style: "display: none;" }, [
        el("div", { class: "center-content" }, [
            el("div", { class: "center-content-rounded-container", style: "margin-top:15px;" }, [
                el("div", { class: "back-container", role: "button", tabindex: "4", onclick: () => { void showWalletScreen(); } }),
                el("div", { class: "roundex-box scrollbar", style: "overflow-y: auto;overflow-x: auto;" }, [
                    el("div", { class: "heading bold large", "data-lang-key": "advanced" }, ["Advanced"]),
                    el("div", { class: "divider" }),
                    el("div", { class: "input_container" }, [
                        el("div", { class: "vertical-menu" }, [
                            menuLink("adv-tokens", "Tokens", "1", showTokenCreateScreen),
                            el("div", { class: "divider" }),
                            menuLink("adv-liquidity", "Liquidity", "2", showLiquidityScreen),
                            el("div", { class: "divider" }),
                            menuLink("adv-pools", "Pools", "3", showPoolsScreen),
                            el("div", { class: "divider" }),
                        ]),
                    ]),
                ]),
            ]),
        ]),
    ]);
}

function buildTokenCreateScreen(): HTMLElement {
    const decimalsOptions: HTMLElement[] = [];
    for (let d = 1; d <= 18; d++) {
        const attrs: Record<string, string> = { value: String(d) };
        if (d === 18) attrs.selected = "selected";
        decimalsOptions.push(el("option", attrs, [String(d)]));
    }
    return el("div", { class: "content", id: "tokenCreateScreen", style: "display: none;" }, [
        el("div", { class: "center-content" }, [
            el("div", { class: "center-content-rounded-container", style: "margin-top:15px;" }, [
                el("div", { class: "back-container", role: "button", tabindex: "7", onclick: () => { void showAdvancedScreen(); } }),
                el("div", { class: "roundex-box", style: "padding-top:15px; padding-bottom:65px;" }, [
                    gasHeaderRow("create-token", "Create Token", "spanCreateTokenGasFee", "divCreateTokenGasIcon", "8", onCreateTokenGasIconClick),
                    el("div", { class: "divider" }),
                    el("div", { class: "blocks-content scrollbar", style: "text-align: left; overflow: auto; " + ADV_SCROLL_PAD }, [
                        el("div", { class: "input_container" }, [
                            el("div", { class: "heading medium", "data-lang-key": "token-name" }, ["Token Name"]),
                            el("input", { class: "tab-name", style: ADV_INPUT_STYLE, type: "text", autocomplete: "off", id: "txtCreateTokenName", name: "token_name", maxlength: "48", tabindex: "1", oninput: () => onCreateTokenInput() }),
                            el("div", { class: "divider" }),
                            el("div", { class: "heading medium", "data-lang-key": "token-symbol" }, ["Token Symbol"]),
                            el("input", { class: "tab-name", style: ADV_INPUT_STYLE, type: "text", autocomplete: "off", id: "txtCreateTokenSymbol", name: "token_symbol", maxlength: "16", tabindex: "2", oninput: () => onCreateTokenInput() }),
                            el("div", { class: "divider" }),
                            el("div", { class: "heading medium", "data-lang-key": "token-decimals" }, ["Decimals"]),
                            el("div", { class: "selectwrapper", style: "width:100%;" }, [
                                el("select", { id: "ddlCreateTokenDecimals", class: "selectbox", tabindex: "3", onchange: () => onCreateTokenInput() }, decimalsOptions),
                            ]),
                            el("div", { class: "divider" }),
                            el("div", { class: "heading medium", "data-lang-key": "token-total-supply" }, ["Total Supply"]),
                            el("input", { class: "tab-name", style: ADV_INPUT_STYLE, type: "text", autocomplete: "off", id: "txtCreateTokenSupply", name: "token_supply", tabindex: "4", oninput: () => onCreateTokenInput() }),
                            el("div", { class: "divider" }),
                            el("div", { id: "divCreateTokenError", class: "tx-steps-error", style: "display:none;" }),
                            el("div", { id: "divCreateTokenOfflineNotice", class: "tx-steps-error", style: "display:none;" }, ["Offline signing: RPC values are used when reachable; the transaction will not be broadcast."]),
                        ]),
                        actionButtonRow("btnCreateToken", "create", "Create", "5", onCreateTokenClick, "15px"),
                    ]),
                ]),
            ]),
        ]),
    ]);
}

function buildPoolsScreen(): HTMLElement {
    return el("div", { class: "content", id: "poolsScreen", style: "display: none;" }, [
        el("div", { class: "center-content" }, [
            el("div", { class: "center-content-rounded-container", style: "margin-top:15px;" }, [
                el("div", { class: "back-container", role: "button", tabindex: "20", onclick: () => { void onPoolsBackClick(); } }),
                el("div", { class: "roundex-box", "data-fluid-height": "true", style: "padding-top:15px; padding-bottom:15px;" }, [
                    refreshHeaderRow("heading large", "pools", "Pools", "divPoolsRefresh", "2", () => refreshPoolsTable()),
                    el("div", { class: "divider" }),

                    // Pool list (default view).
                    el("div", { id: "divPoolsListPanel" }, [
                        el("div", { class: "blocks-content scrollbar", style: "text-align: left; overflow: auto; max-height:min(470px, calc(100vh - 330px)); " + ADV_SCROLL_PAD, id: "divPoolsList", tabindex: "1" }, [
                            el("div", { id: "divPoolsListError", class: "tx-steps-error", style: "display:none;" }),
                            el("table", { class: "styled-table" }, [
                                el("thead", {}, [
                                    el("tr", {}, [
                                        el("th", { "data-lang-key": "pool-pair" }, ["Pair"]),
                                        el("th", { "data-lang-key": "pool-reserves" }, ["Reserves"]),
                                        el("th", { "data-lang-key": "pool-address" }, ["Address"]),
                                    ]),
                                ]),
                                el("tbody", { id: "tbodyPoolsRow" }),
                            ]),
                        ]),
                        el("div", { class: "divider" }),
                        actionButtonRow("btnPoolsOpenCreate", "create-pair", "Create Pair", "3", showPoolsCreatePanel),
                    ]),

                    // Create-pair panel (opened via the Create Pair button).
                    el("div", { id: "divPoolsCreatePanel", style: "display:none;" }, [
                        gasHeaderRow("create-pair", "Create Pair", "spanCreatePairGasFee", "divCreatePairGasIcon", "10", onCreatePairGasIconClick, "divPoolsTokenListLoading"),
                        el("div", { class: "blocks-content scrollbar", style: "text-align: left; overflow: auto; " + ADV_SCROLL_PAD }, [
                            el("div", { class: "input_container" }, [
                                el("div", { class: "heading medium", "data-lang-key": "token-a" }, ["Token A"]),
                                tokenPicker("ddlPoolsTokenA", "11", onPoolsTokenChange),
                                ...pickerInfoRows("PoolsA"),
                                el("div", { class: "divider" }),
                                el("div", { class: "heading medium", "data-lang-key": "token-b" }, ["Token B"]),
                                tokenPicker("ddlPoolsTokenB", "13", onPoolsTokenChange),
                                ...pickerInfoRows("PoolsB"),
                                el("div", { class: "divider" }),
                                el("div", { id: "divPoolsPairWarn", class: "tx-steps-error", style: "display:none;" }),
                                el("div", { id: "divCreatePairOfflineNotice", class: "tx-steps-error", style: "display:none;" }, ["Offline signing: pair existence may not be verified."]),
                            ]),
                            actionButtonRow("btnPoolsCreatePair", "create-pair", "Create Pair", "15", onCreatePairClick, "15px"),
                        ]),
                    ]),
                ]),
            ]),
        ]),
    ]);
}

function buildLiquidityScreen(): HTMLElement {
    return el("div", { class: "content", id: "liquidityScreen", style: "display: none;" }, [
        el("div", { class: "center-content" }, [
            el("div", { class: "center-content-rounded-container", style: "margin-top:15px;" }, [
                el("div", { class: "back-container", role: "button", tabindex: "40", onclick: () => { void onLiquidityBackClick(); } }),
                el("div", { class: "roundex-box", "data-fluid-height": "true", style: "padding-top:15px; padding-bottom:15px;" }, [
                    el("div", {}, [
                        el("div", { class: "heading large", style: "float:left;width:fit-content;", "data-lang-key": "liquidity" }, ["Liquidity"]),
                    ]),
                    el("div", { class: "divider" }),

                    // My positions (default view).
                    el("div", { id: "divLiquidityPositionsPanel" }, [
                        el("div", { class: "blocks-content scrollbar", style: "text-align: left; overflow: auto; max-height:min(510px, calc(100vh - 330px)); " + ADV_SCROLL_PAD }, [
                            refreshHeaderRow("heading medium bold", "my-positions", "My Positions", "divLiquidityPositionsRefresh", "2", () => refreshLiquidityPositions()),
                            el("div", { id: "divLiquidityPositionsError", class: "tx-steps-error", style: "display:none;" }),
                            el("div", { id: "divLiquidityPositionsEmpty", style: "display:none;", "data-lang-key": "no-positions" }, ["You have no liquidity positions."]),
                            el("div", { id: "divLiquidityPositionsList" }),
                        ]),
                        el("div", { class: "divider" }),
                        el("div", { style: "align-content:center;" }, [
                            el("a", { href: "#", "data-lang-key": "add-liquidity", tabindex: "1", onclick: (event: Event) => { event.preventDefault(); void showLiquidityAddPanel(null); } }, ["Add Liquidity"]),
                            el("span", { id: "linkLiquidityOfflineRemove", style: "display:none;" }, [
                                " \u00a0 ",
                                el("a", { href: "#", "data-lang-key": "remove-liquidity", onclick: (event: Event) => { event.preventDefault(); showLiquidityOfflineRemovePanel(); } }, ["Remove Liquidity"]),
                            ]),
                        ]),
                    ]),

                    // Add-liquidity panel.
                    el("div", { id: "divLiquidityAddPanel", style: "display:none;" }, [
                        el("div", { style: "display:flex; align-items:center; justify-content:space-between;" }, [
                            el("div", { class: "heading bold", "data-lang-key": "add-liquidity" }, ["Add Liquidity"]),
                            el("div", { id: "divLiquidityTokenListLoading", style: "display:none; width:30px; height:30px;" }, [
                                el("img", { src: "assets/icons/loading.gif", alt: "Loading tokens", style: "width:30px; height:30px;" }),
                            ]),
                        ]),
                        el("div", { class: "blocks-content scrollbar", style: "text-align: left; overflow: auto; max-height: calc(100vh - 235px); " + ADV_SCROLL_PAD }, [
                            el("div", { class: "input_container" }, [
                                el("div", { class: "heading medium", "data-lang-key": "token-a" }, ["Token A"]),
                                tokenPicker("ddlLiquidityTokenA", "11", onLiquidityTokenChange),
                                ...pickerInfoRows("LiquidityA"),
                                el("input", { class: "tab-name", style: ADV_INPUT_STYLE, type: "text", autocomplete: "off", id: "txtLiquidityAmountA", name: "liq_amount_a", "data-placeholder-key": "quantity", placeholder: "Quantity", tabindex: "13", oninput: () => { void onLiquidityAmountInput("A"); } }),
                                el("div", { class: "divider" }),
                                el("div", { class: "heading medium", "data-lang-key": "token-b" }, ["Token B"]),
                                tokenPicker("ddlLiquidityTokenB", "14", onLiquidityTokenChange),
                                ...pickerInfoRows("LiquidityB"),
                                el("input", { class: "tab-name", style: ADV_INPUT_STYLE, type: "text", autocomplete: "off", id: "txtLiquidityAmountB", name: "liq_amount_b", "data-placeholder-key": "quantity", placeholder: "Quantity", tabindex: "16", oninput: () => { void onLiquidityAmountInput("B"); } }),
                                el("div", { class: "divider" }),
                                el("div", { class: "heading medium", "data-lang-key": "slippage" }, ["Slippage %"]),
                                el("input", { class: "tab-name", style: ADV_INPUT_STYLE, type: "text", autocomplete: "off", id: "txtLiquiditySlippage", name: "liq_slippage", value: "0.5", tabindex: "17", oninput: () => onLiquiditySlippageInput() }),
                                el("div", { class: "divider" }),
                                el("div", { id: "divLiquidityOfflineAddFields", style: "display:none;" }, [
                                    el("div", { class: "tx-steps-error" }, ["Offline signing: allowances and pair state may not be verified."]),
                                    offlineFieldLabel("Deadline (Unix timestamp)"),
                                    el("input", { id: "txtLiquidityOfflineDeadline", class: "tab-name", style: ADV_INPUT_STYLE, type: "number", placeholder: "Deadline (Unix timestamp)" }),
                                    offlineFieldLabel("Approval gas limit"),
                                    el("input", { id: "txtLiquidityOfflineApprovalGas", class: "tab-name", style: ADV_INPUT_STYLE, type: "number", value: "84000", placeholder: "Approval gas limit" }),
                                    offlineFieldLabel("Add-liquidity gas limit"),
                                    el("input", { id: "txtLiquidityOfflineAddGas", class: "tab-name", style: ADV_INPUT_STYLE, type: "number", value: "600000", placeholder: "Add-liquidity gas limit" }),
                                ]),
                                el("div", { id: "divLiquidityFirstProviderWarn", style: "display:none;", "data-lang-key": "first-provider-warn" }, ["This pool is empty. You are the first liquidity provider: the ratio of the amounts you add sets the initial price of this pair."]),
                                el("div", { id: "divLiquidityAddError", class: "tx-steps-error", style: "display:none;" }),
                            ]),
                            actionButtonRow("btnLiquidityAdd", "add", "Add", "18", onAddLiquidityClick, "15px"),
                        ]),
                    ]),

                    // Remove-liquidity panel (opened from a position card).
                    el("div", { id: "divLiquidityRemovePanel", style: "display:none;" }, [
                        el("div", { class: "heading bold", "data-lang-key": "remove-liquidity" }, ["Remove Liquidity"]),
                        el("div", { class: "blocks-content scrollbar", style: "text-align: left; overflow: auto; max-height: calc(100vh - 235px); " + ADV_SCROLL_PAD }, [
                            el("div", { class: "input_container" }, [
                                el("div", { class: "heading medium", id: "divLiquidityRemovePair" }),
                                el("div", { class: "divider" }),
                                el("div", { class: "heading medium" }, [
                                    el("span", { "data-lang-key": "remove-percent" }, ["Amount to remove"]),
                                    el("span", {}, [": "]),
                                    el("span", { id: "spanLiquidityRemovePercent" }, ["50%"]),
                                ]),
                                el("input", { type: "range", min: "1", max: "100", value: "50", id: "rngLiquidityRemovePercent", style: "width:100%;", tabindex: "26", oninput: () => onRemovePercentChange() }),
                                el("div", {}, [
                                    el("a", { href: "#", tabindex: "27", onclick: (event: Event) => { event.preventDefault(); setRemovePercentPreset(25); } }, ["25%"]),
                                    el("span", {}, [" \u00a0 "]),
                                    el("a", { href: "#", tabindex: "28", onclick: (event: Event) => { event.preventDefault(); setRemovePercentPreset(50); } }, ["50%"]),
                                    el("span", {}, [" \u00a0 "]),
                                    el("a", { href: "#", tabindex: "29", onclick: (event: Event) => { event.preventDefault(); setRemovePercentPreset(75); } }, ["75%"]),
                                    el("span", {}, [" \u00a0 "]),
                                    el("a", { href: "#", tabindex: "30", onclick: (event: Event) => { event.preventDefault(); setRemovePercentPreset(100); } }, ["100%"]),
                                ]),
                                el("div", { class: "divider" }),
                                el("div", { id: "divLiquidityRemoveEstimates", style: "white-space:pre-line;" }),
                                el("div", { class: "divider" }),
                                el("div", { id: "divLiquidityOfflineRemoveFields", style: "display:none;" }, [
                                    offlineFieldLabel("LP pair contract address"),
                                    el("input", { id: "txtLiquidityOfflinePairAddress", class: "tab-name", style: ADV_INPUT_STYLE, type: "text", placeholder: "LP pair contract address" }),
                                    offlineFieldLabel("Token A contract"),
                                    el("input", { id: "txtLiquidityOfflineTokenA", class: "tab-name", style: ADV_INPUT_STYLE, type: "text", placeholder: "Token A contract" }),
                                    offlineFieldLabel("Token B contract"),
                                    el("input", { id: "txtLiquidityOfflineTokenB", class: "tab-name", style: ADV_INPUT_STYLE, type: "text", placeholder: "Token B contract" }),
                                    offlineFieldLabel("Token A decimals"),
                                    el("input", { id: "txtLiquidityOfflineDecimalsA", class: "tab-name", style: ADV_INPUT_STYLE, type: "number", value: "18", placeholder: "Token A decimals" }),
                                    offlineFieldLabel("Token B decimals"),
                                    el("input", { id: "txtLiquidityOfflineDecimalsB", class: "tab-name", style: ADV_INPUT_STYLE, type: "number", value: "18", placeholder: "Token B decimals" }),
                                    offlineFieldLabel("LP amount"),
                                    el("input", { id: "txtLiquidityOfflineLpAmount", class: "tab-name", style: ADV_INPUT_STYLE, type: "text", placeholder: "LP amount" }),
                                    offlineFieldLabel("Minimum token A amount"),
                                    el("input", { id: "txtLiquidityOfflineMinA", class: "tab-name", style: ADV_INPUT_STYLE, type: "text", placeholder: "Minimum token A amount" }),
                                    offlineFieldLabel("Minimum token B amount"),
                                    el("input", { id: "txtLiquidityOfflineMinB", class: "tab-name", style: ADV_INPUT_STYLE, type: "text", placeholder: "Minimum token B amount" }),
                                    offlineFieldLabel("Deadline (Unix timestamp)"),
                                    el("input", { id: "txtLiquidityOfflineRemoveDeadline", class: "tab-name", style: ADV_INPUT_STYLE, type: "number", placeholder: "Deadline (Unix timestamp)" }),
                                    offlineFieldLabel("LP approval gas limit"),
                                    el("input", { id: "txtLiquidityOfflineRemoveApprovalGas", class: "tab-name", style: ADV_INPUT_STYLE, type: "number", value: "84000", placeholder: "LP approval gas limit" }),
                                    offlineFieldLabel("Remove-liquidity gas limit"),
                                    el("input", { id: "txtLiquidityOfflineRemoveGas", class: "tab-name", style: ADV_INPUT_STYLE, type: "number", value: "600000", placeholder: "Remove-liquidity gas limit" }),
                                ]),
                                el("div", { class: "heading medium", "data-lang-key": "slippage" }, ["Slippage %"]),
                                el("input", { class: "tab-name", style: ADV_INPUT_STYLE, type: "text", autocomplete: "off", id: "txtLiquidityRemoveSlippage", name: "liq_rem_slippage", value: "0.5", tabindex: "31", oninput: () => onRemoveSlippageInput() }),
                                el("div", { class: "divider" }),
                                el("div", { id: "divLiquidityRemoveError", class: "tx-steps-error", style: "display:none;" }),
                            ]),
                            actionButtonRow("btnLiquidityRemove", "remove", "Remove", "32", onRemoveLiquidityClick, "15px"),
                        ]),
                    ]),
                ]),
            ]),
        ]),
    ]);
}

export const advancedScreenModules: ScreenModule[] = [
    { parentId: "settings-content", build: buildAdvancedScreen },
    { parentId: "settings-content", build: buildTokenCreateScreen },
    { parentId: "settings-content", build: buildPoolsScreen },
    { parentId: "settings-content", build: buildLiquidityScreen },
];
