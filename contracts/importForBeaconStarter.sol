// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

// We need to compile contracts and this is the easiest way to make hardhat do that
import "@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol";
import "@api3/airnode-protocol/contracts/access-control-registry/AccessControlRegistry.sol";
import "@api3/airnode-protocol/contracts/rrp/requesters/RrpBeaconServer.sol";
import "@api3/airnode-protocol/contracts/authorizers/RequesterAuthorizerWithManager.sol";
