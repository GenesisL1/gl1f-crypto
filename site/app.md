# GL1F Crypto Studio: build a Crypto AI model without code

> The studio runs entirely in your browser: market data comes straight from the exchange, training and backtests run on your device, and nothing is uploaded until you choose to publish.

Open it at https://crypto.gl1f.com/app.html. Every step has help texts; the first visit asks you to accept the Terms of Service.

## The five steps

### 1. Build a dataset

Pick Binance, Coinbase or Hyperliquid, a coin, a candle size and a yes-or-no question; the studio turns completed candles into signals and labels.

### 2. Train the Crypto AI model

Gradient-boosted trees learn from the past, walk-forward validation tests them on the future, and optional heuristic search tunes the settings.

### 3. Backtest it

Replay history with fees, slippage and stops to see the equity curve, drawdown and win rate.

### 4. Deploy on-chain

Mint the Crypto AI model as an Crypto AI Model NFT on GenesisL1; protocol fees are burnable by anyone.

### 5. Run AI inference

Score the latest candle or any past moment and verify the result on-chain.

## Saving and publishing

- Save any trained model as a `.gl1f` file and load it again later.
- Publishing stores the model on GenesisL1 and mints its Crypto AI model NFT. You choose its access (free, tips, a fee per inference, subscriptions) and its license. Paid models start with the GL1F On-Chain Use License, which reserves all rights; an open license on a paid model shows a warning.
- Every published model has its own page, model.html?id=<n>, drawn live from GenesisL1.

## Licenses in the studio

The studio runs a published model on your device only when its license allows it. Models under the GL1F On-Chain Use License run in the browser only for their admin, active subscribers, or anyone while the model is free to run.

## Links

- [Studio](https://crypto.gl1f.com/app.html): build, backtest and publish a Crypto AI model ([Markdown](https://crypto.gl1f.com/app.md))
- [Marketplace](https://crypto.gl1f.com/market.html): published Crypto AI model NFTs ([Markdown](https://crypto.gl1f.com/market.md))
- [Docs](https://crypto.gl1f.com/docs.html) ([Markdown](https://crypto.gl1f.com/docs.md))
- [MCP server for AI agents](https://crypto.gl1f.com/api.html#mcp): https://crypto.gl1f.com/mcp (Streamable HTTP, no key), tools list_models, get_model, ask_model and trading_rules
- [Yes threshold](https://crypto.gl1f.com/docs.html#threshold): a model's answer is yes when threshold <= P <= threshold_max (defaults 0.5 and 1)
- [Terms of Service](https://crypto.gl1f.com/legal/terms.html) ([Markdown](https://crypto.gl1f.com/legal/terms.md))
- [GL1F On-Chain Use License](https://crypto.gl1f.com/legal/onchain-use-1.0.html) ([Markdown](https://crypto.gl1f.com/legal/onchain-use-1.0.md))
- [Everything in one file](https://crypto.gl1f.com/llms-full.txt)
- [Source code](https://github.com/GenesisL1/gl1f-crypto) (MIT)
