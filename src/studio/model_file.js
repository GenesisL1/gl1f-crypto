// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Read a .gl1f package: model core plus optional GL1X metadata footer.
import { parseGl1fPackage, decodeModel } from "./local_infer.js";
import { normalizeProfile, profileFromMeta, unpackFeatures } from "./profile.js";

export async function readModelPackage(file) {
  const u8 = new Uint8Array(await file.arrayBuffer());
  const { modelBytes, pkg } = parseGl1fPackage(u8);
  const decoded = decodeModel(modelBytes);
  if (decoded.version !== 1) throw new Error("This pipeline runs binary (scalar) GL1F models only");
  const packed = pkg?.nft?.featuresPacked || "";
  const { meta, features } = unpackFeatures(packed);
  if (meta?.task && meta.task !== "binary_classification") throw new Error(`This package is a ${meta.task.replace(/_/g, " ")} model; the crypto pipeline runs binary models`);
  if (features.length !== decoded.nFeatures) throw new Error(features.length ? `The package lists ${features.length} feature names but the model needs ${decoded.nFeatures}` : "The package has no feature names. Export it again with its GL1X metadata.");
  let profile = null;
  try { profile = normalizeProfile(pkg?.inputProfile) || profileFromMeta(meta); } catch { profile = profileFromMeta(meta); }
  const modelId = globalThis.ethers ? globalThis.ethers.keccak256(modelBytes) : null;
  return {
    origin: "file", fileName: file.name, bytes: modelBytes, decoded, modelId, featureNames: features, profile,
    fullProfile: pkg?.inputProfile || null, title: pkg?.nft?.title || file.name.replace(/\.gl1f$/i, ""),
    description: pkg?.nft?.description || "", usedTrees: decoded.nTrees, testStatistics: pkg?.local?.testStatistics || null,
    validation: pkg?.local?.validation || null, chain: null,
  };
}
