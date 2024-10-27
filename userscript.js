// ==UserScript==
// @name         ChatGPT use 4o-mini model instead of 4o
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Intercepts completion requests and inject {model: gpt-4o-mini} into the request
// @match        *://chatgpt.com/*
// @grant        none
// @author       d0gkiller87
// @license      MIT
// ==/UserScript==

(function() {
  'use strict';

  // Store the original fetch function
  const originalFetch = window.fetch;

  // Override the fetch function
  window.fetch = async (resource, config = {}) => {
    // Check if the config has a JSON body in a POST request
    if (
      resource == 'https://chatgpt.com/backend-api/conversation' &&
      config.method === 'POST' &&
      config.headers &&
      config.headers['Content-Type'] === 'application/json' &&
      config.body
    ) {
      // Parse the JSON body
      const body = JSON.parse(config.body);

      // Add "debug": true to the JSON payload
      body.model = 'gpt-4o-mini';

      // Update the config body with the modified JSON
      config.body = JSON.stringify(body);
    }

    // Call the original fetch with modified config
    return originalFetch(resource, config);
  };
})();
