#!/usr/bin/env python3
# MIT License — Copyright (c) 2026 Decentralized Science Labs
"""Derive the GL1F Crypto registry and marketplace from the GenesisL1/Forest contracts in contracts/upstream/.
Changes: protocol fees stay in the contract and anyone can burn them; per-model licenses from an on-chain catalog;
creator income follows the NFT; a few admin hardenings. Every patch must match exactly once.
Use --check to verify the committed files."""
import re, pathlib
import sys
root = pathlib.Path(__file__).resolve().parents[1]
out = root / "contracts"
CHECK = "--check" in sys.argv
written = {}
def sub1(text, old, new):
    assert text.count(old) == 1, f"expected one match: {old[:60]!r}"
    return text.replace(old, new)
NOTE = """// GL1F Crypto runtime variant of {base}.
// Differences from the General contract:
//   * protocol fees ({kinds}) are never forwarded to the owner or any other
//     account; they stay in this contract;
//   * burnFees() is public: anyone may send the full accumulated balance to
//     BURN_ADDRESS (0x...dEaD), an address no key controls;
//   * cumulative counters (collected, burned, burn count) are public so explorers
//     and the GL1F Crypto docs page can report them from chain state.
// The owner can still set fee levels. The owner cannot withdraw fees.
"""
BURN = """    // ===== Burnable protocol fees (GL1F Crypto) =====
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
{kinds}
{counters}    uint256 public totalFeesBurnedWei;
    uint256 public burnCount;

    event FeesCollected(uint8 indexed kind, address indexed payer, uint256 amountWei);
    event FeesBurned(address indexed caller, uint256 amountWei, uint256 totalBurnedWei);
"""
BURN_FNS = """    // ===== Public fee burn =====
    /// @notice Anyone may call. Sends every wei this contract holds to BURN_ADDRESS.
    function burnFees() external returns (uint256 amountWei) {{
        amountWei = address(this).balance;
        require(amountWei > 0, "NOTHING_TO_BURN");
        totalFeesBurnedWei += amountWei;
        burnCount += 1;
        (bool ok,) = BURN_ADDRESS.call{{value: amountWei}}("");
        require(ok, "BURN_SEND");
        emit FeesBurned(msg.sender, amountWei, totalFeesBurnedWei);
    }}

    /// @notice Fees collected and not yet burned.
    function pendingBurnWei() external view returns (uint256) {{
        return address(this).balance;
    }}

    /// @notice Cumulative protocol fees collected by this contract.
    function totalFeesCollectedWei() external view returns (uint256) {{
        return {total};
    }}

"""
# ---- Registry ----
reg = (root / "contracts/upstream/ModelRegistry.sol").read_text()
reg, n = re.subn(r"\bcontract ModelRegistry\b", "contract CryptoModelRegistry", reg); assert n == 1
first = reg.index("pragma solidity")
reg = reg[:first] + NOTE.format(base="ModelRegistry.sol", kinds="model creation fee and per-byte size fee") + reg[first:]
reg = sub1(reg, "    uint256 public sizeFeeWeiPerByte;\n", "    uint256 public sizeFeeWeiPerByte;\n\n" + BURN.format(
    kinds="    uint8 public constant FEE_KIND_CREATION = 0;\n    uint8 public constant FEE_KIND_SIZE = 1;",
    counters="    uint256 public totalCreationFeesWei;\n    uint256 public totalSizeFeesWei;\n    uint256 public totalBytesRegistered;\n"))
reg = sub1(reg, """        // forward deploy fee to owner
        if (requiredFee > 0) {
            (bool ok,) = owner.call{value: requiredFee}("");
            require(ok, "FEE_SEND");
        }
""", """        // Deploy fees stay in this contract until anyone burns them.
        _recordDeployFees(totalBytes);
""")
reg = sub1(reg, "    function _requireTokenOwner(", BURN_FNS.format(total="totalCreationFeesWei + totalSizeFeesWei") + """    function _recordDeployFees(uint32 totalBytes) internal {
        uint256 creationPart = deployFeeWei;
        uint256 sizePart = sizeFeeWeiPerByte * uint256(totalBytes);
        totalBytesRegistered += totalBytes;
        if (creationPart > 0) {
            totalCreationFeesWei += creationPart;
            emit FeesCollected(FEE_KIND_CREATION, msg.sender, creationPart);
        }
        if (sizePart > 0) {
            totalSizeFeesWei += sizePart;
            emit FeesCollected(FEE_KIND_SIZE, msg.sender, sizePart);
        }
    }

    function _requireTokenOwner(""")
REG_NOTE = """// GL1F Crypto additions to the registry:
//   * per-model licenses: the creator picks any enabled license from an on-chain catalog of standard
//     licenses (SPDX identifiers) when minting; activeLicenseId is the global default; the license of a
//     model can later be moved by its admin only to a later version of that license or to a more open one;
//   * creator income follows the NFT: a fee recipient set by a previous owner stops applying once the
//     Model NFT changes hands, and payments go to the new owner until it sets its own recipient;
//   * the mint time is recorded (mintedAt) and model admins choose how front-ends show internals (setInternalsVisibility);
//   * owner access keys follow the NFT and only they can be revoked; subscriptions cannot be revoked or taken over;
//   * a model's admin can delete it (burnAndDelete) only after every paid subscription has ended (subscribedUntil);
//     the protocol owner's emergency adminBurnAndDelete is removed;
//   * setModelNFT works once; updateModelSettings emits ModelSettingsUpdated; access modes above 2
//     (paid) are rejected.
"""
reg = sub1(reg, "pragma solidity", REG_NOTE + "pragma solidity")
reg = sub1(reg, "    mapping(uint32 => License) private _licenses;\n", """    mapping(uint32 => License) private _licenses;

    // GL1F Crypto: per-model licenses. Each catalog entry carries an SPDX identifier (or LicenseRef-...).
    mapping(uint32 => string) public licenseSpdx;
    mapping(uint32 => bool) public licenseDisabled; // true = not selectable for new models
    mapping(bytes32 => uint32) private _licenseIdBySpdxHash;
    // Openness of each license: 0 reserved, 1 restricted, 2 share-alike, 3 permissive, 4 public domain. Set once.
    mapping(uint32 => uint8) public licenseOpenness;
    // A later version of a license names the version it replaces; model admins may move their models to it.
    mapping(uint32 => uint32) public licenseSupersedes;
    // The block from which each model's current license applies.
    mapping(uint256 => uint64) public licenseSinceBlock;
""")
reg = sub1(reg, "    mapping(bytes32 => uint256) public tokenIdByModelId;\n", """    mapping(bytes32 => uint256) public tokenIdByModelId;

    // GL1F Crypto: the owner that set each model's fee recipient. When the NFT has changed hands since,
    // payments go to the current owner until it sets its own recipient.
    mapping(bytes32 => address) public feeRecipientSetBy;
""")
reg = sub1(reg, "    event ToSUpdated(uint32 indexed version, bytes32 hash);\n", """    event ToSUpdated(uint32 indexed version, bytes32 hash);
    event LicenseSpdxSet(uint32 indexed id, string spdx);
    event LicenseEnabledSet(uint32 indexed id, bool enabled);
    event ModelLicensed(uint256 indexed tokenId, uint32 indexed licenseId);
    event LicenseOpennessSet(uint32 indexed id, uint8 openness);
    event LicenseSupersedesSet(uint32 indexed id, uint32 indexed older);
    event ModelLicenseChanged(uint256 indexed tokenId, uint32 indexed fromId, uint32 indexed toId);
""")
reg = sub1(reg, """        // License #1: CC BY-SA 4.0
        _addLicense("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/");
""", """        // License #1: CC BY-SA 4.0, the initial global default. The rest of the catalog is added at deployment.
        _setLicenseSpdx(_addLicense("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"), "CC-BY-SA-4.0", 2);
""")
reg = sub1(reg, """        require(nftAddr != address(0), "NFT0");
        modelNFT = ModelNFT(nftAddr);
""", """        require(nftAddr != address(0), "NFT0");
        require(address(modelNFT) == address(0), "NFT_SET"); // wired once at deployment; can never be swapped
        modelNFT = ModelNFT(nftAddr);
""")
reg = sub1(reg, """    function setActiveLicenseId(uint32 id) external onlyOwner {
        require(id >= 1 && id <= licenseCount, "LIC_ID");
        activeLicenseId = id;
        emit ActiveLicenseSet(id);
    }
""", """    /// @notice Sets the global default license, preselected for new models. Existing models keep their own license.
    function setActiveLicenseId(uint32 id) external onlyOwner {
        require(id >= 1 && id <= licenseCount, "LIC_ID");
        require(!licenseDisabled[id], "LIC_DISABLED");
        activeLicenseId = id;
        emit ActiveLicenseSet(id);
    }

    /// @notice Adds a catalog license with its SPDX identifier (or a LicenseRef- identifier) and its openness
    ///         (0 reserved, 1 restricted, 2 share-alike, 3 permissive, 4 public domain). Returns its id.
    function addLicenseWithSpdx(string calldata name, string calldata url, string calldata spdx, uint8 openness) external onlyOwner returns (uint32 id) {
        id = _addLicense(name, url);
        _setLicenseSpdx(id, spdx, openness);
    }

    /// @notice Adds several catalog licenses at once (used to seed the catalog at deployment). Returns the first new id.
    function addLicensesWithSpdx(string[] calldata names, string[] calldata urls, string[] calldata spdxIds, uint8[] calldata openness) external onlyOwner returns (uint32 firstId) {
        require(names.length > 0 && names.length == urls.length && names.length == spdxIds.length && names.length == openness.length, "LIC_BATCH");
        firstId = licenseCount + 1;
        for (uint256 i = 0; i < names.length; i++) {
            _setLicenseSpdx(_addLicense(names[i], urls[i]), spdxIds[i], openness[i]);
        }
    }

    /// @notice Enables or disables a catalog license for new models. Models already minted under it keep it.
    ///         The default license cannot be disabled; choose another default first.
    function setLicenseEnabled(uint32 id, bool enabled) external onlyOwner {
        require(id >= 1 && id <= licenseCount, "LIC_ID");
        require(enabled || id != activeLicenseId, "LIC_DEFAULT");
        licenseDisabled[id] = !enabled;
        emit LicenseEnabledSet(id, enabled);
    }

    /// @notice True if new models may be minted under this license.
    function isLicenseSelectable(uint32 id) public view returns (bool) {
        return id >= 1 && id <= licenseCount && !licenseDisabled[id];
    }

    /// @notice Catalog id of an SPDX identifier, or 0 if it is not in the catalog.
    function licenseIdBySpdx(string calldata spdx) external view returns (uint32) {
        return _licenseIdBySpdxHash[keccak256(bytes(spdx))];
    }

    function getLicenseInfo(uint32 id) external view returns (string memory name, string memory url, string memory spdx, bool selectable, uint8 openness, uint32 supersedes) {
        License storage l = _licenses[id];
        return (l.name, l.url, licenseSpdx[id], isLicenseSelectable(id), licenseOpenness[id], licenseSupersedes[id]);
    }

    /// @notice The license a model NFT is under now, and the block from which it applies.
    function licenseOf(uint256 tokenId) external view returns (uint32 id, string memory name, string memory url, string memory spdx, uint8 openness, uint64 sinceBlock) {
        bytes32 mid = modelIdByTokenId[tokenId];
        require(mid != bytes32(0), "NF");
        id = models[mid].licenseIdAccepted;
        License storage l = _licenses[id];
        return (id, l.name, l.url, licenseSpdx[id], licenseOpenness[id], licenseSinceBlock[tokenId]);
    }

    /// @notice Declares catalog license `id` a later version of license `older` (for example a new version of the
    ///         GL1F On-Chain Use License). Both must have the same openness; set once. Model admins may then move
    ///         their models from the older version to the later one.
    function setLicenseSupersedes(uint32 id, uint32 older) external onlyOwner {
        require(id >= 1 && id <= licenseCount && older >= 1 && older < id, "LIC_ID");
        require(licenseSupersedes[id] == 0, "LIC_SET");
        require(licenseOpenness[id] == licenseOpenness[older], "LIC_OPEN");
        licenseSupersedes[id] = older;
        emit LicenseSupersedesSet(id, older);
    }

    /// @notice The model admin may move its model to a later version of its license, or to a more open license.
    ///         Never to a more restrictive one: rights already granted under the old license stay granted.
    function changeModelLicense(uint256 tokenId, uint32 newId) external {
        require(modelNFT.ownerOf(tokenId) == msg.sender, "NOT_OWNER");
        bytes32 mid = modelIdByTokenId[tokenId];
        require(mid != bytes32(0), "NF");
        Model storage m = models[mid];
        require(m.exists && m.active, "NF");
        uint32 cur = m.licenseIdAccepted;
        require(newId != cur && isLicenseSelectable(newId), "LIC");
        require(_isLaterVersion(newId, cur) || licenseOpenness[newId] > licenseOpenness[cur], "LIC_DOWNGRADE");
        m.licenseIdAccepted = newId;
        licenseSinceBlock[tokenId] = uint64(block.number);
        emit ModelLicenseChanged(tokenId, cur, newId);
    }

    function _isLaterVersion(uint32 newer, uint32 older) internal view returns (bool) {
        uint32 x = licenseSupersedes[newer];
        for (uint256 i = 0; i < 32 && x != 0; i++) {
            if (x == older) return true;
            x = licenseSupersedes[x];
        }
        return false;
    }

    function _setLicenseSpdx(uint32 id, string memory spdx, uint8 openness) internal {
        bytes32 h = keccak256(bytes(spdx));
        require(bytes(spdx).length > 0 && bytes(spdx).length <= 64, "LIC_SPDX");
        require(openness <= 4, "LIC_OPEN");
        licenseOpenness[id] = openness;
        emit LicenseOpennessSet(id, openness);
        require(_licenseIdBySpdxHash[h] == 0, "LIC_DUP");
        licenseSpdx[id] = spdx;
        _licenseIdBySpdxHash[h] = id;
        emit LicenseSpdxSet(id, spdx);
    }
""")
reg = sub1(reg, "    // ===== Views for UI =====\n", """    // ===== Creator income follows the NFT (GL1F Crypto) =====
    /// @notice Where a model's inference fees, tips and subscription payments go right now: the recipient chosen
    ///         by the current NFT owner, or the current owner itself if the recipient was set by a previous owner.
    function payoutAddressOf(uint256 tokenId) external view returns (address) {
        bytes32 mid = modelIdByTokenId[tokenId];
        require(mid != bytes32(0), "NF");
        return _payoutAddress(models[mid]);
    }

    function _payoutAddress(Model storage m) internal view returns (address) {
        address current = modelNFT.ownerOf(m.tokenId);
        address r = m.feeRecipient;
        if (r == address(0) || feeRecipientSetBy[m.modelId] != current) return current;
        return r;
    }

    // ===== Views for UI =====
""")
reg = sub1(reg, "m.feeWei, m.feeRecipient, m.inferenceEnabled", "m.feeWei, _payoutAddress(m), m.inferenceEnabled")
reg = sub1(reg, "m.pricingMode, m.feeWei, m.feeRecipient);", "m.pricingMode, m.feeWei, _payoutAddress(m));")
reg = sub1(reg, """        // payout to current owner / recipient
        address payTo = m.feeRecipient;
        if (payTo == address(0)) {
            payTo = modelNFT.ownerOf(m.tokenId);
        }
""", """        // payout: the recipient chosen by the current owner, else the current owner (income follows the NFT)
        address payTo = _payoutAddress(m);
""")
reg = sub1(reg, '        require(licenseIdAccepted_ == activeLicenseId, "LIC");\n',
           '        require(isLicenseSelectable(licenseIdAccepted_), "LIC"); // any enabled catalog license\n')
reg = sub1(reg, '        // fee rules\n        if (pricingMode == 0) {\n', '        // fee rules\n        require(pricingMode <= 2, "MODE");\n        if (pricingMode == 0) {\n')
reg = sub1(reg, '        m.feeRecipient = recipient;\n\n        m.creator = msg.sender;\n', '        m.feeRecipient = recipient;\n        feeRecipientSetBy[modelId] = msg.sender;\n\n        m.creator = msg.sender;\n')
reg = sub1(reg, '        emit ModelRegistered(tokenId, modelId, msg.sender);\n', '        emit ModelLicensed(tokenId, licenseIdAccepted_);\n        emit ModelRegistered(tokenId, modelId, msg.sender);\n')
reg = sub1(reg, '        if (pricingMode == 0) feeWei = 0;\n', '        require(pricingMode <= 2, "MODE");\n        if (pricingMode == 0) feeWei = 0;\n')
reg = sub1(reg, '        m.feeRecipient = recipient;\n\n\n    }\n', '        m.feeRecipient = recipient;\n        feeRecipientSetBy[mid] = o;\n        emit ModelSettingsUpdated(tokenId, enabled, pricingMode, feeWei, recipient);\n    }\n')
reg = sub1(reg, "        m.licenseIdAccepted = licenseIdAccepted_;\n", "        m.licenseIdAccepted = licenseIdAccepted_;\n        licenseSinceBlock[tokenId] = uint64(block.number);\n")
def drop_function(src, name):
    i = src.index(f"    function {name}(")
    start = src.rfind("\n", 0, i) + 1
    while True:
        prev_start = src.rfind("\n", 0, start - 1) + 1
        if src[prev_start:start - 1].strip().startswith("//"): start = prev_start
        else: break
    k, depth = src.index("{", i), 0
    while True:
        depth += {"{": 1, "}": -1}.get(src[k], 0)
        if depth == 0: break
        k += 1
    end = k + 1
    while src[end:end + 1] == "\n" and src[end + 1:end + 2] == "\n": end += 1
    return src[:start] + src[end + 1:]
# Deletion: only the model admin, and only once every paid subscription has ended, so nobody is owed access.
# The protocol owner's emergency delete stays removed.
reg = drop_function(reg, "adminBurnAndDelete")
assert reg.count("        accessExpiry[modelId][key] = newExpiry;\n") == 1
reg = reg.replace("        accessExpiry[modelId][key] = newExpiry;\n", "        accessExpiry[modelId][key] = newExpiry;\n        if (newExpiry > subscribedUntil[modelId]) subscribedUntil[modelId] = newExpiry;\n")
old_burn = """    function burnAndDelete(uint256 tokenId) external {
        address o = modelNFT.ownerOf(tokenId);
        require(o == msg.sender, "NOT_OWNER");
        _burnAndDelete(tokenId);
    }"""
assert reg.count(old_burn) == 1
reg = reg.replace(old_burn, """    /// @notice The model admin (the NFT holder) can delete the model once nobody is owed access: every paid subscription
    /// has ended. Deleting burns the NFT and removes the model from the registry and its search index. The bytes already
    /// written to the store's chunk contracts stay on-chain (deployed code cannot be erased), but nothing points to them.
    function burnAndDelete(uint256 tokenId) external {
        address o = modelNFT.ownerOf(tokenId);
        require(o == msg.sender, "NOT_OWNER");
        require(uint64(block.number) >= subscribedUntil[modelIdByTokenId[tokenId]], "ACTIVE_SUBSCRIPTIONS");
        delete mintedAt[tokenId];
        delete internalsVisibility[tokenId];
        _burnAndDelete(tokenId);
    }""")
assert "function adminBurnAndDelete" not in reg and reg.count("function burnAndDelete(") == 1, "only the admin's guarded delete remains"
# Access keys. Owner keys (the admin's own, unlimited) count only while the address that set them still holds the NFT,
# and only they can be revoked; a paid subscription can be neither revoked nor turned into an owner key.
assert reg.count("        accessExpiry[modelId][ownerKey] = type(uint64).max;\n") == 1 and reg.count("        accessExpiry[modelId][key] = type(uint64).max;\n") == 1
reg = reg.replace("        accessExpiry[modelId][ownerKey] = type(uint64).max;\n", "        accessExpiry[modelId][ownerKey] = type(uint64).max;\n        ownerKeyHolder[modelId][ownerKey] = msg.sender;\n")
reg = reg.replace("        require(key != address(0), \"KEY0\");\n        accessExpiry[modelId][key] = type(uint64).max;\n",
                  "        require(key != address(0), \"KEY0\");\n        require(ownerKeyHolder[modelId][key] != address(0) || accessExpiry[modelId][key] < uint64(block.number), \"KEY_SUBSCRIBED\");\n        accessExpiry[modelId][key] = type(uint64).max;\n        ownerKeyHolder[modelId][key] = msg.sender;\n")
old_rev = "        require(key != address(0), \"KEY0\");\n        accessExpiry[modelId][key] = 0;\n"
assert reg.count(old_rev) == 1
reg = reg.replace(old_rev, "        require(key != address(0), \"KEY0\");\n        require(ownerKeyHolder[modelId][key] != address(0), \"NOT_OWNER_KEY\");\n        accessExpiry[modelId][key] = 0;\n        delete ownerKeyHolder[modelId][key];\n")
decl = "    mapping(bytes32 => mapping(address => uint64)) public accessExpiry;\n"
assert reg.count(decl) == 1
reg = reg.replace(decl, """    mapping(bytes32 => mapping(address => uint64)) internal _accessExpiry;
    /// @notice Who set each owner key: an owner key counts only while that address still holds the model's NFT.
    mapping(bytes32 => mapping(address => address)) public ownerKeyHolder;

    /// @notice Block until which a key may run a paid model (type(uint64).max for an owner key). An owner key set by a
    /// previous holder of the NFT returns 0: access follows the NFT, like income.
    function accessExpiry(bytes32 modelId, address key) public view returns (uint64) {
        address holder = ownerKeyHolder[modelId][key];
        if (holder != address(0)) {
            uint256 tokenId = tokenIdByModelId[modelId];
            if (tokenId == 0 || modelNFT.ownerOf(tokenId) != holder) return 0;
        }
        return _accessExpiry[modelId][key];
    }
""")
reg = re.sub(r"(?<![_\w])accessExpiry\[", "_accessExpiry[", reg)
assert "public accessExpiry;" not in reg and "_accessExpiry[" in reg
# Mint time on-chain (for records since minting) and the admin's choice of how front-ends show a model's internals.
assert reg.count("        emit ModelRegistered(tokenId, modelId, msg.sender);") == 1
reg = reg.replace("        emit ModelRegistered(tokenId, modelId, msg.sender);", "        mintedAt[tokenId] = uint64(block.timestamp);\n        emit ModelRegistered(tokenId, modelId, msg.sender);")
assert reg.count("    // ===== Public fee burn =====") == 1
reg = reg.replace("    // ===== Public fee burn =====", """    // ===== Internals visibility and mint time (GL1F Crypto) =====
    /// @notice When each model was minted (block timestamp): the start of its record on data it could not have seen.
    mapping(uint256 => uint64) public mintedAt;
    /// @notice The last block any paid subscription to a model runs to. The model can be deleted only after it.
    mapping(bytes32 => uint64) public subscribedUntil;
    /// @notice How GL1F front-ends show a model's internals (trees, depth, signal list): 0 = default (private when paid,
    /// public otherwise), 1 = public, 2 = private. The bytes stay public on-chain; this makes copying harder, it is not encryption.
    mapping(uint256 => uint8) public internalsVisibility;
    event InternalsVisibilitySet(uint256 indexed tokenId, uint8 visibility);
    /// @notice The model admin (the NFT holder) chooses, at mint or any time after.
    function setInternalsVisibility(uint256 tokenId, uint8 visibility) external {
        require(modelNFT.ownerOf(tokenId) == msg.sender, "NOT_OWNER");
        require(visibility <= 2, "BAD_VISIBILITY");
        internalsVisibility[tokenId] = visibility;
        emit InternalsVisibilitySet(tokenId, visibility);
    }

    // ===== Public fee burn =====""")
written["CryptoModelRegistry.sol"] = reg
# ---- Marketplace ----
mkt = (root / "contracts/upstream/ModelMarketplace.sol").read_text()
mkt, n = re.subn(r"\bcontract ModelMarketplace\b", "contract CryptoModelMarketplace", mkt); assert n == 1
first = mkt.index("pragma solidity")
mkt = mkt[:first] + NOTE.format(base="ModelMarketplace.sol", kinds="listing fee") + mkt[first:]
mkt = sub1(mkt, "    uint256 public listingFeeWei;\n", "    uint256 public listingFeeWei;\n\n" + BURN.format(
    kinds="    uint8 public constant FEE_KIND_LISTING = 2;", counters="    uint256 public totalListingFeesWei;\n"))
mkt = sub1(mkt, """        if (listingFeeWei > 0) {
            (bool ok,) = owner.call{value: listingFeeWei}("");
            require(ok, "FEE_SEND");
        }
""", """        if (listingFeeWei > 0) {
            totalListingFeesWei += listingFeeWei;
            emit FeesCollected(FEE_KIND_LISTING, msg.sender, listingFeeWei);
        }
""")
mkt = sub1(mkt, "    function cancel(uint256 tokenId) external {", BURN_FNS.format(total="totalListingFeesWei") + "    function cancel(uint256 tokenId) external {")
mkt = sub1(mkt, "    event Bought(uint256 indexed tokenId, uint256 priceWei, address indexed seller, address indexed buyer);\n",
           "    event Bought(uint256 indexed tokenId, uint256 priceWei, address indexed seller, address indexed buyer);\n    event ListingFeeSet(uint256 feeWei); // GL1F Crypto: fee changes are public events\n")
mkt = sub1(mkt, "        listingFeeWei = feeWei;\n", "        listingFeeWei = feeWei;\n        emit ListingFeeSet(feeWei);\n")
old_buy = """        address seller = l.seller;
        // seller must still own it
        require(nft.ownerOf(tokenId) == seller, "SELLER_NOT_OWNER");

        // transfer NFT
        nft.transferFrom(seller, msg.sender, tokenId);

        // payout
        (bool ok,) = seller.call{value: msg.value}("");
        require(ok, "PAY_FAIL");

        _removeListed(tokenId);
        delete listings[tokenId];
"""
assert mkt.count(old_buy) == 1, "marketplace buy changed upstream"
mkt = mkt.replace(old_buy, """        address seller = l.seller;
        // seller must still own it
        require(nft.ownerOf(tokenId) == seller, "SELLER_NOT_OWNER");

        // GL1F Crypto: remove the listing before any external call (checks-effects-interactions), so a seller
        // contract cannot re-enter and remove the listing twice.
        _removeListed(tokenId);
        delete listings[tokenId];

        // transfer NFT
        nft.transferFrom(seller, msg.sender, tokenId);

        // payout
        (bool ok,) = seller.call{value: msg.value}("");
        require(ok, "PAY_FAIL");
""")
written["CryptoModelMarketplace.sol"] = mkt
if CHECK:
    stale = [n for n, t in written.items() if not (out / n).exists() or (out / n).read_text() != t]
    if stale: sys.exit(f"contracts out of date, run: npm run generate:contracts ({stale})")
    print("crypto contracts match their upstream sources plus the GL1F Crypto patches")
else:
    for n, t in written.items(): (out / n).write_text(t)
    print("generated", sorted(written))
