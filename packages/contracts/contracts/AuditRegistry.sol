// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Append-only on-chain registry. AUDIT commits a hash of every agent
///         decision here, so the record is timestamped, public and unforgeable.
contract AuditRegistry {
    struct Entry {
        uint256 timestamp;
        bytes32 decisionHash;
        address submitter;
        string ref;
    }

    Entry[] private _entries;
    mapping(bytes32 => bool) private _seen;

    event Committed(address indexed submitter, bytes32 decisionHash, string ref);

    function commit(bytes32 decisionHash, string calldata ref) external returns (uint256 index) {
        require(decisionHash != bytes32(0), "empty hash");
        require(!_seen[decisionHash], "duplicate");
        _seen[decisionHash] = true;
        index = _entries.length;
        _entries.push(Entry(block.timestamp, decisionHash, msg.sender, ref));
        emit Committed(msg.sender, decisionHash, ref);
    }

    function entryCount() external view returns (uint256) {
        return _entries.length;
    }

    function getEntry(uint256 i) external view returns (uint256, bytes32, address, string memory) {
        Entry memory e = _entries[i];
        return (e.timestamp, e.decisionHash, e.submitter, e.ref);
    }

    function latest() external view returns (uint256, bytes32, address, string memory) {
        require(_entries.length > 0, "empty");
        Entry memory e = _entries[_entries.length - 1];
        return (e.timestamp, e.decisionHash, e.submitter, e.ref);
    }
}
