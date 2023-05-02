//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IEpochManage {
    struct EpochInfo {
        uint256 epochId;
        uint256 crossSPS;
        uint256 accRealSPSComp; //crossSPSClaimed;//comp
        uint256 accRPS;
        uint256 accSPS;
    }

    function isWithdrawDay() external view returns (bool);

    function nextWithdrawDay() external view returns (uint);

    function currentEpochIndex() external view returns (uint64);

    function updateCrossShadow(
        uint256 SPS,
        uint64 enteredEpochIndex,
        bool isClaimed
    ) external;

    function getEpochInfo(
        uint64 epochIndex
    ) external view returns (EpochInfo memory);

    function getCurrentEpochInfo() external view returns (EpochInfo memory);

    function getCurrentEpoch() external view returns (uint256);

    function getTimestampFromEpoch(
        uint64 epochIndex
    ) external view returns (uint256);

    function checkAndCreateNewEpochAndUpdateLiquidity() external returns (bool);

    function checkAndCreateNewEpochAndUpdateAccRPSAccSPS() external;
}
