const { expect } = require("chai");
const hre = require("hardhat");

describe("OxyToken contract", function() {
  // global vars
  let Token;
  let SIW;
  let oxyToken;
  let standInWETH;
  let owner;
  let addr1;
  let addr2;
  let tokenCap = 1080000;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    Token = await ethers.getContractFactory("OxyToken");
    SIW = await ethers.getContractFactory("StandInWETH");
    [owner, addr1, addr2] = await hre.ethers.getSigners();

    standInWETH = await SIW.connect(addr1).deploy();
    oxyToken = await Token.deploy(tokenCap, await standInWETH.getAddress());
  });

  describe("Deployment", function () {

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await oxyToken.balanceOf(owner.address);
      expect(await oxyToken.totalSupply()).to.equal(ownerBalance);
    }); //edit person who created gets tokens

    it("Should set the max capped supply to the argument provided during deployment", async function () {
      const cap = await oxyToken.cap();
      expect(cap == tokenCap);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Transfer 50 tokens from owner to addr1
      await oxyToken.transfer(addr1.address, 50);
      const addr1Balance = await oxyToken.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);

      // Transfer 50 tokens from addr1 to addr2
      // We use .connect(signer) to send a transaction from another account
      await oxyToken.connect(addr1).transfer(addr2.address, 50);
      const addr2Balance = await oxyToken.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(50);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const ownerBalance = await oxyToken.balanceOf(owner.address);
      const initialaddr1Balance = await oxyToken.balanceOf(addr1.address);
      // Try to send 1 token from addr1 (0 tokens) to owner (1000000 tokens).
      // `require` will evaluate false and revert the transaction.
      await expect(

        oxyToken.transfer(addr1.address, (ownerBalance + BigInt(1)))
      ).to.be.reverted;

      // Owner balance shouldn't have changed.
      expect(await oxyToken.balanceOf(addr1.address)).to.equal(
        initialaddr1Balance
      );
    });

    it("Should update balances after transfers", async function () {
      const initialOwnerBalance = await oxyToken.balanceOf(owner.address);

      // Transfer 100 tokens from owner to addr1.
      await oxyToken.transfer(addr1.address, 100);

      // Transfer another 50 tokens from owner to addr2.
      await oxyToken.transfer(addr2.address, 50);
 
      // Check balances.
      const finalOwnerBalance = await oxyToken.balanceOf(owner.address);

      expect(finalOwnerBalance == (initialOwnerBalance - BigInt(150)));

      const addr1Balance = await oxyToken.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(100);

      const addr2Balance = await oxyToken.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(50);
    });
  });

  describe("Buying Tokens", function () {

    it("Should make sure that the user's token balance, the contacts Ether balance, and the total supply increase after tokens are purchased with Ether.", async function(){
      const initialaddr1TokenBalance = await oxyToken.balanceOf(addr1.address);
      const initialContractEtherBalance = await ethers.provider.getBalance(await oxyToken.getAddress());
      const initialTotalSupply = await oxyToken.totalSupply();

      await oxyToken.connect(addr1).buyTokensUsingEther({
        value: ethers.parseUnits("1")
      });

      const finaladdr1TokenBalance = await oxyToken.balanceOf(addr1.address);
      const finalContractEtherBalance = await ethers.provider.getBalance(await oxyToken.getAddress());
      const finalTotalSupply = await oxyToken.totalSupply();

      expect(finaladdr1TokenBalance - initialaddr1TokenBalance == (8 * (10 ** 18)));
      expect(finalContractEtherBalance - initialContractEtherBalance == (1 * (10 ** 18)));
      expect(finalTotalSupply - initialTotalSupply == (8 * (10 ** 18)));
    });
    
    it("Should make sure that the user's token balance, the contacts Ether balance, and the total supply increase after tokens are purchased with Wrapped Ether.", async function(){
      const initialaddr1TokenBalance = await oxyToken.balanceOf(addr1.address);
      const initialContractWETHBalance = await standInWETH.balanceOf(await oxyToken.getAddress());
      const initialTotalSupply = await oxyToken.totalSupply();

      await standInWETH.approve(await oxyToken.getAddress(), 1000);
      await oxyToken.connect(addr1).buyTokensUsingWETH(100);

      const finaladdr1TokenBalance = await oxyToken.balanceOf(addr1.address);
      const finalContractWETHBalance = await standInWETH.balanceOf(await oxyToken.getAddress());
      const finalTotalSupply = await oxyToken.totalSupply();

      expect(finaladdr1TokenBalance - initialaddr1TokenBalance == 800);
      expect(finalContractWETHBalance - initialContractWETHBalance == 100);
      expect(finalTotalSupply - initialTotalSupply == 800);
    });

  });

  describe("Withdrawing Tokens", function () {

    it("Should make sure owner recieves the right ammount of Ether", async function(){

      await oxyToken.connect(addr1).buyTokensUsingEther({
        value: ethers.parseUnits("1")
      });

      const initialOwnerEtherBalance = await ethers.provider.getBalance(owner.address);

      let tx = await oxyToken.withdrawEther(ethers.parseUnits("1"));

      const finalOwnerEtherBalance = await ethers.provider.getBalance(owner.address);

      let reciept = await tx.wait(); // This waits for the transaction to process
      let gasFee = reciept.gasUsed * reciept.gasPrice;

      expect(finalOwnerEtherBalance).to.equal(initialOwnerEtherBalance + ethers.parseUnits("1") - gasFee);
    });

    it("Should make sure owner recieves the right ammount of WETH", async function(){

      await standInWETH.approve(await oxyToken.getAddress(), 1000);
      await oxyToken.connect(addr1).buyTokensUsingWETH(100);

      const initialOwnerWETHBalance = await standInWETH.balanceOf(owner.address);

      await oxyToken.withdrawWETH(100);

      const finalOwnerWETHBalance = await standInWETH.balanceOf(owner.address);

      expect(finalOwnerWETHBalance).to.equal(initialOwnerWETHBalance + BigInt(100));
    });
    
  });
});