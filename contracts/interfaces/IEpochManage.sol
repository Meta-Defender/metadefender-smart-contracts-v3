//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IEpochManage {

    struct EpochInfo {
        // SPSInSettling
        uint SPSInSettling;
        // SPSInBuying;
        uint SPSInBuying;
        // usable capital;
        uint usableCapital;
        // rewardDebt;
        uint accRPS;
    }
    function metaDefender() external returns (address);

    function currentEpoch() external returns (uint);

    function updateSPSInSettling(uint SPS, uint duration) external;

    function updateSPSInBuying(uint SPS, uint enteredAt) external;

    function getEpochInfo() external view returns (EpochInfo memory);

    function getCurrentEpoch() external view returns (uint);

    function isNewEpoch() external returns (bool);

}
