/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  importScripts("push-sw.js");
  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "1568e7f20a4cef566347309df1f49962"
  }, {
    "url": "pwa-512x512.png",
    "revision": "1568e7f20a4cef566347309df1f49962"
  }, {
    "url": "pwa-192x192.png",
    "revision": "43488484d7963a3410e6b6f7c316f402"
  }, {
    "url": "push-sw.js",
    "revision": "848838b6d9215365b158f15a0add1863"
  }, {
    "url": "index.html",
    "revision": "18f8fc2b3bffbf14e4a8c69f43a64e85"
  }, {
    "url": "icon.svg",
    "revision": "26cba74a80fe534c0d27d1ab09f68149"
  }, {
    "url": "favicon.ico",
    "revision": "43488484d7963a3410e6b6f7c316f402"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "22bc812f04278c64f0cf68905029ae23"
  }, {
    "url": "assets/index-R7rtFQ6R.css",
    "revision": null
  }, {
    "url": "assets/index-C6bcA29Z.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "22bc812f04278c64f0cf68905029ae23"
  }, {
    "url": "favicon.ico",
    "revision": "43488484d7963a3410e6b6f7c316f402"
  }, {
    "url": "icon.svg",
    "revision": "26cba74a80fe534c0d27d1ab09f68149"
  }, {
    "url": "pwa-192x192.png",
    "revision": "43488484d7963a3410e6b6f7c316f402"
  }, {
    "url": "pwa-512x512.png",
    "revision": "1568e7f20a4cef566347309df1f49962"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "1568e7f20a4cef566347309df1f49962"
  }, {
    "url": "icons/degira-van.jpg",
    "revision": "7f5d600f2ca3c55ee69801395233c92d"
  }, {
    "url": "manifest.webmanifest",
    "revision": "57de376785889184babb9676af892cfd"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
