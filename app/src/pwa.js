import Vue from 'vue'
import locale from './lib/locale'
import './lib/registerServiceWorker'
import de from './locales/de'
import en from './locales/en'
import App from './pwa-app.vue'
import { state } from './state'

// Electron specific
if (navigator.userAgent.toLowerCase().indexOf(' electron/') > -1 && window.beaker == null) {
  console.log('Identified Electron')
  import('./pwa-electron').then()
  console.log('Handled Electron')
}

Vue.config.productionTip = false

Vue.mixin({
  data() {
    return { state }
  },
  methods: {
    openExternalLink(event) {
      if (window.electron) {
        let href
        if (typeof event === 'string') {
          href = event
        } else {
          let target = event?.target
          while (target && target?.href == null) {
            target = target.parentElement
          }
          href = target?.href
        }
        console.info('Open external link', event.target)
        if (href) {
          window.electron.shell.openExternal(href)
        }
        event.preventDefault()
        return false
      }
      return true
    },
  },
})

Vue.use(locale, {
  locales: { en, de },
})

new Vue({
  render: h => h(App),
}).$mount('#app')
