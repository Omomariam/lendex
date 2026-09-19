// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title LendEx — experimental fixed-term peer-to-peer lending
/// @notice Prototype contract for BOT Chain testnet. Not audited; do not use with real funds.
contract LendEx {
    enum Status { Open, Active, Repaid, Defaulted, Cancelled }

    struct Loan {
        address payable borrower;
        address payable lender;
        uint256 principal;
        uint256 collateral;
        uint256 interestBps;
        uint256 duration;
        uint256 fundedAt;
        Status status;
    }

    Loan[] private _loans;
    bool private _locked;

    event LoanCreated(uint256 indexed id, address indexed borrower, uint256 principal, uint256 collateral, uint256 interestBps, uint256 duration);
    event LoanFunded(uint256 indexed id, address indexed lender, uint256 dueAt);
    event LoanRepaid(uint256 indexed id, uint256 amount);
    event LoanDefaulted(uint256 indexed id, address indexed lender, uint256 collateral);
    event LoanCancelled(uint256 indexed id);

    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    modifier validLoan(uint256 id) {
        require(id < _loans.length, "Loan does not exist");
        _;
    }

    function createLoan(uint256 principal, uint256 interestBps, uint256 duration) external payable returns (uint256 id) {
        require(principal > 0, "Principal must be positive");
        require(msg.value > 0, "Collateral required");
        require(interestBps <= 10_000, "Interest too high");
        require(duration >= 1 hours && duration <= 365 days, "Invalid duration");

        id = _loans.length;
        _loans.push(Loan(payable(msg.sender), payable(address(0)), principal, msg.value, interestBps, duration, 0, Status.Open));
        emit LoanCreated(id, msg.sender, principal, msg.value, interestBps, duration);
    }

    function fundLoan(uint256 id) external payable nonReentrant validLoan(id) {
        Loan storage loan = _loans[id];
        require(loan.status == Status.Open, "Loan is not open");
        require(msg.sender != loan.borrower, "Cannot fund own loan");
        require(msg.value == loan.principal, "Send exact principal");

        loan.lender = payable(msg.sender);
        loan.fundedAt = block.timestamp;
        loan.status = Status.Active;
        (bool sent, ) = loan.borrower.call{value: msg.value}("");
        require(sent, "Principal transfer failed");
        emit LoanFunded(id, msg.sender, block.timestamp + loan.duration);
    }

    function repayLoan(uint256 id) external payable nonReentrant validLoan(id) {
        Loan storage loan = _loans[id];
        require(loan.status == Status.Active, "Loan is not active");
        require(msg.sender == loan.borrower, "Only borrower");
        require(block.timestamp <= loan.fundedAt + loan.duration, "Loan is overdue");
        uint256 due = repaymentAmount(id);
        require(msg.value == due, "Send exact repayment");

        loan.status = Status.Repaid;
        (bool paid, ) = loan.lender.call{value: msg.value}("");
        require(paid, "Lender payment failed");
        (bool returned, ) = loan.borrower.call{value: loan.collateral}("");
        require(returned, "Collateral return failed");
        emit LoanRepaid(id, due);
    }

    function claimDefault(uint256 id) external nonReentrant validLoan(id) {
        Loan storage loan = _loans[id];
        require(loan.status == Status.Active, "Loan is not active");
        require(msg.sender == loan.lender, "Only lender");
        require(block.timestamp > loan.fundedAt + loan.duration, "Loan not overdue");

        loan.status = Status.Defaulted;
        (bool sent, ) = loan.lender.call{value: loan.collateral}("");
        require(sent, "Collateral transfer failed");
        emit LoanDefaulted(id, loan.lender, loan.collateral);
    }

    function cancelLoan(uint256 id) external nonReentrant validLoan(id) {
        Loan storage loan = _loans[id];
        require(loan.status == Status.Open, "Loan is not open");
        require(msg.sender == loan.borrower, "Only borrower");

        loan.status = Status.Cancelled;
        (bool sent, ) = loan.borrower.call{value: loan.collateral}("");
        require(sent, "Collateral return failed");
        emit LoanCancelled(id);
    }

    function repaymentAmount(uint256 id) public view validLoan(id) returns (uint256) {
        Loan storage loan = _loans[id];
        return loan.principal + (loan.principal * loan.interestBps / 10_000);
    }

    function dueAt(uint256 id) external view validLoan(id) returns (uint256) {
        Loan storage loan = _loans[id];
        return loan.fundedAt == 0 ? 0 : loan.fundedAt + loan.duration;
    }

    function getLoan(uint256 id) external view validLoan(id) returns (Loan memory) { return _loans[id]; }
    function getLoans() external view returns (Loan[] memory) { return _loans; }
    function loanCount() external view returns (uint256) { return _loans.length; }
}
