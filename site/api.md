# GL1F Crypto Web3 API

> Run any Crypto AI model on GenesisL1 from code.

[Quick start](https://crypto.gl1f.com/api.html#quick-start)[Addresses](https://crypto.gl1f.com/api.html#addresses)[Access modes](https://crypto.gl1f.com/api.html#access)[Access keys and plans](https://crypto.gl1f.com/api.html#keys)[Inputs](https://crypto.gl1f.com/api.html#inputs) [Reference](https://crypto.gl1f.com/api.html#reference)[Errors](https://crypto.gl1f.com/api.html#errors)[Security](https://crypto.gl1f.com/api.html#security)[Example: a bot](https://crypto.gl1f.com/api.html#bot)[Docs](https://crypto.gl1f.com/docs.html)

**Web3 API** / Quick start

# Run any Crypto AI model from code.

Every Crypto AI model on GenesisL1 can be called from your own code, in a browser or in Node 18+. The GL1F Crypto helper wraps the contracts: it reads a model, computes its inputs on the latest candle with the same market engine the studio runs, and returns the model's probability, computed on-chain. Free models need nothing; paid ones take an access key with a plan, the admin's signature or a fee per run.

[Download gl1f-crypto.js](https://crypto.gl1f.com/sdk/gl1f-crypto.js) [Download the market engine](https://crypto.gl1f.com/sdk/gl1f-engine.js) [Try it in the studio](https://crypto.gl1f.com/app.html#infer)

// npm i ethers (and put gl1f-crypto.js next to your script) import * as ethers from "ethers"; import { GL1FCrypto } from "./gl1f-crypto.js"; const gl1f = new GL1FCrypto({ ethers, rpcUrl: "RPC_URL", chainId: CHAIN_ID, registry: "REGISTRY", runtime: "RUNTIME" }); const model = await gl1f.model(42); // any model's token ID const engine = await GL1FCrypto.nodeEngine(); // in a browser: await GL1FCrypto.browserEngine() const inputs = await gl1f.latestInputs(model, { engine }); // its inputs on the latest completed candle const out = await gl1f.predict(model, inputs.valuesQ); // free model: a free read, no key, no gas console.log(model.title, "P =", out.probability.toFixed(4), "via", out.via);

The Inference step of the studio shows this code ready for the model you open, with its plans and a button that creates an access key.

**01** / Addresses

## Where to call, on GenesisL1.

RPC

—

Chain ID

29

Registry

—

Runtime

—

Model NFT

—

Read from this site's runtime configuration. The registry knows every model, its pricing, plans and keys; the runtime runs a model on its inputs and checks access.

**02** / Access modes

## Free, paid with a plan, or per run.

| Model | Call | On-chain | What it costs |
|---|---|---|---|
| Free or tips | `predict(model, valuesQ)` | `predictView`, a read | Nothing: no key, no gas |
| Paid, with a plan | `predict(model, valuesQ, { accessKey })` | `predictAccessView`, a read: the key signs the request | The plan, bought once for the key; each call is free |
| Paid, per run | `predict(model, valuesQ, { payer })` | `predictTx`, a transaction | The model's fee per run, paid to its admin, plus gas |
| Your own model | `predict(model, valuesQ, { owner })` | `predictOwnerView`, a read: your wallet signs | Nothing |

The result is `{ probability, scoreQ, via }`: the probability that the model's question resolves yes, its integer score and the call that produced it. The score is the same integer the studio computes, so anyone can check it.

**03** / Access keys and plans

## A key for your bot, a plan for the key.

A paid model's admin offers subscription plans: a duration in blocks for a price in L1. You buy a plan for an **access key**, an address whose private key lives on your server or bot, not in your wallet. The key then signs each request (EIP-712 `AccessView`: model, a hash of the exact inputs and a deadline), and the runtime checks the signature and the key's plan. Reads cost nothing.

const key = gl1f.newAccessKey(); // { address, privateKey }: keep privateKey secret const model = await gl1f.model(42); console.log(model.plans); // [{ id, durationBlocks, priceWei, active }] await gl1f.buyAccess(model, 1, key.address, walletSigner); // pays plan 1 from your wallet, for the key console.log(await gl1f.accessStatus(model, key.address)); // { untilBlock, block, active } const out = await gl1f.predict(model, inputs.valuesQ, { accessKey: key.privateKey });

Buying again extends the key's plan. A model's admin cannot revoke or take over a key with a running plan, and a model with a running plan cannot be deleted.

**04** / Inputs

## The same signals, the same integers.

A model's inputs are its signals on one completed candle, in the order stored with the model (`model.featureNames`), as integers: `quantize(values, model.scaleQ)`. `latestInputs(model, { engine })` computes them from public exchange data with the published market engine, the code the studio runs, so the score equals the studio's and the chain's. Pass `asOfMs` for any moment in history. Models that use world signals load the same public data. The engine replays at most 120 days of candles (or 4,000 of the model's candles, if longer): enough for every signal to equal a replay from the model's training start, so an old model is as fast as a new one.

const engine = await GL1FCrypto.nodeEngine("./gl1f-engine.js"); // a local copy, a URL or the script text const now = await gl1f.latestInputs(model, { engine }); const then = await gl1f.latestInputs(model, { engine, asOfMs: Date.UTC(2026, 8, 1) }); console.log(now.valuesQ.length === model.nFeatures, now.selectedOpenMs);

**05** / Reference

## Every method.

| Method | Returns |
|---|---|
| `new GL1FCrypto({ ethers, rpcUrl, chainId, registry, runtime, nft?, provider? })` | A client. Pass the ethers v6 module; `provider` replaces `rpcUrl`. |
| `model(tokenId)` | `{ tokenId, modelId, title, description, pricing, feeWei, inferenceEnabled, scaleQ, nFeatures, featureNames, profile, report, plans }` |
| `latestInputs(model, { engine, asOfMs? })` | `{ valuesQ, values, features, selectedOpenMs, … }` |
| `predict(model, valuesQ, { accessKey \| owner \| payer, deadlineSec? })` | `{ probability, scoreQ, via, tx? }` |
| `newAccessKey()` | `{ address, privateKey }` |
| `buyAccess(model, planId, keyAddress, signer)` | `{ tx, untilBlock, block, active }` |
| `accessStatus(model, keyAddress)` | `{ untilBlock, block, active }` |
| `GL1FCrypto.browserEngine(url?)` · `GL1FCrypto.nodeEngine(source?)` | The market engine: `{ infer(job), close() }` |
| `packInputs(valuesQ)` · `quantize(values, scaleQ)` | The bytes the runtime reads (little-endian int32) · integers from signal values |

**06** / Errors

## What a refusal means.

| Error | Meaning |
|---|---|
| `NO_ACCESS` | The access key has no running plan for this model: buy or extend one. |
| `DEADLINE`, `SIG_EXPIRED` | The signature's deadline has passed: check the computer's clock, or raise `deadlineSec`. |
| `BAD_SIG` | An owner call not signed by the wallet that holds the model's NFT. |
| `MODE` | The call does not fit the model's pricing, for example an access key on a free model. |
| `INF_OFF`, `INF_DISABLED` | The model's admin has paused inference. |
| `INF_FEE` | A paid run sent less than the model's fee. |
| `takes N inputs` | The inputs do not match the model's signals: use `latestInputs`. |

**07** / Security

## Keys, signatures, results.

Keep an access key's private key like a password: anyone who has it can use its plan, and nothing else. Use a separate key per bot. A signature covers one model, the exact inputs and a deadline (5 minutes by default), so it cannot be reused for other inputs or later. Reads are free and never move funds; only `buyAccess` and pay-per-run send a transaction from your wallet. Models are educational: a probability is not financial advice.

**08** / Example

## A bot that asks every candle.

import * as ethers from "ethers"; import { GL1FCrypto } from "./gl1f-crypto.js"; const gl1f = new GL1FCrypto({ ethers, rpcUrl: "RPC_URL", chainId: CHAIN_ID, registry: "REGISTRY", runtime: "RUNTIME" }); const model = await gl1f.model(Number(process.env.GL1F_MODEL)); const engine = await GL1FCrypto.nodeEngine(); async function tick() { const inputs = await gl1f.latestInputs(model, { engine }); const out = await gl1f.predict(model, inputs.valuesQ, process.env.GL1F_ACCESS_KEY ? { accessKey: process.env.GL1F_ACCESS_KEY } : {}); console.log(new Date(inputs.selectedOpenMs).toISOString(), model.title, out.probability.toFixed(4)); } await tick(); setInterval(tick, 15 * 60 * 1000); // match the model's candle
