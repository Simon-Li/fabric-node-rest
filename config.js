const util = require('util');
const path = require('path');
const hfc = require('fabric-client');

let file = 'network-config%s.json';

const env = process.env.TARGET_NETWORK;
if (env) {
    file = util.format(file, `-${env}`);
}
else {
    file = util.format(file, '');
}

hfc.addConfigFile(path.join(__dirname, 'app', file));
hfc.addConfigFile(path.join(__dirname, 'config.json'));
