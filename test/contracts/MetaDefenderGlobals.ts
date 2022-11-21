//
// describe('update the minimumFee', async () => {
//     it('should not allow update when the msg.sender is not the official', async () => {
//         await expect(
//             contracts.metaDefender
//                 .connect(user)
//                 .updateMinimumFee(toBN('0.02')),
//         ).to.be.revertedWithCustomError(
//             contracts.metaDefender,
//             'InsufficientPrivilege',
//         );
//     });
//     it('should successfully update the minimumFee', async () => {
//         await contracts.metaDefender
//             .connect(deployer)
//             .updateMinimumFee(toBN('0.03'));
//         expect(
//             (await contracts.metaDefender.globalInfo()).minimumFee,
//         ).to.be.equal(toBN('0.03'));
//     });
// });
