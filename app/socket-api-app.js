/**
 * Created by maksim on 7/18/17.
 * Updated by Simon Li on 2/6/18.
 */

"use strict";

var log4js = require('log4js');
var logger = log4js.getLogger('Socket');
var peerListener = require('./peer-listener.js');
var tools = require('./tools');

var hfc = require('fabric-client');
hfc.setLogger(logger);
var networkConfig = hfc.getConfigSetting('network-config');

// config
var config = require('../config.json');
const USERNAME = config.admins[0].username;

/**
 * @param {Server} io
 * @param {object} options
 */
function init(io, options) {
  var ORG = options.org;

  var orgConfig = networkConfig[ORG];
  if (!orgConfig) {
    throw new Error('No such organisation in config: '+ORG);
  }

  const peerNameKeys = Object.keys(orgConfig.peers).filter(k => k.startsWith('peer'));
  const peersAddress = peerNameKeys.map(peerkey => tools.getHost(networkConfig[ORG]['peers'][peerkey].requests));

  // log connections
  io.on('connection', function(socket){
    logger.debug('a new user connected:', socket.id);
    socket.on('disconnect', function(/*socket*/){
      logger.debug('user disconnected:', socket.id);
    });
  });

  // emit block appearance
  var lastBlock = null;

  //TODO: listen all peers, remove duplicates
  peerListener.init(peersAddress, ORG);
  peerListener.registerBlockEvent(function(block){
    // emit globally
    lastBlock = block;
    io.emit('chainblock', block);
  });

  // note: these statuses should be matched with client status set
  peerListener.eventHub.on('disconnected', function(){ io.emit('status', 'disconnected'); });
  peerListener.eventHub.on('connecting',   function(){ io.emit('status', 'connecting');   });
  peerListener.eventHub.on('connected',    function(){ io.emit('status', 'connected');    });

  peerListener.listen();

  io.on('connection', function(socket){
    socket.emit('status', peerListener.isConnected() ? 'connected':'disconnected' );
    // if(lastBlock){
    //   socket.emit('chainblock', lastBlock);
    // }
  });


  // setInterval(function(){
  //   socket.emit('ping', Date.now() );
  // }, 5000);
}

exports.init = init;
