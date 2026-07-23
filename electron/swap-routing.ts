// Multi-hop swap routing. Port of the browser extension's routing fallback
// (quantumswap-browser-extension src/bridge/handlers/chain.js): when no direct
// pair exists between the two tokens, a route is searched through intermediate
// hop candidates (wrapped Q + the recognized tokens), with at most
// SWAP_MAX_INTERMEDIATE_HOPS tokens between the from- and to-token.
import { loadQuantumCoin, loadQuantumSwap } from "./sdk";
import { SwapReleaseAddresses } from "./rpc";
import { searchSwapPath, SWAP_NO_ROUTE_ERROR } from "./swap-path-search";

export { SWAP_NO_ROUTE_ERROR };

// Recognized token contract addresses. Duplicated from the renderer's
// src/lib/tokenfilter.ts because the main process is a separate TypeScript
// project; keep the two lists in sync.
export const RECOGNIZED_TOKEN_CONTRACT_ADDRESSES = [
    "0xe8ea8beb86e714ef2bde0afac17d6e45d1c35e48f312d6dc12c4fdb90d9e8a3d", // Heisen (HSN)
    "0xa8036870874fbed790ed4d3bbd41b2f390b9858ff021f2993e90c6d1cbb167c7", // Year2Quantum (Y2Q)
    "0x4015b40b181f2415003f24118b215ce04f276509176eccb10e0c4a9ccbd458d2", // Lion (Lio)
    "0x6ff70c260458c9f448ec7aab008f1611456d58edb12e7795bf88735e1986a6ad", // Tiger (tig)
    "0x592a8abb1de07bc3797bc3c592fc74c099c5a311ba856fc66fb6d4cfc18c728d", // Cat (cat)
    "0x05fe2265b69d0c70a24075180242736c7389876b8917f38400e6540519e663df", // panther (pant)
    // Wrapped Q (WQ) from the Beta2 release. Redundant as a hop for the
    // built-in release (release.wq is always the first candidate; findSwapPath
    // dedupes), but keeps WQ routable under custom releases too.
    "0x45bd01be5ef8509d9da183689ea7faf647331c54c7c9801de54c9ede9ac44d92", // Wrapped Q (WQ, Beta2 release)
];

function swapHopCandidateAddresses(release: SwapReleaseAddresses): string[] {
    return [release.wq, ...RECOGNIZED_TOKEN_CONTRACT_ADDRESSES];
}

// Route + symbol caches. Pairs rarely change, so a short TTL avoids re-querying
// the factory on every debounced quote / gas-estimate while a swap is being set up.
const SWAP_ROUTE_CACHE_TTL_MS = 60000;
const swapRouteCache = new Map<string, { path: string[] | null; at: number }>();
const swapPathSymbolCache = new Map<string, string>();

export function mapSwapTokenValue(value: string, release: SwapReleaseAddresses): string {
    return value === "Q" ? release.wq : value;
}

async function factoryPairExists(factory: any, tokenA: string, tokenB: string): Promise<boolean> {
    const { ZeroAddress } = loadQuantumCoin();
    const pairAddr = await factory.getPair(tokenA, tokenB);
    const pairAddrStr =
        typeof pairAddr === "string"
            ? pairAddr
            : pairAddr && pairAddr.toString
                ? pairAddr.toString()
                : String(pairAddr);
    const zeroAddr =
        ZeroAddress || "0x0000000000000000000000000000000000000000000000000000000000000000";
    return !!(pairAddrStr && pairAddrStr !== zeroAddr && pairAddrStr !== "0x" + "0".repeat(64));
}

// Find a router path from `fromAddrRaw` to `toAddrRaw`: the direct pair when it
// exists, otherwise the shortest route (BFS) through the hop candidates, limited
// to SWAP_MAX_INTERMEDIATE_HOPS intermediate tokens. Returns an array of
// checksummed addresses ([from, ...hops, to]) or null when no route exists.
export async function findSwapPath(
    provider: any,
    chainId: number,
    fromAddrRaw: string,
    toAddrRaw: string,
    release: SwapReleaseAddresses,
): Promise<string[] | null> {
    const { getAddress } = loadQuantumCoin();
    const { QuantumSwapV2Factory } = loadQuantumSwap();

    const fromAddr = getAddress(fromAddrRaw);
    const toAddr = getAddress(toAddrRaw);
    // The release's factory address is part of the key so a route cached for
    // one release is never served for another.
    const cacheKey =
        chainId +
        "|" +
        release.factory.toLowerCase() +
        "|" +
        fromAddr.toLowerCase() +
        "|" +
        toAddr.toLowerCase();
    const cached = swapRouteCache.get(cacheKey);
    if (cached && Date.now() - cached.at < SWAP_ROUTE_CACHE_TTL_MS) return cached.path;

    const factory = QuantumSwapV2Factory.connect(release.factory, provider);
    const seen = new Set([fromAddr.toLowerCase(), toAddr.toLowerCase()]);
    const hops: string[] = [];
    for (const h of swapHopCandidateAddresses(release)) {
        const addr = getAddress(h);
        if (seen.has(addr.toLowerCase())) continue;
        seen.add(addr.toLowerCase());
        hops.push(addr);
    }
    const nodes = [fromAddr, ...hops, toAddr];
    const path = await searchSwapPath(nodes, (a, b) => factoryPairExists(factory, a, b));

    if (swapRouteCache.size > 200) {
        swapRouteCache.delete(swapRouteCache.keys().next().value as string);
    }
    swapRouteCache.set(cacheKey, { path, at: Date.now() });
    return path;
}

// Resolve the router path for a swap between two UI token values ("Q" or a
// contract address). Throws when no route exists so callers surface the error.
export async function resolveSwapPath(
    provider: any,
    chainId: number,
    fromTokenValue: string,
    toTokenValue: string,
    release: SwapReleaseAddresses,
): Promise<string[]> {
    const path = await findSwapPath(
        provider,
        chainId,
        mapSwapTokenValue(fromTokenValue, release),
        mapSwapTokenValue(toTokenValue, release),
        release,
    );
    if (!path) throw new Error(SWAP_NO_ROUTE_ERROR);
    return path;
}

// On-chain symbol() for each path token, for the UI's route display. A failed
// lookup yields null for that entry (the UI falls back to the address). The raw
// symbol strings are untrusted RPC data: the UI must sanitize before rendering.
export async function getSwapPathSymbols(
    provider: any,
    chainId: number,
    path: string[],
): Promise<(string | null)[]> {
    const { IERC20 } = loadQuantumSwap();
    return Promise.all(
        path.map(async (addr) => {
            const key = chainId + "|" + addr.toLowerCase();
            const cachedSymbol = swapPathSymbolCache.get(key);
            if (cachedSymbol != null) return cachedSymbol;
            let symbol: string | null = null;
            try {
                const token: any = IERC20.connect(addr, provider);
                if (typeof token.symbol === "function") {
                    const s = await token.symbol();
                    if (typeof s === "string" && s.trim() !== "") symbol = s;
                }
            } catch {
                /* leave null */
            }
            // Cache only successful lookups: a transient RPC failure must not pin
            // the null (address-fallback) display for the rest of the session.
            if (symbol != null) swapPathSymbolCache.set(key, symbol);
            return symbol;
        }),
    );
}
