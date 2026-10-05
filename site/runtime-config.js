/*
MIT License

Copyright (c) 2026 Decentralized Science Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Crypto runtime configuration for https://crypto.gl1f.com.
//
// `contracts` is the dedicated GL1F Crypto contract set (contracts/crypto/*.sol):
// model creation, per-byte and listing fees stay in the contracts and anyone can
// burn them with burnFees(). It is null until scripts/deploy_crypto_contracts.mjs
// has deployed it. Then paste the printed `contracts` and `codeHashes` blocks
// here and set `status` to "live". While it is null, deployment is locked and the
// studio trains, backtests and runs models locally.
//
// Code hashes are checked before any read or transaction; a mismatch stops the app.
(function configureCryptoRuntime(global) {
  "use strict";

  global.GL1F_RUNTIME = Object.freeze({
    schema: "gl1f-runtime-config/v3",
    id: "crypto",
    name: "Crypto",
    status: "live",
    origin: "https://crypto.gl1f.com",
    // Google Analytics 4 measurement ID ("G-..."). Empty: no analytics cookies and no cookie notice. With an ID,
    // assets/consent.js loads Google Analytics only after a visitor accepts. The Pages workflow can also set it from
    // the repository variable GA_MEASUREMENT_ID.
    analytics: Object.freeze({ googleMeasurementId: "G-4LSBDBBKHN" }),
    network: Object.freeze({
      name: "GenesisL1",
      chainId: 29,
      rpcUrl: "https://rpc.genesisl1.org",
      explorer: "https://explorer.genesisl1.org",
      currency: Object.freeze({ name: "L1 coin", symbol: "L1", decimals: 18 }),
    }),
    contractSet: "gl1f-crypto-genesisl1",
    contracts: Object.freeze({ store: "0x555e94a1699a77C531B59f13810E3d3B6D74E906", registry: "0xF93C5407B07C29cCA9E1313d587fBDF33405038B", nft: "0xad381e8841AC9d4D62B532f3044a870Da20A10C4", runtime: "0x99aAA2a23Fe672e8177f7038559dB9b5160d9932", market: "0xa11a8BF841f544863173bd1F98a1E8b021df68c9" }),
    codeHashes: Object.freeze({ store: "0xe3e2f537e9ee34c9bc6b910fe8d824c4c8d9752dd26035ee69e70f35fa1e5c48", registry: "0xc78dd371db2dbb75cea4773a3b06d56049616651cf87cdf05f85a4298a68a36f", nft: "0xdcb032a21f19e54f3a90263049a57b26336e593cf45604689e3ccf35f9c3142c", runtime: "0x96655ed452b5ceb4551986275067dd54a92bc357d6148805ff6ed54e1b4683a5", market: "0x1e2474fd499c0177770126f4debddf0c6320523850e3dc0e7a496fd3ee16115d" }),
    burnAddress: "0x000000000000000000000000000000000000dEaD",
    exchanges: Object.freeze({
      binance: "https://fapi.binance.com",
      coinbase: "https://api.exchange.coinbase.com",
      hyperliquid: "https://api.hyperliquid.xyz",
    }),
    links: Object.freeze({
      gl1f: "https://gl1f.com/",
      models: "https://gl1f.com/forest.html",
      model: "https://gl1f.com/model.html?tokenId=",
      terms: "https://gl1f.com/terms.html",
      source: "https://github.com/GenesisL1/Forest",
    }),
  });
})(globalThis);
