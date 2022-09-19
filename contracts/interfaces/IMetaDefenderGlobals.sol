//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMetaDefenderGlobals {
    function setMinimumFee(address _address, uint _minimumFee) external;

    function setInitialFee(address _address, uint _InitialFee) external;

    function initialFee(address) external view returns (uint);

    function minimumFee(address) external view returns (uint);
}
