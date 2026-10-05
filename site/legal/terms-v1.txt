# GL1F Crypto Terms of Service

Version 1 · Effective 4 October 2026

These terms are an agreement between you and Decentralized Science Labs LLC, a Wyoming limited liability company ("we", "us") about GL1F Crypto: the app and website at crypto.gl1f.com and any copy of them (the "App"), and the GL1F Crypto smart contracts on GenesisL1 (the "Contracts"), together the "Service". By using the App, or by interacting with the Contracts through any interface, you accept these terms. If you do not accept them, do not use the Service.

The version in force is recorded on-chain in the GL1F Crypto registry (`tosVersion`, `tosText`). If a copy of these terms differs from the on-chain text, the on-chain text applies.

## 1. What the Service is

1. GL1F Crypto is open-source, experimental, educational software in early alpha. It may contain bugs, errors and imperfections, and it may change or stop at any time.
2. It is not a broker, exchange, trading venue, fund, investment adviser or signal service. Nothing in the Service is financial, investment, trading, legal or tax advice.
3. Crypto AI models, backtests and predictions are statistical estimates that can be wrong. They must not be used for live or automated trading.
4. The App runs in your browser. Market data comes from third parties (Binance, Coinbase, Hyperliquid) under their own terms. We never hold your funds, keys or data.

## 2. Your responsibilities

1. You must be of legal age and able to accept these terms where you live, and your use of the Service must be lawful, including under sanctions laws.
2. You are responsible for your wallet, keys, transactions, taxes and decisions.
3. Transactions on GenesisL1 are public, permanent and cannot be reversed. We cannot undo, refund or recover anything.

## 3. Crypto AI models and their licenses

1. Every published Crypto AI model is stored on GenesisL1, and anyone can technically read its bytes. What anyone may do with a model is decided by its license, recorded on-chain (`licenseOf(tokenId)`) and shown in the App.
2. **You must respect the license of every model**, whether you reach it through the App, the Contracts or any other way. For a model under the [GL1F On-Chain Use License](https://crypto.gl1f.com/legal/onchain-use-1.0.html) this means in particular: no copying, sharing or selling it, no models derived from it, and no use of a copy to avoid its fees or access terms.
3. When you publish a model, you confirm that you have the rights to do so and that it infringes no one's rights, and you grant everyone the license you select. The Contracts record that license for the model.
4. Only the model's admin can change its license later, and only to a later version of the same license or to a more open license. Rights already granted under an earlier license stay in force.
5. Predictions you obtain in line with a model's license are yours to use for any lawful purpose, subject to these terms.

## 4. Model NFTs, admins and income

1. The holder of a Model NFT is the model's admin. The admin sets access, fees and subscription plans, and can sell the NFT.
2. When a Model NFT is transferred, by sale or otherwise, the previous holder transfers to the new holder, to the extent the law allows, the rights it holds in the model as its licensor and admin. Licenses and access already granted continue.
3. Inference fees, tips and subscription payments go to the current admin or the recipient it chose. Sale prices go to the seller. Protocol fees are burned by the Contracts and are never refunded.

## 5. How the App respects licenses

1. The App shows every model's license, applies the access terms recorded on-chain, and never offers published models for download.
2. The App runs a model under the GL1F On-Chain Use License on your device only when that license allows it: for its admin, for holders of active access, or while the model is free to run. Otherwise it can be used only through the Contracts.
3. You may not use the App, its code or the Contracts to get around a license or access terms.

## 6. Acceptable use

You may not use the Service to break the law, infringe anyone's rights, manipulate markets, publish malicious or deceptive content, present predictions as investment advice, attack or overload the App, the Contracts or GenesisL1, or help anyone do these things.

## 7. Smart contracts and protocol administration

1. The Contracts are unaudited and may contain vulnerabilities.
2. The owner of the registry and of the marketplace, which may be a multisig, can set protocol fees, publish new versions of these terms, add licenses and new license versions to the catalog, close licenses to new models and cancel marketplace listings. It cannot withdraw protocol fees, change a model's license or move anyone's NFT. The owner cannot delete models. A model's admin can delete their own model only when no paid subscription to it is still running; deletion burns the model's NFT and removes it from the registry, while the bytes already written to GenesisL1 storage remain on-chain. Every such action is a public transaction.

## 8. Changes to these terms

We may publish new versions of these terms. A new version takes effect when the registry owner records it on-chain, and the App asks you to accept it before you continue. Publishing a model always requires accepting the version in force. If you do not accept a new version, stop using the Service. Earlier versions remain readable on-chain in past transactions.

## 9. Privacy and cookies

The Site keeps a few settings in your browser so that it works: your theme, your cookie choice and that you accepted these terms. It uses statistics cookies only if you agree, and you can withdraw that at any time with Cookie settings at the bottom of every page. The app asks market, public-data and blockchain services for data directly from your browser. The [Cookie policy](./cookies.html) explains what is kept, for how long and why.

## 10. Open source

The App's code is available under the MIT License. That license covers the code, not the Crypto AI models published with it, which are covered by their own licenses.

## 11. No warranty

The Service, the App, the Contracts, the models, the data and all content are provided "as is" and "as available", without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, title, non-infringement, accuracy, reliability and availability.

## 12. Limitation of liability

To the maximum extent the law allows, we and the authors, contributors and affiliated parties are not liable for any loss or damage of any kind arising from the Service, its results or its use, including loss of funds, profits or data, whether in contract, tort or otherwise. Where liability cannot be excluded, it is limited to the minimum the law allows.

## 13. Indemnity

To the extent the law allows, you will compensate us for claims and costs that third parties bring against us because you broke these terms or a model's license.

## 14. Governing law

These terms are governed by the laws of the State of Wyoming, United States, without regard to its conflict-of-law rules. The state and federal courts located in Wyoming have jurisdiction, unless the mandatory law of your country of residence gives you the right to go to court elsewhere. Nothing in these terms takes away the protection that the mandatory consumer law of your country of residence gives you.

## 15. Contact

Questions and notices: open an issue at [github.com/GenesisL1/gl1f-crypto](https://github.com/GenesisL1/gl1f-crypto) or write to [GenesisL1 on X](https://x.com/genesis_L1).
