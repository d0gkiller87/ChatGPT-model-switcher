// ==UserScript==
// @name         ChatGPT Model Switcher: Toggle on/off 4o-mini
// @namespace    http://tampermonkey.net/
// @version      0.40
// @description  Injects a button allowing you to toggle on/off 4o-mini during the chat
// @match        *://chatgpt.com/*
// @author       d0gkiller87
// @license      MIT
// @grant        unsafeWindow
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM_addStyle
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// ==/UserScript==

(async function() {
  'use strict';

  class ModelSwitcher {
    constructor( useMini = true ) {
      this.useMini = useMini;
      this.buttons = {};
    }

    hookFetch() {
      const originalFetch = unsafeWindow.fetch;
      unsafeWindow.fetch = async ( resource, config = {} ) => {
        if (
          resource === 'https://chatgpt.com/backend-api/conversation' &&
          config.method === 'POST' &&
          config.headers &&
          config.headers['Content-Type'] === 'application/json' &&
          config.body
        ) {
          if ( this.useMini ) {
            const body = JSON.parse( config.body );
            body.model = 'gpt-4o-mini';
            config.body = JSON.stringify( body );
          }
        }
        return originalFetch( resource, config );
      };
    }

    injectToggleButtonStyle() {
      GM_addStyle(`
  #model-selector {
    position: fixed;
    bottom: 35px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.1);
    color: white;
    padding: 10px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 9999;
  }
  #model-selector button {
    background: none;
    border: 1px solid white;
    color: white;
    padding: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  #model-selector button.btn-4o-mini {
    background-color: #43a25a;
  }
  #model-selector button.btn-default {
    background-color: #83838b;
  }
`);
    }

    refreshButtons() {
      for ( const [ model, button ] of Object.entries( this.buttons ) ) {
        if ( this.useMini ) {
          button.classList.toggle( model, model === 'btn-4o-mini' );
        } else {
          button.classList.toggle( model, model !== 'btn-4o-mini' );
        }
      }
    }

    createModelSelectorMenu() {
      this.modelSelector = document.createElement( 'div' );
      this.modelSelector.id = 'model-selector';

      [ '4o-mini', 'default' ].forEach(
        model => {
          const button = document.createElement( 'button' );
          button.textContent = model;//model.charAt(0).toUpperCase() + model.slice(1);
          button.onclick = async () => {
            this.useMini = !this.useMini;
            await GM.setValue( 'useMini', this.useMini );
            this.refreshButtons();
          }
          this.modelSelector.appendChild( button );
          this.buttons[`btn-${ model }`] = button;
        }
      );
    }

    monitorBodyChanges() {
      const observer = new MutationObserver( mutationsList => {
        for ( const mutation of mutationsList ) {
          if ( document.body.querySelector( '#model-selector' ) ) continue;
          document.body.appendChild( this.modelSelector );
          break;
        }
      });
      observer.observe( document.body, { childList: true } );
    }
  }

  const useMini = await GM.getValue( 'useMini', true );
  const switcher = new ModelSwitcher( useMini );
  switcher.hookFetch();
  switcher.injectToggleButtonStyle();
  switcher.createModelSelectorMenu();
  switcher.refreshButtons();
  switcher.monitorBodyChanges();
  document.body.appendChild( switcher.modelSelector );
})();
