//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IEpochManage {

    struct EpochInfo {
        uint epochId;
        uint crossSPS;
        uint accRPS;
        uint accSPS;
    }

    function currentEpochIndex() external returns (uint64);

    function updateCrossShadow(uint SPS, uint64 enteredEpochIndex) external;

    function getEpochInfo(uint64 epochIndex) external view returns (EpochInfo memory);

    function getCurrentEpochInfo() external view returns (EpochInfo memory);

    function getCurrentEpoch() external view returns(uint);

    function getTimestampFromEpoch(uint64 epochIndex) external view returns(uint);

    function isExitDay() external view returns(bool);

    function checkAndCreateNewEpochAndUpdateLiquidity() external returns (bool);

    function checkAndCreateNewEpochAndUpdateAccRPSAccSPS() external;

    function nextExitDay() external view returns(uint);

}
