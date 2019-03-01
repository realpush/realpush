'use strict'

function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  var results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

function b64ToUnit8Arr(b64) {
  var padding = '='.repeat((4 - b64.length % 4) % 4);
  var base64 = (b64 + padding).replace(/\-/g, '+').replace(/_/g, '/');

  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
}

function nexturl() {
  var loc = window.location;

  if (!!~loc.host.indexOf('localhost')) {
    return;
  }

  var parts = loc.host.split(".");
  var sub = s4() + s4();
  if (parts.length > 2) {
    parts[0] = sub
  } else {
    parts = [sub].concat(parts);
  }

  var host = parts.join(".");
  loc.replace(`${loc.protocol}//${host}/${loc.search}`)
}

function getDeviceType() {
  var ua = navigator.userAgent.toLowerCase();
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua)) {
    return 'tablet';
  } else if (/(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo ds|archos|skyfire|puffin|blazer|bolt|gobrowser|iris|maemo|semc|teashark|uzard)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

function Subscribe() {
  var trback = getUrlParameter('url') || 'https://google.com';
  var can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!can) {
    //window.location.replace(trback);
    return;
  }

  Notification.requestPermission()
    .then(function (perm) {
      if (perm !== "granted") {
        nexturl();
        return Promise.reject(new Error("Bad permisions"));
      }
      return navigator.serviceWorker.register('sw.js');
    })
    .then(function (sw) {
      return sw.pushManager.getSubscription()
        .then(function (sub) {
          var isnew = sub === null;
          sub = sub || sw.pushManager.subscribe({
            applicationServerKey: b64ToUnit8Arr(window.hashKey),
            userVisibleOnly: true
          })
          return Promise.all([
            (sub instanceof Promise) ? sub : Promise.resolve(sub),
            Promise.resolve(isnew)
          ])
        })
    })
    .then(function (data) {
      if (!data[1]) {
        var loc = window.location;
        if (!!!~loc.host.indexOf('localhost')) {
          loc.replace(trback);
        } else {
          console.log('Have subscription. Move to: ' + trback);
        }
        return Promise.resolve()
      }
      var sub = data[0];
      var p256dh = sub.getKey("p256dh");
      var auth = sub.getKey("auth");
      var timezone = (new Date).getTimezoneOffset();
      var body = {
        endpoint: sub.endpoint,
        timestamp: Math.floor(Date.now() / 1e3),
        lang: navigator.language || navigator.userLanguage,
        device: getDeviceType(),
        tz: timezone === 0 ? 0 : -timezone,
        p256dh: p256dh ? window.btoa(String.fromCharCode.apply(null, new Uint8Array(p256dh))) : null,
        auth: auth ? window.btoa(String.fromCharCode.apply(null, new Uint8Array(auth))) : null,

        agent: window.agent,
        site: window.site,

        host: window.location.host
      }
      return fetch('/api/subscriber', {
        method: "POST",
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        localStorage.setItem("id", data.id);
        var loc = window.location;
        if (!!!~loc.host.indexOf('localhost')) {
          loc.replace(trback);
        } else {
          console.log('Subscription complete. Move to: ' + trback);
        }
      });
    })
    .catch(function (err) {
      console.error(err);
    })
}

document.addEventListener('keydown', function (e) {
  if (e.keyCode) {
    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.mozRequestFullScreen) {
        document.documentElement.mozRequestFullScreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
      }
    }
  }
}, false);

document.addEventListener("DOMContentLoaded", function (event) {
  Subscribe();
  document.body.addEventListener('click', function () {
    let req = document.body.requestFullScreen || document.body.webkitRequestFullScreen || document.body.mozRequestFullScreen;
    req.call(document.body);
  })
});