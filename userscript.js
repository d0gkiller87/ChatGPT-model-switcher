// ==UserScript==
// @name         ChatGPT Model Switcher: Toggle on/off 4o-mini
// @namespace    http://tampermonkey.net/
// @version      0.41
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
      this.offsetX = 0;
      this.offsetY = 0;
      this.isDragging = false;
      this.shouldCancelClick = false;
      this.modelSelector = null;
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
    position: absolute;
    background-color: rgba(0, 0, 0, 0.1);
    color: white;
    padding: 10px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 9999;
    cursor: grab;
  }
  #model-selector button {
    background: none;
    border: 1px solid white;
    color: white;
    padding: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    user-select: none;
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
          button.textContent = model;
          button.onclick = async event => {
            if ( this.shouldCancelClick ) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return;
            }
            this.useMini = model === '4o-mini';
            await GM.setValue( 'useMini', this.useMini );
            this.refreshButtons();
          }
          this.modelSelector.appendChild( button );
          this.buttons[`btn-${ model }`] = button;
        }
      );

      // this.modelSelector = modelSelector;
      return this.modelSelector;
    }

    injectMenu() {
      document.body.appendChild( this.modelSelector );
    }

    monitorBodyChanges() {
      const observer = new MutationObserver( mutationsList => {
        for ( const mutation of mutationsList ) {
          if ( document.body.querySelector( '#model-selector' ) ) continue;
          this.injectMenu();
          break;
        }
      });
      observer.observe( document.body, { childList: true } );
    }

    async restorePosition() {
      const menuPosition = await GM.getValue(
        'menuPosition',
        {
          left: ( window.innerWidth - this.modelSelector.offsetWidth - 20 ) + 'px',
          top: ( window.innerHeight - this.modelSelector.offsetHeight - 35 ) + 'px'
        }
      );
      this.modelSelector.style.left = menuPosition.left;
      this.modelSelector.style.top = menuPosition.top;
    }

    getPoint( event ) {
      return event.touches ? event.touches[0] : event;
    }

    mouseDownHandler( event ) {
      const point = this.getPoint( event );
      this.offsetX = point.clientX - this.modelSelector.offsetLeft;
      this.offsetY = point.clientY - this.modelSelector.offsetTop;
      this.isDragging = true;
      this.shouldCancelClick = false;
      this.modelSelector.style.cursor = 'grabbing';
    }

    mouseMoveHandler( event ) {
      if ( !this.isDragging ) return;

      const point = this.getPoint( event );
      const oldLeft = this.modelSelector.style.left;
      const oldTop = this.modelSelector.style.top;
      this.modelSelector.style.left = ( point.clientX - this.offsetX ) + 'px';
      this.modelSelector.style.top = ( point.clientY - this.offsetY ) + 'px';
      if ( this.modelSelector.style.left != oldLeft || this.modelSelector.style.top != oldTop ) {
        this.shouldCancelClick = true;
      }

      // Prevent scrolling on touch
      if ( event.cancelable ) event.preventDefault();
    }

    async mouseUpHandler( event ) {
      this.isDragging = false;
      this.modelSelector.style.cursor = 'grab';
      document.body.style.userSelect = '';
      await GM.setValue(
        'menuPosition',
        {
          left: this.modelSelector.style.left,
          top: this.modelSelector.style.top
        }
      );
    }

    registerGrabbing() {
      // Mouse
      this.modelSelector.addEventListener( 'mousedown', this.mouseDownHandler.bind( this ) );
      document.addEventListener( 'mousemove', this.mouseMoveHandler.bind( this ) );
      document.addEventListener( 'mouseup', this.mouseUpHandler.bind( this ) );

      // Touch
      this.modelSelector.addEventListener( 'touchstart', this.mouseDownHandler.bind( this ), { passive: false } );
      document.addEventListener( 'touchmove', this.mouseMoveHandler.bind( this ), { passive: false } );
      document.addEventListener( 'touchend', this.mouseUpHandler.bind( this ) );
    }
  }

  const useMini = await GM.getValue( 'useMini', true );
  const switcher = new ModelSwitcher( useMini );
  switcher.hookFetch();
  switcher.injectToggleButtonStyle();
  switcher.createModelSelectorMenu();
  switcher.refreshButtons();
  switcher.monitorBodyChanges();
  switcher.injectMenu();
  await switcher.restorePosition();
  switcher.registerGrabbing();
})();
