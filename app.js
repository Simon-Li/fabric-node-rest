/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const log4js = require('log4js');

const logger = log4js.getLogger('FabricNodeRest');
const express = require('express');
//const session = require('express-session');
//const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const http = require('http');
const util = require('util');

const app = express();
const expressJWT = require('express-jwt');
const jwt = require('jsonwebtoken');
const bearerToken = require('express-bearer-token');
const cors = require('cors');

require('./config.js');
const hfc = require('fabric-client');

const helper = require('./app/helper.js');
const channels = require('./app/create-channel.js');
const join = require('./app/join-channel.js');
const install = require('./app/install-chaincode.js');
const instantiate = require('./app/instantiate-chaincode.js');
const invoke = require('./app/invoke-transaction.js');
const query = require('./app/query.js');

const host = process.env.HOST || hfc.getConfigSetting('host');
const port = process.env.PORT || hfc.getConfigSetting('port');

///////////////////////////////////////////////////////////////////////////////
// SET CONFIGURATONS
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());

//support parsing of application/json type post data
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
    extended: false
}));

// set secret const
app.set('secret', 'thisismysecret');
app.use(expressJWT({
    secret: 'thisismysecret'
}).unless({
    path: ['/users']
}));
app.use(bearerToken());
app.use((req, res, next) => {
    if (req.originalUrl.indexOf('/users') >= 0) {
        return next();
    }

    const token = req.token;
    jwt.verify(token, app.get('secret'), (err, decoded) => {
        if (err) {
            res.send({
                success: false,
                message: 'Failed to authenticate token. Make sure to include the ' +
                    'token returned from /users call in the authorization header ' +
                    ' as a Bearer token'
            });
            //return;
        }

        // add the decoded user name and org name to the request object
        // for the downstream code to use
        req.username = decoded.username;
        req.orgname = decoded.orgName;
        logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s', decoded.username, decoded.orgName));
        return next();
    });

    //return next();
});

///////////////////////////////////////////////////////////////////////////////
// START SERVER
///////////////////////////////////////////////////////////////////////////////
const server = http.createServer(app).listen(port, () => {});
logger.info('****************** SERVER STARTED ************************');
logger.info(`**************  http://' + ${host} + ':' + ${port} + '  ******************`);
server.timeout = 240000;

/**
 * get error message
 * @param {string} field Field
 * @returns {object} response
 */
function getErrorMessage(field) {
    const response = {
        success: false,
        message: `${field} field is missing or Invalid in the request`
    };
    return response;
}

/**
 * async middleware wrapper
 * @param {object} fn Function to be wrapped in a promise
 * @returns {object} middleware handler
 */
function asyncMiddleware(fn) {
    return function middlewareFn(req, res, next) {
        Promise.resolve(fn(req, res, next))
            .catch(next);
    };
}

///////////////////////////////////////////////////////////////////////////////
// REST ENDPOINTS START HERE
///////////////////////////////////////////////////////////////////////////////

// Register and enroll user
app.post('/users', (req, res) => {
    const username = req.body.username;
    const orgName = req.body.orgName;

    logger.debug('End point : /users');
    logger.debug(`User name : ${username}`);
    logger.debug(`Org name  : ${orgName}`);

    if (!username) {
        res.json(getErrorMessage('\'username\''));
        return;
    }
    if (!orgName) {
        res.json(getErrorMessage('\'orgName\''));
        return;
    }
    const token = jwt.sign({
        exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime'), 10),
        username,
        orgName
    }, app.get('secret'));
    helper.getRegisteredUsers(username, orgName, true).then((response) => {
        if (response && typeof response !== 'string') {
            response.token = token;
            res.json(response);
        }
        else {
            res.json({
                success: false,
                message: response
            });
        }
    });
});

// Create Channel
app.post('/channels', (req, res) => {
    logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
    logger.debug('End point : /channels');

    const channelName = req.body.channelName;
    const channelConfigPath = req.body.channelConfigPath;
    logger.debug(`Channel name : ${channelName}`);
    logger.debug(`channelConfigPath : ${channelConfigPath}`); // "../fixtures/channel/channel.tx"
    if (!channelName) {
        res.json(getErrorMessage('\'channelName\''));
        return;
    }
    if (!channelConfigPath) {
        res.json(getErrorMessage('\'channelConfigPath\''));
        return;
    }

    channels.createChannel(channelName, channelConfigPath, req.username, req.orgname)
    .then((message) => {
        res.send(message);
    });
});

// Join Channel
app.post('/channels/:channelName/peers', (req, res) => {
    logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');

    const channelName = req.params.channelName;
    const peers = req.body.peers;
    logger.debug(`channelName : ${channelName}`);
    logger.debug(`peers : ${peers}`);

    if (!channelName) {
        res.json(getErrorMessage('\'channelName\''));
        return;
    }
    if (!peers || peers.length === 0) {
        res.json(getErrorMessage('\'peers\''));
        return;
    }

    join.joinChannel(channelName, peers, req.username, req.orgname)
    .then((message) => {
        res.send(message);
    });
});

// Install chaincode on target peers
app.post('/chaincodes', (req, res) => {
    logger.debug('==================== INSTALL CHAINCODE ==================');

    const peers = req.body.peers;
    const chaincodeName = req.body.chaincodeName;
    const chaincodePath = req.body.chaincodePath;
    const chaincodeVersion = req.body.chaincodeVersion;
    logger.debug(`peers : ${peers}`); // target peers list
    logger.debug(`chaincodeName : ${chaincodeName}`);
    logger.debug(`chaincodePath  : ${chaincodePath}`);
    logger.debug(`chaincodeVersion  : ${chaincodeVersion}`);

    if (!peers || peers.length === 0) {
        res.json(getErrorMessage('\'peers\''));
        return;
    }
    if (!chaincodeName) {
        res.json(getErrorMessage('\'chaincodeName\''));
        return;
    }
    if (!chaincodePath) {
        res.json(getErrorMessage('\'chaincodePath\''));
        return;
    }
    if (!chaincodeVersion) {
        res.json(getErrorMessage('\'chaincodeVersion\''));
        return;
    }

    install.installChaincode(peers, chaincodeName, chaincodePath, chaincodeVersion, req.username, req.orgname)
    .then((message) => {
        res.send(message);
    });
});

// Instantiate chaincode on target peers
app.post('/channels/:channelName/chaincodes', (req, res) => {
    logger.debug('==================== INSTANTIATE CHAINCODE ==================');

    const chaincodeName = req.body.chaincodeName;
    const chaincodeVersion = req.body.chaincodeVersion;
    const channelName = req.params.channelName;
    const fcn = req.body.fcn;
    const args = req.body.args;
    logger.debug(`channelName  : ${channelName}`);
    logger.debug(`chaincodeName : ${chaincodeName}`);
    logger.debug(`chaincodeVersion  : ${chaincodeVersion}`);
    logger.debug(`fcn  : ${fcn}`);
    logger.debug(`args  : ${args}`);

    if (!chaincodeName) {
        res.json(getErrorMessage('\'chaincodeName\''));
        return;
    }
    if (!chaincodeVersion) {
        res.json(getErrorMessage('\'chaincodeVersion\''));
        return;
    }
    if (!channelName) {
        res.json(getErrorMessage('\'channelName\''));
        return;
    }
    if (!args) {
        res.json(getErrorMessage('\'args\''));
        return;
    }
    instantiate.instantiateChaincode(channelName, chaincodeName, chaincodeVersion, fcn, args, req.username, req.orgname)
    .then((message) => {
        res.send(message);
    });
});

// Invoke transaction on chaincode on target peers
app.post('/channels/:channelName/chaincodes/:chaincodeName', (req, res) => {
    logger.debug('==================== INVOKE ON CHAINCODE ==================');

    const peers = req.body.peers;
    const chaincodeName = req.params.chaincodeName;
    const channelName = req.params.channelName;
    const fcn = req.body.fcn;
    const args = req.body.args;
    logger.debug(`channelName  : ${channelName}`);
    logger.debug(`chaincodeName : ${chaincodeName}`);
    logger.debug(`fcn  : ${fcn}`);
    logger.debug(`args  : ${args}`);

    if (!chaincodeName) {
        res.json(getErrorMessage('\'chaincodeName\''));
        return;
    }
    if (!channelName) {
        res.json(getErrorMessage('\'channelName\''));
        return;
    }
    if (!fcn) {
        res.json(getErrorMessage('\'fcn\''));
        return;
    }
    if (!args) {
        res.json(getErrorMessage('\'args\''));
        return;
    }

    invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname)
    .then((message) => {
        res.send(message);
    });
});
// Query on chaincode on target peers
app.get('/channels/:channelName/chaincodes/:chaincodeName', (req, res) => {
    logger.debug('==================== QUERY BY CHAINCODE ==================');

    const channelName = req.params.channelName;
    const chaincodeName = req.params.chaincodeName;
    let args = req.query.args;
    const fcn = req.query.fcn;
    const peer = req.query.peer;

    logger.debug(`channelName : ${channelName}`);
    logger.debug(`chaincodeName : ${chaincodeName}`);
    logger.debug(`fcn : ${fcn}`);
    logger.debug(`args : ${args}`);

    if (!chaincodeName) {
        res.json(getErrorMessage('\'chaincodeName\''));
        return;
    }
    if (!channelName) {
        res.json(getErrorMessage('\'channelName\''));
        return;
    }
    if (!fcn) {
        res.json(getErrorMessage('\'fcn\''));
        return;
    }
    if (!args) {
        res.json(getErrorMessage('\'args\''));
        return;
    }
    args = args.replace(/'/g, '"');
    args = JSON.parse(args);
    logger.debug(args);

    query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname)
    .then((message) => {
        res.send(message);
    });
});

//  Query Get Block by BlockNumber
app.get('/channels/:channelName/blocks/:blockId', (req, res) => {
    logger.debug('==================== GET BLOCK BY NUMBER ==================');

    const blockId = req.params.blockId;
    const peer = req.query.peer;
    logger.debug(`channelName : ${req.params.channelName}`);
    logger.debug(`BlockID : ${blockId}`);
    logger.debug(`Peer : ${peer}`);

    if (!blockId) {
        res.json(getErrorMessage('\'blockId\''));
        return;
    }

    query.getBlockByNumber(peer, blockId, req.username, req.orgname)
        .then((message) => {
            res.send(message);
        });
});

// Query Get Transaction by Transaction ID
app.get('/channels/:channelName/transactions/:trxnId', (req, res) => {
    logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================');
    logger.debug(`channelName : ${req.params.channelName}`);

    const trxnId = req.params.trxnId;
    const peer = req.query.peer;
    if (!trxnId) {
        res.json(getErrorMessage('\'trxnId\''));
        return;
    }

    query.getTransactionByID(peer, trxnId, req.username, req.orgname)
        .then((message) => {
            res.send(message);
        });
});

// Query Get Block by Hash
app.get('/channels/:channelName/blocks', (req, res) => {
    logger.debug('================ GET BLOCK BY HASH ======================');
    logger.debug(`channelName : ${req.params.channelName}`);

    const hash = req.query.hash;
    const peer = req.query.peer;
    if (!hash) {
        res.json(getErrorMessage('\'hash\''));
        return;
    }

    query.getBlockByHash(peer, hash, req.username, req.orgname).then(
        (message) => {
            res.send(message);
        });
});

//Query for Channel Information
app.get('/channels/:channelName', (req, res) => {
    logger.debug('================ GET CHANNEL INFORMATION ======================');
    logger.debug(`channelName : ${req.params.channelName}`);

    const peer = req.query.peer;

    query.getChainInfo(peer, req.username, req.orgname).then(
        (message) => {
            res.send(message);
        });
});

// Query to fetch all Installed/instantiated chaincodes
app.get('/chaincodes', (req, res) => {
    const peer = req.query.peer;
    const installType = req.query.type;
    //TODO: add Constnats
    if (installType === 'installed') {
        logger.debug(
            '================ GET INSTALLED CHAINCODES ======================');
    }
    else {
        logger.debug(
            '================ GET INSTANTIATED CHAINCODES ======================');
    }

    query.getInstalledChaincodes(peer, installType, req.username, req.orgname)
    .then((message) => {
        res.send(message);
    });
});

// Query to fetch channels
app.get('/channels', (req, res) => {
    logger.debug('================ GET CHANNELS ======================');
    logger.debug(`peer: ${req.query.peer}`);

    const peer = req.query.peer;
    if (!peer) {
        res.json(getErrorMessage('\'peer\''));
        return;
    }

    query.getChannels(peer, req.username, req.orgname)
    .then((message) => {
        res.send(message);
    });
});
