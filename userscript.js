// ==UserScript==
// @name         ChatGPT Realtime Model Switcher: 4o-mini, o4-mini, o3 and more!
// @namespace    http://tampermonkey.net/
// @version      0.52.3
// @description  A menu that allows you to switch models during a single conversation
// @match        *://chatgpt.com/*
// @author       d0gkiller87
// @license      MIT
// @grant        unsafeWindow
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @grant        GM.unregisterMenuCommand
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// ==/UserScript==

(async function() {
  'use strict';

  function injectStyle( style, isDisabled = false ) {
    const styleNode = document.createElement( 'style' );
    styleNode.type = 'text/css';
    styleNode.textContent = style;
    document.head.appendChild( styleNode );
    styleNode.disabled = isDisabled;
    return styleNode;
  }

  class ModelSwitcher {
    getPlanType() {
      for ( const scriptNode of document.querySelectorAll( 'script' ) ) {
        let match;
        while ( ( match = /\\"planType\\"\s*,\s*\\"(\w+?)\\"/.exec( scriptNode.innerHTML ) ) !== null ) {
          return match[1];
        }
      }
      return 'free'
    }

    async init() {
      this.model = await GM.getValue( 'model', 'auto' );
      this.buttons = {};
      this.offsetX = 0;
      this.offsetY = 0;
      this.isDragging = false;
      this.shouldCancelClick = false;
      this.modelSelector = null;
      this.isMenuVisible = await GM.getValue( 'isMenuVisible', true );
      this.isMenuVisibleCommandId = null;
      this.modelHighlightStyleNode = null;
      this.isModelHighlightEnabled = await GM.getValue( 'isModelHighlightEnabled', true );
      this.isModelHighlightEnabledCommandId = null;

      const planType = this.getPlanType();

      const models = [
        // [ "pro", "o1", "o1" ], // retired
        [ "pro", "o1-pro", "o1-pro" ],
        // [ "free", "o3-mini", "o3-mini" ], // retired
        [ "plus", "o3", "o3" ],
        [ "free", "o4-mini", "o4-mini" ],
        [ "plus", "o4-mini-high", "o4-mini-high" ],
        [ "free", "gpt-3.5", "gpt-3-5" ],
        [ "free", "4o-mini", "gpt-4o-mini" ],
        // [ "free", "gpt-4", "gpt-4" ], // same as 4o
        [ "free", "gpt-4o", "gpt-4o" ],
        // [ "plus", "4o-jawbone", "4o-jawbone" ], // retired (https://x.com/testingcatalog/status/1915483050953125965)
        [ "plus", "gpt-4.5", "gpt-4-5" ],
        [ "free", "default", "auto" ],
      ];

      this.availableModels = {};
      for ( const [ minimumPlan, modelName, modelValue ] of models ) {
        if ( planType === minimumPlan ) {
          this.availableModels[modelName] = modelValue;
        }
      }
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
          const body = JSON.parse( config.body );
          body.model = this.model;
          config.body = JSON.stringify( body );
        }
        return originalFetch( resource, config );
      };
    }

    injectToggleButtonStyle() {
      let style = `
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
        #model-selector.hidden {
          display: none;
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

        :root {
          --o1-pro-color: 139, 232, 27;
          --o3-color: 139, 232, 27;
          --gpt-3-5-color: 0, 106, 129;
          --gpt-4-5-color: 126, 3, 165;
          --gpt-4o-color: 18, 45, 134;
          --o4-mini-high-color: 176, 53, 0;
          --o4-mini-color: 203, 91, 0;
          --gpt-4o-jawbone-color: 201, 42, 42;
          --gpt-4o-mini-color: 67, 162, 90;
          --auto-color: 131, 131, 139;

          --unknown-model-btn-color: 67, 162, 90;
          --unknown-model-box-shadow-color: 48, 255, 19;
        }
      `;

      for ( const model of Object.values( this.availableModels ) ) {
        style += `
          #model-selector button.btn-${ model } {
            background-color: rgb(var(--${ model }-color, var(--unknown-model-btn-color)));
          }
        `;
      }

      injectStyle( style );
    }

    refreshButtons() {
      for ( const [ model, button ] of Object.entries( this.buttons ) ) {
        const isSelected = model === `btn-${ this.model }`;
        button.classList.toggle( model, isSelected );
        button.classList.toggle( 'selected', isSelected );
      }
    }

    async reloadMenuVisibleToggle() {
      this.isMenuVisibleCommandId = await GM.registerMenuCommand(
        `${ this.isMenuVisible ? '☑︎' : '☐' } Show model selector`,
        async () => {
          this.isMenuVisible = !this.isMenuVisible;
          await GM.setValue( 'isMenuVisible', this.isMenuVisible );
          this.modelSelector.classList.toggle( 'hidden', !this.isMenuVisible );
          this.reloadMenuVisibleToggle();
        },
        this.isMenuVisibleCommandId ? { id: this.isMenuVisibleCommandId } : {}
      );
    }

    injectMessageModelHighlightStyle() {
      let style = `
        div[data-message-model-slug] {
          padding: 0px 5px;
          box-shadow: 0 0 3px 3px rgba(var(--unknown-model-box-shadow-color), 0.65);
        }
      `;
      for ( const model of Object.values( this.availableModels ) ) {
        style += `
        div[data-message-model-slug="${ model }"] {
          box-shadow: 0 0 3px 3px rgba(var(--${ model }-color, var(--unknown-model-box-shadow-color)), 0.8);
        }
        `;
      }
      this.modelHighlightStyleNode = injectStyle( style, !this.isModelHighlightEnabled );
    }

    async reloadMessageModelHighlightToggle() {
      this.isModelHighlightEnabledCommandId = await GM.registerMenuCommand(
        `${ this.isModelHighlightEnabled ? '☑︎' : '☐' } Show model identifer`,
        async () => {
          this.isModelHighlightEnabled = !this.isModelHighlightEnabled;
          await GM.setValue( 'isModelHighlightEnabled', this.isModelHighlightEnabled );
          this.modelHighlightStyleNode.disabled = !this.isModelHighlightEnabled;
          this.reloadMessageModelHighlightToggle();
        },
        this.isModelHighlightEnabledCommandId ? { id: this.isModelHighlightEnabledCommandId } : {}
      );
    }

    createModelSelectorMenu() {
      this.modelSelector = document.createElement( 'div' );
      this.modelSelector.id = 'model-selector';

      for ( const [ modelName, modelValue ] of Object.entries( this.availableModels ) ) {
        const button = document.createElement( 'button' );
        button.textContent = modelName;
        button.title = modelValue;
        button.addEventListener(
          'click',
          async event => {
            if ( this.shouldCancelClick ) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return;
            }
            this.model = modelValue;
            await GM.setValue( 'model', modelValue );
            this.refreshButtons();
          }
        );
        this.modelSelector.appendChild( button );
        this.buttons[`btn-${ modelValue }`] = button;
      }
      this.modelSelector.classList.toggle( 'hidden', !this.isMenuVisible );
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

    getDefaultMenuPosition() {
      return {
        left: ( window.innerWidth - this.modelSelector.offsetWidth - 33 ) + 'px',
        top: ( window.innerHeight - this.modelSelector.offsetHeight - 36 ) + 'px'
      };
    }

    async restoreMenuPosition() {
      const menuPosition = await GM.getValue( 'menuPosition', this.getDefaultMenuPosition() );
      this.modelSelector.style.left = menuPosition.left;
      this.modelSelector.style.top = menuPosition.top;
    }

    async registerResetMenuPositionCommand() {
      await GM.registerMenuCommand(
        '⟲ Reset menu position',
        async () => {
          const defaultMenuPosition = this.getDefaultMenuPosition();
          this.modelSelector.style.left = defaultMenuPosition.left;
          this.modelSelector.style.top = defaultMenuPosition.top;
          await GM.setValue( 'menuPosition', defaultMenuPosition );
        }
      );
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

  const switcher = new ModelSwitcher();
  await switcher.init();

  switcher.hookFetch();

  switcher.injectToggleButtonStyle();
  switcher.injectMessageModelHighlightStyle();

  switcher.createModelSelectorMenu();
  await switcher.registerResetMenuPositionCommand();
  await switcher.reloadMenuVisibleToggle();
  await switcher.reloadMessageModelHighlightToggle();

  switcher.refreshButtons();
  switcher.monitorBodyChanges();
  switcher.injectMenu();

  await switcher.restoreMenuPosition();
  switcher.registerGrabbing();
})();
