'use strict';

// LOADED AT NPM INSTALL. RENINSTALL IS REQUIRED FOR FUNCTIONALITY CHANGES

let fs   = require('fs');
let _    = require('lodash');
let root = require('app-root-path');
let clc  = require('cli-color');

// USAGE
//
// - returns index.json with local.json overrides
// - config([NAME]) will return the config named. no name will return the index config
// - config.list() returns additional configs accessed via the function
// - config.fin([STRING]) performs _.findValue on the config being accessed
// - config.env contains usefull proces information (including command line parameters)


//
// Helpers
//

module.exports = (function () {
  let load = function (fileName) {
    let path = root + '/config/' + fileName + '.json';
    if (_.isString(fileName) && fs.existsSync(path)) {
      return _.clone(require(path), true);
    } else if (fileName !== 'local') {
      console.warn(clc.yellow('  !Failed to load file: ') + fileName);
      return false;
    } else {
      return false;
    }
  };

  let findProperty = function (obj, query) {
    let querySplit = (query || '').split('.');
    let result     = obj || this;
    let depthCount = 0;

    try {
      _.each(querySplit, function (propName) {

        // check for arrays
        if (/\[\d\]/.test(propName)) {
          let leadMatch    = propName.match(/^(.*?)\[/) || [];
          let trailMatch   = propName.match(/.*\](.*)$/) || [];
          let leadingProp  = leadMatch[1];
          let trailingProp = trailMatch[1];
          let arrOnly      = propName.replace(leadingProp, '');
          arrOnly          = arrOnly.replace(trailingProp, '');
          arrOnly          = _.compact(arrOnly.replace(/\[/g, '').split(']'));

          result = result[leadingProp];
          _.each(arrOnly, function (index) { result = result[parseInt(index, 10)]; });

          result = trailingProp ? result[trailingProp] : result;

        // simple prop
        } else {
          result = result[propName];
        }
      });
    } catch (e) {
      result = undefined;
    }

    return result;
  };


  //
  // Initial setup
  //


  let secondary = {};
  let config = function (confName) {
    return confName ? (secondary[confName] || null) : config;
  };


  //
  // Core configs
  //


  let index = load('index');
  let local = load('local');

  let raw   = _.defaultsDeep(local || {}, index || {});
  if (!index && !local) { throw Error('index.json or local.json is required'); }

  _.extend(config, raw);

  config.find = function (query) { return findProperty(this, query); };

  config.list = function () { return Object.keys(secondary); };

  config.raw  = function () { return _.cloneDeep(raw); }; // required to pass between processes

  config.package = require(root + '/package.json');


  //
  // Envrionment configs
  //


  config.local         = {};
  config.local.isDev   = (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'development');
  config.local.isProd  = !config.local.isDev;
  config.local.env     = config.local.isProd ? 'production' : 'development';
  config.local.port    = process.env.PORT || 80;
  config.local.host    = process.env.HOST || '127.0.0.1';
  config.local.version = process.env.VERSION || require(root + '/package.json').version;


  //
  // Models
  //

  config.models = {};
  _.each(fs.readdirSync(root + '/config/models'), function (fileName) {
    if (/\.json$/.test(fileName)) {
      let name = fileName.replace(/\.json$/, '');
      config.models[name] = load('models/' + name);
      if (config.models[name]) config.models[name].model = true;
    }
  });


  //
  // Additional configs
  //


  _.each(fs.readdirSync(root + '/config'), function (fileName) {
    if (/\.json$/.test(fileName) && !_.includes(['index.json', 'local.json'], fileName)) {
      let name             = fileName.replace(/\.json$/, '');
      secondary[name]      = load(name);
      secondary[name].find = function (query) { return findProperty(this, query); };
    }
  });

  return config;
})();
