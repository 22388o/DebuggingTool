// basic.js
// Basic Lightning Network Operations 


/**
 *  Type -100032 Protocol is used to request to create a channel with someone else(Bob).
 *  @param myUserID The user id of logged in
 *  @param nodeID peer id of the obd node where the fundee logged in.
 *  @param userID the user id of the fundee.
 *  @param info 
 */
function openChannel(myUserID, nodeID, userID, info) {
    return new Promise((resolve, reject) => {
        obdApi.openChannel(nodeID, userID, info, function(e) {
            console.info('SDK: -100032 openChannel = ' + JSON.stringify(e));

            let channel_id = e.temporary_channel_id;
            saveCounterparty(myUserID,  channel_id, nodeID, userID);
            saveChannelStatus(myUserID, channel_id, true, kStatusOpenChannel);

            let privkey = getPrivKeyFromPubKey(myUserID, info.funding_pubkey);
            saveFundingPrivKey(myUserID, channel_id, privkey);
            resolve(e);
        });
    })
}

/**
 * Type -100033 Bob replies to accept, his OBD completes his message and 
 * routes it back to Alice's OBD. Then Alice sees the response of acceptance.
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param info 
 */
function acceptChannel(myUserID, nodeID, userID, info) {
    return new Promise((resolve, reject) => {
        obdApi.acceptChannel(nodeID, userID, info, function(e) {
            console.info('SDK: -100033 acceptChannel = ' + JSON.stringify(e));

            let channel_id = e.temporary_channel_id;
            let privkey    = getPrivKeyFromPubKey(myUserID, info.funding_pubkey);
            saveFundingPrivKey(myUserID, channel_id, privkey);
            saveChannelStatus(myUserID, channel_id, false, kStatusAcceptChannel);
            saveChannelAddr(channel_id, e.channel_address);
            resolve(true);
        });
    })
}

/**
 * Type 102109 Protocol is used for depositing bitcoin into a channel. 
 * Since the basic Omnilayer protocal uses BTC as miner fee in 
 * constructing transactions, this message 102109 is mandatory 
 * for depositing a little BTC into a channel as miner fee.
 * 
 * @param myUserID The user id of logged in
 * @param info 
 */
function fundingBitcoin(myUserID, info) {
    return new Promise((resolve, reject) => {
        obdApi.fundingBitcoin(info, async function(e) {
            console.info('SDK: -102109 fundingBitcoin = ' + JSON.stringify(e));

            let channel_id = await getChannelIDFromAddr(info.to_address);
            let status     = await getChannelStatus(channel_id, true);
            console.info('fundingBitcoin status = ' + status);
            switch (Number(status)) {
                case kStatusAcceptChannel:
                    saveChannelStatus(myUserID, channel_id, true, kStatusFirstFundingBitcoin);
                    break;
                case kStatusFirstBitcoinFundingSigned:
                    saveChannelStatus(myUserID, channel_id, true, kStatusSecondFundingBitcoin);
                    break;
                case kStatusSecondBitcoinFundingSigned:
                    saveChannelStatus(myUserID, channel_id, true, kStatusThirdFundingBitcoin);
                    break;
            }

            // Sign the tx on client
            let privkey    = getPrivKeyFromAddress(info.from_address);
            let signed_hex = signP2PKH(e.hex, privkey);

            // saveFundingPrivKey(myUserID, channel_id, info.from_address_private_key);

            info.from_address_private_key = privkey;
            saveFundingBtcData(myUserID, channel_id, info);
            saveTempData(myUserID, channel_id, signed_hex);
            resolve(e);
        });
    })
}

/**
 * Type -100340 Protocol is used to notify the success of 
 * funding BTC to the counterpart of the channel.
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param info 
 */
function bitcoinFundingCreated(myUserID, nodeID, userID, info) {
    return new Promise((resolve, reject) => {
        obdApi.bitcoinFundingCreated(nodeID, userID, info, async function(e) {
            console.info('SDK: -100340 bitcoinFundingCreated = ' + JSON.stringify(e));
    
            let channel_id = e.temporary_channel_id;
            let status     = await getChannelStatus(channel_id, true);
            console.info('bitcoinFundingCreated status = ' + status);
            switch (Number(status)) {
                case kStatusFirstFundingBitcoin:
                    saveChannelStatus(myUserID, channel_id, true, kStatusFirstBitcoinFundingCreated);
                    break;
                case kStatusSecondFundingBitcoin:
                    saveChannelStatus(myUserID, channel_id, true, kStatusSecondBitcoinFundingCreated);
                    break;
                case kStatusThirdFundingBitcoin:
                    saveChannelStatus(myUserID, channel_id, true, kStatusThirdBitcoinFundingCreated);
                    break;
            }

            // Sign tx
            // console.info('bitcoinFundingCreated e.hex = ' + e.hex);
            if (e.hex) {
                // Alice sign the tx on client
                let privkey    = await getFundingPrivKey(myUserID, channel_id);
                let signed_hex = signP2SH(true, e.hex, e.pub_key_a, 
                    e.pub_key_b, privkey, e.inputs[0].amount);
                resolve(signed_hex);
            }

            resolve(true);
        });
    })
}

/**
 * Type -100341 Protocol send signed_hex that Alice signed in 100340 to OBD.
 * 
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param signed_hex 
 */
function sendSignedHex100341(nodeID, userID, signed_hex) {
    return new Promise((resolve, reject) => {
        obdApi.sendSignedHex100341(nodeID, userID, signed_hex, function(e) {
            console.info('SDK: -100341 sendSignedHex100341 = ' + JSON.stringify(e));
            resolve(true);
        });
    })
}

/**
 * Type -100350 Protocol is used to Bob tells his OBD to reply Alice 
 * that he knows the BTC funding by message -100350.
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param info 
 */
function bitcoinFundingSigned(myUserID, nodeID, userID, info) {
    return new Promise((resolve, reject) => {
        obdApi.bitcoinFundingSigned(nodeID, userID, info, async function(e) {
            console.info('SDK: -100350 bitcoinFundingSigned = ' + JSON.stringify(e));
    
            let channel_id = e.temporary_channel_id;
            let status     = await getChannelStatus(channel_id, false);
            console.info('bitcoinFundingSigned status = ' + status);
            switch (Number(status)) {
                case kStatusFirstBitcoinFundingCreated:
                    saveChannelStatus(myUserID, channel_id, false, kStatusFirstBitcoinFundingSigned);
                    break;
                case kStatusSecondBitcoinFundingCreated:
                    saveChannelStatus(myUserID, channel_id, false, kStatusSecondBitcoinFundingSigned);
                    break;
                case kStatusThirdBitcoinFundingCreated:
                    saveChannelStatus(myUserID, channel_id, false, kStatusThirdBitcoinFundingSigned);
                    break;
            }

            // saveFundingPrivKey(myUserID, channel_id, info.channel_address_private_key);
            resolve(true);
        });
    })
}

/**
 * Type -102120 Protocol is used to Alice starts to deposit omni assets to 
 * the channel. This is quite similar to the the btc funding procedure.
 * 
 * @param myUserID The user id of logged in
 * @param info 
 */
function fundingAsset(myUserID, info) {
    return new Promise((resolve, reject) => {
        obdApi.fundingAsset(info, async function(e) {
            console.info('SDK: -102120 fundingAsset = ' + JSON.stringify(e));
            
            // Sign the tx on client
            let privkey    = getPrivKeyFromAddress(info.from_address);
            let signed_hex = signP2PKH(e.hex, privkey);

            let channel_id = await getChannelIDFromAddr(info.to_address);
            saveChannelStatus(myUserID, channel_id, true, kStatusFundingAsset);
            saveTempData(myUserID, channel_id, signed_hex);
            resolve(true);
        });
    })
}

/**
 * Type -100034 Protocol is used to notify the success of omni asset 
 * funding transaction to the counterparty of the channel.
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param info 
 */
function assetFundingCreated(myUserID, nodeID, userID, info) {
    return new Promise((resolve, reject) => {
        obdApi.assetFundingCreated(nodeID, userID, info, async function(e) {
            console.info('SDK: -100034 - assetFundingCreated = ' + JSON.stringify(e));

            // Save temporary private key to local storage
            let tempKey = getPrivKeyFromPubKey(myUserID, info.temp_address_pub_key);
            console.info('tempKey = ' + tempKey);
            saveTempPrivKey(myUserID, kTempPrivKey, info.temporary_channel_id, tempKey);
            saveChannelStatus(myUserID, info.temporary_channel_id, true, kStatusAssetFundingCreated);

            // Sign tx
            // console.info('bitcoinFundingCreated e.hex = ' + e.hex);
            if (e.hex) {
                // Alice sign the tx on client
                let privkey    = await getFundingPrivKey(myUserID, channel_id);
                let signed_hex = signP2SH(true, e.hex, e.pub_key_a, 
                    e.pub_key_b, privkey, e.inputs[0].amount);
                resolve(signed_hex);
            }

            resolve(true);
        });
    })
}

/**
 * Type -101034 Protocol send signed_hex that Alice signed in 100034 to OBD.
 * 
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param signed_hex 
 */
function sendSignedHex101034(nodeID, userID, signed_hex) {
    return new Promise((resolve, reject) => {
        obdApi.sendSignedHex101034(nodeID, userID, signed_hex, function(e) {
            console.info('sendSignedHex101034 = ' + JSON.stringify(e));
            resolve(true);
        });
    })
}

/**
 * Type -100035 Protocol is used to Bob tells his OBD to reply Alice 
 * that he knows the asset funding transaction by message -100035, 
 * and Alice's OBD will creat commitment transactions (C1a & RD1a).
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param info 
 */
function assetFundingSigned(myUserID, nodeID, userID, info) {
    return new Promise((resolve, reject) => {
        obdApi.assetFundingSigned(nodeID, userID, info, async function(e) {
            console.info('SDK: -100035 - assetFundingSigned = ' + JSON.stringify(e));
            
            // Bob sign the tx on client side
            // console.info('bitcoinFundingCreated e.hex = ' + e.hex);
            if (e.hex) {
                let privkey    = await getFundingPrivKey(myUserID, channel_id);
                let signed_hex = signP2SH(false, e.hex, e.pub_key_a, 
                    e.pub_key_b, privkey, e.inputs[0].amount);
                    
                // resolve(signed_hex);
            }


            // Once sent -100035 AssetFundingSigned , the final channel_id has generated.
            // So need update the local saved data for funding private key and channel_id.

            let priv_key     = info.channel_address_private_key;
            let tempCID      = info.temporary_channel_id;
            let channel_id   = e.channel_id;
            let channel_addr = await getChannelAddr(tempCID);

            saveFundingPrivKey(myUserID, channel_id, priv_key);

            //
            delChannelAddr(tempCID);
            saveChannelAddr(channel_id, channel_addr);

            //
            delChannelStatus(tempCID, false);
            saveChannelStatus(myUserID, channel_id, false, kStatusAssetFundingSigned);

            //
            delCounterparty(myUserID, tempCID);
            saveCounterparty(myUserID, channel_id, nodeID, userID);

            resolve(e);
        });
    })
}

/**
 * Type -100351 Protocol is used for paying omni assets by 
 * Revocable Sequence Maturity Contract(RSMC) within a channel.
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param info 
 * @param isFunder 
 */
function commitmentTransactionCreated(myUserID, nodeID, userID, info, isFunder) {
    return new Promise((resolve, reject) => {
        obdApi.commitmentTransactionCreated(nodeID, userID, info, function(e) {
            console.info('SDK: -100351 commitmentTransactionCreated = ' + JSON.stringify(e));
            saveTempPrivKey(myUserID, kTempPrivKey, e.channel_id, info.curr_temp_address_private_key);
            saveChannelStatus(myUserID, e.channel_id, isFunder, kStatusCommitmentTransactionCreated);
            saveSenderRole(kIsSender);
            resolve(true);
        });
    })
}

/**
 * Type -100352 Protocol is used to Receiver revokes the previous 
 * commitment transaction and ackonwledge the new transaction.
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param info 
 * @param isFunder 
 */
function commitmentTransactionAccepted(myUserID, nodeID, userID, info, isFunder) {
    return new Promise((resolve, reject) => {
        obdApi.commitmentTransactionAccepted(nodeID, userID, info, function(e) {
            console.info('SDK: -100352 commitmentTransactionAccepted = ' + JSON.stringify(e));
            saveTempPrivKey(myUserID, kTempPrivKey, e.channel_id, info.curr_temp_address_private_key);
            saveChannelStatus(myUserID, e.channel_id, isFunder, kStatusCommitmentTransactionAccepted);
            resolve(true);
        });
    })
}

/**
 * Type -100038 Protocol is used to close a channel. 
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param channel_id 
 * @param isFunder 
 */
function closeChannel(myUserID, nodeID, userID, channel_id, isFunder) {
    return new Promise((resolve, reject) => {
        obdApi.closeChannel(nodeID, userID, channel_id, function(e) {
            console.info('SDK: -100038 closeChannel = ' + JSON.stringify(e));
            saveChannelStatus(myUserID, channel_id, isFunder, kStatusCloseChannel);
            saveSenderRole(kIsSender);
            resolve(true);
        });
    })
}

/**
 * Type -100039 Protocol is used to response the close channel request.
 * 
 * @param myUserID The user id of logged in
 * @param nodeID peer id of the obd node where the fundee logged in.
 * @param userID the user id of the fundee.
 * @param info 
 * @param isFunder 
 */
function closeChannelSigned(myUserID, nodeID, userID, info, isFunder) {
    return new Promise((resolve, reject) => {
        obdApi.closeChannelSigned(nodeID, userID, info, function(e) {
            console.info('SDK: -100039 closeChannelSigned = ' + JSON.stringify(e));
            saveChannelStatus(myUserID, e.channel_id, isFunder, kStatusCloseChannelSigned);
            resolve(true);
        });
    })
}
