const MAX_BLOCKCHAIN_NETWORK_INDEX_KEY = "MaxBlockchainNetworkIndex4";
const DEFAULT_BLOCKCHAIN_NETWORK_INDEX_KEY = "DefaultBlockchainNetworkIndex4";
const BLOCKCHAIN_NETWORK_KEY_PREFIX = "BLOCKCHAIN_NETWORK_3_";
const MAX_BLOCKCHAIN_NETWORKS = 100;
const URL_REGEX_PATTERN = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

var regex = new RegExp('^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$');

var blockchainIndexToNetworkMap = new Map(); //key is index, value is BlockchainNetwork

const isValidDomainName = (supposedDomainName) => {
    if(/localhost:[0-9]{1,5}/.test(supposedDomainName) === true){
        return true;
    }
    // Allow any IPv4 address with optional port for HTTP (e.g. 192.168.1.1:8545 or 127.0.0.1)
    if(/^(\d{1,3}\.){3}\d{1,3}(:[0-9]{1,5})?$/.test(supposedDomainName) === true){
        return true;
    }

    return /^(?!-)[A-Za-z0-9-]+([\-\.]{1}[a-z0-9]+)*\.[A-Za-z]{2,6}$/i.test(
        supposedDomainName
    );
};

class BlockchainNetwork {
    constructor(scanApiDomain, blockExplorerDomain, networkId, blockchainName, rpcEndpoint, index) {
        if (scanApiDomain == null || blockExplorerDomain == null || networkId == null || blockchainName == null) {
            throw new Error("BlockchainNetwork null values")
        }

        if (isValidDomainName(scanApiDomain) == false) {
            throw new Error("BlockchainNetwork invalid URL")
        }

        let id = parseInt(networkId);

        if (isNumber(id) == false) {
            throw new Error('BlockchainNetwork invalid networkId.');
        }

        if (blockchainName == null || blockchainName.length < 5 || blockchainName.length > 30 || blockchainName.trim().length != blockchainName.length) {
            throw new Error('BlockchainNetwork invalid blockchainName.');
        }

        if (rpcEndpoint == null || rpcEndpoint === "") {
            rpcEndpoint = "public.rpc.quantumcoinapi.com";
        }
        if (isValidDomainName(rpcEndpoint) == false) {
            throw new Error("BlockchainNetwork invalid rpcEndpoint URL")
        }

        this.scanApiDomain = scanApiDomain;
        this.blockExplorerDomain = blockExplorerDomain;
        this.networkId = networkId;
        this.blockchainName = blockchainName;
        this.rpcEndpoint = rpcEndpoint;
        this.index = index;
    }
}

async function blockchainNetworkGetMaxIndex() {
    let result = await storageGetItem(MAX_BLOCKCHAIN_NETWORK_INDEX_KEY);
    if (result == null) {
        return -1;
    }

    let maxIndex = parseInt(result);

    if (isNumber(maxIndex) == false) {
        throw new Error('blockchainNetworkGetMaxIndex maxIndex is not a number.');
    }

    if (maxIndex < 0 || maxIndex > MAX_BLOCKCHAIN_NETWORKS) {
        throw new Error('blockchainNetworkGetMaxIndex maxIndex out of range.');
    }

    return maxIndex;
}

async function blockchainNetworksInit() {
    let result = await blockchainNetworkGetMaxIndex();
    if (result == -1) {
        await blockchainNetworkSaveDefaults();
    }
}

async function blockchainNetworkSaveDefaults() {
    var networksString = await ReadFile("./json/blockchain-networks.json");
    if (networksString == null) {
        throw new Error("loadDefaultBlockchainNetworks load error")
    }

    networkList = JSON.parse(networksString);
    if (networkList == null || networkList.networks == null || networkList.networks.length < 1) {
        throw new Error("loadDefaultBlockchainNetworks json error")
    }

    for (var i = 0; i < networkList.networks.length; i++) {
        let networkItem = JSON.stringify(networkList.networks[i]);
        let key = BLOCKCHAIN_NETWORK_KEY_PREFIX + i.toString();

        let itemStoreResult = await storageSetItem(key, networkItem);
        if (itemStoreResult != true) {
            throw new Error("saveDefaultBlockchainNetworks item store failed");
        }
    }

    let indexStoreResult = await storageSetItem(MAX_BLOCKCHAIN_NETWORK_INDEX_KEY, (networkList.networks.length - 1).toString());
    if (indexStoreResult != true) {
        throw new Error("saveDefaultBlockchainNetworks index store failed failed");
    }
}

async function blockchainNetworkAddNew(networkJson) {
    let networkItem = JSON.parse(networkJson);
    let maxIndex = await blockchainNetworkGetMaxIndex();
    maxIndex = maxIndex + 1;
    let blockchainNetwork = new BlockchainNetwork(networkItem.scanApiDomain, networkItem.blockExplorerDomain, networkItem.networkId, networkItem.blockchainName, networkItem.rpcEndpoint, maxIndex);
    let key = BLOCKCHAIN_NETWORK_KEY_PREFIX + maxIndex.toString();

    let itemStoreResult = await storageSetItem(key, networkJson);
    if (itemStoreResult != true) {
        throw new Error("blockchainNetworkAddNew item store failed");
    }

    itemStoreResult = await storageSetItem(MAX_BLOCKCHAIN_NETWORK_INDEX_KEY, maxIndex.toString());
    if (itemStoreResult != true) {
        throw new Error("blockchainNetworkAddNew item store index failed");
    }

    blockchainIndexToNetworkMap.set(maxIndex, blockchainNetwork);
}

async function blockchainNetworksList() {
    blockchainIndexToNetworkMap = new Map();
    let maxIndex = await blockchainNetworkGetMaxIndex();
    for (var i = 0; i <= maxIndex; i++) {
        let key = BLOCKCHAIN_NETWORK_KEY_PREFIX + i.toString();
        let networkJson = await storageGetItem(key);
        let networkItem = JSON.parse(networkJson);
        let blockchainNetwork = new BlockchainNetwork(networkItem.scanApiDomain, networkItem.blockExplorerDomain, networkItem.networkId, networkItem.blockchainName, networkItem.rpcEndpoint, i);
        blockchainIndexToNetworkMap.set(i, blockchainNetwork);
    }

    return blockchainIndexToNetworkMap;
}

async function blockchainNetworkSetDefaultIndex(index) {
    let result = await blockchainNetworkGetMaxIndex();
    if (result == null || index < 0 || index > result) {
        index = 0;
    }

    let itemStoreResult = await storageSetItem(DEFAULT_BLOCKCHAIN_NETWORK_INDEX_KEY, index);
    if (itemStoreResult != true) {
        throw new Error("blockchainNetworkSetDefaultIndex item store failed");
    }

    return true;
}

async function blockchainNetworkGetDefaultIndex(index) {
    let result = await storageGetItem(DEFAULT_BLOCKCHAIN_NETWORK_INDEX_KEY);
    if (result == null) {
        return 0;
    }

    let defaultIndex = parseInt(result);

    if (isNumber(defaultIndex) == false) {
        throw new Error('blockchainNetworkGetDefaultIndex maxIndex is not a number.');
    }

    if (defaultIndex < 0 || defaultIndex > MAX_BLOCKCHAIN_NETWORKS) {
        throw new Error('blockchainNetworkGetDefaultIndex defaultIndex out of range.');
    }

    return defaultIndex;
}