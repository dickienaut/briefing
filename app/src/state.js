import { messages } from './lib/emitter'
import { setupWebRTC } from './logic/connection'
import { defaultAudioConstraints, defaultVideoConstraints, getDevices, getUserMedia } from './logic/stream'

const log = require('debug')('app:state')

// export const DEBUG = location.port.toString() === '8080' || !location.pathname.startsWith('/ng/')
// export const isPWA = process.env.VUE_APP_TARGET === 'pwa'

// ROOM

let m = /^\/ngs?\/(.*?)$/gi.exec(location.pathname)
let room = m && m[1] || null
// console.log('Room =', room)

if (location.pathname === '/') {
  window.history.pushState(
    {},
    'brie.fi/ng',
    '/ng',
  )
}

// STATE

export let state = {

  // ID of this room
  room,

  // Local users peer ID
  peerID: null,

  // IDs of all currently active WebRTC peers
  peers: [],

  // Video stream of the local user without sound
  stream: null,

  status: {},

  blur: false,
  bandwidth: false,
  fill: true,

  muteVideo: false,
  muteAudio: false,

  deviceVideo: null,
  deviceAudio: null,

  devices: [],

  svg: {
    stroke: '1.5',
  },

  maximized: '',

}

messages.on('updateStream', updateStream)

function updateStream() {
  state.stream.getAudioTracks().forEach(t => t.enabled = !state.muteAudio)
  state.stream.getVideoTracks().forEach(t => t.enabled = !state.muteVideo)
}

messages.on('switchVideo', switchVideo)

let blurLib

async function switchVideo() {
  let audio = {
    ...defaultAudioConstraints,
  }

  if (state.deviceAudio) {
    audio.deviceId = state.deviceAudio
  }

  let video = {
    ...defaultVideoConstraints,
  }

  if (state.deviceVideo) {
    video.deviceId = state.deviceVideo
  }

  let constraints = {
    audio,
    video,
  }

  let stream
  const showsDesktop = state.deviceVideo === 'desktop'

  if (showsDesktop) {
    log('desktop')
    video = {
      video: {
        cursor: 'always',
      },
    }
    stream = await navigator.mediaDevices.getDisplayMedia(video)
  } else {
    stream = await navigator.mediaDevices.getUserMedia(constraints)
  }
  log('Stream', stream, constraints)
  if (stream) {
    let success = true
    let videoTracks = stream.getVideoTracks()
    if (state.deviceVideo && videoTracks?.length <= 0) {
      state.deviceVideo = null
      success = false
    }
    let audioTracks = stream.getAudioTracks()
    if (state.deviceAudio && audioTracks?.length <= 0) {
      state.deviceAudio = null
      success = false
    }

    if (!success) {
      return await switchVideo()
    }

    log('blur what?', state.blur, blurLib)
    if (state.blur && !showsDesktop) {
      if (!blurLib) {
        blurLib = await import(/* webpackChunkName: 'blur' */ './logic/blur')
      }
      stream = await blurLib.startBlurTransform(stream)
      Array.from(stream.getAudioTracks()).forEach(t => stream.removeTrack(t))
      audioTracks.forEach(t => stream.addTrack(t))
    } else if (blurLib) {
      log('stop blur')
      blurLib.stopBlurTransform()
    }

    state.stream = stream
    updateStream()

    messages.emit('setLocalStream', state.stream)

  } else {
    log('Stream not found')
  }
}

export async function setup() {
  let rtc
  try {

    rtc = await setupWebRTC(state)

    if (!rtc) {
      alert('Your browser does not support the required WebRTC technologies.\n\nPlease reconnect using an up to date web browser.\n\nThanks for your understanding.')
      location.assign('/ng/')
      return
    }

    let stream = await getUserMedia()

    // Safari getDevices only works immediately after getUserMedia (bug)
    state.devices = await getDevices()

    state.stream = stream
    updateStream()

    messages.emit('setLocalStream', state.stream)

  } catch (err) {
    console.error('Exception:', err)
  }

  return {
    cleanup() {
      rtc?.cleanup()
    },
  }
}

