// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract Lease721 is Context {
  ERC721 public asset;
  uint256 public tokenId;
  address public tenant;
  uint256 public duration;
  uint256 public pricePerHour;

  /**
   * @dev Initializes a new Lease contract.
   * @param _asset The address of the ERC721 asset contract.
   * @param _tokenId The ID of the token being leased.
   * @param _pricePerHour The price of the lease.
   */
  constructor(address _asset, uint256 _tokenId, uint256 _pricePerHour) {
    asset = ERC721(_asset);
    tokenId = _tokenId;
    tenant = address(0);
    pricePerHour = _pricePerHour;
  }

  /**
   * @dev Allows a user to rent the asset by providing the expiration time and making a payment.
   * @param _hours Number of hours the client is buying.
   */
  function rent(uint256 _hours) public payable {
    require(_msgSender() != address(0), "ERR_INVALID_ADDRESS");
    require(tenant == address(0), "ERR_ALREADY_RENTED");

    uint256 totalPricePerHour = _hours * pricePerHour;

    require(msg.value == totalPricePerHour, "ERR_INVALID_PRICE_PER_HOUR_AMOUNT");

    duration = block.timestamp + (_hours * 1 hours);
    tenant = _msgSender();

    asset.approve(tenant, tokenId);
  }

  /**
   * @dev Emitted by anyone (a cron-job in this case) and will terminate the lease (remove approval of this contract and of the tenant) on behalf of the owner
   */
  function terminate() public {
    require(block.timestamp > duration, "ERR_NOT_EXPIRED");

    tenant = address(0);
    asset.approve(address(0), tokenId);
  }

  /**
   * @dev Allows the ERC721 owner to claim the total balance accumulated from rent of this tokenId.
   * @dev Can be called by anyone, but only the owner of the ERC721 token will receive the balance.
   */
  function claimBalance() public {
    require(tenant == address(0), "ERR_LEASE_NOT_TERMINATED");

    uint256 balance = address(this).balance;
    require(balance > 0, "ERR_NO_BALANCE_TO_CLAIM");

    address owner = ERC721(asset).ownerOf(tokenId);

    payable(owner).transfer(balance);
  }
}
