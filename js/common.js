var obdApi = new ObdApi();
var enumMsgType = new MessageType();

// Save connection status.
var isConnectToOBD = false;

// Save login status.
var isLogined = false;

// Save obd node id.
var nodeID;

// Save userID of a user already logined.
var userID;

// save OBD messages
var obdMessages = '';
var arrObdMsg = [];

// mnemonic using for login
var mnemonicWithLogined = '';

//
var inNewHtml = 'in_new_html';

//
var itemChannelList = 'channel_list';

//
var itemAddr = 'addr';

//
var itemCounterparties = 'counterparties';

//
var itemOBDList = 'obd_list';

//
var invokeHistory = 'invoke_history';

//
var itemMnemonic = 'mnemonic';

//
var itemGoWhere = 'go_where';

//
var itemTempChannelID = 'temp_channel_id';

//
var itemFundingBtcHex = 'FundingBtcHex';

//
var itemFundingAssetHex = 'FundingAssetHex';

//
var itemFundingBtcTxid = 'FundingBtcTxid';

// the info save to local storage [ChannelList].
var channelInfo;

// word wrap code.
// result.setAttribute('style', 'word-break: break-all;white-space: normal;');

/**
 * Save fundingBTC parameters value.
 */
var btcFromAddr, btcFromAddrPrivKey, btcToAddr, btcAmount, btcMinerFee;

/**
 * open / close auto mode.
 */
var isAutoMode = false;

/**
 * Save funding private key to local storage
 */
var FundingPrivKey = 'FundingPrivKey';

/**
 * Save temporary private key to local storage
 */
var TempPrivKey = 'TempPrivKey';

/**
 * Save RSMC tx temporary private key to local storage
 */
var RsmcTempPrivKey = 'RsmcTempPrivKey';

/**
 * Save HTLC tx temporary private key to local storage
 */
var HtlcTempPrivKey = 'HtlcTempPrivKey';

/**
 * Save HTLC htnx tx temporary private key to local storage
 */
var HtlcHtnxTempPrivKey = 'HtlcHtnxTempPrivKey';


// Get name of saveGoWhere variable.
function getSaveName() {
    return itemGoWhere;
}

// 
function listeningN351(e, msgType) {
    console.info('listeningN351 = ' + JSON.stringify(e));
    console.info('listeningN351 msgType = ' + msgType);
    saveChannelList(e, e.channelId, msgType);
    // saveMsgFromCounterparty(e);
}

// 
function listeningN40(e, msgType) {
    console.info('listeningN40 = ' + JSON.stringify(e));
    saveChannelList(e, e.channelId, msgType);
    // saveMsgFromCounterparty(e);
}

// 
function listeningN41(e, msgType) {
    console.info('listeningN41 = ' + JSON.stringify(e));
    saveChannelList(e, e.channel_id, msgType);
    // saveMsgFromCounterparty(e);
}

// 
function listeningN45(e, msgType) {
    console.info('listeningN45 = ' + JSON.stringify(e));
    saveChannelList(e, e.channel_id, msgType);
    // saveMsgFromCounterparty(e);
}

// auto response to -100032 (openChannel) 
// listening to -110032 and send -100033 acceptChannel
function listening110032(e, msgType) {
    console.info('NOW isAutoMode = ' + isAutoMode);
    saveTempChannelID(e.temporary_channel_id);

    if (!isAutoMode) return;
    
    console.info('listening110032 = ' + JSON.stringify(e));

    let p2pID    = e.funder_node_address;
    let name     = e.funder_peer_id;
    let temp_cid = e.temporary_channel_id;

    // Generate an address by local js library.
    let result = genAddressFromMnemonic();
    saveAddresses(result);

    // will send -100033 acceptChannel
    let info                  = new AcceptChannelInfo();
    info.temporary_channel_id = temp_cid;
    info.funding_pubkey       = result.result.pubkey;
    info.approval             = true;

    // OBD API
    obdApi.acceptChannel(p2pID, name, info, function(e) {
        console.info('-100033 acceptChannel = ' + JSON.stringify(e));
        saveChannelList(e);
        saveCounterparties(name, p2pID);
        saveTempPrivKey(FundingPrivKey, temp_cid, result.result.wif);
    });
}

// auto response to -100340 (BTCFundingCreated)
// listening to -110340 and send -100350 BTCFundingSigned
function listening110340(e, msgType) {
    console.info('NOW isAutoMode = ' + isAutoMode);

    saveFundingBtcTxid(e.funding_txid);

    if (!isAutoMode) return;
    
    console.info('listening110340 = ' + JSON.stringify(e));

    // will send -100350 BTCFundingSigned
    let temp_cid                      = e.temporary_channel_id;
    let info                          = new FundingBtcSigned();
    info.temporary_channel_id         = temp_cid;
    info.channel_address_private_key  = getTempPrivKey(FundingPrivKey, temp_cid);
    info.funding_txid                 = e.funding_txid;
    info.approval                     = true;

    // OBD API
    obdApi.btcFundingSigned(e.funder_node_address, e.funder_peer_id, info, function(e) {
        console.info('-100350 btcFundingSigned = ' + JSON.stringify(e));
        saveChannelList(e, temp_cid, msgType);
    });
}

// auto response to -100034 (AssetFundingCreated)
// listening to -110034 and send -100035 AssetFundingSigned
function listening110034(e, msgType) {
    console.info('NOW isAutoMode = ' + isAutoMode);
    if (!isAutoMode) return;
    console.info('listening110034 = ' + JSON.stringify(e));

    // will send -100035 AssetFundingSigned
    let info                                = new ChannelFundingSignedInfo();
    info.temporary_channel_id               = e.temporary_channel_id;
    info.fundee_channel_address_private_key = getTempPrivKey(FundingPrivKey, e.temporary_channel_id);

    // OBD API
    obdApi.channelFundingSigned(e.funder_node_address, e.funder_peer_id, info, function(e) {
        console.info('-100035 AssetFundingSigned = ' + JSON.stringify(e));
        saveChannelList(e, e.channel_id, msgType);
        saveTempPrivKey(FundingPrivKey, e.channel_id, info.fundee_channel_address_private_key);
    });
}

// save funding private key of Alice side
function listening110035(e, msgType) {
    console.info('listening110035 = ' + JSON.stringify(e));
    // saveTempPrivKey(FundingPrivKey, e.channel_id, ????);
}

// auto response to -100351 (RSMCCTxCreated)
// listening to -110351 and send -100352 RSMCCTxSigned
function listening110351(e, msgType) {
    console.info('NOW isAutoMode = ' + isAutoMode);
    if (!isAutoMode) return;
    console.info('listening110351 = ' + JSON.stringify(e));

    // Generate an address by local js library.
    let result = genAddressFromMnemonic();
    saveAddresses(result);
    saveTempPrivKey(TempPrivKey, e.channel_id, result.result.wif);

    // will send -100352 RSMCCTxSigned
    let info                           = new CommitmentTxSigned();
    info.channel_id                    = e.channel_id;
    info.msg_hash                      = e.msg_hash;
    info.curr_temp_address_pub_key     = result.result.pubkey;
    info.curr_temp_address_private_key = result.result.wif;
    info.channel_address_private_key   = getTempPrivKey(FundingPrivKey, e.channel_id);
    info.last_temp_address_private_key = getTempPrivKey(TempPrivKey, e.channel_id);
    info.approval                      = true;

    // OBD API
    obdApi.revokeAndAcknowledgeCommitmentTransaction(
        e.funder_node_address, e.funder_peer_id, info, function(e) {
        console.info('-100352 RSMCCTxSigned = ' + JSON.stringify(e));
        saveChannelList(e, e.channel_id, msgType);
    });
}

// 
function registerEvent() {
    // auto response mode
    let msg_110032 = enumMsgType.MsgType_RecvChannelOpen_32;
    obdApi.registerEvent(msg_110032, function(e) {
        listening110032(e, msg_110032);
    });

    // auto response mode
    let msg_110340 = enumMsgType.MsgType_FundingCreate_RecvBtcFundingCreated_340;
    obdApi.registerEvent(msg_110340, function(e) {
        listening110340(e, msg_110340);
    });

    // auto response mode
    let msg_110034 = enumMsgType.MsgType_FundingCreate_RecvAssetFundingCreated_34;
    obdApi.registerEvent(msg_110034, function(e) {
        listening110034(e, msg_110034);
    });

    // auto response mode
    let msg_110351 = enumMsgType.MsgType_CommitmentTx_RecvCommitmentTransactionCreated_351;
    obdApi.registerEvent(msg_110351, function(e) {
        listening110351(e, msg_110351);
    });



    var msgTypeN351 = enumMsgType.MsgType_CommitmentTx_SendCommitmentTransactionCreated_351;
    obdApi.registerEvent(msgTypeN351, function(e) {
        listeningN351(e, msgTypeN351);
    });

    var msgTypeN40 = enumMsgType.MsgType_HTLC_SendAddHTLC_40;
    obdApi.registerEvent(msgTypeN40, function(e) {
        listeningN40(e, msgTypeN40);
    });

    var msgTypeN41 = enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41;
    obdApi.registerEvent(msgTypeN41, function(e) {
        listeningN41(e, msgTypeN41);
    });

    var msgTypeN45 = enumMsgType.MsgType_HTLC_SendVerifyR_45;
    obdApi.registerEvent(msgTypeN45, function(e) {
        listeningN45(e, msgTypeN45);
    });
}

// logIn API at local.
function logIn(msgType) {

    var mnemonic = $("#mnemonic").val();
    // console.info('mnemonic = ' + mnemonic);

    if (mnemonic === '') {
        alert('Please input a valid mnemonic.');
        return;
    }

    obdApi.logIn(mnemonic, function(e) {

        // Register event needed for listening.
        registerEvent();

        console.info('logIn - OBD Response = ' + JSON.stringify(e));
        // If already logined, then stop listening to OBD Response,
        // DO NOT update the userID.
        if (isLogined) {
            createOBDResponseDiv(e, msgType);
            return;
        }

        // Otherwise, a new loginning, update the userID.
        mnemonicWithLogined = mnemonic;
        nodeID = e.nodePeerId;
        userID = e.userPeerId;
        $("#logined").text(userID);
        // $("#logined").text(userID.substring(0, 10) + '...');
        // createOBDResponseDiv(e, msgType);
        isLogined = true;
    });
}

// connectP2PPeer API at local.
function connectP2PPeer(msgType) {
    let remote_node_address = $("#remote_node_address").val();
    let info = new P2PPeer();
    info.remote_node_address = remote_node_address;

    // OBD API
    obdApi.connectP2PPeer(info, function(e) {
        console.info('connectP2PPeer - OBD Response = ' + JSON.stringify(e));
        createOBDResponseDiv(e, msgType);
    });
}

// -100032 openChannel API at local.
function openChannel(msgType) {

    var p2pID  = $("#recipient_node_peer_id").val();
    var name   = $("#recipient_user_peer_id").val();
    var pubkey = $("#funding_pubkey").val();

    // OBD API
    obdApi.openChannel(p2pID, name, pubkey, function(e) {
        console.info('-100032 openChannel = ' + JSON.stringify(e));
        saveChannelList(e);
        saveCounterparties(name, p2pID);
        let privkey = getFundingPrivKeyFromPubKey(pubkey);
        console.info('FundingPrivKey = ' + privkey);
        saveTempPrivKey(FundingPrivKey, e.temporary_channel_id, privkey);
    });
}

// -100033 accept Channel API at local.
function acceptChannel(msgType) {

    var p2pID    = $("#recipient_node_peer_id").val();
    var name     = $("#recipient_user_peer_id").val();
    var temp_cid = $("#temporary_channel_id").val();
    var pubkey   = $("#funding_pubkey").val();
    var approval = $("#checkbox_n33").prop("checked");

    let info = new AcceptChannelInfo();
    info.temporary_channel_id = temp_cid;
    info.funding_pubkey = pubkey;
    info.approval = approval;

    // OBD API
    obdApi.acceptChannel(p2pID, name, info, function(e) {
        console.info('-100033 acceptChannel = ' + JSON.stringify(e));
        saveChannelList(e);
        saveCounterparties(name, p2pID);
        let privkey = getFundingPrivKeyFromPubKey(pubkey);
        console.info('FundingPrivKey = ' + privkey);
        saveTempPrivKey(FundingPrivKey, temp_cid, privkey);
    });
}

/** 
 * -45 htlcSendR API at local.
 * @param msgType
 */
function htlcSendR(msgType) {

    var recipient_node_peer_id    = $("#recipient_node_peer_id").val();
    var recipient_user_peer_id     = $("#recipient_user_peer_id").val();
    var channel_id = $("#channel_id").val();
    var r = $("#r").val();
    var channel_address_private_key = $("#channel_address_private_key").val();
    var curr_htlc_temp_address_for_he1b_pub_key = $("#curr_htlc_temp_address_for_he1b_pub_key").val();
    var curr_htlc_temp_address_for_he1b_private_key = $("#curr_htlc_temp_address_for_he1b_private_key").val();

    let info = new HtlcSendRInfo();
    info.channel_id = channel_id;
    info.r = r;
    info.channel_address_private_key = channel_address_private_key;
    info.curr_htlc_temp_address_for_he1b_pub_key = curr_htlc_temp_address_for_he1b_pub_key;
    info.curr_htlc_temp_address_for_he1b_private_key = curr_htlc_temp_address_for_he1b_private_key;

    // Get channel_id with request_hash.
    // var tempChID;
    // var list = JSON.parse(localStorage.getItem(itemChannelList));
    // for (let i = 0; i < list.result.length; i++) {
    //     for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
    //         if (request_hash === list.result[i].htlc[i2].request_hash) {
    //             tempChID = list.result[i].htlc[i2].channelId;
    //         }
    //     }
    // }

    // OBD API
    obdApi.htlcSendR(recipient_node_peer_id, recipient_user_peer_id, info, function(e) {
        console.info('-45 htlcSendR - OBD Response = ' + JSON.stringify(e));
        saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -46 htlcVerifyR API at local.
 * @param msgType
 */
function htlcVerifyR(msgType) {

    var recipient_node_peer_id    = $("#recipient_node_peer_id").val();
    var recipient_user_peer_id    = $("#recipient_user_peer_id").val();
    var channel_id = $("#channel_id").val();
    var r = $("#r").val();
    var request_hash = $("#request_hash").val();
    var channel_address_private_key = $("#channel_address_private_key").val();

    let info = new HtlcVerifyRInfo();
    info.channel_id = channel_id;
    info.r = r;
    info.request_hash = request_hash;
    info.channel_address_private_key = channel_address_private_key;

    // Get channel_id with request_hash.
    // var tempChID;
    // var list = JSON.parse(localStorage.getItem(itemChannelList));
    // for (let i = 0; i < list.result.length; i++) {
    //     for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
    //         if (request_hash === list.result[i].htlc[i2].request_hash) {
    //             tempChID = list.result[i].htlc[i2].channelId;
    //         }
    //     }
    // }

    // OBD API
    obdApi.htlcVerifyR(recipient_node_peer_id, recipient_user_peer_id, info, function(e) {
        console.info('-46 htlcVerifyR - OBD Response = ' + JSON.stringify(e));
        saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -49 closeHTLC API at local.
 * @param msgType
 */
function closeHTLC(msgType) {

    var recipient_node_peer_id    = $("#recipient_node_peer_id").val();
    var recipient_user_peer_id    = $("#recipient_user_peer_id").val();
    var channel_id = $("#channel_id").val();
    var channel_address_private_key = $("#channel_address_private_key").val();
    var last_rsmc_temp_address_private_key = $("#last_rsmc_temp_address_private_key").val();
    var last_htlc_temp_address_private_key = $("#last_htlc_temp_address_private_key").val();
    var last_htlc_temp_address_for_htnx_private_key = $("#last_htlc_temp_address_for_htnx_private_key").val();
    var curr_rsmc_temp_address_pub_key = $("#curr_rsmc_temp_address_pub_key").val();
    var curr_rsmc_temp_address_private_key = $("#curr_rsmc_temp_address_private_key").val();

    let info = new CloseHtlcTxInfo();
    info.channel_id = channel_id;
    info.channel_address_private_key = channel_address_private_key;
    info.last_rsmc_temp_address_private_key = last_rsmc_temp_address_private_key;
    info.last_htlc_temp_address_private_key = last_htlc_temp_address_private_key;
    info.last_htlc_temp_address_for_htnx_private_key = last_htlc_temp_address_for_htnx_private_key;
    info.curr_rsmc_temp_address_pub_key = curr_rsmc_temp_address_pub_key;
    info.curr_rsmc_temp_address_private_key = curr_rsmc_temp_address_private_key;

    // OBD API
    obdApi.closeHTLC(recipient_node_peer_id, recipient_user_peer_id, info, function(e) {
        console.info('-49 closeHTLC - OBD Response = ' + JSON.stringify(e));
        saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -50 closeHTLCSigned API at local.
 * @param msgType
 */
function closeHTLCSigned(msgType) {

    var recipient_node_peer_id    = $("#recipient_node_peer_id").val();
    var recipient_user_peer_id    = $("#recipient_user_peer_id").val();
    var request_hash = $("#request_hash").val();
    var channel_address_private_key = $("#channel_address_private_key").val();
    var last_rsmc_temp_address_private_key = $("#last_rsmc_temp_address_private_key").val();
    var last_htlc_temp_address_private_key = $("#last_htlc_temp_address_private_key").val();
    var last_htlc_temp_address_for_htnx_private_key = $("#last_htlc_temp_address_for_htnx_private_key").val();
    var curr_rsmc_temp_address_pub_key = $("#curr_rsmc_temp_address_pub_key").val();
    var curr_rsmc_temp_address_private_key = $("#curr_rsmc_temp_address_private_key").val();

    let info = new CloseHtlcTxInfoSigned();
    info.request_hash = request_hash;
    info.channel_address_private_key = channel_address_private_key;
    info.last_rsmc_temp_address_private_key = last_rsmc_temp_address_private_key;
    info.last_htlc_temp_address_private_key = last_htlc_temp_address_private_key;
    info.last_htlc_temp_address_for_htnx_private_key = last_htlc_temp_address_for_htnx_private_key;
    info.curr_rsmc_temp_address_pub_key = curr_rsmc_temp_address_pub_key;
    info.curr_rsmc_temp_address_private_key = curr_rsmc_temp_address_private_key;

    // Get channel_id with request_hash.
    // var channel_id;
    // var list = JSON.parse(localStorage.getItem(itemChannelList));
    // for (let i = 0; i < list.result.length; i++) {
    //     for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
    //         if (request_close_htlc_hash === list.result[i].htlc[i2].request_hash) {
    //             channel_id = list.result[i].htlc[i2].channel_id;
    //         }
    //     }
    // }

    // OBD API
    obdApi.closeHTLCSigned(recipient_node_peer_id, recipient_user_peer_id, info, function(e) {
        console.info('-50 closeHTLCSigned - OBD Response = ' + JSON.stringify(e));
        // saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -80 atomicSwap API at local.
 * @param msgType
 */
function atomicSwap(msgType) {

    var channel_id_from = $("#channel_id_from").val();
    var channel_id_to = $("#channel_id_to").val();
    var recipient_user_peer_id = $("#recipient_user_peer_id").val();
    var property_sent = $("#property_sent").val();
    var amount = $("#amount").val();
    var exchange_rate = $("#exchange_rate").val();
    var property_received = $("#property_received").val();
    var transaction_id = $("#transaction_id").val();
    var time_locker = $("#time_locker").val();


    let info = new AtomicSwapRequest();
    info.channel_id_from = channel_id_from;
    info.channel_id_to = channel_id_to;
    info.recipient_user_peer_id = recipient_user_peer_id;
    info.property_sent = Number(property_sent);
    info.amount = Number(amount);
    info.exchange_rate = Number(exchange_rate);
    info.property_received = Number(property_received);
    info.transaction_id = transaction_id;
    info.time_locker = Number(time_locker);

    // OBD API
    obdApi.atomicSwap(info, function(e) {
        console.info('-80 atomicSwap - OBD Response = ' + JSON.stringify(e));
        // saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -81 atomicSwapAccepted API at local.
 * @param msgType
 */
function atomicSwapAccepted(msgType) {

    var channel_id_from = $("#channel_id_from").val();
    var channel_id_to = $("#channel_id_to").val();
    var recipient_user_peer_id = $("#recipient_user_peer_id").val();
    var property_sent = $("#property_sent").val();
    var amount = $("#amount").val();
    var exchange_rate = $("#exchange_rate").val();
    var property_received = $("#property_received").val();
    var transaction_id = $("#transaction_id").val();
    var target_transaction_id = $("#target_transaction_id").val();
    var time_locker = $("#time_locker").val();

    let info = new AtomicSwapAccepted();
    info.channel_id_from = channel_id_from;
    info.channel_id_to = channel_id_to;
    info.recipient_user_peer_id = recipient_user_peer_id;
    info.property_sent = Number(property_sent);
    info.amount = Number(amount);
    info.exchange_rate = Number(exchange_rate);
    info.property_received = Number(property_received);
    info.transaction_id = transaction_id;
    info.target_transaction_id = target_transaction_id;
    info.time_locker = Number(time_locker);

    // OBD API
    obdApi.atomicSwapAccepted(info, function(e) {
        console.info('-81 atomicSwapAccepted - OBD Response = ' + JSON.stringify(e));
        // saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -38 closeChannel API at local.
 * @param msgType
 */
function closeChannel(msgType) {

    var channel_id = $("#channel_id").val();

    // OBD API
    obdApi.closeChannel(channel_id, function(e) {
        console.info('-38 closeChannel - OBD Response = ' + JSON.stringify(e));
        saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -39 closeChannelSigned API at local.
 * @param msgType
 */
function closeChannelSigned(msgType) {

    var channel_id = $("#channel_id").val();
    var request_close_channel_hash = $("#request_close_channel_hash").val();
    var approval = $("#checkbox_n39").prop("checked");

    let info = new CloseChannelSign();
    info.channel_id = channel_id;
    info.request_close_channel_hash = request_close_channel_hash;
    info.approval = approval;

    // OBD API
    obdApi.closeChannelSign(info, function(e) {
        console.info('-39 closeChannelSign - OBD Response = ' + JSON.stringify(e));
        saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * 1200 getBalanceForOmni API at local.
 * @param msgType
 */
function getBalanceForOmni(msgType) {

    var address = $("#address").val();

    // OBD API
    obdApi.omniGetAllBalancesForAddress(address, function(e) {
        console.info('1200 getBalanceForOmni - OBD Response = ' + JSON.stringify(e));
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * 1201 issuanceFixed API at local.
 * @param msgType
 */
function issuanceFixed(msgType) {

    var from_address = $("#from_address").val();
    var name = $("#name").val();
    var ecosystem = $("#ecosystem").val();
    var divisible_type = $("#divisible_type").val();
    var data = $("#data").val();
    var amount = $("#amount").val();

    let info = new OmniSendIssuanceFixed();
    info.from_address = from_address;
    info.name = name;
    info.ecosystem = Number(ecosystem);
    info.divisible_type = Number(divisible_type);
    info.data = data;
    info.amount = Number(amount);

    // OBD API
    obdApi.createNewTokenFixed(info, function(e) {
        console.info('1201 createNewTokenFixed - OBD Response = ' + JSON.stringify(e));
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * 1202 issuanceManaged API at local.
 * @param msgType
 */
function issuanceManaged(msgType) {

    var from_address = $("#from_address").val();
    var name = $("#name").val();
    var ecosystem = $("#ecosystem").val();
    var divisible_type = $("#divisible_type").val();
    var data = $("#data").val();

    let info = new OmniSendIssuanceManaged();
    info.from_address = from_address;
    info.name = name;
    info.ecosystem = Number(ecosystem);
    info.divisible_type = Number(divisible_type);
    info.data = data;

    // OBD API
    obdApi.createNewTokenManaged(info, function(e) {
        console.info('1202 issuanceManaged - OBD Response = ' + JSON.stringify(e));
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * 1203 sendGrant API at local.
 * @param msgType
 */
function sendGrant(msgType) {

    var from_address = $("#from_address").val();
    var property_id = $("#property_id").val();
    var amount = $("#amount").val();
    var memo = $("#memo").val();

    let info = new OmniSendGrant();
    info.from_address = from_address;
    info.property_id = Number(property_id);
    info.amount = Number(amount);
    info.memo = memo;

    // OBD API
    obdApi.omniSendGrant(info, function(e) {
        console.info('1203 sendGrant - OBD Response = ' + JSON.stringify(e));
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * 1204 sendRevoke API at local.
 * @param msgType
 */
function sendRevoke(msgType) {

    var from_address = $("#from_address").val();
    var property_id = $("#property_id").val();
    var amount = $("#amount").val();
    var memo = $("#memo").val();

    let info = new OmniSendRevoke();
    info.from_address = from_address;
    info.property_id = Number(property_id);
    info.amount = Number(amount);
    info.memo = memo;

    // OBD API
    obdApi.omniSendRevoke(info, function(e) {
        console.info('1204 sendRevoke - OBD Response = ' + JSON.stringify(e));
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * 1205 listProperties API at local.
 * @param msgType
 */
function listProperties(msgType) {
    // OBD API
    obdApi.listProperties(function(e) {
        console.info('1205 listProperties - OBD Response = ' + JSON.stringify(e));
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * 1206 getTransaction API at local.
 * @param msgType
 */
function getTransaction(msgType) {

    var txid = $("#txid").val();

    // OBD API
    obdApi.getOmniTxByTxid(txid, function(e) {
        console.info('1206 getTransaction - OBD Response = ' + JSON.stringify(e));
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * 1207 getAssetNameByID API at local.
 * @param msgType
 */
function getAssetNameByID(msgType) {

    var propertyId = $("#PropertyID").val();

    // OBD API
    obdApi.omniGetAssetNameByID(propertyId, function(e) {
        console.info('1207 getAssetNameByID - OBD Response = ' + JSON.stringify(e));
        // createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -35109 getAllBRTx API at local.
 * @param msgType
 */
function getAllBRTx(msgType) {

    var channel_id = $("#channel_id").val();

    // OBD API
    obdApi.getAllBRTx(channel_id, function(e) {
        console.info('-35109 getAllBRTx - OBD Response = ' + JSON.stringify(e));
        createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -3207 GetChannelDetail API at local.
 * @param msgType
 */
function getChannelDetail(msgType) {

    var id = $("#id").val();

    // OBD API
    obdApi.getChannelById(Number(id), function(e) {
        console.info('-3207 GetChannelDetail - OBD Response = ' + JSON.stringify(e));
        createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -3202 getAllChannels API at local.
 * @param msgType
 */
function getAllChannels(msgType) {
    // OBD API
    obdApi.getAllChannels(function(e) {
        console.info('-3202 getAllChannels - OBD Response = ' + JSON.stringify(e));
        createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -35101 GetAllCommitmentTransactions API at local.
 * @param msgType
 */
function getAllCommitmentTransactions(msgType) {

    var channel_id = $("#channel_id").val();

    // OBD API
    obdApi.getItemsByChannelId(channel_id, function(e) {
        console.info('-35101 GetAllCommitmentTransactions - OBD Response = ' + JSON.stringify(e));
        createOBDResponseDiv(e, msgType);
    });
}

/** 
 * -35104 getLatestCommitmentTx API at local.
 * @param msgType
 */
function getLatestCommitmentTx(msgType) {

    var channel_id = $("#channel_id").val();

    // OBD API
    obdApi.getLatestCommitmentTxByChannelId(channel_id, function(e) {
        console.info('-35104 getLatestCommitmentTx - OBD Response = ' + JSON.stringify(e));
        createOBDResponseDiv(e, msgType);
    });
}

// BTC Funding Created -3400 API at local.
function btcFundingCreated(msgType) {

    var p2pID    = $("#recipient_node_peer_id").val();
    var name     = $("#recipient_user_peer_id").val();
    var temp_cid = $("#temporary_channel_id").val();
    var privkey  = $("#channel_address_private_key").val();
    var tx_hex   = $("#funding_tx_hex").val();

    let info = new FundingBtcCreated();
    info.temporary_channel_id = temp_cid;
    info.channel_address_private_key = privkey;
    info.funding_tx_hex = tx_hex;

    // OBD API
    obdApi.btcFundingCreated(p2pID, name, info, function(e) {
        console.info('btcFundingCreated - OBD Response = ' + JSON.stringify(e));
        saveChannelList(e, temp_cid, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

// BTC Funding Signed -100350 API at local.
function btcFundingSigned(msgType) {

    var p2pID    = $("#recipient_node_peer_id").val();
    var name     = $("#recipient_user_peer_id").val();
    var temp_cid = $("#temporary_channel_id").val();
    var privkey  = $("#channel_address_private_key").val();
    var tx_id    = $("#funding_txid").val();
    var approval = $("#checkbox_n3500").prop("checked");

    let info = new FundingBtcSigned();
    info.temporary_channel_id = temp_cid;
    info.channel_address_private_key = privkey;
    info.funding_txid = tx_id;
    info.approval = approval;

    // OBD API
    obdApi.btcFundingSigned(p2pID, name, info, function(e) {
        console.info('btcFundingSigned - OBD Response = ' + JSON.stringify(e));
        saveChannelList(e, temp_cid, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

// Omni Asset Funding Created -100034 API at local.
function assetFundingCreated(msgType) {

    let p2pID    = $("#recipient_node_peer_id").val();
    let name     = $("#recipient_user_peer_id").val();
    let temp_cid = $("#temporary_channel_id").val();
    let t_ad_pbk = $("#temp_address_pub_key").val();
    let t_ad_prk = $("#temp_address_private_key").val();
    let privkey  = $("#channel_address_private_key").val();
    let tx_hex   = $("#funding_tx_hex").val();

    let info                         = new ChannelFundingCreatedInfo();
    info.temporary_channel_id        = temp_cid;
    info.temp_address_pub_key        = t_ad_pbk;
    info.temp_address_private_key    = t_ad_prk;
    info.channel_address_private_key = privkey;
    info.funding_tx_hex              = tx_hex;

    // OBD API
    obdApi.channelFundingCreated(p2pID, name, info, function(e) {
        console.info('-100034 - assetFundingCreated = ' + JSON.stringify(e));
        saveChannelList(e, temp_cid, msgType);
        saveTempPrivKey(TempPrivKey, temp_cid, privkey);
    });
}

// Omni Asset Funding Signed -100035 API at local.
function assetFundingSigned(msgType) {

    let p2pID      = $("#recipient_node_peer_id").val();
    let name       = $("#recipient_user_peer_id").val();
    let temporary_channel_id = $("#temporary_channel_id").val();
    let privkey    = $("#fundee_channel_address_private_key").val();
    // let approval   = $("#checkbox_n35").prop("checked");

    let info = new ChannelFundingSignedInfo();
    info.temporary_channel_id = temporary_channel_id;
    info.fundee_channel_address_private_key = privkey;
    // info.approval = approval;

    // OBD API
    obdApi.channelFundingSigned(p2pID, name, info, function(e) {
        console.info('-100035 - assetFundingSigned = ' + JSON.stringify(e));
        saveChannelList(e, e.channel_id, msgType);
        saveTempPrivKey(FundingPrivKey, e.channel_id, privkey);
    });
}

// -102109 funding BTC API at local.
function fundingBTC(msgType) {

    var from_address = $("#from_address").val();
    var from_address_private_key = $("#from_address_private_key").val();
    var to_address  = $("#to_address").val();
    var amount      = $("#amount").val();
    var miner_fee   = $("#miner_fee").val();

    let info = new BtcFundingInfo();
    info.from_address = from_address;
    info.from_address_private_key = from_address_private_key;
    info.to_address = to_address;
    info.amount = Number(amount);
    info.miner_fee = Number(miner_fee);

    //Save value to variable
    btcFromAddr = from_address;
    btcFromAddrPrivKey = from_address_private_key;
    btcToAddr = to_address;
    btcAmount = amount;
    btcMinerFee = miner_fee;

    // Get temporary_channel_id
    let tempChID = getTempChannelID();

    // var tempChID;
    // var list = JSON.parse(localStorage.getItem(itemChannelList));
    // for (let i = 0; i < list.result.length; i++) {
    //     for (let i2 = 0; i2 < list.result[i].data.length; i2++) {
    //         if (to_address === list.result[i].data[i2].channel_address) {
    //             tempChID = list.result[i].data[i2].temporary_channel_id;
    //         }
    //     }
    // }

    // OBD API
    obdApi.fundingBTC(info, function(e) {
        console.info('-102109 fundingBTC = ' + JSON.stringify(e));
        saveChannelList(e, tempChID, msgType);
        saveFundingBtcHex(e.hex);
    });
}

//  -102120 funding Omni Asset API at local.
function fundingAsset(msgType) {

    var from_address = $("#from_address").val();
    var from_address_private_key = $("#from_address_private_key").val();
    var to_address = $("#to_address").val();
    var amount = $("#amount").val();
    var property_id = $("#property_id").val();

    let info = new OmniFundingAssetInfo();
    info.from_address = from_address;
    info.from_address_private_key = from_address_private_key;
    info.to_address = to_address;
    info.amount = Number(amount);
    info.property_id = Number(property_id);

    // Get temporary_channel_id with channel_address.
    let tempChID = getTempChannelID();
    // var tempChID;
    // var list = JSON.parse(localStorage.getItem(itemChannelList));
    // for (let i = 0; i < list.result.length; i++) {
    //     for (let i2 = 0; i2 < list.result[i].data.length; i2++) {
    //         if (to_address === list.result[i].data[i2].channel_address) {
    //             tempChID = list.result[i].data[i2].temporary_channel_id;
    //         }
    //     }
    // }

    // OBD API
    obdApi.fundingAssetOfOmni(info, function(e) {
        console.info(' -102120 fundingAssetOfOmni = ' + JSON.stringify(e));
        saveChannelList(e, tempChID, msgType);
        saveFundingAssetcHex(e.hex);
    });
}

// createInvoice API at local.
function createInvoice(msgType) {

    let property_id = $("#property_id").val();
    let amount      = $("#amount").val();
    let h           = $("#h").val();
    let expiry_time = $("#expiry_time").val();
    let description = $("#description").val();

    let info         = new InvoiceInfo();
    info.property_id = Number(property_id);
    info.amount      = Number(amount);
    info.h           = h;
    info.expiry_time = expiry_time;
    console.info('info.expiry_time = ' + info.expiry_time);
    info.description = description;

    // OBD API
    obdApi.htlcInvoice(info, function(e) {
        console.info('createInvoice - OBD Response = ' + JSON.stringify(e));
        // saveChannelList(e, tempChID, msgType);
        // createOBDResponseDiv(e, msgType);

        $("#newDiv").remove();
        createElement($("#name_req_div"), 'div', '', 'panelItem', 'newDiv');
        
        let newDiv     = $("#newDiv");
        let strInvoice = JSON.stringify(e);

        // Basecode string of invoice
        strInvoice = strInvoice.replace("\"", "").replace("\"", "");
        createElement(newDiv, 'div', strInvoice, 'str_invoice');

        // QRCode of invoice
        createElement(newDiv, 'div', '', 'qrcode', 'qrcode');
        let qrcode = new QRCode("qrcode", {
            width : 160, height : 160
        });
        qrcode.makeCode(strInvoice);
    });
}

// -40 htlcCreated API at local.
function htlcCreated(msgType) {

    var recipient_node_peer_id  = $("#recipient_node_peer_id").val();
    var recipient_user_peer_id  = $("#recipient_user_peer_id").val();
    var property_id = $("#property_id").val();
    var amount      = $("#amount").val();
    var memo        = $("#memo").val();
    var h           = $("#h").val();
    var htlc_channel_path = $("#htlc_channel_path").val();
    var channel_address_private_key = $("#channel_address_private_key").val();
    var last_temp_address_private_key = $("#last_temp_address_private_key").val();
    var curr_rsmc_temp_address_pub_key = $("#curr_rsmc_temp_address_pub_key").val();
    var curr_rsmc_temp_address_private_key = $("#curr_rsmc_temp_address_private_key").val();
    var curr_htlc_temp_address_pub_key = $("#curr_htlc_temp_address_pub_key").val();
    var curr_htlc_temp_address_private_key = $("#curr_htlc_temp_address_private_key").val();
    var curr_htlc_temp_address_for_ht1a_pub_key = $("#curr_htlc_temp_address_for_ht1a_pub_key").val();
    var curr_htlc_temp_address_for_ht1a_private_key = $("#curr_htlc_temp_address_for_ht1a_private_key").val();

    let info = new HtlcCreatedInfo();
    info.recipient_user_peer_id = recipient_user_peer_id;
    info.property_id = Number(property_id);
    info.amount = Number(amount);
    info.memo = memo;
    info.h = h;
    info.htlc_channel_path = htlc_channel_path;
    info.channel_address_private_key = channel_address_private_key;
    info.last_temp_address_private_key = last_temp_address_private_key;
    info.curr_rsmc_temp_address_pub_key = curr_rsmc_temp_address_pub_key;
    info.curr_rsmc_temp_address_private_key = curr_rsmc_temp_address_private_key;
    info.curr_htlc_temp_address_pub_key = curr_htlc_temp_address_pub_key;
    info.curr_htlc_temp_address_private_key = curr_htlc_temp_address_private_key;
    info.curr_htlc_temp_address_for_ht1a_pub_key = curr_htlc_temp_address_for_ht1a_pub_key;
    info.curr_htlc_temp_address_for_ht1a_private_key = curr_htlc_temp_address_for_ht1a_private_key;

    // OBD API
    obdApi.htlcCreated(recipient_node_peer_id, recipient_user_peer_id, info, function(e) {
        console.info('-40 htlcCreated - OBD Response = ' + JSON.stringify(e));
        // saveChannelList in listeningN40 func.
        // createOBDResponseDiv(e, msgType);
    });
}

// -100041 htlcSigned API at local.
function htlcSigned(msgType) {

    var recipient_node_peer_id  = $("#recipient_node_peer_id").val();
    var recipient_user_peer_id  = $("#recipient_user_peer_id").val();
    var request_hash = $("#request_hash").val();
    var channel_address_private_key = $("#channel_address_private_key").val();
    var last_temp_address_private_key = $("#last_temp_address_private_key").val();
    var curr_rsmc_temp_address_pub_key = $("#curr_rsmc_temp_address_pub_key").val();
    var curr_rsmc_temp_address_private_key = $("#curr_rsmc_temp_address_private_key").val();
    var curr_htlc_temp_address_pub_key = $("#curr_htlc_temp_address_pub_key").val();
    var curr_htlc_temp_address_private_key = $("#curr_htlc_temp_address_private_key").val();
    // var approval = $("#checkbox_n41").prop("checked");

    let info = new HtlcSignedInfo();
    info.request_hash = request_hash;
    info.channel_address_private_key = channel_address_private_key;
    info.last_temp_address_private_key = last_temp_address_private_key;
    info.curr_rsmc_temp_address_pub_key = curr_rsmc_temp_address_pub_key;
    info.curr_rsmc_temp_address_private_key = curr_rsmc_temp_address_private_key;
    info.curr_htlc_temp_address_pub_key = curr_htlc_temp_address_pub_key;
    info.curr_htlc_temp_address_private_key = curr_htlc_temp_address_private_key;
    // info.approval = approval;

    // Get channel_id by request_hash.
    // var channelId;
    // var list = JSON.parse(localStorage.getItem(itemChannelList));
    // for (let i = 0; i < list.result.length; i++) {
    //     for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
    //         if (request_hash === list.result[i].htlc[i2].msgHash) {
    //             channelId =  list.result[i].htlc[i2].channelId;
    //         }
    //     }
    // }

    // OBD API
    obdApi.htlcSigned(recipient_node_peer_id, recipient_user_peer_id, info, function(e) {
        console.info('-100041 htlcSigned - OBD Response = ' + JSON.stringify(e));
        saveChannelList(e, e.channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

// -43 htlcSendH API at local.
function htlcSendH(msgType) {

    var h = $("#h").val();
    var request_hash = $("#request_hash").val();

    // OBD API
    obdApi.htlcSendH(h, request_hash, function(e) {
        console.info('-43 htlcSendH - OBD Response = ' + JSON.stringify(e));
        // saveChannelList(e);
        // createOBDResponseDiv(e, msgType);
    });
}

// 
function htlcFindPath(msgType) {

    var recipient_node_peer_id = $("#recipient_node_peer_id").val();
    var recipient_user_peer_id = $("#recipient_user_peer_id").val();
    var property_id            = $("#property_id").val();
    var amount                 = $("#amount").val();

    let info = new HtlcFindPathInfo();
    info.recipient_node_peer_id = recipient_node_peer_id;
    info.recipient_user_peer_id = recipient_user_peer_id;
    info.property_id            = Number(property_id);
    info.amount                 = Number(amount);

    // OBD API
    obdApi.htlcFindPath(info, function(e) {
        console.info('N4001 - htlcFindPath - OBD Response = ' + JSON.stringify(e));
        // saveChannelList(e, tempChID, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

// -100351 Commitment Transaction Created API at local.
function rsmcCTxCreated(msgType) {

    var p2pID    = $("#recipient_node_peer_id").val();
    var name     = $("#recipient_user_peer_id").val();
    var channel_id = $("#channel_id").val();
    var amount = $("#amount").val();
    var curr_temp_address_pub_key = $("#curr_temp_address_pub_key").val();
    var curr_temp_address_private_key = $("#curr_temp_address_private_key").val();
    var channel_address_private_key = $("#channel_address_private_key").val();
    var last_temp_address_private_key = $("#last_temp_address_private_key").val();

    let info = new CommitmentTx();
    info.channel_id = channel_id;
    info.amount = Number(amount);
    info.curr_temp_address_pub_key = curr_temp_address_pub_key;
    info.curr_temp_address_private_key = curr_temp_address_private_key;
    info.channel_address_private_key = channel_address_private_key;
    info.last_temp_address_private_key = last_temp_address_private_key;

    // OBD API
    obdApi.commitmentTransactionCreated(p2pID, name, info, function(e) {
        console.info('-100351 RSMCCTxCreated = ' + JSON.stringify(e));
        saveTempPrivKey(TempPrivKey, channel_id, curr_temp_address_private_key);
    });
}

// Revoke and Acknowledge Commitment Transaction -100352 API at local.
function rsmcCTxSigned(msgType) {

    var p2pID    = $("#recipient_node_peer_id").val();
    var name     = $("#recipient_user_peer_id").val();
    var channel_id = $("#channel_id").val();
    var curr_temp_address_pub_key = $("#curr_temp_address_pub_key").val();
    var curr_temp_address_private_key = $("#curr_temp_address_private_key").val();
    var channel_address_private_key = $("#channel_address_private_key").val();
    var last_temp_address_private_key = $("#last_temp_address_private_key").val();
    var msg_hash = $("#msg_hash").val();
    var approval = $("#checkbox_n352").prop("checked");

    let info = new CommitmentTxSigned();
    info.channel_id = channel_id;
    info.curr_temp_address_pub_key = curr_temp_address_pub_key;
    info.curr_temp_address_private_key = curr_temp_address_private_key;
    info.channel_address_private_key = channel_address_private_key;
    info.last_temp_address_private_key = last_temp_address_private_key;
    info.msg_hash = msg_hash;
    info.approval = approval;

    // OBD API
    obdApi.revokeAndAcknowledgeCommitmentTransaction(p2pID, name, info, function(e) {
        console.info('-100352 RSMCCTxSigned = ' + JSON.stringify(e));
        saveChannelList(e, channel_id, msgType);
        // createOBDResponseDiv(e, msgType);
    });
}

// Invoke each APIs.
function invokeAPIs(objSelf) {

    var msgType = Number(objSelf.getAttribute('type_id'));
    console.info('type_id = ' + msgType);

    switch (msgType) {
        // Util APIs.
        case enumMsgType.MsgType_Core_Omni_Getbalance_2112:
            getBalanceForOmni(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_CreateNewTokenFixed_2113:
            issuanceFixed(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_CreateNewTokenManaged_2114:
            issuanceManaged(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_GrantNewUnitsOfManagedToken_2115:
            sendGrant(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_RevokeUnitsOfManagedToken_2116:
            sendRevoke(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_ListProperties_2117:
            listProperties(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_GetTransaction_2118:
            getTransaction(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_GetProperty_2119:
            getAssetNameByID(msgType);
            break;
        case enumMsgType.MsgType_CommitmentTx_AllBRByChanId_3208:
            getAllBRTx(msgType);
            break;
        case enumMsgType.MsgType_GetChannelInfoByChannelId_3154:
            getChannelDetail(msgType);
            break;
        case enumMsgType.MsgType_ChannelOpen_AllItem_3150:
            getAllChannels(msgType);
            break;
        case enumMsgType.MsgType_CommitmentTx_ItemsByChanId_3200:
            getAllCommitmentTransactions(msgType);
            break;
        case enumMsgType.MsgType_CommitmentTx_LatestCommitmentTxByChanId_3203:
            getLatestCommitmentTx(msgType);
            break;
        // case enumMsgType.MsgType_Core_GetNewAddress_2101:
        //     obdApi.getNewAddress(function(e) {
        //         console.info('OBD Response = ' + e);
        //         createOBDResponseDiv(e);
        //     });
        //     break;
        case enumMsgType.MsgType_Mnemonic_CreateAddress_3000:
            var result = genAddressFromMnemonic();
            if (result === '') return;
            saveAddresses(result);
            createOBDResponseDiv(result, msgType);
            break;
        case enumMsgType.MsgType_Mnemonic_GetAddressByIndex_3001:
            var result = getAddressInfo();
            if (result === '') return;
            createOBDResponseDiv(result, msgType);
            break;

            // APIs for debugging.
        case enumMsgType.MsgType_UserLogin_2001:
            logIn(msgType);
            break;
        case enumMsgType.MsgType_UserLogout_2002:
            obdApi.logout();
            break;
        case enumMsgType.MsgType_GetMnemonic_2004:
            // Generate mnemonic by local js library.
            // var mnemonic = btctool.generateMnemonic(128);
            // let mnemonic = obdApi.genMnemonic();
            let mnemonic = genMnemonic();
            saveMnemonic(mnemonic);
            createOBDResponseDiv(mnemonic);
            break;
        case enumMsgType.MsgType_Core_FundingBTC_2109:
            fundingBTC(msgType);
            break;
        case enumMsgType.MsgType_FundingCreate_SendBtcFundingCreated_340:
            btcFundingCreated(msgType);
            break;
        case enumMsgType.MsgType_FundingSign_SendBtcSign_350:
            btcFundingSigned(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_FundingAsset_2120:
            fundingAsset(msgType);
            break;
        case enumMsgType.MsgType_FundingCreate_SendAssetFundingCreated_34:
            assetFundingCreated(msgType);
            break;
        case enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35:
            assetFundingSigned(msgType);
            break;
        case enumMsgType.MsgType_CommitmentTx_SendCommitmentTransactionCreated_351:
            rsmcCTxCreated(msgType);
            break;
        case enumMsgType.MsgType_CommitmentTxSigned_SendRevokeAndAcknowledgeCommitmentTransaction_352:
            rsmcCTxSigned(msgType);
            break;
        case enumMsgType.MsgType_Core_Omni_GetTransaction_2118:
            txid = "c76710920860456dff2433197db79dd030f9b527e83a2e253f5bc6ab7d197e73";
            obdApi.getOmniTxByTxid(txid);
            break;
            // Open Channel request.
        case enumMsgType.MsgType_SendChannelOpen_32:
            openChannel(msgType);
            break;
            // Accept Channel request.
        case enumMsgType.MsgType_SendChannelAccept_33:
            acceptChannel(msgType);
            break;
        case enumMsgType.MsgType_HTLC_Invoice_402:
            createInvoice(msgType);
            break;
        case enumMsgType.MsgType_HTLC_FindPath_401:
            htlcFindPath(msgType);
            break;
        case enumMsgType.MsgType_HTLC_SendAddHTLC_40:
            htlcCreated(msgType);
            break;
        case enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41:
            htlcSigned(msgType);
            break;
        case enumMsgType.MsgType_HTLC_SendVerifyR_45:
            htlcSendR(msgType);
            break;
        case enumMsgType.MsgType_HTLC_SendSignVerifyR_46:
            htlcVerifyR(msgType);
            break;
        case enumMsgType.MsgType_HTLC_SendRequestCloseCurrTx_49:
            closeHTLC(msgType);
            break;
        case enumMsgType.MsgType_HTLC_SendCloseSigned_50:
            closeHTLCSigned(msgType);
            break;
        case enumMsgType.MsgType_SendCloseChannelRequest_38:
            closeChannel(msgType);
            break;
        case enumMsgType.MsgType_SendCloseChannelSign_39:
            closeChannelSigned(msgType);
            break;
        case enumMsgType.MsgType_Atomic_SendSwap_80:
            atomicSwap(msgType);
            break;
        case enumMsgType.MsgType_Atomic_SendSwapAccept_81:
            atomicSwapAccepted(msgType);
            break;
        case enumMsgType.MsgType_p2p_ConnectPeer_2003:
            connectP2PPeer(msgType);
            break;
        default:
            console.info(msgType + " do not exist");
            break;
    }
}

// 
function saveMsgFromCounterparty(e) {
    console.info("saveMsgFromCounterparty:", JSON.stringify(e));

    var data = localStorage.getItem('broadcast_info');

    var msgTime = new Date().toLocaleString();
    var fullMsg = JSON.stringify(e, null, 2);
        fullMsg = jsonFormat(fullMsg);

    arrObdMsg.push(data);
    arrObdMsg.push(fullMsg);
    arrObdMsg.push('------------------------------------');
    arrObdMsg.push(msgTime);
    arrObdMsg.push('------------------------------------');
    
    var showMsg = '';
    for (let i = arrObdMsg.length - 1; i >= 0; i--) {
        showMsg += arrObdMsg[i] + '\n\n';
    }
    
    // SAVE broadcast info TO LOCAL STORAGE
    localStorage.setItem('broadcast_info', showMsg);
}

// get a copy of an object
function getNewObjectOf(src) {
    return Object.assign({}, src);
}

// 
function displayOBDMessages(msg) {
    let content = getNewObjectOf(msg);
    console.info("broadcast info:", JSON.stringify(content));

    var msgHead;
    var msgTime = new Date().toLocaleString();
    var fullMsg = JSON.stringify(content, null, 2);
        fullMsg = jsonFormat(fullMsg);

    switch (Number(content.type)) {
        // case enumMsgType.MsgType_Error_0:
        // case enumMsgType.MsgType_Mnemonic_CreateAddress_3000:
        // case enumMsgType.MsgType_Mnemonic_GetAddressByIndex_3001:
        // case enumMsgType.MsgType_GetMnemonic_2004:
        // case enumMsgType.MsgType_Core_BalanceByAddress_2108:
        // case enumMsgType.MsgType_Core_FundingBTC_2109:
        // case enumMsgType.MsgType_Core_Omni_Getbalance_2112:
        // case enumMsgType.MsgType_Core_Omni_GetProperty_2119:
        // case enumMsgType.MsgType_Core_Omni_FundingAsset_2120:
        // case enumMsgType.MsgType_HTLC_Invoice_402:
        // case enumMsgType.MsgType_CommitmentTx_LatestCommitmentTxByChanId_3203:
        // case enumMsgType.MsgType_CommitmentTx_ItemsByChanId_3200:
        // case enumMsgType.MsgType_ChannelOpen_AllItem_3150:
        // case enumMsgType.MsgType_GetChannelInfoByChannelId_3154:
        // case enumMsgType.MsgType_CommitmentTx_AllBRByChanId_3208:
        //     return;
        case enumMsgType.MsgType_UserLogin_2001:
            content.result = 'Logged In - ' + content.from;
            msgHead = msgTime +  '  - Logged In.';
            break;
        case enumMsgType.MsgType_p2p_ConnectPeer_2003:
            content.result = 'Connect to P2P Peer.';
            msgHead = msgTime+  '  - Connect to P2P Peer.';
            break;
        case enumMsgType.MsgType_SendChannelOpen_32:
            content.result = 'LAUNCH - ' + content.from +
                ' - launch an Open Channel request. ';

            msgHead = msgTime +  '  - launch an Open Channel request.';

            // 'The [temporary_channel_id] is : ' + 
            // content.result.temporary_channel_id;
            break;
        case enumMsgType.MsgType_SendChannelAccept_33:
            if (content.result.curr_state === 11) { // Accept
                content.result = 'ACCEPT - ' + content.from +
                    ' - accept Open Channel request. ';
                // 'The [temporary_channel_id] is : ' + 
                // content.result.temporary_channel_id;

                msgHead = msgTime +  '  - accept Open Channel request.';

            } else if (content.result.curr_state === 30) { // Not Accept
                content.result = 'DECLINE - ' + content.from +
                    ' - decline Open Channel request. ';

                msgHead = msgTime +  '  - decline Open Channel request.';

                // 'The [temporary_channel_id] is : ' + 
                // content.result.temporary_channel_id;
            }
            break;
        case enumMsgType.MsgType_FundingCreate_SendBtcFundingCreated_340:
            content.result = 'Notification - ' + content.from +
                ' - depositing BTC in Channel.';
            msgHead = msgTime +  '  - Notification: depositing BTC in Channel.';
            break;
        case enumMsgType.MsgType_FundingSign_SendBtcSign_350:
            content.result = 'Reply - ' + content.from +
                ' - depositing BTC message.';
            msgHead = msgTime +  '  - Reply: depositing BTC message.';
            break;
        case enumMsgType.MsgType_FundingCreate_SendAssetFundingCreated_34:
            content.result = 'Notification - ' + content.from +
                ' - depositing Omni Asset in Channel.';
            msgHead = msgTime +  '  - Notification: depositing Omni Asset in Channel.';
            break;
        case enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35:
            content.result = 'Reply - ' + content.from +
                ' - depositing Omni Asset message.';
            msgHead = msgTime +  '  - Reply: depositing Omni Asset message.';
            break;
        case enumMsgType.MsgType_CommitmentTx_SendCommitmentTransactionCreated_351:
            content.result = 'RSMC transfer - ' + content.from +
                ' - launch a transfer.';
            msgHead = msgTime +  '  - RSMC: launch a transfer.';
            break;
        case enumMsgType.MsgType_CommitmentTxSigned_SendRevokeAndAcknowledgeCommitmentTransaction_352:
            content.result = 'RSMC transfer - ' + content.from +
                ' - accept a transfer.';
            msgHead = msgTime +  '  - RSMC: accept a transfer.';
            break;
        case enumMsgType.MsgType_HTLC_SendAddHTLC_40:
            content.result = 'HTLC - ' + content.from +
                ' - launch a HTLC transfer.';
            msgHead = msgTime +  '  - HTLC: launch a HTLC transfer.';
            break;
        case enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41:
            content.result = 'HTLC - ' + content.from +
                ' - accept a HTLC transfer.';
            msgHead = msgTime +  '  - HTLC: accept a HTLC transfer.';
            break;
        case enumMsgType.MsgType_HTLC_SendVerifyR_45:
            content.result = 'HTLC - ' + content.from +
                ' - Sent R.';
            msgHead = msgTime +  '  - HTLC: Sent R.';
            break;
        case enumMsgType.MsgType_HTLC_SendSignVerifyR_46:
            content.result = 'HTLC - ' + content.from +
                ' - Verify R.';
            msgHead = msgTime +  '  - HTLC: Verify R.';
            break;
        case enumMsgType.MsgType_HTLC_SendRequestCloseCurrTx_49:
            content.result = 'HTLC - ' + content.from +
                ' - Request Close.';
            msgHead = msgTime +  '  - HTLC: Request Close.';
            break;
        case enumMsgType.MsgType_HTLC_SendCloseSigned_50:
            content.result = 'HTLC - ' + content.result.msg;
            msgHead = msgTime +  '  - HTLC: Closed.';
            break;
        case enumMsgType.MsgType_SendCloseChannelRequest_38:
            content.result = 'N38 Request Close Channel from - ' + content.from;
            msgHead = msgTime +  '  - Request Close Channel.';
            break;
        case enumMsgType.MsgType_SendCloseChannelSign_39:
            content.result = 'N39 Response Close Channel from - ' + content.from;
            msgHead = msgTime +  '  - Response Close Channel.';
            break;
        case enumMsgType.MsgType_Atomic_SendSwap_80:
            content.result = 'N80 Request Atomic Swap from - ' + content.from;
            msgHead = msgTime +  '  - Request Atomic Swap.';
            break;
        case enumMsgType.MsgType_Atomic_SendSwapAccept_81:
            content.result = 'N81 Response Atomic Swap from - ' + content.from;
            msgHead = msgTime +  '  - Response Atomic Swap.';
            break;
        default:
            msgHead = msgTime;
            break;
    }

    content = JSON.stringify(content.result);
    if (Number(msg.type) != enumMsgType.MsgType_Error_0) {
        content = content.replace("\"", "").replace("\"", "");
    }
    // console.info("OBD DIS - content = ", content);

    // the info save to local storage [ChannelList].
    channelInfo = content;

    // Some case do not need displayed.
    if (content === 'already login' || content === 'undefined') return;

    // Add new message
    arrObdMsg.push('\n');
    arrObdMsg.push(fullMsg);
    arrObdMsg.push('------------------------------------');
    arrObdMsg.push(msgHead);
    arrObdMsg.push('------------------------------------');
    
    var showMsg = '';
    for (let i = arrObdMsg.length - 1; i >= 0; i--) {
        showMsg += arrObdMsg[i] + '\n\n';
    }
    
    $("#obd_messages").html(showMsg);

    // SAVE all broadcast info TO LOCAL STORAGE
    // Get old messages
    var data = localStorage.getItem('broadcast_info');
    if (data) {
        var newMsg = '------------------------------------';
        newMsg += '\n\n' + msgHead;
        newMsg += '\n\n' + '------------------------------------';
        newMsg += '\n\n' + fullMsg;
        newMsg += '\n\n\n\n' + data;
        showMsg = newMsg;
    }
    // testNum++;
    // console.info('INFO --> testNum = ' + testNum);
    // console.info('INFO --> showMsg = ' + showMsg);
    localStorage.setItem('broadcast_info', showMsg);
}
// var testNum = 0;

// 
function getUserDataList(goWhere) {

    var api_id, description, apiItem, menuDiv;
    var jsonFile = "json/user_data_list.json";

    // dynamic create api_list div.
    $.getJSON(jsonFile, function(result) {
        // get [user_data_list] div
        var apiList = $("#user_data_list");

        for (let i = 0; i < result.data.length; i++) {
            api_id = result.data[i].id;
            description = result.data[i].description;

            // menuDiv = document.createElement('div');
            // menuDiv.setAttribute('class', 'menuItem');

            apiItem = document.createElement('a');
            apiItem.id = api_id;
            apiItem.href = '#';
            apiItem.setAttribute('class', 'url');
            apiItem.setAttribute('description', description);
            apiItem.setAttribute('onclick', 'displayUserData(this)');
            apiItem.innerText = api_id;

            // menuDiv.append(apiItem);
            apiList.append(apiItem);

            createElement(apiList, 'p');
        }

        // display User Data in new html page.
        // console.info('goWhere LIST = '+ goWhere);
        if (goWhere) $("#user_data_list").hide();
        switch (goWhere) {
            case 'MnemonicWords':
                displayUserData(MnemonicWords);
                break;
            case 'MyAddresses':
                displayUserData(MyAddresses, inNewHtml);
                break;
            case 'Counterparties':
                displayUserData(Counterparties, inNewHtml);
                break;
            case 'ChannelList':
                displayUserData(ChannelList, inNewHtml);
                break;
        }
    });
}

// getUtilList
function getUtilList() {
    var jsonFile = "json/util_list.json";
    var divName = "#util_list";

    createLeftSideMenu(jsonFile, divName);
}

// getAPIList
function getAPIList() {
    var jsonFile = "json/api_list.json";
    var divName = "#api_list";

    createLeftSideMenu(jsonFile, divName);
}

// 
function getManageAssetList() {
    var jsonFile = "json/manage_asset.json";
    var divName = "#manage_assets_list";

    createLeftSideMenu(jsonFile, divName);
}

// createLeftSideMenu
function createLeftSideMenu(jsonFile, divName) {

    var api_id, type_id, description, apiItem, menuDiv;

    // dynamic create api_list div.
    $.getJSON(jsonFile, function(result) {
        // get [api_list] div
        var apiList = $(divName);

        for (let i = 0; i < result.data.length; i++) {
            api_id = result.data[i].id;
            type_id = result.data[i].type_id;
            description = result.data[i].description;

            menuDiv = document.createElement('div');
            // menuDiv.setAttribute('class', 'menuItem');

            apiItem = document.createElement('a');
            apiItem.id = api_id;
            apiItem.href = '#';
            // apiItem.href = 'javascript:void(0);';
            apiItem.setAttribute('class', 'url');
            apiItem.setAttribute('type_id', type_id);
            apiItem.setAttribute('description', description);
            apiItem.setAttribute('onclick', 'displayAPIContent(this)');
            apiItem.innerText = api_id;

            menuDiv.append(apiItem);
            apiList.append(menuDiv);

            createElement(apiList, 'p');
        }
    });
}

// Invoke a api, show content. Dynamic create content div area.
function displayAPIContent(obj) {
    removeNameReqDiv();
    createApiNameDiv(obj);
    createRequestDiv(obj);
    createInputParamDiv(obj, 'json/util_list.json');
    createInputParamDiv(obj, 'json/api_list.json');
    createInputParamDiv(obj, 'json/manage_asset.json');
}

// create 
function createApiNameDiv(obj) {
    var content_div = $("#name_req_div");

    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    // create [api_name] element
    var title = document.createElement('div');
    title.setAttribute('class', 'panelTitle');
    createElement(title, 'h2', obj.innerHTML);
    newDiv.append(title);

    // create [api_description] element
    createElement(newDiv, 'text', obj.getAttribute("description"), 'api_description');

    content_div.append(newDiv);
}

// create 
function createRequestDiv(obj) {
    var content_div = $("#name_req_div");

    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    // create [title] element
    var title = document.createElement('div');
    title.setAttribute('class', 'panelTitle');
    createElement(title, 'h2', 'Request');
    newDiv.append(title);
    // createElement(content_div, 'h2', 'Request');

    // create [func_title] element
    createElement(newDiv, 'text', 'func: ');

    // create [func_name] element: id = JS function name.
    createElement(newDiv, 'text', obj.getAttribute("id"), 'funcText');

    // create [type_id] element
    var value = " type ( " + obj.getAttribute("type_id") + " )";
    createElement(newDiv, 'text', value);

    // create [Invoke API] element
    var button = document.createElement('button');
    button.setAttribute('type_id', obj.getAttribute("type_id"));
    button.setAttribute('class', 'button button_big');
    button.setAttribute('onclick', 'invokeAPIs(this)');
    button.innerText = 'Invoke API';
    newDiv.append(button);

    content_div.append(newDiv);
}

// dynamic create input parameters div area.
function createInputParamDiv(obj, jsonFile) {

    $.getJSON(jsonFile, function(result) {
        // get [content] div
        var content_div = $("#name_req_div");

        // get JS function name.
        var js_func = obj.getAttribute("id");

        for (let i = 0; i < result.data.length; i++) {
            // id = js_func, is JS function name.
            if (js_func === result.data[i].id) {
                var arrParams = result.data[i].parameters;
                // console.info('arrParams = ' + arrParams.length);

                // No parameter.
                if (arrParams.length === 0) {
                    break;
                }

                var newDiv = document.createElement('div');
                newDiv.setAttribute('class', 'panelItem');

                var title = document.createElement('div');
                title.setAttribute('class', 'panelTitle');
                createElement(title, 'h2', 'Input Parameters');
                newDiv.append(title);

                // Parameters
                createParamOfAPI(arrParams, newDiv);
                content_div.append(newDiv);
                autoFillValue(arrParams, obj);
            }
        }

        // display Approval Checkbox
        if (jsonFile === 'json/api_list.json') {
            var msgType = Number(obj.getAttribute("type_id"));
            switch (msgType) {
                case enumMsgType.MsgType_SendChannelAccept_33:
                case enumMsgType.MsgType_FundingSign_SendBtcSign_350:
                // case enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35:
                case enumMsgType.MsgType_CommitmentTxSigned_SendRevokeAndAcknowledgeCommitmentTransaction_352:
                case enumMsgType.MsgType_SendCloseChannelSign_39:
                // case enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41:
                    displayApprovalCheckbox(newDiv, obj, msgType);
                    content_div.append(newDiv);
                    break;
            }
        }
    });
}

//
function autoFillValue(arrParams, obj) {

    // Only for fundingBTC api.
    if (arrParams[0].name === 'from_address') {
        if (btcFromAddr) {
            $("#from_address").val(btcFromAddr);
            $("#from_address_private_key").val(btcFromAddrPrivKey);
            $("#to_address").val(btcToAddr);
            $("#amount").val(btcAmount);
            $("#miner_fee").val(btcMinerFee);
        }
    }

    // Auto generate addresses and fill pubkey and privkey to input box
    let result, channelID, privkey;
    let msgType = Number(obj.getAttribute("type_id"));
    switch (msgType) {
        case enumMsgType.MsgType_HTLC_Invoice_402:
            let date = new Date().toJSON().substr(0, 10).replace('T', ' ');
            $("#expiry_time").val(date);
            $("#expiry_time").attr("type", "date");
        //     if (isLogined) {
        //         $("#recipient_node_peer_id").val(nodeID);
        //         $("#recipient_user_peer_id").val(userID);
        //         $("#recipient_node_peer_id").attr("class", "input input_color");
        //         $("#recipient_user_peer_id").attr("class", "input input_color");
        //     }
            break;

        case enumMsgType.MsgType_SendChannelOpen_32:
            if (!isLogined) return;  // Not logined
            result = getLastCounterparty();
            if (result === '') return;
            $("#recipient_node_peer_id").val(result.p2pID);
            $("#recipient_user_peer_id").val(result.name);
            break;

        case enumMsgType.MsgType_SendChannelAccept_33:
            if (!isLogined) return;  // Not logined
            result = getLastCounterparty();
            if (result === '') return;
            $("#recipient_node_peer_id").val(result.p2pID);
            $("#recipient_user_peer_id").val(result.name);
            
            channelID = getTempChannelID();
            if (channelID === '') return;
            $("#temporary_channel_id").val(channelID);
            break;

        case enumMsgType.MsgType_FundingCreate_SendBtcFundingCreated_340:
        case enumMsgType.MsgType_FundingSign_SendBtcSign_350:
            if (!isLogined) return;  // Not logined

            result = getLastCounterparty();
            if (result === '') return;
            $("#recipient_node_peer_id").val(result.p2pID);
            $("#recipient_user_peer_id").val(result.name);
            
            channelID = getTempChannelID();
            if (channelID === '') return;
            $("#temporary_channel_id").val(channelID);
            
            privkey = getTempPrivKey(FundingPrivKey, channelID);
            if (privkey === '') return;
            $("#channel_address_private_key").val(privkey);
            
            if (msgType === enumMsgType.MsgType_FundingSign_SendBtcSign_350) {
                let txid = getFundingBtcTxid();
                if (txid === '') return;
                $("#funding_txid").val(txid);
            } else {
                let hex = getFundingBtcHex();
                if (hex === '') return;
                $("#funding_tx_hex").val(hex);
            }

            break;

        case enumMsgType.MsgType_FundingCreate_SendAssetFundingCreated_34:
            if (!isLogined) return;  // Not logined

            result = getLastCounterparty();
            if (result === '') return;
            $("#recipient_node_peer_id").val(result.p2pID);
            $("#recipient_user_peer_id").val(result.name);

            channelID = getTempChannelID();
            if (channelID === '') return;
            $("#temporary_channel_id").val(channelID);

            privkey = getTempPrivKey(FundingPrivKey, channelID);
            if (privkey === '') return;
            $("#channel_address_private_key").val(privkey);

            let hex = getFundingAssetcHex();
            if (hex === '') return;
            $("#funding_tx_hex").val(hex);

            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#temp_address_pub_key").val(result.result.pubkey);
            $("#temp_address_private_key").val(result.result.wif);
            $("#temp_address_pub_key").attr("class", "input input_color");
            $("#temp_address_private_key").attr("class", "input input_color");
            saveAddresses(result);
            break;

        case enumMsgType.MsgType_CommitmentTx_SendCommitmentTransactionCreated_351:
        case enumMsgType.MsgType_CommitmentTxSigned_SendRevokeAndAcknowledgeCommitmentTransaction_352:
            if (!isLogined) return;  // Not logined
            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_temp_address_private_key").val(result.result.wif);
            $("#curr_temp_address_pub_key").attr("class", "input input_color");
            $("#curr_temp_address_private_key").attr("class", "input input_color");
            saveAddresses(result);
            break;

        case enumMsgType.MsgType_HTLC_SendAddHTLC_40:
            if (!isLogined) return;  // Not logined
            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_rsmc_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_rsmc_temp_address_private_key").val(result.result.wif);
            $("#curr_rsmc_temp_address_pub_key").attr("class", "input input_color");
            $("#curr_rsmc_temp_address_private_key").attr("class", "input input_color");
            saveAddresses(result);

            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_htlc_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_htlc_temp_address_private_key").val(result.result.wif);
            $("#curr_htlc_temp_address_pub_key").attr("class", "input input_color");
            $("#curr_htlc_temp_address_private_key").attr("class", "input input_color");
            saveAddresses(result);

            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_htlc_temp_address_for_ht1a_pub_key").val(result.result.pubkey);
            $("#curr_htlc_temp_address_for_ht1a_private_key").val(result.result.wif);
            $("#curr_htlc_temp_address_for_ht1a_pub_key").attr("class", "input input_color");
            $("#curr_htlc_temp_address_for_ht1a_private_key").attr("class", "input input_color");
            saveAddresses(result);
            break;

        case enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41:
            if (!isLogined) return;  // Not logined
            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_rsmc_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_rsmc_temp_address_private_key").val(result.result.wif);
            $("#curr_rsmc_temp_address_pub_key").attr("class", "input input_color");
            $("#curr_rsmc_temp_address_private_key").attr("class", "input input_color");
            saveAddresses(result);

            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_htlc_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_htlc_temp_address_private_key").val(result.result.wif);
            $("#curr_htlc_temp_address_pub_key").attr("class", "input input_color");
            $("#curr_htlc_temp_address_private_key").attr("class", "input input_color");
            saveAddresses(result);
            break;
        
        case enumMsgType.MsgType_HTLC_SendVerifyR_45:
            if (!isLogined) return;  // Not logined
            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_htlc_temp_address_for_he1b_pub_key").val(result.result.pubkey);
            $("#curr_htlc_temp_address_for_he1b_private_key").val(result.result.wif);
            $("#curr_htlc_temp_address_for_he1b_pub_key").attr("class", "input input_color");
            $("#curr_htlc_temp_address_for_he1b_private_key").attr("class", "input input_color");
            saveAddresses(result);
            break;

        case enumMsgType.MsgType_HTLC_SendRequestCloseCurrTx_49:
            if (!isLogined) return;  // Not logined
            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_rsmc_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_rsmc_temp_address_private_key").val(result.result.wif);
            $("#curr_rsmc_temp_address_pub_key").attr("class", "input input_color");
            $("#curr_rsmc_temp_address_private_key").attr("class", "input input_color");
            saveAddresses(result);
            break;

        case enumMsgType.MsgType_HTLC_SendCloseSigned_50:
            if (!isLogined) return;  // Not logined
            result = genAddressFromMnemonic();
            if (result === '') return;
            $("#curr_rsmc_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_rsmc_temp_address_private_key").val(result.result.wif);
            $("#curr_rsmc_temp_address_pub_key").attr("class", "input input_color");
            $("#curr_rsmc_temp_address_private_key").attr("class", "input input_color");
            saveAddresses(result);
            break;
    }
}

// display Approval Checkbox
function displayApprovalCheckbox(content_div, obj, msgType) {

    createElement(content_div, 'text', 'Approval ');
    var element = document.createElement('input');
    switch (msgType) {
        case enumMsgType.MsgType_SendChannelAccept_33:
            element.id = 'checkbox_n33';
            break;
        case enumMsgType.MsgType_FundingSign_SendBtcSign_350:
            element.id = 'checkbox_n3500';
            break;
        // case enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35:
        //     element.id = 'checkbox_n35';
        //     break;
        case enumMsgType.MsgType_CommitmentTxSigned_SendRevokeAndAcknowledgeCommitmentTransaction_352:
            element.id = 'checkbox_n352';
            break;
        // case enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41:
        //     element.id = 'checkbox_n41';
        //     break;
        case enumMsgType.MsgType_SendCloseChannelSign_39:
            element.id = 'checkbox_n39';
            break;
    }

    element.type = 'checkbox';
    element.defaultChecked = true;
    element.setAttribute('onclick', 'clickApproval(this)');
    content_div.append(element);
}

// 
function clickApproval(obj) {
    // console.info('clickApproval checked = ' + obj.checked);
    switch (obj.id) {
        case 'checkbox_n33':
            if (obj.checked) {
                $("#funding_pubkey").show();
                $("#funding_pubkeySel").show();
                $("#funding_pubkeyCre").show();
            } else {
                $("#funding_pubkey").hide();
                $("#funding_pubkeySel").hide();
                $("#funding_pubkeyCre").hide();
            }
            break;

        case 'checkbox_n3500':
            if (obj.checked) {
                $("#channel_address_private_key").show();
                $("#channel_address_private_keyDis").show();
                // $("#funding_txid").show();
                // $("#funding_txidGet").show();
            } else {
                $("#channel_address_private_key").hide();
                $("#channel_address_private_keyDis").hide();
                // $("#funding_txid").hide();
                // $("#funding_txidGet").hide();
            }
            break;

        // case 'checkbox_n35':
        //     if (obj.checked) {
        //         $("#fundee_channel_address_private_key").show();
        //         $("#fundee_channel_address_private_keyDis").show();
        //     } else {
        //         $("#fundee_channel_address_private_key").hide();
        //         $("#fundee_channel_address_private_keyDis").hide();
        //     }
        //     break;

        case 'checkbox_n352':
            if (obj.checked) {
                $("#curr_temp_address_pub_key").show();
                $("#curr_temp_address_pub_keySel").show();
                $("#curr_temp_address_private_key").show();
                $("#curr_temp_address_private_keySel").show();
                $("#last_temp_address_private_key").show();
                $("#last_temp_address_private_keyDis").show();
                $("#channel_address_private_key").show();
                $("#channel_address_private_keyDis").show();
            } else {
                $("#curr_temp_address_pub_key").hide();
                $("#curr_temp_address_pub_keySel").hide();
                $("#curr_temp_address_private_key").hide();
                $("#curr_temp_address_private_keySel").hide();
                $("#last_temp_address_private_key").hide();
                $("#last_temp_address_private_keyDis").hide();
                $("#channel_address_private_key").hide();
                $("#channel_address_private_keyDis").hide();
            }
            break;

        // case 'checkbox_n41':
        //     if (obj.checked) {
        //         $("#curr_rsmc_temp_address_pub_key").show();
        //         $("#curr_rsmc_temp_address_pub_keySel").show();
        //         $("#curr_rsmc_temp_address_private_key").show();
        //         $("#curr_rsmc_temp_address_private_keySel").show();
        //         $("#curr_htlc_temp_address_pub_key").show();
        //         $("#curr_htlc_temp_address_pub_keySel").show();
        //         $("#curr_htlc_temp_address_private_key").show();
        //         $("#curr_htlc_temp_address_private_keySel").show();
        //         $("#last_temp_address_private_key").show();
        //         $("#last_temp_address_private_keyDis").show();
        //         $("#channel_address_private_key").show();
        //         $("#channel_address_private_keyDis").show();
        //     } else {
        //         $("#curr_rsmc_temp_address_pub_key").hide();
        //         $("#curr_rsmc_temp_address_pub_keySel").hide();
        //         $("#curr_rsmc_temp_address_private_key").hide();
        //         $("#curr_rsmc_temp_address_private_keySel").hide();
        //         $("#curr_htlc_temp_address_pub_key").hide();
        //         $("#curr_htlc_temp_address_pub_keySel").hide();
        //         $("#curr_htlc_temp_address_private_key").hide();
        //         $("#curr_htlc_temp_address_private_keySel").hide();
        //         $("#last_temp_address_private_key").hide();
        //         $("#last_temp_address_private_keyDis").hide();
        //         $("#channel_address_private_key").hide();
        //         $("#channel_address_private_keyDis").hide();
        //     }
        //     break;

        case 'checkbox_n39':
            if (obj.checked) {
                $("#request_close_channel_hash").show();
                $("#request_close_channel_hashDis").show();
            } else {
                $("#request_close_channel_hash").hide();
                $("#request_close_channel_hashDis").hide();
            }
            break;
    }
}

//
function showTooltip(content, parent, imgPath) {
    var div_help = document.createElement('div');
    div_help.setAttribute('class', 'wrapper');

    var help = document.createElement('img');
    help.setAttribute('class', 'btn_help');
    help.setAttribute('src', 'doc/tooltip/help.png');
    help.setAttribute('alt', 'help');
    div_help.append(help);

    var div_tooltip = document.createElement('div');
    div_tooltip.setAttribute('class', 'tooltip_help');

    var tooltip = document.createElement('label');
    tooltip.innerText = content;
    div_tooltip.append(tooltip);

    if (imgPath) {
        createElement(div_tooltip, 'p');
        let img = document.createElement('img');
        img.setAttribute('src', imgPath);
        div_tooltip.append(img);
    }
    
    div_help.append(div_tooltip);
    parent.append(div_help);
}

// create parameter of each API.
function createParamOfAPI(arrParams, content_div) {

    let input_box;
    
    for (let i = 0; i < arrParams.length; i++) {
        
        let parent = document.createElement('div');
        parent.setAttribute('class', 'parent_div');

        // Show tooltip.
        if (arrParams[i].help) {
            showTooltip(arrParams[i].help, parent, arrParams[i].imgPath);
        }

        let div_other = document.createElement('div');

        // create [param_title] element
        createElement(div_other, 'text', arrParams[i].name + ' : ', 'param');

        // create [input box of param] element
        input_box = document.createElement('input');    
        input_box.id = arrParams[i].name;

        if (arrParams[i].name === 'NodeAddress') {
            input_box.setAttribute('class', 'input_node_url');
        } else {
            input_box.setAttribute('class', 'input');
        }

        div_other.append(input_box);
        createButtonOfParam(arrParams, i, div_other);
        createElement(div_other, 'p');
        parent.append(div_other);
        content_div.append(parent);
    }
}

// create button of parameter
function createButtonOfParam(arrParams, index, content_div) {

    var innerText, invokeFunc;
    var arrButtons = arrParams[index].buttons;

    for (let i = 0; i < arrButtons.length; i++) {
        innerText = arrButtons[i].innerText;
        invokeFunc = arrButtons[i].onclick;

        // create [button] element
        var button = document.createElement('button');
        button.id = arrParams[index].name + innerText.substring(0, 3);
        button.innerText = innerText;
        button.setAttribute('class', 'button button_small');
        button.setAttribute('onclick', invokeFunc);
        content_div.append(button);
    }
}

// 
function createInvokeAPIButton(obj) {
    // get [content] div
    var content_div = $("#name_req_div");

    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    createElement(newDiv, 'p');

    // create [Send button] element
    var button = document.createElement('button');
    // button.id = 'send_button';
    button.setAttribute('type_id', obj.getAttribute("type_id"));
    button.setAttribute('class', 'button');
    button.setAttribute('onclick', 'invokeAPIs(this)');
    button.innerText = 'Invoke API';
    newDiv.append(button);
    content_div.append(newDiv);
}

//----------------------------------------------------------------
// 
function displayCustomMode() {
    removeNameReqDiv();
    historyCustomInNewHtml();
}

// 
function displayConnectOBD() {
    removeNameReqDiv();
    createConnectNodeDiv();
    afterConnectOBD();
}

// remove name and request Div
function removeNameReqDiv() {
    $("#name_req_div").remove();
    $("#tracker_div").remove();
    var name_req_div = document.createElement('div');
    name_req_div.id = "name_req_div";
    $("#content").append(name_req_div);
}

// 
function removeInvokeHistoryDiv() {
    $("#invoke_history").remove();
    var div = document.createElement('div');
    div.id = "invoke_history";
    $("#menu").append(div);
}

// 
function removeTrackerDiv() {
    $("#name_req_div").remove();
    $("#tracker_div").remove();
    var div = document.createElement('div');
    div.id = "tracker_div";
    $("#content").append(div);
}

// 
function createConnectNodeDiv(isCustom) {
    // var content_div = $("#name_req_div");

    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    // create [title] element
    var title = document.createElement('div');
    title.setAttribute('class', 'panelTitle');
    createElement(title, 'h2', 'OBD Node');
    newDiv.append(title);

    // create [input title] element
    createElement(newDiv, 'text', 'Node Address: ');

    // create [input] element
    var nodeAddress = document.createElement('input');
    nodeAddress.id = 'NodeAddress';
    nodeAddress.setAttribute('class', 'input_conn_node');
    nodeAddress.placeholder = 'Please input Node URL.';
    nodeAddress.value = getNewestConnOBD();
    newDiv.append(nodeAddress);

    // create [button] element
    var button = document.createElement('button');
    button.id = 'button_connect';
    button.setAttribute('class', 'button button_small');

    if (isCustom === 'custom') {
        button.setAttribute('onclick', 'connectOBDInCustomMode()');
    } else {
        button.setAttribute('onclick', 'connectOBD()');
    }
    
    button.innerText = 'Connect';
    newDiv.append(button);
    
    $("#name_req_div").append(newDiv);
}

// 
function afterConnectOBD() {
    // already connected
    if (isConnectToOBD === true) {
        changeConnectButtonStatus();
        createElement($("#name_req_div"), 'h3', 'Already connected. ' + 
            'Please refresh the page if you want to connect again.');
    } else {
        displayOBDConnectHistory();
    }
}

// create Div
function createCustomModeDiv() {

    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    // create [title] element
    var title = document.createElement('div');
    title.setAttribute('class', 'panelTitle');
    createElement(title, 'h2', 'Request');
    newDiv.append(title);

    // create [send button] element
    var btnSend = document.createElement('button');
    btnSend.setAttribute('class', 'button button_request');
    btnSend.setAttribute('onclick', 'sendCustomRequest()');
    btnSend.innerText = 'Send';
    newDiv.append(btnSend);

    // create [clear button] element
    var btnClear = document.createElement('button');
    btnClear.setAttribute('class', 'button button_request button_clear_cq');
    btnClear.setAttribute('onclick', 'clearCustomRequest()');
    btnClear.innerText = 'Clear';
    newDiv.append(btnClear);

    //
    var request = document.createElement('textarea');
    request.id = 'custom_request';
    request.setAttribute('class', 'custom_textarea');
    request.setAttribute('cols', '70');
    request.setAttribute('rows', '20');
    request.placeholder = 'Input custom request infomation. (type protocol)';
    newDiv.append(request);

    $("#name_req_div").append(newDiv);
}

// 
function clearOBDMsg() {
    // Clear array
    arrObdMsg.splice(0, arrObdMsg.length);
    $("#obd_messages").html("");
}

// 
function connectOBD() {
    var nodeAddress = $("#NodeAddress").val();

    if (nodeAddress.trim().length === 0) {
        alert('Please input Node Address.');
        return;
    }

    obdApi.connectToServer(nodeAddress, function(response) {
        console.info('connectOBD - OBD Response = ' + response);

        $("#status").text("Connected");
        $("#status_tooltip").text("Connected to " + nodeAddress);
        isConnectToOBD = true; // already connected.

        createOBDResponseDiv(response, 'connect_node_resp');
        changeConnectButtonStatus();
        saveOBDConnectHistory(nodeAddress);
        $("#history_div").remove();

    }, function(globalResponse) {
        displayOBDMessages(globalResponse);
    });
}

// 
function connectOBDInCustomMode() {
    var nodeAddress = $("#NodeAddress").val();
    if (nodeAddress.trim().length === 0) {
        alert('Please input Node Address.');
        return;
    }

    obdApi.connectToServer(nodeAddress, function(response) {
        console.info('connectOBDInCustomMode - OBD Response = ' + response);
        $("#status").text("Connected");
        $("#status_tooltip").text("Connected to " + nodeAddress);

        // isConnectToOBD = true; // already connected.
        // createOBDResponseDiv(response, 'connect_node_resp');
        changeConnectButtonStatus();
        saveOBDConnectHistory(nodeAddress);
        historyInCustom();

    }, function(globalResponse) {
        displayOBDMessages(globalResponse);
    });
}

//
function changeConnectButtonStatus() {
    // $("#button_connect").remove();
    var button = $("#button_connect");
    button.text("Disconnect");
    button.attr('class', 'button_small disabled');
    button.attr("disabled", "disabled");

    $("#NodeAddress").attr("class", "input_conn_node disabled");
    $("#NodeAddress").attr("disabled", "disabled");
}

// create OBD Response Div 
function createOBDResponseDiv(response, msgType) {

    $("#newDiv").remove();
    $("#obd_response_div").remove();

    var newDiv = document.createElement('div');
    newDiv.id = "newDiv";
    newDiv.setAttribute('class', 'panelItem');

    var obd_response_div = document.createElement('div');
    obd_response_div.id = "obd_response_div";

    // create [title] element
    var title = document.createElement('div');
    title.setAttribute('class', 'panelTitle');
    createElement(title, 'h2', 'Messages');
    newDiv.append(title);

    newDiv.append(obd_response_div);
    $("#name_req_div").append(newDiv);

    switch (msgType) {
        case 'connect_node_resp':
            var msg = response + '. Please refresh the page if you want to connect again.';
            createElement(obd_response_div, 'p', msg);
            break;
        case enumMsgType.MsgType_Core_Omni_Getbalance_2112:
            parseData1200(response);
            break;
        case enumMsgType.MsgType_Core_Omni_GetProperty_2119:
            parseData1207(response);
            break;
        case enumMsgType.MsgType_CommitmentTx_AllBRByChanId_3208:
            parseDataN35109(response);
            break;
        case enumMsgType.MsgType_GetChannelInfoByChannelId_3154:
            parseDataN3207(response);
            break;
        case enumMsgType.MsgType_ChannelOpen_AllItem_3150:
            parseDataN3202(response);
            break;
        case enumMsgType.MsgType_CommitmentTx_ItemsByChanId_3200:
            parseDataN35101(response);
            break;
        case enumMsgType.MsgType_CommitmentTx_LatestCommitmentTxByChanId_3203:
            parseDataN35104(response);
            break;
        case enumMsgType.MsgType_Mnemonic_CreateAddress_3000:
        case enumMsgType.MsgType_Mnemonic_GetAddressByIndex_3001:
            parseDataN200(response);
            break;
        case enumMsgType.MsgType_SendChannelOpen_32:
            parseDataN32(response);
            break;
        case enumMsgType.MsgType_SendChannelAccept_33:
            parseDataN33(response);
            break;
        case enumMsgType.MsgType_Core_FundingBTC_2109:
            parseData1009(response);
            break;
        case enumMsgType.MsgType_FundingCreate_SendBtcFundingCreated_340:
            parseDataN3400(response);
            break;
        case enumMsgType.MsgType_FundingSign_SendBtcSign_350:
            parseDataN3500(response);
            break;
        case enumMsgType.MsgType_Core_Omni_FundingAsset_2120:
            parseData2001(response);
            break;
        case enumMsgType.MsgType_FundingCreate_SendAssetFundingCreated_34:
            parseDataN34(response);
            break;
        case enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35:
            parseDataN35(response);
            break;
        case enumMsgType.MsgType_CommitmentTx_SendCommitmentTransactionCreated_351:
            parseDataN351(response);
            break;
        case enumMsgType.MsgType_CommitmentTxSigned_SendRevokeAndAcknowledgeCommitmentTransaction_352:
            parseDataN352(response);
            break;
        case enumMsgType.MsgType_HTLC_Invoice_402:
            parseDataN4003(response);
            break;
        case enumMsgType.MsgType_HTLC_FindPath_401:
            parseDataN4001(response);
            break;
        case enumMsgType.MsgType_HTLC_SendAddHTLC_40:
            parseDataN40(response);
            break;
        case enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41:
            parseDataN41(response);
            break;
        case enumMsgType.MsgType_HTLC_SendVerifyR_45:
            parseDataN45(response);
            break;
        case enumMsgType.MsgType_HTLC_SendSignVerifyR_46:
            parseDataN46(response);
            break;
        case enumMsgType.MsgType_HTLC_SendRequestCloseCurrTx_49:
            parseDataN49(response);
            break;
        case enumMsgType.MsgType_HTLC_SendCloseSigned_50:
            parseDataN50(response);
            break;
        case enumMsgType.MsgType_SendCloseChannelRequest_38:
            parseDataN38(response);
            break;
        case enumMsgType.MsgType_SendCloseChannelSign_39:
            parseDataN39(response);
            break;
        case enumMsgType.MsgType_Atomic_SendSwap_80:
            parseDataN80(response);
            break;
        case enumMsgType.MsgType_Atomic_SendSwapAccept_81:
            parseDataN81(response);
            break;
        case enumMsgType.MsgType_UserLogin_2001:
            parseData1(response);
            break;
        case enumMsgType.MsgType_p2p_ConnectPeer_2003:
            parseData3(response);
            break;
        default:
            createElement(obd_response_div, 'p', response);
            break;
    }
}

//----------------------------------------------------------------
// Functions of processing each response from invoke APIs.

// parseData3 - 
function parseData3(response) {
    var arrData = [
        'Connect success.',
    ];

    for (let i = 0; i < arrData.length; i++) {
        createElement(obd_response_div, 'p', arrData[i], 'responseText');
    }
}

// parseData1 - 
function parseData1(response) {
    if (isLogined) {
        var arrData = [
            'Status : ' + response,
        ];
    } else {
        // var arrData = [
        //     'NodeAddress : ' + response.nodeAddress,
        //     'NodePeerID : '  + response.nodePeerId,
        //     'UserPeerID : '     + response.userPeerId,
        // ];
    }

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN81 - 
function parseDataN81(response) {
    var arrData = [
        // 'channel_id : ' + response.channel_id,
        // 'request_close_channel_hash : ' + response.request_close_channel_hash,
    ];

    for (let i = 0; i < arrData.length; i++) {
        createElement(obd_response_div, 'p', arrData[i]);
    }
}

// parseDataN80 - 
function parseDataN80(response) {
    var arrData = [
        // 'channel_id : ' + response.channel_id,
        // 'request_close_channel_hash : ' + response.request_close_channel_hash,
    ];

    for (let i = 0; i < arrData.length; i++) {
        createElement(obd_response_div, 'p', arrData[i]);
    }
}

// parseData1200 - 
function parseData1200(response) {

    var arrData;

    createElement(obd_response_div, 'p', 'Total Count = ' + response.length);

    for (let i = 0; i < response.length; i++) {
        arrData = [
            'balance : ' + response[i].balance,
            'frozen : ' + response[i].frozen,
            'name : ' + response[i].name,
            'propertyid : ' + response[i].propertyid,
            'reserved : ' + response[i].reserved,
        ];
        
        createElement(obd_response_div, 'h4', 'NO. ' + (i + 1), 'responseText');

        for (let i2 = 0; i2 < arrData.length; i2++) {
            var point   = arrData[i2].indexOf(':') + 1;
            var title   = arrData[i2].substring(0, point);
            var content = arrData[i2].substring(point);
            createElement(obd_response_div, 'text', title);
            createElement(obd_response_div, 'p', content, 'responseText');
        }
    }
}

// parseData1207 - 
function parseData1207(response) {
    var arrData = [
        'propertyid : ' + response.propertyid,
        'name : ' + response.name,
        'totaltokens : ' + response.totaltokens,
        'issuer : ' + response.issuer,
        'category : ' + response.category,
        'subcategory : ' + response.subcategory,
        'creationtxid : ' + response.creationtxid,
        'data : ' + response.data,
        'divisible : ' + response.divisible,
        'fixedissuance : ' + response.fixedissuance,
        'managedissuance : ' + response.managedissuance,
        'url : ' + response.url,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN3207 - 
function parseDataN3207(response) {
    var arrData = [
        'accept_at : ' + response.accept_at,
        'address_a : ' + response.address_a,
        'address_b : ' + response.address_b,
        'chain_hash : ' + response.chain_hash,
        'channel_address : ' + response.channel_address,
        'channel_address_redeem_script : ' + response.channel_address_redeem_script,
        'channel_address_script_pub_key : ' + response.channel_address_script_pub_key,
        'channel_id : ' + response.channel_id,
        'channel_reserve_satoshis : ' + response.channel_reserve_satoshis,
        'close_at : ' + response.close_at,
        'create_at : ' + response.create_at,
        'create_by : ' + response.create_by,
        'curr_state : ' + response.curr_state,
        'delayed_payment_base_point : ' + response.delayed_payment_base_point,
        'dust_limit_satoshis : ' + response.dust_limit_satoshis,
        'fee_rate_per_kw : ' + response.fee_rate_per_kw,
        'funding_address : ' + response.funding_address,
        'funding_pubkey : ' + response.funding_pubkey,
        'funding_satoshis : ' + response.funding_satoshis,
        'htlc_base_point : ' + response.htlc_base_point,
        'htlc_minimum_msat : ' + response.htlc_minimum_msat,
        'id : ' + response.id,
        'max_accepted_htlcs : ' + response.max_accepted_htlcs,
        'max_htlc_value_in_flight_msat : ' + response.max_htlc_value_in_flight_msat,
        'payment_base_point : ' + response.payment_base_point,
        'peer_id_a : ' + response.peer_id_a,
        'peer_id_b : ' + response.peer_id_b,
        'property_id : ' + response.property_id,
        'pub_key_a : ' + response.pub_key_a,
        'pub_key_b : ' + response.pub_key_b,
        'push_msat : ' + response.push_msat,
        'revocation_base_point : ' + response.revocation_base_point,
        'temporary_channel_id : ' + response.temporary_channel_id,
        'to_self_delay : ' + response.to_self_delay,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN3202 - 
function parseDataN3202(response) {

    var arrData;

    createElement(obd_response_div, 'p', 'Total Count = ' + response.count);

    for (let i = 0; i < response.body.length; i++) {
        arrData = [
            'accept_at : ' + response.body[i].accept_at,
            'address_a : ' + response.body[i].address_a,
            'address_b : ' + response.body[i].address_b,
            'chain_hash : ' + response.body[i].chain_hash,
            'channel_address : ' + response.body[i].channel_address,
            'channel_address_redeem_script : ' + response.body[i].channel_address_redeem_script,
            'channel_address_script_pub_key : ' + response.body[i].channel_address_script_pub_key,
            'channel_id : ' + response.body[i].channel_id,
            'channel_reserve_satoshis : ' + response.body[i].channel_reserve_satoshis,
            'close_at : ' + response.body[i].close_at,
            'create_at : ' + response.body[i].create_at,
            'create_by : ' + response.body[i].create_by,
            'curr_state : ' + response.body[i].curr_state,
            'delayed_payment_base_point : ' + response.body[i].delayed_payment_base_point,
            'dust_limit_satoshis : ' + response.body[i].dust_limit_satoshis,
            'fee_rate_per_kw : ' + response.body[i].fee_rate_per_kw,
            'funding_address : ' + response.body[i].funding_address,
            'funding_pubkey : ' + response.body[i].funding_pubkey,
            'funding_satoshis : ' + response.body[i].funding_satoshis,
            'htlc_base_point : ' + response.body[i].htlc_base_point,
            'htlc_minimum_msat : ' + response.body[i].htlc_minimum_msat,
            'id : ' + response.body[i].id,
            'max_accepted_htlcs : ' + response.body[i].max_accepted_htlcs,
            'max_htlc_value_in_flight_msat : ' + response.body[i].max_htlc_value_in_flight_msat,
            'payment_base_point : ' + response.body[i].payment_base_point,
            'peer_id_a : ' + response.body[i].peer_id_a,
            'peer_id_b : ' + response.body[i].peer_id_b,
            'property_id : ' + response.body[i].property_id,
            'pub_key_a : ' + response.body[i].pub_key_a,
            'pub_key_b : ' + response.body[i].pub_key_b,
            'push_msat : ' + response.body[i].push_msat,
            'revocation_base_point : ' + response.body[i].revocation_base_point,
            'temporary_channel_id : ' + response.body[i].temporary_channel_id,
            'to_self_delay : ' + response.body[i].to_self_delay,
        ];

        createElement(obd_response_div, 'h4', 'NO. ' + (i + 1));

        for (let i2 = 0; i2 < arrData.length; i2++) {
            var point   = arrData[i2].indexOf(':') + 1;
            var title   = arrData[i2].substring(0, point);
            var content = arrData[i2].substring(point);
            createElement(obd_response_div, 'text', title);
            createElement(obd_response_div, 'p', content, 'responseText');
        }
    }
}

// parseDataN35109 - 
function parseDataN35109(response) {

    var arrData;

    createElement(obd_response_div, 'p', 'Total Count = ' + response.length);

    for (let i = 0; i < response.length; i++) {
        arrData = [
            'channel_id : ' + response[i].channel_id,
            'amount : ' + response[i].amount,
            'commitment_tx_id : ' + response[i].commitment_tx_id,
            'create_at : ' + response[i].create_at,
            'create_by : ' + response[i].create_by,
            'curr_state : ' + response[i].curr_state,
            'id : ' + response[i].id,
            'input_amount : ' + response[i].input_amount,
            'input_txid : ' + response[i].input_txid,
            'input_vout : ' + response[i].input_vout,
            'last_edit_time : ' + response[i].last_edit_time,
            'owner : ' + response[i].owner,
            'peer_id_a : ' + response[i].peer_id_a,
            'peer_id_b : ' + response[i].peer_id_b,
            'property_id : ' + response[i].property_id,
            'send_at : ' + response[i].send_at,
            'sign_at : ' + response[i].sign_at,
            'transaction_sign_hex : ' + response[i].transaction_sign_hex,
            'txid : ' + response[i].txid,
        ];

        createElement(obd_response_div, 'h4', 'NO. ' + (i + 1));

        for (let i2 = 0; i2 < arrData.length; i2++) {
            var point   = arrData[i2].indexOf(':') + 1;
            var title   = arrData[i2].substring(0, point);
            var content = arrData[i2].substring(point);
            createElement(obd_response_div, 'text', title);
            createElement(obd_response_div, 'p', content, 'responseText');
        }
    }
}

// parseDataN35101 - 
function parseDataN35101(response) {

    var arrData;

    createElement(obd_response_div, 'p', 'Total Count = ' + response.totalCount);

    for (let i = 0; i < response.body.length; i++) {
        arrData = [
            'channel_id : ' + response.body[i].channel_id,
            'amount_to_htlc : ' + response.body[i].amount_to_htlc,
            'amount_to_counterparty : ' + response.body[i].amount_to_counterparty,
            'amount_to_rsmc : ' + response.body[i].amount_to_rsmc,
            'create_at : ' + response.body[i].create_at,
            'create_by : ' + response.body[i].create_by,
            'curr_hash : ' + response.body[i].curr_hash,
            'curr_state : ' + response.body[i].curr_state,
            'htlc_h : ' + response.body[i].htlc_h,
            'htlc_multi_address : ' + response.body[i].htlc_multi_address,
            'htlc_multi_address_script_pub_key : ' + response.body[i].htlc_multi_address_script_pub_key,
            'htlc_r : ' + response.body[i].htlc_r,
            'htlc_redeem_script : ' + response.body[i].htlc_redeem_script,
            'htlc_sender : ' + response.body[i].htlc_sender,
            'htlc_temp_address_pub_key : ' + response.body[i].htlc_temp_address_pub_key,
            'htlc_tx_hash : ' + response.body[i].htlc_tx_hash,
            'htlc_txid : ' + response.body[i].htlc_txid,
            'id : ' + response.body[i].id,
            'input_amount : ' + response.body[i].input_amount,
            'input_txid : ' + response.body[i].input_txid,
            'input_vout : ' + response.body[i].input_vout,
            'last_commitment_tx_id : ' + response.body[i].last_commitment_tx_id,
            'last_edit_time : ' + response.body[i].last_edit_time,
            'last_hash : ' + response.body[i].last_hash,
            'owner : ' + response.body[i].owner,
            'peer_id_a : ' + response.body[i].peer_id_a,
            'peer_id_b : ' + response.body[i].peer_id_b,
            'property_id : ' + response.body[i].property_id,
            'rsmc_multi_address : ' + response.body[i].rsmc_multi_address,
            'rsmc_multi_address_script_pub_key : ' + response.body[i].rsmc_multi_address_script_pub_key,
            'rsmc_redeem_script : ' + response.body[i].rsmc_redeem_script,
            'rsmc_temp_address_pub_key : ' + response.body[i].rsmc_temp_address_pub_key,
            'rsmc_tx_hash : ' + response.body[i].rsmc_tx_hash,
            'rsmc_txid : ' + response.body[i].rsmc_txid,
            'send_at : ' + response.body[i].send_at,
            'sign_at : ' + response.body[i].sign_at,
            'to_other_tx_hash : ' + response.body[i].to_other_tx_hash,
            'to_other_txid : ' + response.body[i].to_other_txid,
            'tx_type : ' + response.body[i].tx_type,
        ];

        createElement(obd_response_div, 'h4', 'NO. ' + (i + 1));

        for (let i2 = 0; i2 < arrData.length; i2++) {
            var point   = arrData[i2].indexOf(':') + 1;
            var title   = arrData[i2].substring(0, point);
            var content = arrData[i2].substring(point);
            createElement(obd_response_div, 'text', title);
            createElement(obd_response_div, 'p', content, 'responseText');
        }
    }
}

// parseDataN35104 - 
function parseDataN35104(response) {
    var arrData = [
        'channel_id : ' + response.channel_id,
        'id : ' + response.id,
        'property_id : ' + response.property_id,
        'input_amount : ' + response.input_amount,
        'amount_to_rsmc : ' + response.amount_to_rsmc,
        'amount_to_counterparty : ' + response.amount_to_counterparty,
        'amount_to_htlc : ' + response.amount_to_htlc,
        'owner : ' + response.owner,
        'peer_id_a : ' + response.peer_id_a,
        'peer_id_b : ' + response.peer_id_b,
        'create_at : ' + response.create_at,
        'create_by : ' + response.create_by,
        'curr_hash : ' + response.curr_hash,
        'curr_state : ' + response.curr_state,
        'htlc_h : ' + response.htlc_h,
        'htlc_multi_address : ' + response.htlc_multi_address,
        'htlc_multi_address_script_pub_key : ' + response.htlc_multi_address_script_pub_key,
        'htlc_r : ' + response.htlc_r,
        'htlc_redeem_script : ' + response.htlc_redeem_script,
        'htlc_sender : ' + response.htlc_sender,
        'htlc_temp_address_pub_key : ' + response.htlc_temp_address_pub_key,
        'htlc_tx_hex : ' + response.htlc_tx_hex,
        'htlc_txid : ' + response.htlc_txid,
        'input_txid : ' + response.input_txid,
        'input_vout : ' + response.input_vout,
        'last_commitment_tx_id : ' + response.last_commitment_tx_id,
        'last_edit_time : ' + response.last_edit_time,
        'last_hash : ' + response.last_hash,
        'rsmc_multi_address : ' + response.rsmc_multi_address,
        'rsmc_multi_address_script_pub_key : ' + response.rsmc_multi_address_script_pub_key,
        'rsmc_redeem_script : ' + response.rsmc_redeem_script,
        'rsmc_temp_address_pub_key : ' + response.rsmc_temp_address_pub_key,
        'rsmc_tx_hex : ' + response.rsmc_tx_hex,
        'rsmc_txid : ' + response.rsmc_txid,
        'send_at : ' + response.send_at,
        'sign_at : ' + response.sign_at,
        'to_other_tx_hex : ' + response.to_other_tx_hex,
        'to_other_txid : ' + response.to_other_txid,
        'tx_type : ' + response.tx_type,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN39 - 
function parseDataN39(response) {
    var arrData = [
        'channel_id : ' + response.channel_id,
        'request_close_channel_hash : ' + response.request_close_channel_hash,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN38 - 
function parseDataN38(response) {
    var arrData = [
        'channel_id : ' + response.channel_id,
        'request_close_channel_hash : ' + response.request_close_channel_hash,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN50 - 
function parseDataN50(response) {
    var arrData = [
        'msg : ' + response.msg,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN49 - 
function parseDataN49(response) {
    var arrData = [
        'channel_id : ' + response.channel_id,
        'create_at : ' + response.create_at,
        'create_by : ' + response.create_by,
        'curr_rsmc_temp_address_pub_key : ' + response.curr_rsmc_temp_address_pub_key,
        'curr_state : ' + response.curr_state,
        'id : ' + response.id,
        'request_hash : ' + response.request_hash,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN46 - 
function parseDataN46(response) {
    var arrData = [
        'r : ' + response.r,
        'request_hash : ' + response.request_hash,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN45 - 
function parseDataN45(response) {
    var arrData = [
        'h : ' + response.h,
        'request_hash : ' + response.request_hash,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN40 - 
function parseDataN40(response) {
    var arrData = [
        'channelId : ' + response.channelId,
        'amount : ' + response.amount,
        'commitmentTxHash : ' + response.commitmentTxHash,
        'currHtlcTempAddressForHt1aPubKey : ' + response.currHtlcTempAddressForHt1aPubKey,
        'currHtlcTempAddressPubKey : ' + response.currHtlcTempAddressPubKey,
        'currRsmcTempAddressPubKey : ' + response.currRsmcTempAddressPubKey,
        'h : ' + response.h,
        'htlcChannelPath : ' + response.htlcChannelPath,
        'htlcTxHex : ' + response.htlcTxHex,
        'lastTempAddressPrivateKey : ' + response.lastTempAddressPrivateKey,
        'memo : ' + response.memo,
        'rsmcTxHex : ' + response.rsmcTxHex,
        'toOtherHex : ' + response.toOtherHex,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN41 - 
function parseDataN41(response) {
    var arrData = [
        'channelId : ' + response.channelId,
        'amount : ' + response.amount,
        'htlcChannelPath : ' + response.htlcChannelPath,
        'htlcTxHex : ' + response.htlcTxHex,
        'msgHash : ' + response.msgHash,
        'rsmcTxHex : ' + response.rsmcTxHex,
        'toOtherHex : ' + response.toOtherHex,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

//
function parseDataN4001(response) {
    var arrData = [
        'channelPath : '    + response.channelPath,
        'nextNodePeerId : ' + response.nextNodePeerId,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN4003 - 
function parseDataN4003(response) {
    var arrData = [
        'recipient_user_peer_id : ' + response.recipient_user_peer_id,
        'amount : ' + response.amount,
        'property_id : ' + response.propertyId,
        'msg : ' + response.msg,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN352 - 
function parseDataN352(response) {

    var arrData = [
        'channel_id : ' + response.latestCcommitmentTxInfo.channel_id,
        'id : ' + response.latestCcommitmentTxInfo.id,
        'property_id : ' + response.latestCcommitmentTxInfo.property_id,
        'input_amount : ' + response.latestCcommitmentTxInfo.input_amount,
        'amount_to_rsmc : ' + response.latestCcommitmentTxInfo.amount_to_rsmc,
        'amount_to_counterparty : ' + response.latestCcommitmentTxInfo.amount_to_counterparty,
        'amount_to_htlc : ' + response.latestCcommitmentTxInfo.amount_to_htlc,
        'owner : ' + response.latestCcommitmentTxInfo.owner,
        'peer_id_a : ' + response.latestCcommitmentTxInfo.peer_id_a,
        'peer_id_b : ' + response.latestCcommitmentTxInfo.peer_id_b,
        'create_at : ' + response.latestCcommitmentTxInfo.create_at,
        'create_by : ' + response.latestCcommitmentTxInfo.create_by,
        'curr_hash : ' + response.latestCcommitmentTxInfo.curr_hash,
        'curr_state : ' + response.latestCcommitmentTxInfo.curr_state,
        'htlc_h : ' + response.latestCcommitmentTxInfo.htlc_h,
        'htlc_multi_address : ' + response.latestCcommitmentTxInfo.htlc_multi_address,
        'htlc_multi_address_script_pub_key : ' + response.latestCcommitmentTxInfo.htlc_multi_address_script_pub_key,
        'htlc_r : ' + response.latestCcommitmentTxInfo.htlc_r,
        'htlc_redeem_script : ' + response.latestCcommitmentTxInfo.htlc_redeem_script,
        'htlc_sender : ' + response.latestCcommitmentTxInfo.htlc_sender,
        'htlc_temp_address_pub_key : ' + response.latestCcommitmentTxInfo.htlc_temp_address_pub_key,
        'htlc_tx_hex : ' + response.latestCcommitmentTxInfo.htlc_tx_hex,
        'htlc_txid : ' + response.latestCcommitmentTxInfo.htlc_txid,
        'input_txid : ' + response.latestCcommitmentTxInfo.input_txid,
        'input_vout : ' + response.latestCcommitmentTxInfo.input_vout,
        'last_commitment_tx_id : ' + response.latestCcommitmentTxInfo.last_commitment_tx_id,
        'last_edit_time : ' + response.latestCcommitmentTxInfo.last_edit_time,
        'last_hash : ' + response.latestCcommitmentTxInfo.last_hash,
        'rsmc_input_txid : ' + response.latestCcommitmentTxInfo.rsmc_input_txid,
        'rsmc_multi_address : ' + response.latestCcommitmentTxInfo.rsmc_multi_address,
        'rsmc_multi_address_script_pub_key : ' + response.latestCcommitmentTxInfo.rsmc_multi_address_script_pub_key,
        'rsmc_redeem_script : ' + response.latestCcommitmentTxInfo.rsmc_redeem_script,
        'rsmc_temp_address_pub_key : ' + response.latestCcommitmentTxInfo.rsmc_temp_address_pub_key,
        'rsmc_tx_hex : ' + response.latestCcommitmentTxInfo.rsmc_tx_hex,
        'rsmc_txid : ' + response.latestCcommitmentTxInfo.rsmc_txid,
        'send_at : ' + response.latestCcommitmentTxInfo.send_at,
        'sign_at : ' + response.latestCcommitmentTxInfo.ign_at,
        'to_other_tx_hex : ' + response.latestCcommitmentTxInfo.to_other_tx_hex,
        'to_other_txid : ' + response.latestCcommitmentTxInfo.to_other_txid,
        'tx_type : ' + response.latestCcommitmentTxInfo.tx_type,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN351 - 
function parseDataN351(response) {
    var arrData = [
        // TO BOB INFO
        // 'channelId : ' + response.channelId,
        // 'amount : ' + response.amount,
        // 'msgHash : ' + response.msgHash,
        // 'rsmcHex : ' + response.rsmcHex,
        // 'toOtherHex : ' + response.toOtherHex,
        
        // ALICE LOOK INFO
        'channelId : ' + response.channelId,
        'amount : ' + response.amount,
        'commitmentHash : ' + response.commitmentHash,
        'currTempAddressPubKey : ' + response.currTempAddressPubKey,
        'lastTempAddressPrivateKey : ' + response.lastTempAddressPrivateKey,
        'rsmcHex : ' + response.rsmcHex,
        'toOtherHex : ' + response.toOtherHex,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN34 - 
function parseDataN34(response) {
    var arrData = [
        'channel_id : ' + response.channel_id,
        'temporary_channel_id : ' + response.temporary_channel_id,
        'c1a_rsmc_hex : ' + response.c1a_rsmc_hex,
        'funding_omni_hex : ' + response.funding_omni_hex,
        'rsmc_temp_address_pub_key : ' + response.rsmc_temp_address_pub_key,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN35 - 
function parseDataN35(response) {
    var arrData = [
        'channel_id : ' + response.channel_id,
        'rd_hex : ' + response.rd_hex,
        'rsmc_signed_hex : ' + response.rsmc_signed_hex,
        'approval : ' + response.approval,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN2001 - 
function parseData2001(response) {
    var arrData = [
        'hex : ' + response.hex,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN3500 - 
function parseDataN3500(response) {
    var arrData = [
        // 'channel_id : ' + response.channel_id,
        // 'temporary_channel_id : ' + response.temporary_channel_id,
        // 'create_at : ' + response.create_at,
        // 'id : ' + response.id,
        // 'owner : ' + response.owner,
        // 'txid : ' + response.txid,
        // 'tx_hash : ' + response.tx_hash,

        'approval : ' + response.approval,
        'funding_redeem_hex : ' + response.funding_redeem_hex,
        'funding_txid : ' + response.funding_txid,
        'temporary_channel_id : ' + response.temporary_channel_id,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN3400 - 
function parseDataN3400(response) {
    var arrData = [
        'temporary_channel_id : ' + response.temporary_channel_id,
        'funding_txid : ' + response.funding_txid,
        'funding_btc_hex : ' + response.funding_btc_hex,
        'funding_redeem_hex : ' + response.funding_redeem_hex,
        // 'amount : ' + response.amount,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseData1009 - 
function parseData1009(response) {
    var arrData = [
        'hex : ' + response.hex,
        'txid : ' + response.txid,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// parseDataN200 - genAddressFromMnemonic
function parseDataN200(response) {
    var arrData = [
        'ADDRESS : ' + response.result.address,
        'INDEX : ' + response.result.index,
        'PUB_KEY : ' + response.result.pubkey,
        'WIF : ' + response.result.wif
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// processing -32 openChannel data.
function parseDataN32(response) {
    var arrData = [
        'chain_hash : ' + response.chain_hash,
        'channel_reserve_satoshis : ' + response.channel_reserve_satoshis,
        'delayed_payment_base_point : ' + response.delayed_payment_base_point,
        'dust_limit_satoshis : ' + response.dust_limit_satoshis,
        'fee_rate_per_kw : ' + response.fee_rate_per_kw,
        'funding_address : ' + response.funding_address,
        'funding_pubkey : ' + response.funding_pubkey,
        'funding_satoshis : ' + response.funding_satoshis,
        'htlc_base_point : ' + response.htlc_base_point,
        'htlc_minimum_msat : ' + response.htlc_minimum_msat,
        'max_accepted_htlcs : ' + response.max_accepted_htlcs,
        'max_htlc_value_in_flight_msat : ' + response.max_htlc_value_in_flight_msat,
        'payment_base_point : ' + response.payment_base_point,
        'push_msat : ' + response.push_msat,
        'revocation_base_point : ' + response.revocation_base_point,
        'temporary_channel_id : ' + response.temporary_channel_id,
        'to_self_delay : ' + response.to_self_delay,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// processing -33 Accept Channel data.
function parseDataN33(response) {
    // curr_state = 20 is accept open channel request.
    // curr_state = 30 is NOT accept open channel request.
    var arrData = [
        'accept_at : ' + response.accept_at,
        'address_a : ' + response.address_a,
        'address_b : ' + response.address_b,
        'chain_hash : ' + response.chain_hash,
        'channel_address : ' + response.channel_address,
        'channel_address_redeem_script : ' + response.channel_address_redeem_script,
        'channel_address_script_pub_key : ' + response.channel_address_script_pub_key,
        'channel_id : ' + response.channel_id,
        'channel_reserve_satoshis : ' + response.channel_reserve_satoshis,
        'close_at : ' + response.close_at,
        'create_at : ' + response.create_at,
        'create_by : ' + response.create_by,
        'curr_state : ' + response.curr_state,
        'delayed_payment_base_point : ' + response.delayed_payment_base_point,
        'dust_limit_satoshis : ' + response.dust_limit_satoshis,
        'fee_rate_per_kw : ' + response.fee_rate_per_kw,
        'funding_address : ' + response.funding_address,
        'funding_pubkey : ' + response.funding_pubkey,
        'funding_satoshis : ' + response.funding_satoshis,
        'htlc_base_point : ' + response.htlc_base_point,
        'htlc_minimum_msat : ' + response.htlc_minimum_msat,
        'id : ' + response.id,
        'max_accepted_htlcs : ' + response.max_accepted_htlcs,
        'max_htlc_value_in_flight_msat : ' + response.max_htlc_value_in_flight_msat,
        'payment_base_point : ' + response.payment_base_point,
        'peer_id_a : ' + response.peer_id_a,
        'peer_id_b : ' + response.peer_id_b,
        'pub_key_a : ' + response.pub_key_a,
        'pub_key_b : ' + response.pub_key_b,
        'push_msat : ' + response.push_msat,
        'revocation_base_point : ' + response.revocation_base_point,
        'temporary_channel_id : ' + response.temporary_channel_id,
        'to_self_delay : ' + response.to_self_delay,
    ];

    for (let i = 0; i < arrData.length; i++) {
        var point   = arrData[i].indexOf(':') + 1;
        var title   = arrData[i].substring(0, point);
        var content = arrData[i].substring(point);
        createElement(obd_response_div, 'text', title);
        createElement(obd_response_div, 'p', content, 'responseText');
    }
}

// get a new index of address
function getNewAddrIndex() {

    var addr = JSON.parse(localStorage.getItem(itemAddr));
    // console.info('localStorage KEY  = ' + addr);

    // If has data.
    if (addr) {
        // console.info('HAS DATA');
        for (let i = 0; i < addr.result.length; i++) {
            if (userID === addr.result[i].userID) {
                maxIndex = addr.result[i].data.length - 1;
                newIndex = addr.result[i].data[maxIndex].index + 1;
                return newIndex;
            }
        }

        // A new User ID.
        return 1;

    } else {
        // console.info('FIRST DATA');
        return 1;
    }
}

/**
 * Save channelID to local storage
 * @param tempChannelID
 */
function saveTempChannelID(tempChannelID) {

    let resp = JSON.parse(localStorage.getItem(itemTempChannelID));

    // If has data.
    if (resp) {
        for (let i = 0; i < resp.result.length; i++) {
            if (userID === resp.result[i].userID) {
                resp.result[i].tempChannelID = tempChannelID;
                localStorage.setItem(itemTempChannelID, JSON.stringify(resp));
                return;
            }
        }

        // A new User ID.
        let new_data = {
            userID:  userID,
            tempChannelID: tempChannelID,
        }
        resp.result.push(new_data);
        localStorage.setItem(itemTempChannelID, JSON.stringify(resp));

    } else {
        let data = {
            result: [{
                userID:  userID,
                tempChannelID: tempChannelID,
            }]
        }
        localStorage.setItem(itemTempChannelID, JSON.stringify(data));
    }
}


/**
 * Get channelID from local storage
 */
function getTempChannelID() {

    let resp = JSON.parse(localStorage.getItem(itemTempChannelID));

    // If has data.
    if (resp) {
        for (let i = 0; i < resp.result.length; i++) {
            if (userID === resp.result[i].userID) {
                return resp.result[i].tempChannelID;
            }
        }
        return '';
    } else {
        return '';
    }
}

//
function getFundingPrivKeyFromPubKey(pubkey) {

    let addr = JSON.parse(localStorage.getItem(itemAddr));

    // If has data.
    if (addr) {
        // console.info('HAS DATA');
        for (let i = 0; i < addr.result.length; i++) {
            if (userID === addr.result[i].userID) {
                for (let j = 0; j < addr.result[i].data.length; j++) {
                    if (pubkey === addr.result[i].data[j].pubkey) {
                        return addr.result[i].data[j].wif;
                    }
                }
            }
        }
        return '';
    } else {
        return '';
    }
}

/**
 * Save temporary private key to local storage
 * @param saveKey
 * @param channelID
 * @param privkey
 */
function saveTempPrivKey(saveKey, channelID, privkey) {
    
    let addr = JSON.parse(localStorage.getItem(saveKey));

    // If has data.
    if (addr) {
        // console.info('HAS DATA');
        for (let i = 0; i < addr.result.length; i++) {
            if (userID === addr.result[i].userID) {
                for (let j = 0; j < addr.result[i].data.length; j++) {
                    if (channelID === addr.result[i].data[j].channelID) {
                        // update privkey 
                        addr.result[i].data[j].privkey = privkey;
                        localStorage.setItem(saveKey, JSON.stringify(addr));
                        return;
                    }
                }

                // A new channel id
                let new_data = {
                    channelID: channelID,
                    privkey:   privkey
                }
                addr.result[i].data.push(new_data);
                localStorage.setItem(saveKey, JSON.stringify(addr));
                return;
            }
        }

        // A new User ID.
        let new_data = {
            userID:  userID,
            data: [{
                channelID: channelID,
                privkey:   privkey
            }]
        }
        addr.result.push(new_data);
        localStorage.setItem(saveKey, JSON.stringify(addr));

    } else {
        // console.info('FIRST DATA');
        let data = {
            result: [{
                userID:  userID,
                data: [{
                    channelID: channelID,
                    privkey:   privkey
                }]
            }]
        }
        localStorage.setItem(saveKey, JSON.stringify(data));
    }
}

/**
 * Get temporary private key from local storage
 * @param saveKey
 * @param channelID
 */
function getTempPrivKey(saveKey, channelID) {
    
    let addr = JSON.parse(localStorage.getItem(saveKey));

    // If has data.
    if (addr) {
        // console.info('HAS DATA');
        for (let i = 0; i < addr.result.length; i++) {
            if (userID === addr.result[i].userID) {
                for (let j = 0; j < addr.result[i].data.length; j++) {
                    if (channelID === addr.result[i].data[j].channelID) {
                        return addr.result[i].data[j].privkey;
                    }
                }
            }
        }
        return '';
    } else {
        return '';
    }
}

// Address generated from mnemonic words save to local storage.
function saveAddresses(response) {

    let addr = JSON.parse(localStorage.getItem(itemAddr));

    // If has data.
    if (addr) {
        // console.info('HAS DATA');
        for (let i = 0; i < addr.result.length; i++) {
            if (userID === addr.result[i].userID) {
                // Add new dato to 
                let new_data = {
                    address: response.result.address,
                    index: response.result.index,
                    pubkey: response.result.pubkey,
                    wif: response.result.wif
                }
                addr.result[i].data.push(new_data);
                localStorage.setItem(itemAddr, JSON.stringify(addr));
                return;
            }
        }

        // A new User ID.
        let new_data = {
            userID: userID,
            data: [{
                address: response.result.address,
                index: response.result.index,
                pubkey: response.result.pubkey,
                wif: response.result.wif
            }]
        }
        addr.result.push(new_data);
        localStorage.setItem(itemAddr, JSON.stringify(addr));

    } else {
        // console.info('FIRST DATA');
        let data = {
            result: [{
                userID: userID,
                data: [{
                    address: response.result.address,
                    index: response.result.index,
                    pubkey: response.result.pubkey,
                    wif: response.result.wif
                }]
            }]
        }
        localStorage.setItem(itemAddr, JSON.stringify(data));
    }
}

// Record full flow channel data.
function channelData(response) {

    var data = {
        channelInfo: channelInfo,
        create_at: response.create_at,
        create_by: response.create_by,
        accept_at: response.accept_at,
        address_a: response.address_a,
        address_b: response.address_b,
        channel_address: response.channel_address,
        temporary_channel_id: response.temporary_channel_id,

        request_close_channel_hash: response.request_close_channel_hash,
        date: new Date().toLocaleString(),
    }

    return data;
}

// Depositing btc record.
function btcData(response, msgType) {
    var btc = {
        from_address: $("#from_address").val(),
        amount: $("#amount").val(),
        hex: response.hex,
        txid: response.txid,
        date: new Date().toLocaleString(),
        msgType: msgType,
    }
    return btc;
}

// transfer (HTLC) record.
function htlcData(response, msgType) {
    var data = {
        channelId: response.channelId,
        amount: response.amount,
        htlcChannelPath: response.htlcChannelPath,
        htlcTxHex: response.htlcTxHex,
        msgHash: response.msgHash,
        rsmcTxHex: response.rsmcTxHex,
        toOtherHex: response.toOtherHex,
        date: new Date().toLocaleString(),
        msgType: msgType,
    }

    return data;
}

//
function updateHtlcData(response, data, msgType) {
    data.msgType = msgType;
    data.date = new Date().toLocaleString();
    // data.msgHash = response.msgHash;
    // data.sender = response.sender;
    // data.approval = response.approval;
}

// transfer (RSMC) record.
function rsmcData(response, msgType) {
    var data = {
        channelId: response.channelId,
        amount: response.amount,
        msgHash: response.msgHash,
        rsmcHex: response.rsmcHex,
        toOtherHex: response.toOtherHex,
        date: new Date().toLocaleString(),
        msgType: msgType,
    }

    return data;
}

//
function updateRsmcData(response, data, msgType) {
    data.msgType = msgType;
    data.date = new Date().toLocaleString();

    // data.amount_to_htlc = response.amount_to_htlc;
    // data.amount_to_counterparty = response.amount_to_counterparty;
    // data.amount_to_rsmc = response.amount_to_rsmc;
    // data.rsmc_multi_address = response.rsmc_multi_address;
    // data.rsmc_txid = response.rsmc_txid;
    // data.send_at = response.send_at;
    // data.sign_at = response.sign_at;
    // data.to_other_txid = response.to_other_txid;
}

// Depositing omni assets record.
function omniAssetData(response, msgType) {
    var omniAsset = {
        from_address: $("#from_address").val(),
        amount: $("#amount").val(),
        property_id: $("#property_id").val(),
        hex: response.hex,
        date: new Date().toLocaleString(),
        msgType: msgType,

        // -34 response
        channel_id: '',
        temporary_channel_id: '',
        funding_omni_hex: '',
        rsmc_temp_address_pub_key: '',
        c1a_rsmc_hex: '',
        
        // -35 response
        approval: '',
        rd_hex: '',
        rsmc_signed_hex: '',
    }

    return omniAsset;
}

// 
function dataConstruct(response, tempChID, msgType) {
    var data;
    if (msgType) {
        data = {
            temporary_channel_id: tempChID,
            userID: userID,
            data: [channelData(response)],
            btc: [btcData(response, msgType)],
            omniAsset: [omniAssetData(response, msgType)],
            transfer: [],
            htlc: [],
        }
    } else {
        data = {
            temporary_channel_id: tempChID,
            userID: userID,
            data: [channelData(response)],
            btc: [],
            omniAsset: [],
            transfer: [],
            htlc: [],
        }
    }

    return data;
}

// 
function saveChannelList(response, channelID, msgType) {
    var chID;
    var list = JSON.parse(localStorage.getItem(itemChannelList));

    if (response.temporary_channel_id) {
        chID = response.temporary_channel_id;
    } else {
        chID = channelID;
    }

    if (list) {
        for (let i = 0; i < list.result.length; i++) {
            if (chID === list.result[i].temporary_channel_id) {
                switch (msgType) {
                    case enumMsgType.MsgType_HTLC_SendAddHTLC_40:
                        list.result[i].htlc.push(htlcData(response, msgType));
                        break;
                    case enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41:
                        for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
                            if ($("#request_hash").val() === list.result[i].htlc[i2].msgHash) {
                                updateHtlcData(response, list.result[i].htlc[i2], msgType);
                            }
                        }
                        break;
                    case enumMsgType.MsgType_HTLC_SendVerifyR_45:
                        for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
                            if ($("#request_hash").val() === list.result[i].htlc[i2].msgHash) {
                                list.result[i].htlc[i2].r = response.r;
                                list.result[i].htlc[i2].msgHash = response.msgHash;
                                list.result[i].htlc[i2].msgType = msgType;
                                list.result[i].htlc[i2].date = new Date().toLocaleString();
                            }
                        }
                        break;
                    case enumMsgType.MsgType_HTLC_SendSignVerifyR_46:
                        for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
                            if ($("#request_hash").val() === list.result[i].htlc[i2].msgHash) {
                                list.result[i].htlc[i2].msgHash = response.msgHash;
                                list.result[i].htlc[i2].msgType = msgType;
                                list.result[i].htlc[i2].date = new Date().toLocaleString();
                            }
                        }
                        break;
                    case enumMsgType.MsgType_HTLC_SendRequestCloseCurrTx_49:
                        list.result[i].htlc.push(htlcData(response, msgType));
                        break;
                    case enumMsgType.MsgType_HTLC_SendCloseSigned_50:
                        for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
                            if ($("#request_hash").val() === list.result[i].htlc[i2].msgHash) {
                                list.result[i].htlc[i2].msgType = msgType;
                                list.result[i].htlc[i2].date = new Date().toLocaleString();
                            }
                        }
                        break;
                    case enumMsgType.MsgType_CommitmentTx_SendCommitmentTransactionCreated_351:
                        list.result[i].transfer.push(rsmcData(response, msgType));
                        break;
                    case enumMsgType.MsgType_CommitmentTxSigned_SendRevokeAndAcknowledgeCommitmentTransaction_352:
                        for (let i2 = 0; i2 < list.result[i].transfer.length; i2++) {
                            if ($("#msg_hash").val() === list.result[i].transfer[i2].msgHash) {
                                updateRsmcData(response, list.result[i].transfer[i2], msgType);
                            }
                        }
                        break;
                    case enumMsgType.MsgType_Core_FundingBTC_2109:
                        list.result[i].btc.push(btcData(response, msgType));
                        break;
                    case enumMsgType.MsgType_FundingCreate_SendBtcFundingCreated_340:
                        for (let i2 = 0; i2 < list.result[i].btc.length; i2++) {
                            if (response.funding_txid === list.result[i].btc[i2].txid) {
                                list.result[i].btc[i2].msgType = msgType;
                                list.result[i].btc[i2].date = new Date().toLocaleString();
                            }
                        }
                        break;
                    case enumMsgType.MsgType_FundingSign_SendBtcSign_350:
                        for (let i2 = 0; i2 < list.result[i].btc.length; i2++) {
                            if ($("#funding_txid").val() === list.result[i].btc[i2].txid) {
                                // list.result[i].btc[i2].txid = response.txid;
                                // list.result[i].btc[i2].hex  = response.tx_hash;
                                list.result[i].btc[i2].msgType = msgType;
                                list.result[i].btc[i2].date = new Date().toLocaleString();
                            }
                        }
                        break;
                    case enumMsgType.MsgType_Core_Omni_FundingAsset_2120:
                        list.result[i].omniAsset.push(omniAssetData(response, msgType));
                        break;
                    case enumMsgType.MsgType_FundingCreate_SendAssetFundingCreated_34:
                        for (let i2 = 0; i2 < list.result[i].omniAsset.length; i2++) {
                            if ($("#funding_tx_hex").val() === list.result[i].omniAsset[i2].hex) {
                                list.result[i].temporary_channel_id = response.channel_id;
                                updateOmniAssetData(response, list.result[i].omniAsset[i2], msgType);
                            }
                        }
                        break;
                    case enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35:
                        for (let i2 = 0; i2 < list.result[i].omniAsset.length; i2++) {
                            if ($("#channel_id").val() === list.result[i].omniAsset[i2].channel_id) {
                                updateOmniAssetData(response, list.result[i].omniAsset[i2], msgType);
                            }
                        }
                        break;
                    case enumMsgType.MsgType_SendCloseChannelRequest_38:
                        if (list.result[i].data.length > 2) {
                            list.result[i].data[2].request_close_channel_hash = response.request_close_channel_hash;
                            list.result[i].data[2].date = new Date().toLocaleString();
                        } else {
                            list.result[i].data.push(channelData(response));
                        }
                        break;
                    case enumMsgType.MsgType_SendCloseChannelSign_39:
                        list.result[i].data.push(channelData(response));
                        break;
                    default:
                        list.result[i].data.push(channelData(response));
                        break;
                }

                localStorage.setItem(itemChannelList, JSON.stringify(list));
                return;
            }
        }

        // A new 
        list.result.push(dataConstruct(response, chID, msgType));
        localStorage.setItem(itemChannelList, JSON.stringify(list));

    } else {
        // console.info('FIRST DATA');
        let data = {
            result: [dataConstruct(response, chID, msgType)]
        }
        localStorage.setItem(itemChannelList, JSON.stringify(data));
    }
}

//
function updateOmniAssetData(response, data, msgType) {
    data.msgType = msgType;
    data.date = new Date().toLocaleString();
    data.channel_id = response.channel_id;

    if (msgType === enumMsgType.MsgType_FundingCreate_SendAssetFundingCreated_34) {
        data.funding_omni_hex = response.funding_omni_hex;
        data.c1a_rsmc_hex = response.c1a_rsmc_hex;
        data.rsmc_temp_address_pub_key = response.rsmc_temp_address_pub_key;
    } else if (msgType === enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35) {
        data.approval = response.approval;
        data.rd_hex = response.rd_hex;
        data.rsmc_signed_hex = response.rsmc_signed_hex;
    }
}

// mnemonic words generated with signUp api save to local storage.
function saveMnemonic(response) {

    var mnemonic = JSON.parse(sessionStorage.getItem(itemMnemonic));
    // var mnemonic = JSON.parse(localStorage.getItem(saveMnemonic));

    // If has data.
    if (mnemonic) {
        // console.info('HAS DATA');
        let new_data = {
            mnemonic: response,
        }
        mnemonic.result.push(new_data);
        sessionStorage.setItem(itemMnemonic, JSON.stringify(mnemonic));
        // localStorage.setItem(saveMnemonic, JSON.stringify(mnemonic));

    } else {
        // console.info('FIRST DATA');
        let data = {
            result: [{
                mnemonic: response
            }]
        }
        sessionStorage.setItem(itemMnemonic, JSON.stringify(data));
        // localStorage.setItem(saveMnemonic, JSON.stringify(data));
    }
}

// 
function getNewestConnOBD() {
    var nodeAddress;
    var list = JSON.parse(localStorage.getItem(itemOBDList));
    // If has data
    if (list) {
        for (let i = 0; i < list.result.length; i++) {
            if (list.result[i].newest === 'yes') {
                nodeAddress = list.result[i].name;
                return nodeAddress;
            }
        }
        return nodeAddress = 'ws://127.0.0.1:60020/ws';
    } else { // NO LOCAL STORAGE DATA YET.
        return nodeAddress = 'ws://127.0.0.1:60020/ws';
    }
}

// List of OBD node that have interacted
function saveOBDConnectHistory(name) {

    var list = JSON.parse(localStorage.getItem(itemOBDList));

    // If has data.
    if (list) {
        // console.info('HAS DATA');
        for (let i = 0; i < list.result.length; i++) {
            list.result[i].newest = '';
        }

        for (let i = 0; i < list.result.length; i++) {
            if (list.result[i].name === name) {
                list.result[i].newest = 'yes';
                localStorage.setItem(itemOBDList, JSON.stringify(list));
                return;
            }
        }

        let new_data = {
            name:  name,
            newest: 'yes'
        }
        list.result.push(new_data);
        localStorage.setItem(itemOBDList, JSON.stringify(list));

    } else {
        // console.info('FIRST DATA');
        let data = {
            result: [{
                name:  name,
                newest: 'yes'
            }]
        }
        localStorage.setItem(itemOBDList, JSON.stringify(data));
    }
}

// Save APIs invoked history in custom mode.
function saveInvokeHistory(name, content) {

    var list = JSON.parse(localStorage.getItem(invokeHistory));

    // If has data.
    if (list) {
        // console.info('HAS DATA');
        // If is same data, delete original and push to array again.
        for (let i = 0; i < list.result.length; i++) {
            if (list.result[i].name === name && list.result[i].content === content) {
                list.result.splice(i, 1);
            }
        }

        let new_data = {
            name:    name,
            content: content,
        }
        list.result.push(new_data);
        localStorage.setItem(invokeHistory, JSON.stringify(list));

    } else {
        // console.info('FIRST DATA');
        let data = {
            result: [{
                name:    name,
                content: content,
            }]
        }
        localStorage.setItem(invokeHistory, JSON.stringify(data));
    }
}

//
function getLastCounterparty() {

    let data = JSON.parse(localStorage.getItem(itemCounterparties));

    // If has data.
    if (data) {
        // console.info('HAS DATA');
        for (let i = 0; i < data.result.length; i++) {
            if (userID === data.result[i].userID) {
                let lastIndex = data.result[i].data.length - 1;
                return data.result[i].data[lastIndex];
            }
        }
        return '';
    } else {
        return '';
    }
}

// get funding_tx_hex from FundingAsset type ( -102120 ) return
function getFundingAssetcHex() {

    let resp = JSON.parse(localStorage.getItem(itemFundingAssetHex));

    // If has data.
    if (resp) {
        return resp.hex;
    } else {
        return '';
    }
}

// save funding_tx_hex from FundingAsset type ( -102120 ) return
function saveFundingAssetcHex(hex) {

    let resp = JSON.parse(localStorage.getItem(itemFundingAssetHex));

    // If has data.
    if (resp) {
        resp.hex = hex;
        localStorage.setItem(itemFundingAssetHex, JSON.stringify(resp));
    } else {
        let data = {
            hex: hex
        }
        localStorage.setItem(itemFundingAssetHex, JSON.stringify(data));
    }
}

// get funding_tx_hex from fundingBTC -102109 return
function getFundingBtcHex() {

    let resp = JSON.parse(localStorage.getItem(itemFundingBtcHex));

    // If has data.
    if (resp) {
        return resp.hex;
    } else {
        return '';
    }
}

// save funding_tx_hex from fundingBTC -102109 return
function saveFundingBtcHex(hex) {

    let resp = JSON.parse(localStorage.getItem(itemFundingBtcHex));

    // If has data.
    if (resp) {
        resp.hex = hex;
        localStorage.setItem(itemFundingBtcHex, JSON.stringify(resp));
    } else {
        let data = {
            hex: hex
        }
        localStorage.setItem(itemFundingBtcHex, JSON.stringify(data));
    }
}

// get funding_txid from BTCFundingCreated type ( -100340 ) return
function getFundingBtcTxid() {

    let resp = JSON.parse(localStorage.getItem(itemFundingBtcTxid));

    // If has data.
    if (resp) {
        return resp.txid;
    } else {
        return '';
    }
}

// save funding_txid from BTCFundingCreated type ( -100340 ) return
function saveFundingBtcTxid(txid) {

    let resp = JSON.parse(localStorage.getItem(itemFundingBtcTxid));

    // If has data.
    if (resp) {
        resp.txid = txid;
        localStorage.setItem(itemFundingBtcTxid, JSON.stringify(resp));
    } else {
        let data = {
            txid: txid
        }
        localStorage.setItem(itemFundingBtcTxid, JSON.stringify(data));
    }
}

// List of Counterparties who have interacted
function saveCounterparties(name, p2pID) {

    var list = JSON.parse(localStorage.getItem(itemCounterparties));

    // If has data.
    if (list) {
        // console.info('HAS DATA');
        for (let i = 0; i < list.result.length; i++) {
            // same userID
            if (userID === list.result[i].userID) {
                for (let i2 = 0; i2 < list.result[i].data.length; i2++) {
                    // if UserPeerID is same, then NodePeerID is updated.
                    if (list.result[i].data[i2].name === name) {
                        list.result[i].data[i2].p2pID = p2pID;
                        localStorage.setItem(itemCounterparties, JSON.stringify(list));
                        return;
                    }
                }

                // Add a new data to the userID
                let new_data = {
                    name:  name,
                    p2pID: p2pID
                }
                list.result[i].data.push(new_data);
                localStorage.setItem(itemCounterparties, JSON.stringify(list));
                return;
            }
        }

        // A new User ID.
        let new_data = {
            userID: userID,
            data: [{
                name:  name,
                p2pID: p2pID
            }]
        }
        list.result.push(new_data);
        localStorage.setItem(itemCounterparties, JSON.stringify(list));

    } else {
        // console.info('FIRST DATA');
        let data = {
            result: [{
                userID: userID,
                data: [{
                    name:  name,
                    p2pID: p2pID
                }]
            }]
        }
        localStorage.setItem(itemCounterparties, JSON.stringify(data));
    }
}

//----------------------------------------------------------------
// Functions of buttons.

// get balance of btc and omni assets of an address.
function getBalance(strAddr) {
    // console.info('strAddr = ' + strAddr);

    var result;

    // OBD API
    obdApi.getBtcBalanceByAddress(strAddr, function(e) {
        console.info('getBtcBalance - OBD Response = ' + JSON.stringify(e));
        result = JSON.stringify(e);
        result = result.replace("\"", "").replace("\"", "");
        result = parseFloat(result);
        result = 'Balance : ' + result + ' BTC ';
        $("#" + strAddr).text(result);
    });

    // for omni assets
    obdApi.omniGetAllBalancesForAddress(strAddr, function(e) {
        console.info('omniGetAllBalancesForAddress - OBD Response = ' + JSON.stringify(e));

        if (e != "") {
            for (let i = 0; i < e.length; i++) {
                result += ' *** ' + parseFloat(e[i].balance) + ' ' + e[i].name +
                    ' (Property ID: ' + e[i].propertyid + ')';
            }
            $("#" + strAddr).text(result);
        }
    });
}

// Generate new mnemonic words.
function autoCreateMnemonic() {
    // Generate mnemonic by local js library.
    var mnemonic = btctool.generateMnemonic(128);
    $("#mnemonic").val(mnemonic);
    saveMnemonic(mnemonic);
}

// Generate a new pub key of an address.
function autoCreateFundingPubkey(param) {
    // Generate address by local js library.
    var result = genAddressFromMnemonic();
    if (result === '') return;

    switch (param) {
        case -102109:
        case -102120:
            $("#from_address").val(result.result.address);
            $("#from_address_private_key").val(result.result.wif);
            break;
        case -100034:
            $("#temp_address_pub_key").val(result.result.pubkey);
            $("#temp_address_private_key").val(result.result.wif);
            break;
        case -100351:
        case -100352:
            $("#curr_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_temp_address_private_key").val(result.result.wif);
            break;
        case -401: // first data for type -40
        case -411: // first data for type -41
        case -49:
        case -50:
            $("#curr_rsmc_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_rsmc_temp_address_private_key").val(result.result.wif);
            break;
        case -402: // second data for type -40
        case -412: // second data for type -41
            $("#curr_htlc_temp_address_pub_key").val(result.result.pubkey);
            $("#curr_htlc_temp_address_private_key").val(result.result.wif);
            break;
        case -403: // third data for type -40
            $("#curr_htlc_temp_address_for_ht1a_pub_key").val(result.result.pubkey);
            $("#curr_htlc_temp_address_for_ht1a_private_key").val(result.result.wif);
            break;
        case -45:
            $("#curr_htlc_temp_address_for_he1b_pub_key").val(result.result.pubkey);
            $("#curr_htlc_temp_address_for_he1b_private_key").val(result.result.wif);
            break;
        default:
            $("#funding_pubkey").val(result.result.pubkey);
            break;
    }

    saveAddresses(result);
}

// auto Calculation Miner Fee
function autoCalcMinerFee() {
    $("#miner_fee").val('0.00001');
}

//----------------------------------------------------------------
// Functions of display User Data.
function displayUserData(obj, param) {
    removeNameReqDiv();
    createApiNameDiv(obj);

    switch (obj.id) {
        case 'MnemonicWords':
            displayMnemonic();
            break;
        case 'MyAddresses':
            displayAddresses(param);
            break;
        case 'Counterparties':
            displayCounterparties(param);
            break;
        case 'ChannelList':
            displayChannelCreation(param);
            break;
    }
}

//
function displayMnemonic() {
    // get [name_req_div] div
    var parent = $("#name_req_div");
    var mnemonic = JSON.parse(sessionStorage.getItem(itemMnemonic));
    // var mnemonic = JSON.parse(localStorage.getItem(saveMnemonic));

    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    // If has data
    if (mnemonic) {
        for (let i = 0; i < mnemonic.result.length; i++) {
            createElement(newDiv, 'h4', 'NO. ' + (i + 1));
            createElement(newDiv, 'text', mnemonic.result[i].mnemonic, 'responseText');
        }
    } else { // NO LOCAL STORAGE DATA YET.
        createElement(newDiv, 'h3', 'NO DATA YET. YOU CAN CREATE ONE WITH [signUp].');
    }

    parent.append(newDiv);
}

//
function displayAddresses(param) {
    var parent = $("#name_req_div");
    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    if (param === inNewHtml) { // New page
        var status = JSON.parse(localStorage.getItem(itemGoWhere));
        if (!status.isLogined) { // Not login.
            createElement(newDiv, 'h3', 'NOT LOGINED.');
            parent.append(newDiv);
            return;
        } else {
            userID = status.userID;
        }

    } else {
        if (!isLogined) { // Not login.
            createElement(newDiv, 'h3', 'NOT LOGINED.');
            parent.append(newDiv);
            return;
        }
    }

    var arrData;
    var addr = JSON.parse(localStorage.getItem(itemAddr));

    // If has data
    if (addr) {
        for (let i = 0; i < addr.result.length; i++) {
            if (userID === addr.result[i].userID) {
                // var bigText = 'User ID : ' + addr.result[i].userID;
                // createElement(newDiv, 'text', bigText, 'bigText');
                // createElement(newDiv, 'h2', 'Address List', 'responseText');

                for (let i2 = 0; i2 < addr.result[i].data.length; i2++) {
                    createElement(newDiv, 'h3', 'NO. ' + (i2 + 1), 'responseText');

                    // Get balance of an address.
                    var strAddr = addr.result[i].data[i2].address;
                    createBalanceElement(newDiv, strAddr);

                    arrData = [
                        'Address : ' + addr.result[i].data[i2].address,
                        'Index : ' + addr.result[i].data[i2].index,
                        'PubKey : ' + addr.result[i].data[i2].pubkey,
                        'WIF : ' + addr.result[i].data[i2].wif
                    ];

                    for (let i3 = 0; i3 < arrData.length; i3++) {
                        var point   = arrData[i3].indexOf(':') + 1;
                        var title   = arrData[i3].substring(0, point);
                        var content = arrData[i3].substring(point);
                        createElement(newDiv, 'text', title);
                        createElement(newDiv, 'text', content, 'responseText');
                        createElement(newDiv, 'p');
                    }
                }

                parent.append(newDiv);
                return;
            }
        }

        // The user has not create address yet.
        createElement(newDiv, 'h3', 'NO DATA YET.');
        parent.append(newDiv);

    } else { // NO LOCAL STORAGE DATA YET.
        createElement(newDiv, 'h3', 'NO DATA YET.');
        parent.append(newDiv);
    }
}

//
function createBalanceElement(parent, strAddr) {
    // create [text] element
    var title = document.createElement('text');
    title.id = strAddr;
    title.innerText = 'Balance : ';
    parent.append(title);

    // create [button] element
    var button = document.createElement('button');
    button.innerText = 'Get Balance';
    var clickFunc = "getBalance('" + strAddr + "')";
    button.setAttribute('class', 'button button_small');
    button.setAttribute('onclick', clickFunc);
    parent.append(button);

    createElement(parent, 'p');
}

// List of Counterparties who have interacted
function displayCounterparties(param) {
    var arrData;
    var parent = $("#name_req_div");
    var list   = JSON.parse(localStorage.getItem(itemCounterparties));
    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    if (param === inNewHtml) { // New page
        var status = JSON.parse(localStorage.getItem(itemGoWhere));
        if (!status.isLogined) { // Not login.
            createElement(newDiv, 'h3', 'NOT LOGINED.');
            parent.append(newDiv);
            return;
        } else {
            userID = status.userID;
        }

    } else {
        if (!isLogined) { // Not login.
            createElement(newDiv, 'h3', 'NOT LOGINED.');
            parent.append(newDiv);
            return;
        }
    }

    // If has data
    if (list) {
        for (let i = 0; i < list.result.length; i++) {
            if (userID === list.result[i].userID) {
                for (let i2 = 0; i2 < list.result[i].data.length; i2++) {
                    createElement(newDiv, 'h3', 'NO. ' + (i2 + 1), 'responseText');
                    arrData = [
                        'NodePeerID : ' + list.result[i].data[i2].p2pID,
                        'UserPeerID : ' + list.result[i].data[i2].name,
                    ];

                    for (let i3 = 0; i3 < arrData.length; i3++) {
                        var point   = arrData[i3].indexOf(':') + 1;
                        var title   = arrData[i3].substring(0, point);
                        var content = arrData[i3].substring(point);
                        createElement(newDiv, 'text', title);
                        createElement(newDiv, 'text', content, 'responseText');
                        createElement(newDiv, 'p');
                    }
                }

                parent.append(newDiv);
                return;
            }
        }

        // The user has not counterparty yet.
        createElement(newDiv, 'h3', 'NO DATA YET.');
        parent.append(newDiv);

    } else { // NO LOCAL STORAGE DATA YET.
        createElement(newDiv, 'h3', 'NO DATA YET.');
        parent.append(newDiv);
    }
}

// List of OBD node that have interacted
function displayOBDConnectHistory() {

    var item;
    var parent = $("#name_req_div");
    var list = JSON.parse(localStorage.getItem(itemOBDList));

    // $("#history_div").remove();
    var newDiv = document.createElement('div');
    newDiv.id = "history_div";
    newDiv.setAttribute('class', 'panelItem');

    createElement(newDiv, 'h3', 'Connection History');

    // If has data
    if (list) {
        for (let i = 0; i < list.result.length; i++) {
            // createElement(newDiv, 'h4', 'NO. ' + (i + 1));
            item = document.createElement('a');
            item.href = '#';
            item.innerText = list.result[i].name;
            item.setAttribute('onclick', 'clickConnectionHistory(this)');
            // item.setAttribute('class', 'url');
            newDiv.append(item);
            createElement(newDiv, 'p');
        }
    } else { // NO LOCAL STORAGE DATA YET.
        createElement(newDiv, 'h4', 'NO CONNECTION HISTORY.');
    }

    parent.append(newDiv);
}

// List of OBD connection history in custom mode.
function connectionHistoryInCustom() {
    var item, del;
    var parent = $("#invoke_history");
    var list   = JSON.parse(localStorage.getItem(itemOBDList));

    createElement(parent, 'h3', 'Connection History');

    // create [button] element
    var button = document.createElement('button');
    button.setAttribute('class', 'button button_clear_history');
    button.setAttribute('onclick', 'clearConnectionHistory()');
    button.innerText = 'Clear';
    parent.append(button);

    createElement(parent, 'p');

    // If has data
    if (list) {
        for (let i = list.result.length - 1; i >= 0; i--) {
            // Delete button
            del = document.createElement('text');
            del.innerText = 'X';
            del.setAttribute('onclick', 'deleteOneConnectionHistory(this)');
            del.setAttribute('class', 'url url_red');
            del.setAttribute('index', i);
            parent.append(del);

            // item name
            item = document.createElement('a');
            item.href = '#';
            item.innerText = list.result[i].name;
            item.setAttribute('onclick', 'clickConnectionHistory(this)');
            item.setAttribute('class', 'url url_conn_history');
            parent.append(item);

            createElement(parent, 'p');
        }
    } else { // NO LOCAL STORAGE DATA YET.
        createElement(parent, 'h4', 'No connection history.');
    }
}

// Data history in custom mode.
function historyInCustom() {
    removeInvokeHistoryDiv();
    connectionHistoryInCustom();
    apiInvokeHistoryInCustom();
}

// List of APIs invoked history in custom mode.
function apiInvokeHistoryInCustom() {
    var item, del;
    var parent = $("#invoke_history");
    var list   = JSON.parse(localStorage.getItem(invokeHistory));

    createElement(parent, 'h3', 'APIs History');

    // create [button] element
    var button = document.createElement('button');
    button.setAttribute('class', 'button button_clear_history');
    button.setAttribute('onclick', 'clearInvokeHistory()');
    button.innerText = 'Clear';
    parent.append(button);

    createElement(parent, 'p');
    
    // If has data
    if (list) {
        // console.info('has data');
        for (let i = list.result.length - 1; i >= 0; i--) {
            // Delete button
            del = document.createElement('text');
            del.innerText = 'X';
            del.setAttribute('onclick', 'deleteOneInvokeHistory(this)');
            del.setAttribute('class', 'url url_red');
            del.setAttribute('index', i);
            parent.append(del);

            // item name
            item = document.createElement('a');
            item.href = '#';
            item.innerText = list.result[i].name;
            item.setAttribute('onclick', 'clickInvokeHistory(this)');
            item.setAttribute('content', list.result[i].content);
            item.setAttribute('class', 'url url_blue');
            parent.append(item);

            createElement(parent, 'p');
        }
    } else { // NO LOCAL STORAGE DATA YET.
        // console.info('no data');
        createElement(parent, 'h4', 'No APIs history.');
    }
}

// 
function clearInvokeHistory(obj) {
    localStorage.removeItem(invokeHistory);
    historyInCustom();
}

// 
function clearConnectionHistory(obj) {
    localStorage.removeItem(itemOBDList);
    historyInCustom();
}

// 
function deleteOneInvokeHistory(obj) {
    var list = JSON.parse(localStorage.getItem(invokeHistory));
    list.result.splice(obj.getAttribute("index"), 1);
    if (list.result.length === 0) { // no item
        localStorage.removeItem(invokeHistory);
    } else {
        localStorage.setItem(invokeHistory, JSON.stringify(list));
    }
    historyInCustom();
}

// 
function deleteOneConnectionHistory(obj) {
    var list = JSON.parse(localStorage.getItem(itemOBDList));
    list.result.splice(obj.getAttribute("index"), 1);
    if (list.result.length === 0) { // no item
        localStorage.removeItem(itemOBDList);
    } else {
        localStorage.setItem(itemOBDList, JSON.stringify(list));
    }
    historyInCustom();
}

//
function clearCustomRequest() {
    $("#custom_request").val("");
}

//
function sendCustomRequest() {

    var custom_request  = $("#custom_request").val().trim();

    try {
        var list = JSON.parse(custom_request);
    } catch (error) {
        alert("Wrong JSON format!");
        return;
    }

    var type    = list.type;
    var saveVal = 'type : ' + type;

    // OBD API
    obdApi.sendJsonData(custom_request, Number(type), function(e) {
        console.info('sendCustomRequest - OBD Response = ' + JSON.stringify(e));
        saveInvokeHistory(saveVal, custom_request);
        historyInCustom();

        // Display user id on screen top.
        if (Number(type) === 1) {  // Login func
            $('#cm_logined').text(e.userPeerId);
        }

        //
        obdApi.removeEvent(Number(type));
    });
}

//
function clickConnectionHistory(obj) {
    $("#NodeAddress").val(obj.innerText);
}

//
function clickInvokeHistory(obj) {
    $("#custom_request").val(obj.getAttribute("content"));
}

// List of channel creation process records.
function displayChannelCreation(param) {
    // get [name_req_div] div
    var parent = $("#name_req_div");

    var newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'panelItem');

    /*
    if (param === inNewHtml) {
        var status = JSON.parse(localStorage.getItem(saveGoWhere));
        if (!status.isLogined) { // Not login.
            createElement(parent, 'text', 'NOT LOGINED.');
            return;
        } else {
            userID = status.userID;
        }
        
    } else {
        if (!isLogined) { // Not login.
            createElement(parent, 'text', 'NOT LOGINED.');
            return;
        }
    }
    */

    var list = JSON.parse(localStorage.getItem(itemChannelList));

    if (list) {
        for (let i = 0; i < list.result.length; i++) {
            // createElement(parent, 'h4', 'NO. ' + (i + 1) + 
            //     ' - Temp Channel ID is: ' + list.result[i].temporary_channel_id);
            createElement(newDiv, 'h2', 'NO. ' + (i + 1), 'responseText');

            // Display channel id in creation process.
            channelID(newDiv, list, i);

            // Display channel info.
            partChannelInfo(newDiv, list, i)

            // Display depositing btc record.
            btcRecord(newDiv, list, i);

            // Display depositing omni asset record.
            omniAssetRecord(newDiv, list, i);

            // Display RSMC - transfer in channel.
            rsmcRecord(newDiv, list, i);

            // Display HTLC - transfer in channel.
            htlcRecord(newDiv, list, i);
        }
    } else { // NO LOCAL STORAGE DATA YET.
        createElement(newDiv, 'h3', 'NO DATA YET.');
    }

    parent.append(newDiv);
}

// Display channel id in creation process.
function channelID(parent, list, i) {
    // var msgType;
    try {
        var msgType = list.result[i].omniAsset[0].msgType;
    } catch (error) {}

    if (msgType === enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35) {
        createElement(parent, 'text', 'DONE - Channel ID : ');
    } else {
        createElement(parent, 'text', 'TEMP - Channel ID : ');
    }

    createElement(parent, 'p', list.result[i].temporary_channel_id, 'responseText');
}

// Display channel info.
function partChannelInfo(parent, list, i) {

    var arrData;

    for (let i2 = 0; i2 < list.result[i].data.length; i2++) {
        var title = list.result[i].data[i2].channelInfo;
        var point   = title.indexOf('-');
        var title2  = title.substring(0, point);
        var content = title.substring(point + 1);
        createElement(parent, 'p', '-----------------------------------------------');
        createElement(parent, 'text', title2);
        createElement(parent, 'p', content, 'responseText');

        // Construct data will be displayed.
        if (title.substring(0, 6) === 'LAUNCH') {
            arrData = [
                'temporary_channel_id : ' + list.result[i].data[i2].temporary_channel_id,
            ];
        } else if (title.substring(0, 3) === 'N38') {
            arrData = [
                'request_close_channel_hash : ' + list.result[i].data[i2].request_close_channel_hash,
                'date : ' + list.result[i].data[i2].date,
            ];
        } else if (title.substring(0, 3) === 'N39') {
            arrData = [
                'The channel is closed.',
                'date : ' + list.result[i].data[i2].date,
            ];
        } else {
            arrData = [
                'channel_address : ' + list.result[i].data[i2].channel_address,
                'temporary_channel_id : ' + list.result[i].data[i2].temporary_channel_id,
                'create_at : ' + list.result[i].data[i2].create_at,
                'create_by : ' + list.result[i].data[i2].create_by,
                'accept_at : ' + list.result[i].data[i2].accept_at,
                'address_a : ' + list.result[i].data[i2].address_a,
                'address_b : ' + list.result[i].data[i2].address_b,
            ];
        }

        for (let i3 = 0; i3 < arrData.length; i3++) {
            var point   = arrData[i3].indexOf(':') + 1;
            var title   = arrData[i3].substring(0, point);
            var content = arrData[i3].substring(point);
            createElement(parent, 'text', title);
            createElement(parent, 'p', content, 'responseText');
        }
    }
}

// Display depositing btc record.
function btcRecord(parent, list, i) {

    var arrData;

    if (list.result[i].btc[0]) {
        createElement(parent, 'p', '-----------------------------------------------');
        createElement(parent, 'h3', 'DEPOSITING - BTC Record', 'responseText');

        for (let i2 = 0; i2 < list.result[i].btc.length; i2++) {
            createElement(parent, 'br');
            createElement(parent, 'text', 'NO. ' + (i2 + 1));

            var status;
            switch (list.result[i].btc[i2].msgType) {
                case enumMsgType.MsgType_Core_FundingBTC_2109:
                    status = 'Precharge (1009)';
                    break;
                case enumMsgType.MsgType_FundingCreate_SendBtcFundingCreated_340:
                    status = 'Noticed (-3400)';
                    break;
                case enumMsgType.MsgType_FundingSign_SendBtcSign_350:
                    status = 'Confirmed (-3500)';
                    break;
                default:
                    break;
            }

            createElement(parent, 'text', ' -- ' + status);
            createElement(parent, 'text', ' -- ' + list.result[i].btc[i2].date);
            createElement(parent, 'br');
            createElement(parent, 'p', '---------------------------------------------');

            arrData = [
                'from_address : ' + list.result[i].btc[i2].from_address,
                'amount : ' + list.result[i].btc[i2].amount,
                'txid : ' + list.result[i].btc[i2].txid,
                'hex : ' + list.result[i].btc[i2].hex,
            ];

            for (let i3 = 0; i3 < arrData.length; i3++) {
                var point   = arrData[i3].indexOf(':') + 1;
                var title   = arrData[i3].substring(0, point);
                var content = arrData[i3].substring(point);
                createElement(parent, 'text', title);
                createElement(parent, 'p', content, 'responseText');
            }
        }
    }
}

// Display depositing omni asset record.
function omniAssetRecord(parent, list, i) {

    var arrData;

    if (list.result[i].omniAsset[0]) {
        createElement(parent, 'p', '-----------------------------------------------');
        createElement(parent, 'h3', 'DEPOSITING - Omni Asset Record', 'responseText');

        for (let i2 = 0; i2 < list.result[i].omniAsset.length; i2++) {
            var status;
            switch (list.result[i].omniAsset[i2].msgType) {
                case enumMsgType.MsgType_Core_Omni_FundingAsset_2120:
                    status = 'Precharge (2001)';
                    break;
                case enumMsgType.MsgType_FundingCreate_SendAssetFundingCreated_34:
                    status = 'Noticed (-34)';
                    break;
                case enumMsgType.MsgType_FundingSign_SendAssetFundingSigned_35:
                    status = 'Confirmed (-35)';
                    break;
            }

            createElement(parent, 'text', ' -- ' + status);
            createElement(parent, 'text', ' -- ' + list.result[i].omniAsset[i2].date);
            createElement(parent, 'br');
            createElement(parent, 'p', '---------------------------------------------');

            arrData = [
                'from_address : ' + list.result[i].omniAsset[i2].from_address,
                'amount : ' + list.result[i].omniAsset[i2].amount,
                'property_id : ' + list.result[i].omniAsset[i2].property_id,
                'hex : ' + list.result[i].omniAsset[i2].hex,

                '(-34) Response : ----------------------',
                'channel_id : ' + list.result[i].omniAsset[i2].channel_id,
                'funding_omni_hex : ' + list.result[i].omniAsset[i2].funding_omni_hex,
                'c1a_rsmc_hex : ' + list.result[i].omniAsset[i2].c1a_rsmc_hex,
                'rsmc_temp_address_pub_key : ' + list.result[i].omniAsset[i2].rsmc_temp_address_pub_key,
                
                '(-35) Response : ----------------------',
                'approval : ' + list.result[i].omniAsset[i2].approval,
                'rd_hex : ' + list.result[i].omniAsset[i2].rd_hex,
                'rsmc_signed_hex : ' + list.result[i].omniAsset[i2].rsmc_signed_hex,
            ];

            for (let i3 = 0; i3 < arrData.length; i3++) {
                var point   = arrData[i3].indexOf(':') + 1;
                var title   = arrData[i3].substring(0, point);
                var content = arrData[i3].substring(point);
                createElement(parent, 'text', title);
                createElement(parent, 'p', content, 'responseText');
            }
        }
    }
}

// Display RSMC - transfer in channel.
function rsmcRecord(parent, list, i) {

    var arrData;

    if (list.result[i].transfer[0]) {
        createElement(parent, 'p', '-----------------------------------------------');
        createElement(parent, 'h3', 'RSMC - transfer in channel', 'responseText');

        for (let i2 = 0; i2 < list.result[i].transfer.length; i2++) {
            createElement(parent, 'br');
            createElement(parent, 'text', 'NO. ' + (i2 + 1));

            var status;
            switch (list.result[i].transfer[i2].msgType) {
                case enumMsgType.MsgType_CommitmentTx_SendCommitmentTransactionCreated_351:
                    status = 'Pre-transfer (-351)';
                    break;
                case enumMsgType.MsgType_CommitmentTxSigned_SendRevokeAndAcknowledgeCommitmentTransaction_352:
                    status = 'Done transfer (-352)';
                    break;
            }

            createElement(parent, 'text', ' -- ' + status);
            createElement(parent, 'text', ' -- ' + list.result[i].transfer[i2].date);
            createElement(parent, 'br');
            createElement(parent, 'p', '---------------------------------------------');

            arrData = [
                'channelId : ' + list.result[i].transfer[i2].channelId,
                'amount : ' + list.result[i].transfer[i2].amount,
                'msgHash : ' + list.result[i].transfer[i2].msgHash,
                // 'currTempAddressPubKey : ' + list.result[i].transfer[i2].currTempAddressPubKey,
                // 'lastTempAddressPrivateKey : ' + list.result[i].transfer[i2].lastTempAddressPrivateKey,
                'rsmcHex : ' + list.result[i].transfer[i2].rsmcHex,
                'toOtherHex : ' + list.result[i].transfer[i2].toOtherHex,
            ];

            for (let i3 = 0; i3 < arrData.length; i3++) {
                var point   = arrData[i3].indexOf(':') + 1;
                var title   = arrData[i3].substring(0, point);
                var content = arrData[i3].substring(point);
                createElement(parent, 'text', title);
                createElement(parent, 'p', content, 'responseText');
            }
        }
    }
}

// Display HTLC - transfer in channel.
function htlcRecord(parent, list, i) {

    var arrData;

    if (list.result[i].htlc[0]) {
        createElement(parent, 'p', '-----------------------------------------------');
        createElement(parent, 'h3', 'HTLC - transfer in channel', 'responseText');

        for (let i2 = 0; i2 < list.result[i].htlc.length; i2++) {
            createElement(parent, 'br');
            createElement(parent, 'text', 'NO. ' + (i2 + 1));

            var status;
            switch (list.result[i].htlc[i2].msgType) {
                case enumMsgType.MsgType_HTLC_SendAddHTLC_40:
                    status = 'HTLC-Created (-40)';
                    break;
                case enumMsgType.MsgType_HTLC_SendAddHTLCSigned_41:
                    status = 'HTLC-Signed (-41)';
                    break;
                case enumMsgType.MsgType_HTLC_SendVerifyR_45:
                    status = 'Send R (-45)';
                    break;
                case enumMsgType.MsgType_HTLC_SendSignVerifyR_46:
                    status = 'Verify R (-46)';
                    break;
                case enumMsgType.MsgType_HTLC_SendRequestCloseCurrTx_49:
                    status = 'Request Close (-49)';
                    break;
                case enumMsgType.MsgType_HTLC_SendCloseSigned_50:
                    status = 'Closed (-50)';
                    break;
            }

            createElement(parent, 'text', ' -- ' + status);
            createElement(parent, 'text', ' -- ' + list.result[i].htlc[i2].date);
            createElement(parent, 'br');
            createElement(parent, 'p', '---------------------------------------------');

            switch (list.result[i].htlc[i2].msgType) {
                case enumMsgType.MsgType_HTLC_SendRequestCloseCurrTx_49:
                case enumMsgType.MsgType_HTLC_SendCloseSigned_50:
                    arrData = [
                        'channel_id : ' + list.result[i].htlc[i2].channel_id,
                        'create_at : ' + list.result[i].htlc[i2].create_at,
                        'create_by : ' + list.result[i].htlc[i2].create_by,
                        'curr_state : ' + list.result[i].htlc[i2].curr_state,
                        'request_hash : ' + list.result[i].htlc[i2].request_hash,
                    ];
                    break;

                default:
                    arrData = [
                        'channelId : ' + list.result[i].htlc[i2].channelId,
                        'amount : ' + list.result[i].htlc[i2].amount,
                        'htlcChannelPath : ' + list.result[i].htlc[i2].htlcChannelPath,
                        'htlcTxHex : ' + list.result[i].htlc[i2].htlcTxHex,
                        'msgHash : ' + list.result[i].htlc[i2].msgHash,
                        'rsmcTxHex : ' + list.result[i].htlc[i2].rsmcTxHex,
                        'toOtherHex : ' + list.result[i].htlc[i2].toOtherHex,

                        // 'h : ' + list.result[i].htlc[i2].h,
                        // 'r : ' + list.result[i].htlc[i2].r,
                        // 'request_hash : ' + list.result[i].htlc[i2].request_hash,
                        // 'property_id : ' + list.result[i].htlc[i2].property_id,
                        // 'memo : ' + list.result[i].htlc[i2].memo,
                        // 'curr_state : ' + list.result[i].htlc[i2].curr_state,
                        // 'sender : ' + list.result[i].htlc[i2].sender,
                        // 'approval : ' + list.result[i].htlc[i2].approval,
                    ];
                    break;
            }


            for (let i3 = 0; i3 < arrData.length; i3++) {
                var point   = arrData[i3].indexOf(':') + 1;
                var title   = arrData[i3].substring(0, point);
                var content = arrData[i3].substring(point);
                createElement(parent, 'text', title);
                createElement(parent, 'p', content, 'responseText');
            }
        }
    }
}

//----------------------------------------------------------------
// Functions of Common Util.

// create html elements
function createElement(parent, elementName, myInnerText, css, elementID) {

    let element = document.createElement(elementName);

    if (myInnerText) {
        element.innerText = myInnerText;
    }

    if (css) {
        element.setAttribute('class', css);
    }

    if (elementID) {
        element.id = elementID;
    }

    parent.append(element);
}

//
function displayUserDataInNewHtml(goWhere) {
    saveGoWhere(goWhere);
    window.open('userData.html', 'data', 'height=600, width=800, top=150, ' +
        'left=300, toolbar=no, menubar=no, scrollbars=no, resizable=no, ' +
        'location=no, status=no');
}

//
function historyCustomInNewHtml() {
    window.open('customMode.html');
}

// 
function openLogPage() {
    window.open('log.html');
}

// Show complete log of OBD messages.
function showLog() {
    var list = localStorage.getItem('broadcast_info');
    $("#log").html(list);
}

//
function saveGoWhere(goWhere) {
    let data = {
        goWhere: goWhere,
        isLogined: isLogined,
        userID: userID
    }
    localStorage.setItem(itemGoWhere, JSON.stringify(data));
}

// Bitcoin Testnet Faucet
function openTestnetFaucet() {
    window.open('https://testnet-faucet.mempool.co/');
}

//
function jsonFormat(json) {

    json = json.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');

    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

//
function getTrackerData(getWhat, pageNum, pageSize) {

    let strURL = 'http://62.234.216.108:60060/api/common/' + getWhat + '?pageNum=' + 
                pageNum + '&pageSize=' + pageSize;

    $.ajax({
        url: strURL,
        type: "GET",
        success: function(result) {
            console.log(JSON.stringify(result));
            tableData(getWhat, result);
        },
        error: function(error) {
            console.log('ERROR IS : ' + JSON.stringify(error));
        }
    })
}

//
function tableData(getWhat, result) {
    console.info('getWhat = ' + getWhat);
    console.info('total count = ' + result.totalCount);

    removeTrackerDiv();

    // table
    let tracker_div = $("#tracker_div");
    let table = document.createElement('table');
    table.id = 'tracker';
    tracker_div.append(table);

    // head
    createElement(table, 'tr');
    createElement(table, 'th', 'NO', 'col_1_width');
    switch (getWhat) {
        case 'getObdNodes':
            createElement(table, 'th', 'online', 'col_2_width');
            createElement(table, 'th', 'node_id');
            createElement(table, 'th', 'p2p_address');
            createElement(table, 'th', 'login_ip', 'col_3_width');
            createElement(table, 'th', 'login_time', 'col_4_width');
            createElement(table, 'th', 'offline_time', 'col_4_width');
            break;

        case 'getUsers':
            createElement(table, 'th', 'online', 'col_2_width');
            createElement(table, 'th', 'obd_node_id');
            createElement(table, 'th', 'user_id');
            createElement(table, 'th', 'offline_time', 'col_4_width');
            break;
            
        case 'getChannels':
            // createElement(table, 'th', 'obd_node_a');
            // createElement(table, 'th', 'obd_node_b');
            createElement(table, 'th', 'channel_id');
            createElement(table, 'th', 'property_id', 'col_4_width');
            // createElement(table, 'th', 'curr_state', 'col_2_width');
            // createElement(table, 'th', 'user_a');
            // createElement(table, 'th', 'user_b');
            createElement(table, 'th', 'balance_a', 'col_4_width');
            createElement(table, 'th', 'balance_b', 'col_4_width');
            // createElement(table, 'th', 'create_time', 'col_4_width');
            break;
    }
    

    // row
    let iNum = result.totalCount - result.data[0].id;

    for (let i = 0; i < result.data.length; i++) {
        if (i % 2 != 0) {
            let tr2 = document.createElement('tr');
            tr2.setAttribute('class', 'alt');
            table.append(tr2);
            createElement(tr2, 'td', i + 1 + iNum);

            switch (getWhat) {
                case 'getObdNodes':
                    createElement(tr2, 'td', String(result.data[i].is_online));
                    createElement(tr2, 'td', result.data[i].node_id);
                    createElement(tr2, 'td', result.data[i].p2p_address);
                    createElement(tr2, 'td', result.data[i].latest_login_ip);
                    createElement(tr2, 'td', formatTime(result.data[i].latest_login_at));
                    createElement(tr2, 'td', formatTime(result.data[i].latest_offline_at));
                    break;
        
                case 'getUsers':
                    createElement(tr2, 'td', String(result.data[i].is_online));
                    createElement(tr2, 'td', result.data[i].obd_node_id);
                    createElement(tr2, 'td', result.data[i].user_id);
                    createElement(tr2, 'td', formatTime(result.data[i].offline_at));
                    break;
        
                case 'getChannels':
                    // createElement(tr2, 'td', result.data[i].obd_node_ida);
                    // createElement(tr2, 'td', result.data[i].obd_node_idb);
                    createElement(tr2, 'td', result.data[i].channel_id);
                    createElement(tr2, 'td', result.data[i].property_id);
                    // createElement(tr2, 'td', result.data[i].curr_state);
                    // createElement(tr2, 'td', result.data[i].peer_ida);
                    // createElement(tr2, 'td', result.data[i].peer_idb);
                    createElement(tr2, 'td', result.data[i].amount_a);
                    createElement(tr2, 'td', result.data[i].amount_b);
                    // createElement(tr2, 'td', result.data[i].create_at);
                    break;
            }

        } else {
            createElement(table, 'tr');
            createElement(table, 'td', i + 1 + iNum);

            switch (getWhat) {
                case 'getObdNodes':
                    createElement(table, 'td', String(result.data[i].is_online));
                    createElement(table, 'td', result.data[i].node_id);
                    createElement(table, 'td', result.data[i].p2p_address);
                    createElement(table, 'td', result.data[i].latest_login_ip);
                    createElement(table, 'td', formatTime(result.data[i].latest_login_at));
                    createElement(table, 'td', formatTime(result.data[i].latest_offline_at));
                    break;
        
                case 'getUsers':
                    createElement(table, 'td', String(result.data[i].is_online));
                    createElement(table, 'td', result.data[i].obd_node_id);
                    createElement(table, 'td', result.data[i].user_id);
                    createElement(table, 'td', formatTime(result.data[i].offline_at));
                    break;
        
                case 'getChannels':
                    // createElement(table, 'td', result.data[i].obd_node_ida);
                    // createElement(table, 'td', result.data[i].obd_node_idb);
                    createElement(table, 'td', result.data[i].channel_id);
                    createElement(table, 'td', result.data[i].property_id);
                    // createElement(table, 'td', result.data[i].curr_state);
                    // createElement(table, 'td', result.data[i].peer_ida);
                    // createElement(table, 'td', result.data[i].peer_idb);
                    createElement(table, 'td', result.data[i].amount_a);
                    createElement(table, 'td', result.data[i].amount_b);
                    // createElement(table, 'td', result.data[i].create_at);
                    break;
            }
        }
    }

    // total count
    let bottom_div = document.createElement('div');
    bottom_div.setAttribute('class', 'bottom_div');
    tracker_div.append(bottom_div);

    createElement(bottom_div, 'label', 'Total Count : ' + result.totalCount, 'left_margin');
    createElement(bottom_div, 'label', 'Page ' + result.pageNum + ' / ' + result.totalPage, 'left_margin');

    // previous page
    let butPrevious = document.createElement('button');
    butPrevious.setAttribute('getWhat', getWhat);
    butPrevious.setAttribute('pageNum', result.pageNum);
    // butPrevious.setAttribute('totalPage', result.totalPage);
    butPrevious.setAttribute('class', 'button button_small');
    butPrevious.setAttribute('onclick', 'previousPage(this)');
    butPrevious.innerText = 'Prev Page';
    bottom_div.append(butPrevious);

    if (result.pageNum === 1) {
        butPrevious.setAttribute('class', 'button_small disabled');
        butPrevious.setAttribute("disabled", "disabled");
    }

    // next page
    let butNext = document.createElement('button');
    butNext.setAttribute('getWhat', getWhat);
    butNext.setAttribute('pageNum', result.pageNum);
    // butNext.setAttribute('totalPage', result.totalPage);
    butNext.setAttribute('class', 'button button_small');
    butNext.setAttribute('onclick', 'nextPage(this)');
    butNext.innerText = 'Next Page';
    bottom_div.append(butNext);

    if (result.pageNum === result.totalPage) {
        butNext.setAttribute('class', 'button_small disabled');
        butNext.setAttribute("disabled", "disabled");
    }
}

//
function previousPage(obj) {
    let getWhat = obj.getAttribute("getWhat");
    let previousPage = Number(obj.getAttribute("pageNum")) - 1;
    console.info('previousPage = ' + previousPage);
    getTrackerData(getWhat, previousPage, 10);
}

//
function nextPage(obj) {
    let getWhat = obj.getAttribute("getWhat");
    let nextPage = Number(obj.getAttribute("pageNum")) + 1;
    console.info('nextPage = ' + nextPage);
    getTrackerData(getWhat, nextPage, 10);
}

//
function formatTime(time) {
    // console.info(time);
    if (time === '0001-01-01T00:00:00Z') {  // Null time
        return '';
    }

    return time.substring(0, 19).replace('T', ' ');
}

//
function autoMode(obj) {
    if (obj.checked) {
        isAutoMode = true;
    } else {
        isAutoMode = false;
    }
    console.info('CLICK - isAutoMode = ' + isAutoMode);
}

/**
 * MsgType_GetMnemonic_2004
 * This is a OBD JS API. Will be moved to obdapi.js file.
 */
function genMnemonic() {
    return btctool.generateMnemonic(128);
}

/**
 * MsgType_Mnemonic_CreateAddress_3000
 * genAddressFromMnemonic by local js library
 * This is a OBD JS API. Will be moved to obdapi.js file.
 */
function genAddressFromMnemonic() {
    if (!isLogined) { // Not logined
        alert('Please login first.');
        return '';
    }

    let newIndex = getNewAddrIndex();
    // console.info('mnemonicWithLogined = ' + mnemonicWithLogined);
    // console.info('addr index = ' + newIndex);

    // True: testnet  False: mainnet
    let result = btctool.generateWalletInfo(mnemonicWithLogined, newIndex, true);
    console.info('local addr data = ' + JSON.stringify(result));

    return result;
}

/**
 * MsgType_Mnemonic_GetAddressByIndex_3001
 * get Address Info by local js library
 * This is a OBD JS API. Will be moved to obdapi.js file.
 */
function getAddressInfo() {
    if (!isLogined) { // Not logined
        alert('Please login first.');
        return '';
    }

    var index = $("#index").val();
    console.info('index = ' + index);

    try {
        // True: testnet  False: mainnet
        var result = btctool.generateWalletInfo(mnemonicWithLogined, index, true);
        console.info('local addr data = ' + JSON.stringify(result));
    } catch (error) {
        alert('Please input a valid index of address.');
        return '';
    }

    if (!result.status) { // status = false
        alert('Please input a valid index of address.');
        return '';
    }

    return result;
}