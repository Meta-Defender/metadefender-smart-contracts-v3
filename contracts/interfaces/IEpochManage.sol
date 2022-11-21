//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IEpochManage {

    struct EpochInfo {
        uint epochId;
        uint crossSPS;
        // deprecated
        uint accRPS;
    }

    function metaDefender() external returns (address);

    function currentEpochIndex() external returns (uint);

    function epochLength() external returns (uint);

    function updateCrossShadow(uint SPS, uint enteredEpoch) external;

    function getEpochInfo(uint epochIndex) external view returns (EpochInfo memory);

    function getCurrentEpochInfo() external view returns (EpochInfo memory);

    function getCurrentEpoch() external view returns(uint);

    function getCurrentEpochIndex() external view returns(uint);

    function checkAndCreateNewEpoch() external;

}
