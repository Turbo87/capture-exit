var RSVP = require('rsvp');

var exit;
var handlers = [];
var lastTime;

/*
 * To allow cooperative async exit handlers, we unfortunately must hijack
 * process.exit.
 *
 * It allows a handler to ensure exit, without that exit handler impeding other
 * similar handlers
 *
 * for example, see: https://github.com/sindresorhus/ora/issues/27
 *
 */
module.exports.releaseExit = function() {
  if (exit) {
    process.exit = exit;
    exit = null;
  }
};

module.exports.captureExit = function() {
  if (exit) {
    // already captured, no need to do more work
    return;
  }
  exit = process.exit;

  process.exit = function(code) {
    lastTime = module.exports._flush(lastTime, code)
      .finally(function() {
        exit.call(process, code);
      })
      .catch(function(error) {
        console.error(error);
        exit.apply(process, 1);
      });
  };
};

module.exports._handlers = handlers;
module.exports._flush = function(lastTime, code) {
  var work = handlers.splice(0, handlers.length);

  return RSVP.Promise.resolve(lastTime).
    then(function() {
      return RSVP.map(work, function(handler) {
        return handler.call(null, code);
      });
    });
};

module.exports.onExit = function(cb) {
  var index = handlers.indexOf(cb);

  if (index > -1) { return; }
  handlers.push(cb);
};

module.exports.offExit = function(cb) {
  var index = handlers.indexOf(cb);

  if (index < 0) { return; }

  handlers.splice(index, 1);
};

module.exports.exit  = function() {
  exit.apply(process, arguments);
};
