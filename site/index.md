# GL1F Crypto: launch your own Crypto AI model

> GL1F Crypto is a no-code crypto AI model builder on GenesisL1, an EVM Layer 1 blockchain (chain id 29). In the browser you build a dataset from Binance, Coinbase or Hyperliquid candles, train a gradient-boosted tree model with walk-forward validation, backtest it with fees, slippage and leverage, publish it as a Crypto AI model NFT and run inference that anyone can verify on-chain. Early alpha, educational, not financial advice.

## Build a Crypto AI model in five steps

1. **Build a dataset:** Pick Binance, Coinbase or Hyperliquid, a coin, a candle size and a yes-or-no question; the studio turns completed candles into signals and labels.
2. **Train the Crypto AI model:** Gradient-boosted trees learn from the past, walk-forward validation tests them on the future, and optional heuristic search tunes the settings.
3. **Backtest it:** Replay history with fees, slippage and stops to see the equity curve, drawdown and win rate.
4. **Deploy on-chain:** Mint the Crypto AI model as an Crypto AI Model NFT on GenesisL1; protocol fees are burnable by anyone.
5. **Run AI inference:** Score the latest candle or any past moment and verify the result on-chain.

## What a Crypto AI model answers

A yes-or-no question about the next hours or days on one market, for example: "Will ETH rise 1% before it drops 0.5% within 5 hours?" or "Will DOGE drop 7% within the next 2 days?". It answers with a probability, computed by the same integer math in the browser and in the GenesisL1 EVM, so anyone can check a prediction on-chain.

## Key facts

- Chain: GenesisL1, EVM Layer 1, chain id 29, live since 2021
- Model format: GL1F integer tree ensembles (gradient-boosted trees); the same integer score in the browser and inside the EVM
- Data: Binance, Coinbase and Hyperliquid candles fetched by the browser; only completed candles, frozen to the exchange's server time
- Signals: 274 in all: 212 from market data (momentum, volatility, volume, funding, BTC context) and 62 world signals (holidays and events, astronomy, macro and markets, disasters and conflict); list at https://crypto.gl1f.com/signals.txt
- Validation: walk-forward folds (2 to 20), expanding or rolling windows, and a final test set kept locked until the end
- Backtests: entries at the next candle's open, fees, slippage, stops, leverage from 1x to 100x, liquidation and account ruin
- Crypto AI model NFTs: one per published model; its holder is the model admin; access is free, tips, a fee per inference, or subscriptions
- Licenses: every model carries the license its creator chose at mint, from 38 standard licenses (SPDX License List 3.29.0); default CC BY-SA 4.0; paid models default to the GL1F On-Chain Use License (all rights reserved, use only through GenesisL1); a model's admin can only open its license up or move it to a later version
- Terms of Service: version 1, stored in full on-chain; the registry owner publishes new versions and users accept them in the app
- Fees: protocol fees (model creation, per-byte storage, listing) are burned; creator income goes to the model admin
- Admin: the registry and marketplace owners set protocol fees, terms and the license catalog; ownership moves in two steps and can go to a multisig; nobody can withdraw protocol fees
- Status: early alpha; educational; not financial advice; not for live or automated trading
- Source: https://github.com/GenesisL1/gl1f-crypto (MIT)

## Questions and answers

### Which signals can a Crypto AI model use?

274 signals: 212 from the market itself (returns, trend, volatility, volume and taker flow, funding, BTC context) and 62 world signals: US and Asian holidays, Fed decision days, elections and expiries; Moon phases, Mercury, Venus and Mars retrogrades and planetary alignment; Treasury yields, the Fed funds rate, oil and natural gas, the dollar, VIX, the S&P 500, gold, inflation and unemployment; earthquakes, tropical storms and war attention. They load live in the browser, with years of history behind each one, and nothing to install. Every value uses only what was known when the candle closed. The full list is at signals.txt.

### What is a Crypto AI model?

A machine-learning model that reads market signals such as recent returns, volatility, volume, funding and how Bitcoin is moving, and outputs the probability that your yes-or-no question comes true, for example: will ETH rise 1% before it drops 0.5% in the next 5 hours? GL1F Crypto builds it from exchange candles with gradient-boosted decision trees.

### Can AI predict crypto prices?

Sometimes a little, often not at all. Markets are noisy, and most patterns are weak or vanish after fees. That is why every Crypto AI model here is tested walk-forward on data it never saw and backtested with costs, and why the honest answer can be: no edge.

### Is this an AI trading bot?

No. GL1F Crypto is an educational Crypto AI model builder. It never places trades, never connects to exchange accounts or funds, and its Crypto AI models must not be used for live or automated trading.

### What makes it on-chain AI?

The Crypto AI model is stored on GenesisL1 as an Crypto AI Model NFT, and its inference runs as integer math inside the EVM, so anyone can recompute a prediction on-chain and get exactly the score your browser shows. GenesisL1 EVM is your quant.

### What is GL1F Crypto?

A free, open-source crypto AI studio that turns a market question into a machine-learning Crypto AI model. It downloads completed candles from Binance, Coinbase or Hyperliquid, trains gradient-boosted trees in your browser, backtests them with fees, and can mint the Crypto AI model as an Crypto AI Model NFT on GenesisL1 so anyone can verify its predictions.

### Do I need to code or know machine learning?

No. Every field has a question mark with a plain-language explanation, and the defaults are sensible. You pick a coin, a target move, a stop and a time window; the studio does the rest.

### Will it make me money?

Nobody can promise that, and we don't. GL1F Crypto is educational, experimental software. Most market patterns are weak and many disappear after fees. Crypto AI models must not be used for live trading. Crypto trading can lose you all of your money.

### Where does my data go?

Nowhere. Candles are fetched straight from the exchange's public API into your browser, and training runs locally. Only deploying a model sends a transaction to GenesisL1.

### What happens to deployment fees?

The model creation fee and the per-byte storage fee stay in the registry contract, and anyone can burn them to an unspendable address with one public call. No one, including the deployer, can withdraw them.

### Why does my Crypto AI model look great in training and bad in the backtest?

That is usually overfitting, fees, or both, and it's exactly what the backtest is for. Try a simpler Crypto AI model (fewer trees, lower depth), turn on heuristic search, pick a bigger target or a longer candle, or accept that this question has no edge.

### Why does Hyperliquid start at 15-minute candles?

Its public API keeps only the latest 5,000 candles per size. The signals need 22 days of warm-up history, which smaller candles can't cover, so the studio starts at 15m and sets the earliest possible start date for you.

### Can I use someone else's Crypto AI model?

Yes. Published Crypto AI models can be run on the latest candle or any past moment and their scores verified on-chain; paid ones offer a fee per run or a subscription. Each shows the license it was published under.

### Which license does a Crypto AI model NFT have?

The one its creator picked when minting it, from a catalog of standard licenses stored on GenesisL1: public domain (such as CC0), permissive (such as MIT, Apache 2.0, CC BY 4.0 or OpenMDW, made for machine-learning models), share-alike (such as CC BY-SA 4.0, GPL or ODbL) or restricted (non-commercial or no changes). The default is CC BY-SA 4.0. The license is written on-chain at mint; later its admin can only open it up or move it to a later version, even after a sale.

### Can someone copy a model from the chain?

Technically yes: every model's bytes are public on GenesisL1. Legally it depends on the model's license. Open licenses allow copying; the GL1F On-Chain Use License, preselected for paid models, reserves all rights and allows use only through GenesisL1 on the admin's terms. The Terms of Service bind every user of the app and the contracts to respect each model's license.

## Links

- [Studio](https://crypto.gl1f.com/app.html): build, backtest and publish a Crypto AI model ([Markdown](https://crypto.gl1f.com/app.md))
- [Marketplace](https://crypto.gl1f.com/market.html): published Crypto AI model NFTs ([Markdown](https://crypto.gl1f.com/market.md))
- [Docs](https://crypto.gl1f.com/docs.html) ([Markdown](https://crypto.gl1f.com/docs.md))
- [Terms of Service](https://crypto.gl1f.com/legal/terms.html) ([Markdown](https://crypto.gl1f.com/legal/terms.md))
- [GL1F On-Chain Use License](https://crypto.gl1f.com/legal/onchain-use-1.0.html) ([Markdown](https://crypto.gl1f.com/legal/onchain-use-1.0.md))
- [Everything in one file](https://crypto.gl1f.com/llms-full.txt)
- [Source code](https://github.com/GenesisL1/gl1f-crypto) (MIT)
