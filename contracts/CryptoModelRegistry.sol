// SPDX-License-Identifier: MIT
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
// GL1F Crypto runtime variant of ModelRegistry.sol.
// Differences from the General contract:
//   * protocol fees (model creation fee and per-byte size fee) are never forwarded to the owner or any other
//     account; they stay in this contract;
//   * burnFees() is public: anyone may send the full accumulated balance to
//     BURN_ADDRESS (0x...dEaD), an address no key controls;
//   * cumulative counters (collected, burned, burn count) are public so explorers
//     and the GL1F Crypto docs page can report them from chain state.
// The owner can still set fee levels. The owner cannot withdraw fees.
// GL1F Crypto additions to the registry:
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
pragma solidity ^0.8.20;

import "./SimpleOwnable.sol";
import "./ModelNFT.sol";

contract CryptoModelRegistry is SimpleOwnable {
    // ===== Legal =====
    struct License { string name; string url; }

    uint32 public licenseCount;
    uint32 public activeLicenseId;

    mapping(uint32 => License) private _licenses;

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

    uint32 public tosVersion;
    bytes32 public tosHash;
    string public tosText;

    // ===== Fees =====
    uint256 public deployFeeWei;
    uint256 public sizeFeeWeiPerByte;

    // ===== Burnable protocol fees (GL1F Crypto) =====
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint8 public constant FEE_KIND_CREATION = 0;
    uint8 public constant FEE_KIND_SIZE = 1;
    uint256 public totalCreationFeesWei;
    uint256 public totalSizeFeesWei;
    uint256 public totalBytesRegistered;
    uint256 public totalFeesBurnedWei;
    uint256 public burnCount;

    event FeesCollected(uint8 indexed kind, address indexed payer, uint256 amountWei);
    event FeesBurned(address indexed caller, uint256 amountWei, uint256 totalBurnedWei);

    // ===== Model storage =====
    struct Model {
        bool exists;
        bool active;

        bytes32 modelId;

        address tablePtr;
        uint32 chunkSize;
        uint32 numChunks;
        uint32 totalBytes;

        uint16 nFeatures;
        uint16 nTrees;
        uint16 depth;
        int32 baseQ;
        uint32 scaleQ;

        bool inferenceEnabled;
        uint8 pricingMode; // 0 free, 1 tips, 2 paid
        uint256 feeWei;
        address feeRecipient;

        address creator;
        uint32 tosVersionAccepted;
        uint32 licenseIdAccepted;

        uint256 tokenId;
    }

    // modelId => model
    mapping(bytes32 => Model) public models;

    // tokenId => modelId
    mapping(uint256 => bytes32) public modelIdByTokenId;

    // modelId => tokenId
    mapping(bytes32 => uint256) public tokenIdByModelId;

    // GL1F Crypto: the owner that set each model's fee recipient. When the NFT has changed hands since,
    // payments go to the current owner until it sets its own recipient.
    mapping(bytes32 => address) public feeRecipientSetBy;

    // ===== API Access Keys / Subscriptions =====
    struct AccessPlan {
        uint32 durationBlocks;
        uint256 priceWei;
        bool active;
    }

    // modelId => planId (1..count) => plan
    mapping(bytes32 => mapping(uint8 => AccessPlan)) private _accessPlans;
    // modelId => number of plans
    mapping(bytes32 => uint8) public accessPlanCount;

    // modelId => access key => expiry block. 0 = none. type(uint64).max = never expires.
    mapping(bytes32 => mapping(address => uint64)) internal _accessExpiry;
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


    // Title-word index: wordHash => tokenId[] and membership mapping for fast AND search
    mapping(bytes32 => uint256[]) private _wordTokens;
    mapping(bytes32 => mapping(uint256 => bool)) private _wordHasToken;
    mapping(uint256 => bytes32[]) private _tokenWords;

    ModelNFT public modelNFT;

    event ModelNFTSet(address indexed nft);
    event LicenseAdded(uint32 indexed id, string name, string url);
    event ActiveLicenseSet(uint32 indexed id);
    event ToSUpdated(uint32 indexed version, bytes32 hash);
    event LicenseSpdxSet(uint32 indexed id, string spdx);
    event LicenseEnabledSet(uint32 indexed id, bool enabled);
    event ModelLicensed(uint256 indexed tokenId, uint32 indexed licenseId);
    event LicenseOpennessSet(uint32 indexed id, uint8 openness);
    event LicenseSupersedesSet(uint32 indexed id, uint32 indexed older);
    event ModelLicenseChanged(uint256 indexed tokenId, uint32 indexed fromId, uint32 indexed toId);
    event DeployFeeSet(uint256 feeWei);
    event SizeFeeSet(uint256 weiPerByte);

    event ModelRegistered(uint256 indexed tokenId, bytes32 indexed modelId, address indexed creator);
    event ModelSettingsUpdated(uint256 indexed tokenId, bool enabled, uint8 mode, uint256 feeWei, address recipient);
    event ModelBurned(uint256 indexed tokenId, bytes32 indexed modelId);
    event AccessPlanSet(bytes32 indexed modelId, uint8 indexed planId, uint32 durationBlocks, uint256 priceWei, bool active);
    event AccessPurchased(bytes32 indexed modelId, address indexed buyer, address indexed key, uint8 planId, uint64 newExpiry);
    event OwnerAccessKeySet(bytes32 indexed modelId, address indexed key, uint64 expiry);
    event AccessRevoked(bytes32 indexed modelId, address indexed key);


    constructor(address owner_, string memory initialToS) SimpleOwnable(owner_) {
        // default: 10 L1
        deployFeeWei = 10 ether;
        emit DeployFeeSet(deployFeeWei);
        sizeFeeWeiPerByte = 0;
        emit SizeFeeSet(sizeFeeWeiPerByte);

        // ToS v1
        tosVersion = 1;
        tosText = initialToS;
        tosHash = keccak256(bytes(initialToS));
        emit ToSUpdated(tosVersion, tosHash);

        // License #1: CC BY-SA 4.0, the initial global default. The rest of the catalog is added at deployment.
        _setLicenseSpdx(_addLicense("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"), "CC-BY-SA-4.0", 2);
        activeLicenseId = 1;
        emit ActiveLicenseSet(activeLicenseId);
    }

    // ===== Admin =====
    function setModelNFT(address nftAddr) external onlyOwner {
        require(nftAddr != address(0), "NFT0");
        require(address(modelNFT) == address(0), "NFT_SET"); // wired once at deployment; can never be swapped
        modelNFT = ModelNFT(nftAddr);
        emit ModelNFTSet(nftAddr);
    }

    function setDeployFeeWei(uint256 feeWei) external onlyOwner {
        deployFeeWei = feeWei;
        emit DeployFeeSet(feeWei);
    }

    function setSizeFeeWeiPerByte(uint256 weiPerByte) external onlyOwner {
        sizeFeeWeiPerByte = weiPerByte;
        emit SizeFeeSet(weiPerByte);
    }

    function requiredDeployFeeWei(uint32 totalBytes) public view returns (uint256) {
        return deployFeeWei + (sizeFeeWeiPerByte * uint256(totalBytes));
    }

    function addLicense(string calldata name, string calldata url) external onlyOwner returns (uint32 id) {
        id = _addLicense(name, url);
    }

    function _addLicense(string memory name, string memory url) internal returns (uint32 id) {
        require(bytes(name).length > 0, "LIC_NAME");
        require(bytes(url).length > 0, "LIC_URL");
        id = ++licenseCount;
        _licenses[id] = License(name, url);
        emit LicenseAdded(id, name, url);
    }

    /// @notice Sets the global default license, preselected for new models. Existing models keep their own license.
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

    function getLicense(uint256 id) external view returns (string memory name, string memory url) {
        License memory l = _licenses[uint32(id)];
        return (l.name, l.url);
    }

    function setToS(string calldata text) external onlyOwner {
        require(bytes(text).length > 0, "TOS_EMPTY");
        tosVersion += 1;
        tosText = text;
        tosHash = keccak256(bytes(text));
        emit ToSUpdated(tosVersion, tosHash);
    }

    // ===== Creator income follows the NFT (GL1F Crypto) =====
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
    function creatorOf(uint256 tokenId) external view returns (address) {
        bytes32 mid = modelIdByTokenId[tokenId];
        if (mid == bytes32(0)) return address(0);
        return models[mid].creator;
    }

    function getModelSummary(uint256 tokenId) external view returns (
        bool exists,
        bytes32 modelId,
        address tablePtr,
        uint16 nFeatures,
        uint16 nTrees,
        uint16 depth,
        int32 baseQ,
        uint8 pricingMode,
        uint256 feeWei,
        address feeRecipient,
        bool inferenceEnabled,
        address creator,
        uint32 tosVersionAccepted,
        string memory title,
        string memory description
    ) {
        bytes32 mid = modelIdByTokenId[tokenId];
        if (mid == bytes32(0)) return (false, 0, address(0), 0, 0, 0, 0, 0, 0, address(0), false, address(0), 0, "", "");
        Model storage m = models[mid];
        if (!m.exists || !m.active) return (false, 0, address(0), 0, 0, 0, 0, 0, 0, address(0), false, address(0), 0, "", "");

        title = modelNFT.title(tokenId);
        description = modelNFT.description(tokenId);

        return (true, m.modelId, m.tablePtr, m.nFeatures, m.nTrees, m.depth, m.baseQ, m.pricingMode, m.feeWei, _payoutAddress(m), m.inferenceEnabled, m.creator, m.tosVersionAccepted, title, description);
    }

    function getModelBytesInfo(bytes32 modelId) external view returns (address tablePtr, uint32 chunkSize, uint32 numChunks, uint32 totalBytes) {
        Model storage m = models[modelId];
        require(m.exists && m.active, "NF");
        return (m.tablePtr, m.chunkSize, m.numChunks, m.totalBytes);
    }

    function getModelRuntime(bytes32 modelId) external view returns (
        address tablePtr,
        uint32 chunkSize,
        uint32 numChunks,
        uint32 totalBytes,
        uint16 nFeatures,
        uint16 nTrees,
        uint16 depth,
        int32 baseQ,
        uint32 scaleQ,
        bool inferenceEnabled,
        uint8 pricingMode,
        uint256 feeWei,
        address feeRecipient
    ) {
        Model storage m = models[modelId];
        require(m.exists && m.active, "NF");
        return (m.tablePtr, m.chunkSize, m.numChunks, m.totalBytes, m.nFeatures, m.nTrees, m.depth, m.baseQ, m.scaleQ, m.inferenceEnabled, m.pricingMode, m.feeWei, _payoutAddress(m));
    }

    // AND search on words (exact hash match), paginated over the first word list.
    function searchTitleWords(bytes32[] calldata words, uint256 cursor, uint256 limit) external view returns (uint256[] memory tokenIds, uint256 nextCursor) {
        if (words.length == 0) return (new uint256[](0), 0);

        uint256[] storage baseList = _wordTokens[words[0]];
        uint256 n = baseList.length;
        if (cursor >= n) return (new uint256[](0), 0);

        uint256[] memory tmp = new uint256[](limit);
        uint256 found = 0;
        uint256 i = cursor;

        for (; i < n && found < limit; i++) {
            uint256 tid = baseList[i];
            bytes32 mid = modelIdByTokenId[tid];
            if (mid == bytes32(0)) continue;
            Model storage m = models[mid];
            if (!m.exists || !m.active) continue;

            bool ok = true;
            for (uint256 w = 1; w < words.length; w++) {
                if (!_wordHasToken[words[w]][tid]) { ok = false; break; }
            }
            if (!ok) continue;

            tmp[found++] = tid;
        }

        tokenIds = new uint256[](found);
        for (uint256 k = 0; k < found; k++) tokenIds[k] = tmp[k];
        nextCursor = (i >= n) ? 0 : i;
    }

    // ===== Mutations =====
    function registerModel(
        bytes32 modelId,
        address tablePtr,
        uint32 chunkSize,
        uint32 numChunks,
        uint32 totalBytes,
        uint16 nFeatures,
        uint16 nTrees,
        uint16 depth,
        int32 baseQ,
        uint32 scaleQ,
        string calldata title_,
        string calldata description_,
        bytes calldata iconPng32,
        string calldata featuresPacked,
        bytes32[] calldata titleWordHashes,
        uint8 pricingMode,
        uint256 feeWei,
        address recipient,
        uint32 tosVersionAccepted_,
        uint32 licenseIdAccepted_,
        address ownerKey
    ) external payable returns (uint256 tokenId) {
        require(address(modelNFT) != address(0), "NFT_NOT_SET");
        require(modelId != bytes32(0), "MID0");
        require(!models[modelId].exists, "EXISTS");
        uint256 requiredFee = requiredDeployFeeWei(totalBytes);
        require(msg.value == requiredFee, "DEPLOY_FEE");

        require(tosVersionAccepted_ == tosVersion, "TOS");
        require(isLicenseSelectable(licenseIdAccepted_), "LIC"); // any enabled catalog license
        require(ownerKey != address(0), "OWNER_KEY");

        require(bytes(title_).length > 0, "TITLE");
        require(bytes(description_).length > 0, "DESC");
        require(iconPng32.length > 0, "ICON");
        require(numChunks > 0, "NO_CHUNKS");
        require(chunkSize > 0, "CHUNK0");

        // fee rules
        require(pricingMode <= 2, "MODE");
        if (pricingMode == 0) {
            feeWei = 0;
        } else {
            require(feeWei > 0, "FEE_ZERO");
        }
        if (recipient == address(0)) recipient = msg.sender;

        // mint NFT
        tokenId = modelNFT.mintTo(msg.sender, title_, description_, iconPng32, featuresPacked);
        // Grant the model owner a perpetual API access key.
        _accessExpiry[modelId][ownerKey] = type(uint64).max;
        ownerKeyHolder[modelId][ownerKey] = msg.sender;
        emit OwnerAccessKeySet(modelId, ownerKey, type(uint64).max);

        Model storage m = models[modelId];
        m.exists = true;
        m.active = true;
        m.modelId = modelId;

        m.tablePtr = tablePtr;
        m.chunkSize = chunkSize;
        m.numChunks = numChunks;
        m.totalBytes = totalBytes;

        m.nFeatures = nFeatures;
        m.nTrees = nTrees;
        m.depth = depth;
        m.baseQ = baseQ;
        m.scaleQ = scaleQ;

        m.inferenceEnabled = true;
        m.pricingMode = pricingMode;
        m.feeWei = feeWei;
        m.feeRecipient = recipient;
        feeRecipientSetBy[modelId] = msg.sender;

        m.creator = msg.sender;
        m.tosVersionAccepted = tosVersionAccepted_;
        m.licenseIdAccepted = licenseIdAccepted_;
        licenseSinceBlock[tokenId] = uint64(block.number);
        m.tokenId = tokenId;

        modelIdByTokenId[tokenId] = modelId;
        tokenIdByModelId[modelId] = tokenId;

        // title index
        if (titleWordHashes.length > 0) {
            bytes32[] storage arr = _tokenWords[tokenId];
            for (uint256 i = 0; i < titleWordHashes.length; i++) {
                bytes32 wh = titleWordHashes[i];
                if (wh == bytes32(0)) continue;
                if (_wordHasToken[wh][tokenId]) continue;
                _wordHasToken[wh][tokenId] = true;
                _wordTokens[wh].push(tokenId);
                arr.push(wh);
            }
        }

        // Deploy fees stay in this contract until anyone burns them.
        _recordDeployFees(totalBytes);

        emit ModelLicensed(tokenId, licenseIdAccepted_);
        mintedAt[tokenId] = uint64(block.timestamp);
        emit ModelRegistered(tokenId, modelId, msg.sender);
    }

    // ===== Internals visibility and mint time (GL1F Crypto) =====
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

    // ===== Public fee burn =====
    /// @notice Anyone may call. Sends every wei this contract holds to BURN_ADDRESS.
    function burnFees() external returns (uint256 amountWei) {
        amountWei = address(this).balance;
        require(amountWei > 0, "NOTHING_TO_BURN");
        totalFeesBurnedWei += amountWei;
        burnCount += 1;
        (bool ok,) = BURN_ADDRESS.call{value: amountWei}("");
        require(ok, "BURN_SEND");
        emit FeesBurned(msg.sender, amountWei, totalFeesBurnedWei);
    }

    /// @notice Fees collected and not yet burned.
    function pendingBurnWei() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Cumulative protocol fees collected by this contract.
    function totalFeesCollectedWei() external view returns (uint256) {
        return totalCreationFeesWei + totalSizeFeesWei;
    }

    function _recordDeployFees(uint32 totalBytes) internal {
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

    function _requireTokenOwner(uint256 tokenId) internal view returns (address o) {
        o = modelNFT.ownerOf(tokenId);
        require(o == msg.sender, "NOT_OWNER");
    }

    function updateModelSettings(uint256 tokenId, bool enabled, uint8 pricingMode, uint256 feeWei, address recipient) external {
        address o = modelNFT.ownerOf(tokenId);
        require(o == msg.sender, "NOT_OWNER");
        bytes32 mid = modelIdByTokenId[tokenId];
        require(mid != bytes32(0), "NF");
        Model storage m = models[mid];
        require(m.exists && m.active, "NF");

        require(pricingMode <= 2, "MODE");
        if (pricingMode == 0) feeWei = 0;
        else require(feeWei > 0, "FEE_ZERO");
        if (recipient == address(0)) recipient = o;

        m.inferenceEnabled = enabled;
        m.pricingMode = pricingMode;
        m.feeWei = feeWei;
        m.feeRecipient = recipient;
        feeRecipientSetBy[mid] = o;
        emit ModelSettingsUpdated(tokenId, enabled, pricingMode, feeWei, recipient);
    }
    // ===== API Access Key Plans =====

    function createAccessPlan(bytes32 modelId, uint32 durationBlocks, uint256 priceWei, bool active) external returns (uint8 planId) {
        _requireTokenOwnerByModelId(modelId);
        require(models[modelId].pricingMode == 2, "MODE");
        require(durationBlocks > 0, "DUR0");
        planId = accessPlanCount[modelId] + 1;
        require(planId != 0, "PLAN_OVERFLOW"); // uint8 overflow
        accessPlanCount[modelId] = planId;
        _accessPlans[modelId][planId] = AccessPlan({durationBlocks: durationBlocks, priceWei: priceWei, active: active});
        emit AccessPlanSet(modelId, planId, durationBlocks, priceWei, active);
    }

    function setAccessPlan(bytes32 modelId, uint8 planId, uint32 durationBlocks, uint256 priceWei, bool active) external {
        _requireTokenOwnerByModelId(modelId);
        require(models[modelId].pricingMode == 2, "MODE");
        require(planId > 0 && planId <= accessPlanCount[modelId], "PLAN_ID");
        require(durationBlocks > 0, "DUR0");
        _accessPlans[modelId][planId] = AccessPlan({durationBlocks: durationBlocks, priceWei: priceWei, active: active});
        emit AccessPlanSet(modelId, planId, durationBlocks, priceWei, active);
    }

    function getAccessPlan(bytes32 modelId, uint8 planId) external view returns (uint32 durationBlocks, uint256 priceWei, bool active) {
        AccessPlan memory p = _accessPlans[modelId][planId];
        return (p.durationBlocks, p.priceWei, p.active);
    }

    function buyAccess(bytes32 modelId, uint8 planId, address key) external payable returns (uint64 newExpiry) {
        require(key != address(0), "KEY0");
        Model storage m = models[modelId];
        require(m.exists && m.active, "NF");
        require(m.pricingMode == 2, "MODE");

        AccessPlan memory p = _accessPlans[modelId][planId];
        require(p.active, "PLAN_OFF");
        require(msg.value == p.priceWei, "PRICE");

        uint64 cur = _accessExpiry[modelId][key];
        uint64 start = cur > uint64(block.number) ? cur : uint64(block.number);
        newExpiry = start + uint64(p.durationBlocks);
        _accessExpiry[modelId][key] = newExpiry;
        if (newExpiry > subscribedUntil[modelId]) subscribedUntil[modelId] = newExpiry;

        // payout: the recipient chosen by the current owner, else the current owner (income follows the NFT)
        address payTo = _payoutAddress(m);
        if (msg.value > 0) {
            (bool ok,) = payTo.call{value: msg.value}("");
            require(ok, "PAY_FAIL");
        }

        emit AccessPurchased(modelId, msg.sender, key, planId, newExpiry);
    }

    function setOwnerAccessKey(bytes32 modelId, address key) external {
        _requireTokenOwnerByModelId(modelId);
        require(models[modelId].pricingMode == 2, "MODE");
        require(key != address(0), "KEY0");
        require(ownerKeyHolder[modelId][key] != address(0) || _accessExpiry[modelId][key] < uint64(block.number), "KEY_SUBSCRIBED");
        _accessExpiry[modelId][key] = type(uint64).max;
        ownerKeyHolder[modelId][key] = msg.sender;
        emit OwnerAccessKeySet(modelId, key, type(uint64).max);
    }

    function revokeAccessKey(bytes32 modelId, address key) external {
        _requireTokenOwnerByModelId(modelId);
        require(models[modelId].pricingMode == 2, "MODE");
        require(key != address(0), "KEY0");
        require(ownerKeyHolder[modelId][key] != address(0), "NOT_OWNER_KEY");
        _accessExpiry[modelId][key] = 0;
        delete ownerKeyHolder[modelId][key];
        emit AccessRevoked(modelId, key);
    }

    function _requireTokenOwnerByModelId(bytes32 modelId) internal view returns (uint256 tokenId, address owner) {
        require(address(modelNFT) != address(0), "NFT_NOT_SET");
        tokenId = tokenIdByModelId[modelId];
        require(tokenId != 0, "NO_TOKEN");
        owner = modelNFT.ownerOf(tokenId);
        require(owner == msg.sender, "NOT_OWNER");
    }


    /// @notice The model admin (the NFT holder) can delete the model once nobody is owed access: every paid subscription
    /// has ended. Deleting burns the NFT and removes the model from the registry and its search index. The bytes already
    /// written to the store's chunk contracts stay on-chain (deployed code cannot be erased), but nothing points to them.
    function burnAndDelete(uint256 tokenId) external {
        address o = modelNFT.ownerOf(tokenId);
        require(o == msg.sender, "NOT_OWNER");
        require(uint64(block.number) >= subscribedUntil[modelIdByTokenId[tokenId]], "ACTIVE_SUBSCRIPTIONS");
        delete mintedAt[tokenId];
        delete internalsVisibility[tokenId];
        _burnAndDelete(tokenId);
    }

    function _burnAndDelete(uint256 tokenId) internal {
        bytes32 mid = modelIdByTokenId[tokenId];
        require(mid != bytes32(0), "NF");
        Model storage m = models[mid];
        require(m.exists && m.active, "NF");

        // burn NFT
        modelNFT.burn(tokenId);

        // clear index membership flags (arrays remain, but membership false)
        bytes32[] storage words = _tokenWords[tokenId];
        for (uint256 i = 0; i < words.length; i++) {
            _wordHasToken[words[i]][tokenId] = false;
        }
        delete _tokenWords[tokenId];

        // clear mappings
        delete modelIdByTokenId[tokenId];
        delete tokenIdByModelId[mid];

        // deactivate model
        m.active = false;
        m.inferenceEnabled = false;
        m.tablePtr = address(0);

        emit ModelBurned(tokenId, mid);
    }
}