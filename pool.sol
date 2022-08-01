pragma solidity ^0.8.0;

//SPDX-License-Identifier: SimPL-2.0

interface ERC20token {
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool success);

    function transfer(address _to, uint256 _value)
        external
        returns (bool success);

    function balanceOf(address _address) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function mint(address _to, uint256 amount) external returns (bool);
}

interface RiskReserveInterface {
    function someFn(uint256 _param) external;
}

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    function mod(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

contract pool {
    using SafeMath for uint256;
    ERC20token aUSD; 
    RiskReserveInterface riskReserve;

    struct policyInfo {
        uint256 id;
        address beneficiary;
        uint256 coverage;
        uint256 deposit;
        uint256 startTime;
        uint256 effectiveUntil;
        uint256 latestProviderIndex;
        uint256 deltaAccSPS;
        bool isClaimed;
        bool inClaimApplying;
        bool isCanceled;
    }

    struct providerInfo {
        uint256 index;
        uint256 participationTime;
        uint256 saUSDAmount;
        uint256 RDebt;
        uint256 SDebt;
    }

    struct historicalProviderInfo {
        uint256 indexBefore; 
        uint256 saUSDAmountBefore; 
        uint256 faUSD;
        uint256 accSPSWhileLeft; 
        uint256 SDebtBefore; 
    }


    uint256 public providerCount; 
    uint256 public exchangeRate = 100000; 

    uint256 public policyCount; 

    uint256 public accRPS = 0; 
    uint256 public accSPS = 0; 
    uint256 public accSPSDown = 0; 
    uint256 public aUSDStakedHere = 0;
    uint256 public saUSDSupply = 0; 
    uint256 public aUSDFrozenHere = 0; 
    uint256 public totalCoverage = 0; 
    uint256 public kLast; 
    uint256 public latestUnfrozenIndex; 

    uint256 public initialFee = 2000;
    uint256 public minFee = 2000; 

    address internal judger; 
    address internal official; 

    uint256 internal claimableTeamReward;
    uint256 internal virtualParam;

    mapping(address => bool) public usedToBeProvider; 
    mapping(address => providerInfo) public providerMap; 
    mapping(address => historicalProviderInfo) public historicalProviderMap; 
    mapping(address => uint256[]) public userPolicies; 
    policyInfo[] public policies; 

    mapping(address => bool) internal isValidMiningProxy; 

    bool internal providerLeaving = false;
    bool internal historicalProviderLeaving = false;

    constructor(
        address _aUSD,
        address _judger,
        address _official,
        address _riskReserve,
        uint256 _virtualParam
    ) {
        aUSD = ERC20token(_aUSD);
        judger = _judger;
        official = _official;
        riskReserve = RiskReserveInterface(_riskReserve);
        virtualParam = _virtualParam;
    }

    function judgerTransfer(address _judger) external {
        require(msg.sender == judger);
        judger = _judger;
    }

    function officialTransfer(address _offcial) external {
        require(msg.sender == official);
        official = _offcial;
    }

    function teamClaim() external {
        require(msg.sender == official);
        aUSD.transfer(official, claimableTeamReward);
        claimableTeamReward = 0;
    }

    function validMiningProxyManage(address _proxy, bool _bool) external {
        require(msg.sender == judger);
        isValidMiningProxy[_proxy] = _bool;
    }

    function getUseableCapital() public view returns (uint256) {
        if (aUSDStakedHere >= totalCoverage) {
            return aUSDStakedHere.sub(totalCoverage); 
        } else {
            return 0;
        }
    }

    function getFee() public view returns (uint256) {
        uint256 useableCapital = getUseableCapital(); 
        if(useableCapital != 0){
           uint256 fee = kLast.div(useableCapital.add(virtualParam)); 
           return fee;
        }else{
           return 0;
        }
    }



    function buyCover(uint256 _coverage) public {
        uint256 useableCapital = getUseableCapital(); 
        require(
          useableCapital != 0 && _coverage <= useableCapital.mul(2).div(100),
            "invalid coverage"
        ); 
        uint256 fee = getFee(); 
        uint256 coverFee = _coverage.mul(fee).div(1e5); 
        uint256 deposit = coverFee.mul(5).div(100); 
        uint256 totalPay = coverFee.add(deposit); 
        aUSD.transferFrom(msg.sender, address(this), totalPay); 

        totalCoverage = totalCoverage.add(_coverage); 
        uint256 deltaAccSPS = _coverage.mul(1e12).div(saUSDSupply); 
        accSPS = accSPS.add(deltaAccSPS);

        uint256 rewardForTeam = coverFee.mul(5).div(100); 
        claimableTeamReward = claimableTeamReward.add(rewardForTeam); 
        uint256 rewardForProviders = coverFee.sub(rewardForTeam); 
        uint256 deltaAccRPS = rewardForProviders.mul(1e12).div(saUSDSupply);
        accRPS = accRPS.add(deltaAccRPS);

        uint256 today = block.timestamp;
        policies.push(
            policyInfo({
                id: policyCount,
                beneficiary: msg.sender,
                coverage: _coverage,
                deposit: deposit,
                startTime: today,
                effectiveUntil: today.add(360 * 86400),
                latestProviderIndex: providerCount.sub(1),
                deltaAccSPS: deltaAccSPS,
                isClaimed: false,
                inClaimApplying: false,
                isCanceled: false
            })
        );

        userPolicies[msg.sender].push(policyCount);

        policyCount++;
    }

    function provideCapital(uint256 _amount) public {
        require(usedToBeProvider[msg.sender] == false); 
        usedToBeProvider[msg.sender] = true;

        providerInfo storage provider = providerMap[msg.sender];
        aUSD.transferFrom(msg.sender, address(this), _amount);

        provider.index = providerCount; 
        provider.participationTime = block.timestamp; 
        provider.saUSDAmount = _amount.mul(1e5).div(exchangeRate); 
        provider.RDebt = provider.saUSDAmount.mul(accRPS).div(1e12); 
        provider.SDebt = provider.saUSDAmount.mul(accSPS).div(1e12); 

        saUSDSupply = saUSDSupply.add(provider.saUSDAmount); 



        uint256 preUseableCapital = getUseableCapital();
        aUSDStakedHere = aUSDStakedHere.add(_amount); 
        uint256 currentUseableCapital = getUseableCapital();
        _updateKLastByProvider(preUseableCapital, currentUseableCapital); 



        providerCount++; 
    }


    function _updateKLastByProvider(
        uint256 _preUseableCapital,
        uint256 _currentUseableCapital
    ) internal {
        if (providerCount == 0) { 
            kLast = initialFee.mul(_currentUseableCapital.add(virtualParam)); 
        } else {
            uint256 fee = kLast.div(_preUseableCapital.add(virtualParam));
            kLast = fee.mul(_currentUseableCapital.add(virtualParam));
        }
    }



    function getReward(address _provider) public view returns (uint256) {
        providerInfo storage provider = providerMap[_provider];
        if (provider.saUSDAmount != 0) {
            uint256 reward = provider.saUSDAmount.mul(accRPS).div(1e12).sub(
                provider.RDebt
            );
            return reward;
        } else {
            return 0;
        }
    }

    function providerTakeReward() public {
        providerInfo storage provider = providerMap[msg.sender]; 
        require(provider.saUSDAmount > 0); 
        uint256 reward = getReward(msg.sender); 
        provider.RDebt = provider.saUSDAmount.mul(accRPS).div(1e12); 
        aUSD.transfer(msg.sender, reward);
    }



    function providerAbolish() public {
        providerInfo storage provider = providerMap[msg.sender];
        require(provider.saUSDAmount != 0); 

        require(providerLeaving == false);
        providerLeaving = true;

        uint256 aUSDRemain = provider.saUSDAmount.mul(exchangeRate).div(1e5);
        uint256 shadow = _getShadow(provider);

        uint256 withdrawableCapital;
        if (aUSDRemain >= shadow) {
            withdrawableCapital = aUSDRemain.sub(shadow);
        } else {
            withdrawableCapital = 0;
        }

        uint256 reward = provider.saUSDAmount.mul(accRPS).div(1e12).sub(
            provider.RDebt
        );

        _registerHistoricalProvider(provider, aUSDRemain, withdrawableCapital);

        saUSDSupply = saUSDSupply.sub(provider.saUSDAmount);
        provider.saUSDAmount = 0;
        provider.RDebt = 0;

        uint256 preUseableCapital = getUseableCapital();
        aUSDStakedHere = aUSDStakedHere.sub(aUSDRemain);
        uint256 currentUseableCapital = getUseableCapital();
        _updateKLastByProvider(preUseableCapital, currentUseableCapital);

        if (withdrawableCapital.add(reward) > 0) {
            aUSD.transfer(msg.sender, withdrawableCapital.add(reward));
        }

        providerLeaving = false;

    }

    function _registerHistoricalProvider(
        providerInfo storage provider,
        uint256 _aUSDRemain,
        uint256 _withdrawableCapital
    ) internal {
        historicalProviderInfo
            storage historicalProvider = historicalProviderMap[msg.sender];
        historicalProvider.indexBefore = provider.index;
        historicalProvider.saUSDAmountBefore = provider.saUSDAmount;
        uint256 aUSDLeft = _aUSDRemain.sub(_withdrawableCapital);
        historicalProvider.faUSD = aUSDLeft.mul(1e5).div(exchangeRate);
        historicalProvider.accSPSWhileLeft = accSPS;
        historicalProvider.SDebtBefore = provider.SDebt;

        aUSDFrozenHere = aUSDFrozenHere.add(aUSDLeft);
    }

    function getUnfrozenCapital(address _provider)
        public
        view
        returns (uint256)
    {
        providerInfo storage provider = providerMap[_provider];
        uint256 aUSDRemain = provider.saUSDAmount.mul(exchangeRate).div(1e5); 
        if (provider.index > latestUnfrozenIndex) {
            uint256 shadow1 = provider.saUSDAmount.mul(accSPS).div(1e12).sub(
                provider.SDebt
            );
            if (aUSDRemain >= shadow1) {
                return aUSDRemain.sub(shadow1);
            } else {
                return 0; 
            }
        } else {
            uint256 delta = accSPS.sub(accSPSDown);
            uint256 shadow2 = provider.saUSDAmount.mul(delta).div(1e12);
            if (aUSDRemain >= shadow2) {
                return aUSDRemain.sub(shadow2);
            } else {
                return 0;
            }
        }
    }

    function _getShadow(providerInfo storage provider)
        internal
        view
        returns (uint256)
    {
        if (provider.index > latestUnfrozenIndex) {
            return
                provider.saUSDAmount.mul(accSPS).div(1e12).sub(provider.SDebt);
        } else {
            uint256 delta = accSPS.sub(accSPSDown);
            return provider.saUSDAmount.mul(delta).div(1e12);
        }
    }

    function _getShadowHistoricalProvider(
        historicalProviderInfo storage historicalProvider
    ) internal view returns (uint256) {
        if (historicalProvider.indexBefore > latestUnfrozenIndex) {
            return
                historicalProvider
                    .saUSDAmountBefore
                    .mul(historicalProvider.accSPSWhileLeft)
                    .div(1e12)
                    .sub(historicalProvider.SDebtBefore);
        } else {
            if (historicalProvider.accSPSWhileLeft >= accSPSDown) {
                uint256 delta = historicalProvider.accSPSWhileLeft.sub(
                    accSPSDown
                );
                return
                    historicalProvider.saUSDAmountBefore.mul(delta).div(1e12);
            } else {
                return 0;
            }
        }
    }

    function getUnfrozenCapitalHistorical(address _historicalProvider)
        public
        view
        returns (uint256)
    {
        historicalProviderInfo
            storage historicalProvider = historicalProviderMap[
                _historicalProvider
            ];
        uint256 shadow = _getShadowHistoricalProvider(historicalProvider);
        if (historicalProvider.faUSD.mul(exchangeRate).div(1e5) <= shadow) {
            return 0;
        } else {
            return historicalProvider.faUSD.mul(exchangeRate).div(1e5).sub(shadow);
        }
    }

    function historicalProviderWithdraw() public {
        historicalProviderInfo
            storage historicalProvider = historicalProviderMap[msg.sender];
        require(historicalProvider.faUSD != 0); 

        require(historicalProviderLeaving == false);
        historicalProviderLeaving = true;

        uint256 shadow = _getShadowHistoricalProvider(historicalProvider);
        require(historicalProvider.faUSD.mul(exchangeRate).div(1e5) > shadow); 
        aUSD.transfer(msg.sender, historicalProvider.faUSD.mul(exchangeRate).div(1e5).sub(shadow));   
        
        aUSDFrozenHere = aUSDFrozenHere.sub(historicalProvider.faUSD.mul(exchangeRate).div(1e5).sub(shadow));

        historicalProvider.faUSD = shadow.mul(1e5).div(exchangeRate); 
        
        historicalProviderLeaving = false;
    }

    function tryPolicyCancel(uint256 _id) public {
        policyInfo storage policy = policies[_id];
        require(policy.isCanceled == false, "policy already canceled");

        if (_id == 0) {
            excuteCancel(policy); 
        } else {
            policyInfo storage prepolicy = policies[_id - 1]; 
            require(prepolicy.isCanceled == true);
            excuteCancel(policy);
        }
    }

    function excuteCancel(policyInfo storage policy) internal {
        uint256 today = block.timestamp; 
        require(
            policy.effectiveUntil < today && policy.inClaimApplying == false
        ); 
        uint256 timePass = today.sub(policy.effectiveUntil);
        if (timePass <= 86400) {
            require(
                msg.sender == policy.beneficiary,
                "only for policy holder now"
            );
            _doPolicyCancel(policy, msg.sender);
        } else {
            _doPolicyCancel(policy, msg.sender);
        }
    }

    function _doPolicyCancel(policyInfo storage policy, address _caller)
        internal
    {
        totalCoverage = totalCoverage.sub(policy.coverage); 
        accSPSDown = accSPSDown.add(policy.deltaAccSPS); 
        policy.isCanceled = true;
        latestUnfrozenIndex = policy.latestProviderIndex;
        _updateKLastByCancel(totalCoverage);
        aUSD.transfer(_caller, policy.deposit); 
    }


    function _updateKLastByCancel(uint256 _totalCoverage) internal {
        if(aUSDStakedHere > _totalCoverage){
        uint256 useableCapital = aUSDStakedHere.sub(_totalCoverage); 
        uint256 tentativeFee = kLast.div(useableCapital.add(virtualParam)); 
           if (tentativeFee >= minFee) {    
               return; 
           } else {
               kLast = minFee.mul(useableCapital.add(virtualParam));
           }
        }else{
            return;
        }
        
    }

    function policyClaimApply(uint256 _id) public {
        policyInfo storage policy = policies[_id];
        require(msg.sender == policy.beneficiary); 
        require(policy.isClaimed == false); 
        require(policy.inClaimApplying == false); 
        require(policy.isCanceled == false); 
        uint256 today = block.timestamp;
        require(today <= policy.effectiveUntil); 
        policy.inClaimApplying = true;
    }

    function refuseApply(uint256 _id) public {
        require(msg.sender == judger);
        policyInfo storage policy = policies[_id];
        policy.inClaimApplying = false;
    }

   
    function acceptApply(uint256 _id) external {
        require(msg.sender == judger); 
        policyInfo storage policy = policies[_id];
        require(policy.inClaimApplying == true); 
        policy.inClaimApplying = false; 
        policy.isClaimed = true; 

        if (aUSD.balanceOf(address(riskReserve)) >= policy.coverage) {
            aUSD.transferFrom(
                address(riskReserve),
                policy.beneficiary,
                policy.coverage
            ); 
        } else {
            aUSD.transferFrom(
                address(riskReserve),
                policy.beneficiary,
                aUSD.balanceOf(address(riskReserve))
            ); 
            uint256 exceeded = policy.coverage.sub(
                aUSD.balanceOf(address(riskReserve))
            );
            _exceededPay(policy.beneficiary, exceeded); 
        }
    }

    function _exceededPay(address _to, uint256 _exceeded) internal {
        uint256 preReserve = aUSDStakedHere.add(aUSDFrozenHere);
        uint256 afterReserve = preReserve.sub(_exceeded);

        uint256 deltaRate = afterReserve.mul(1e5).div(preReserve);

        exchangeRate = exchangeRate.mul(deltaRate).div(1e5); 

        aUSDStakedHere = aUSDStakedHere.mul(deltaRate).div(1e5); 
        aUSDFrozenHere = aUSDFrozenHere.mul(deltaRate).div(1e5);

        aUSD.transfer(_to, _exceeded); 
    }

    function unusedCaptalForMining(uint256 _amount, address _to) external {
        require(msg.sender == judger && isValidMiningProxy[_to] == true); 
        aUSD.transfer(_to, _amount); 
    }
}
