// ==UserScript==
// @name         ChatGPT Model Switcher: Toggle on/off 4o-mini
// @namespace    http://tampermonkey.net/
// @version      0.21
// @description  Injects a button allowing you to toggle on/off 4o-mini during the chat
// @match        *://chatgpt.com/*
// @author       d0gkiller87
// @license      MIT
// @grant        unsafeWindow
// @grant        GM.setValue
// @grant        GM.getValue
// @run-at       document-end
// ==/UserScript==

(async function() {
  'use strict';

  class ModelSwitcher {
    constructor( useMini = true ) {
      this.useMini = useMini;
    }

    hookFetch() {
      const originalFetch = unsafeWindow.fetch;
      unsafeWindow.fetch = async ( resource, config = {} ) => {
        if (
          this.useMini &&
          resource === 'https://chatgpt.com/backend-api/conversation' &&
          config.method === 'POST' &&
          config.headers &&
          config.headers['Content-Type'] === 'application/json' &&
          config.body
        ) {
          const body = JSON.parse( config.body );
          body.model = 'gpt-4o-mini';
          config.body = JSON.stringify( body );
        }
        return originalFetch( resource, config );
      };
    }

    injectToggleButton() {
      // Credit: https://webdevworkshop.io/code/css-toggle-button/
      if ( !document.getElementById( 'toggleCss' ) ) {
        const styleNode = document.createElement( 'style' );
        styleNode.id = 'toggleCss';
        styleNode.type = 'text/css';
        styleNode.textContent = `.toggle {
  position: relative;
  display: inline-block;
  width: 2.5rem;
  height: 1.5rem;
  background-color: hsl(0deg 0% 40%);
  border-radius: 25px;
  cursor: pointer;
  transition: background-color 0.25s ease-in;
}
.toggle::after {
  content: '';
  position: absolute;
  width: 1.4rem;
  left: 0.1rem;
  height: calc(1.5rem - 2px);
  top: 1px;
  background-color: white;
  border-radius: 50%;
  transition: all 0.25s ease-out;
}
#cb-toggle:checked + .toggle {
  background-color: hsl(102, 58%, 39%);
}
#cb-toggle:checked + .toggle::after {
  transform: translateX(1rem);
}
.hide-me {
  opacity: 0;
  height: 0;
  width: 0;
}`;
        document.head.appendChild( styleNode );
      }

      const container = document.querySelector( '#composer-background div:nth-of-type(2) div:first-child' );
      if ( container ) {
        container.classList.add( 'items-center' );

        const observer = new MutationObserver( mutationsList => {
          for ( const mutation of mutationsList ) {
            if ( mutation.type !== 'childList' ) continue;
            if ( !mutation.addedNodes ) continue;
            observer.disconnect();

            setTimeout(() => {
              // <input id="cb-toggle" type="checkbox" class="hide-me">
              const checkbox = document.createElement( 'input' );
              checkbox.id = 'cb-toggle';
              checkbox.type = 'checkbox';
              checkbox.className = 'hide-me';
              checkbox.checked = this.useMini;

              // <label for="cb-toggle" class="toggle" title="Toggle GPT-4o Mini"></label>
              const label = document.createElement( 'label' );
              label.htmlFor = 'cb-toggle';
              label.className = 'toggle';
              label.title = `Using model: ${ this.useMini ? 'GPT-4o mini' : 'original' }`;

              container.appendChild( checkbox );
              container.appendChild( label );

              const cb = document.querySelector( '#cb-toggle' );
              cb.addEventListener(
                'click', async () => {
                  this.useMini = cb.checked;
                  await GM.setValue( 'useMini', this.useMini );
                  label.title = `Using model: ${ this.useMini ? 'GPT-4o mini' : 'original' }`;
                },
                false
              );
            }, 1000 );

            break;
          }
        });
        observer.observe( container, { childList: true } );
      } else {
        console.error( 'container not found!' );
      }
    }
  }

  const useMini = await GM.getValue( 'useMini', true );
  const switcher = new ModelSwitcher( useMini );
  switcher.hookFetch();
  switcher.injectToggleButton();
})();
