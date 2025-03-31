// ==UserScript==
// @name         ChatGPT Model Switcher: Toggle on/off 4o-mini
// @namespace    http://tampermonkey.net/
// @version      0.30
// @description  Injects a button allowing you to toggle on/off 4o-mini during the chat
// @match        *://chatgpt.com/*
// @author       d0gkiller87
// @license      MIT
// @grant        unsafeWindow
// @grant        GM.setValue
// @grant        GM.getValue
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// ==/UserScript==

(async function() {
  'use strict';

  class ModelSwitcher {
    constructor( useMini = true ) {
      this.useMini = useMini;
      this.containerSelector = 'div[style*=--vt-composer-]';
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
  transition: background-color 0.2s ease-in;
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
  transition: all 0.2s ease-out;
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
  display: none;
}`;
        document.head.appendChild( styleNode );
      }
    }

    getContainer() {
      return document.querySelector( this.containerSelector ).parentElement;
    }

    injectToggleButton( container = null ) {
      console.log( 'inject' );
      if ( !container ) container = this.getContainer();
      if ( !container ) {
        console.error( 'container not found!' );
        return;
      }
      if ( container.querySelector( '#cb-toggle' ) ) {
        console.log( '#cb-toggle already exists' );
        return;
      }
      container.classList.add( 'items-center' );

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
    }

    monitorChild( nodeSelector, is_parent, callback ) {
      let node = document.querySelector( nodeSelector );
      if ( is_parent ) node = node.parentElement;
      if ( !node ) {
        console.log( `${ nodeSelector } not found!` )
        return;
      }
      const observer = new MutationObserver( mutationsList => {
        for ( const mutation of mutationsList ) {
          console.log( nodeSelector );
          callback( observer, mutation );
          break;
        }
      });
      observer.observe( node, { childList: true } );
    }

    __tagAttributeRecursively( selector ) {
      // Select the node using the provided selector
      const rootNode = document.querySelector( selector );
      if ( !rootNode ) {
        console.warn( `No element found for selector: ${ selector }` );
        return;
      }

      // Recursive function to add the "xx" attribute to the node and its children
      function addAttribute( node ) {
        node.setAttribute( "xxx", "" ); // Add the attribute to the current node
        Array.from( node.children ).forEach( addAttribute ); // Recurse for all child nodes
      }

      addAttribute( rootNode );
    }


    monitorNodesAndInject() {
      this.monitorChild( 'body main' /* switching conversation */, false, () => {
        this.injectToggleButton();

        this.monitorChild( '.composer-parent > div:nth-child(2)' /* new conversation */, false, ( observer, mutation ) => {
          observer.disconnect();
          this.injectToggleButton();
        });
      });

      this.monitorChild( this.containerSelector /* init */, true, ( observer, mutation ) => {
        observer.disconnect();
        setTimeout( () => this.injectToggleButton(), 500 );
      });

      this.monitorChild( '.composer-parent > div:nth-child(2)' /* new conversation */, false, ( observer, mutation ) => {
        observer.disconnect();
        this.injectToggleButton();
      });
    }
  }

  const useMini = await GM.getValue( 'useMini', true );
  const switcher = new ModelSwitcher( useMini );
  switcher.hookFetch();
  switcher.injectToggleButtonStyle();
  switcher.monitorNodesAndInject();
})();
