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
// GL1F Crypto runtime variant of ModelMarketplace.sol.
// Differences from the General contract:
//   * protocol fees (listing fee) are never forwarded to the owner or any other
//     account; they stay in this contract;
//   * burnFees() is public: anyone may send the full accumulated balance to
//     BURN_ADDRESS (0x...dEaD), an address no key controls;
//   * cumulative counters (collected, burned, burn count) are public so explorers
//     and the GL1F Crypto docs page can report them from chain state.
// The owner can still set fee levels. The owner cannot withdraw fees.
pragma solidity ^0.8.20;

import "./SimpleOwnable.sol";

interface IModelNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract CryptoModelMarketplace is SimpleOwnable {
    IModelNFT public immutable nft;

    struct Listing {
        bool listed;
        uint256 priceWei;
        address seller;
    }

    uint256 public listingFeeWei;

    // ===== Burnable protocol fees (GL1F Crypto) =====
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint8 public constant FEE_KIND_LISTING = 2;
    uint256 public totalListingFeesWei;
    uint256 public totalFeesBurnedWei;
    uint256 public burnCount;

    event FeesCollected(uint8 indexed kind, address indexed payer, uint256 amountWei);
    event FeesBurned(address indexed caller, uint256 amountWei, uint256 totalBurnedWei);

    mapping(uint256 => Listing) public listings;
    uint256[] private listedIds;
    mapping(uint256 => uint256) private listedIndex; // tokenId => idx+1

    event Listed(uint256 indexed tokenId, uint256 priceWei, address indexed seller);
    event Cancelled(uint256 indexed tokenId);
    event Bought(uint256 indexed tokenId, uint256 priceWei, address indexed seller, address indexed buyer);
    event ListingFeeSet(uint256 feeWei); // GL1F Crypto: fee changes are public events

    constructor(address nftAddr, address owner_) SimpleOwnable(owner_) {
        require(nftAddr != address(0), "NFT0");
        nft = IModelNFT(nftAddr);
    }

    function setListingFeeWei(uint256 feeWei) external onlyOwner {
        listingFeeWei = feeWei;
        emit ListingFeeSet(feeWei);
    }

    function getListing(uint256 tokenId) external view returns (bool listed, uint256 priceWei, address seller) {
        Listing memory l = listings[tokenId];
        return (l.listed, l.priceWei, l.seller);
    }

    function getListingsPage(uint256 cursor, uint256 limit) external view returns (uint256[] memory tokenIds, uint256[] memory prices, address[] memory sellers, uint256 nextCursor) {
        uint256 n = listedIds.length;
        if (cursor >= n) {
            return (new uint256[](0), new uint256[](0), new address[](0), 0);
        }
        uint256 end = cursor + limit;
        if (end > n) end = n;
        uint256 m = end - cursor;

        tokenIds = new uint256[](m);
        prices = new uint256[](m);
        sellers = new address[](m);

        for (uint256 i = 0; i < m; i++) {
            uint256 tid = listedIds[cursor + i];
            Listing memory l = listings[tid];
            tokenIds[i] = tid;
            prices[i] = l.priceWei;
            sellers[i] = l.seller;
        }

        nextCursor = (end >= n) ? 0 : end;
    }

    function list(uint256 tokenId, uint256 priceWei) external payable {
        require(msg.value == listingFeeWei, "LIST_FEE");
        require(priceWei > 0, "PRICE0");
        address seller = nft.ownerOf(tokenId);
        require(seller == msg.sender, "NOT_OWNER");

        bool approved = (nft.getApproved(tokenId) == address(this)) || nft.isApprovedForAll(seller, address(this));
        require(approved, "APPROVE_MARKET");

        Listing storage l = listings[tokenId];
        if (!l.listed) {
            l.listed = true;
            l.seller = seller;
            _addListed(tokenId);
        } else {
            // keep seller as original
            require(l.seller == seller, "SELLER_CHANGED");
        }
        l.priceWei = priceWei;

        if (listingFeeWei > 0) {
            totalListingFeesWei += listingFeeWei;
            emit FeesCollected(FEE_KIND_LISTING, msg.sender, listingFeeWei);
        }

        emit Listed(tokenId, priceWei, seller);
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
        return totalListingFeesWei;
    }

    function cancel(uint256 tokenId) external {
        Listing storage l = listings[tokenId];
        require(l.listed, "NOT_LISTED");
        address seller = l.seller;
        require(msg.sender == seller || msg.sender == owner, "NOAUTH");
        _removeListed(tokenId);
        delete listings[tokenId];
        emit Cancelled(tokenId);
    }

    function buy(uint256 tokenId) external payable {
        Listing storage l = listings[tokenId];
        require(l.listed, "NOT_LISTED");
        require(msg.value == l.priceWei, "BAD_PRICE");

        address seller = l.seller;
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

        emit Bought(tokenId, msg.value, seller, msg.sender);
    }

    function _addListed(uint256 tokenId) internal {
        if (listedIndex[tokenId] != 0) return;
        listedIds.push(tokenId);
        listedIndex[tokenId] = listedIds.length; // idx+1
    }

    function _removeListed(uint256 tokenId) internal {
        uint256 idx1 = listedIndex[tokenId];
        if (idx1 == 0) return;
        uint256 idx = idx1 - 1;
        uint256 last = listedIds[listedIds.length - 1];
        if (idx != listedIds.length - 1) {
            listedIds[idx] = last;
            listedIndex[last] = idx + 1;
        }
        listedIds.pop();
        delete listedIndex[tokenId];
    }
}
