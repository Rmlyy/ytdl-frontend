const API_BASE_URL = 'https://ytdl.rmly.dev/backend'

const button = document.getElementById('dlbtn')
const buttonOriginalText = button.innerHTML
let checkbox
let videoId

function toggleCheckboxes(currentCheckbox) {
  const checkboxes = document.getElementsByName('format')

  checkboxes.forEach((checkbox) => {
    if (checkbox !== currentCheckbox) checkbox.checked = false
  })
}

function getCheckedCheckbox() {
  const checkboxes = document.getElementsByName('format')
  let checkedCheckbox = null

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      checkedCheckbox = checkbox
    }
  })

  return checkedCheckbox
}

function extractVideoId(url) {
  const regex =
    /^(?:(?:https?:)?\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(regex)

  return match ? match[1] : null
}

function disableButton(buttonId, html) {
  const button = document.getElementById(buttonId)
  html = html ?? '<i class="fa-solid fa-circle-notch fa-spin"></i> Please wait..'

  button.disabled = true
  button.innerHTML = html
}

function enableButton(buttonId) {
  const button = document.getElementById(buttonId)

  button.disabled = false
  button.innerHTML = buttonOriginalText
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  const formattedTime =
    (hours > 0 ? hours + ':' : '') +
    (minutes < 10 ? '0' + minutes : minutes) +
    ':' +
    (remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds)

  return formattedTime
}

async function getInfo() {
  const urlElem = document.getElementById('url')

  if (!urlElem.value) return alert('You must enter a URL.')

  videoId = extractVideoId(urlElem.value)

  if (!videoId) return alert('Invalid URL.')

  checkbox = getCheckedCheckbox()

  if (!checkbox) return alert('You must choose the format you want your video to be in.')

  const videoInfo = await getVideoInfo(videoId)

  if (!videoInfo) return alert('Unable to get information about this video.')

  const appElem = document.getElementById('app')
  const videoElem = document.getElementById('video')

  appElem.remove()
  videoElem.style.display = 'block'

  if (checkbox.id === 'mp4') {
    const formatElem = document.getElementById('format')

    formatElem.style.display = 'block'
    populateFormats(videoInfo.video.formats)
  }

  const videoTitleElem = document.getElementById('title')
  const videoThumbnailElem = document.getElementById('thumbnail')
  const videoDuration = document.getElementById('duration')
  const videoViews = document.getElementById('views')
  const videoLikes = document.getElementById('likes')
  const downloadButton = document.getElementById('dlbtn2')

  videoTitleElem.innerText = videoInfo.video.title
  videoThumbnailElem.src = videoInfo.video.thumbnail
  videoDuration.innerText = formatTime(videoInfo.video.duration)
  videoViews.innerText = videoInfo.video.viewCount.toLocaleString()
  videoLikes.innerText = videoInfo?.video?.likeCount?.toLocaleString() ?? 'Disabled'

  downloadButton.innerHTML = `<i class="fa-solid fa-download"></i> DOWNLOAD IN ${checkbox.id.toUpperCase()}`
  return
}

async function download() {
  const infoElem = document.getElementById('info')
  const type = checkbox.id
  let format

  let requestUrl = `${API_BASE_URL}/download/?videoId=${videoId}&type=${type}`

  if (type === 'mp4') {
    const formatsElem = document.getElementById('formats')
    format = formatsElem.options[formatsElem.selectedIndex]

    requestUrl += `&format=${format.text}`
  }

  disableButton('dlbtn2')

  const request = await fetch(requestUrl, {
    method: 'POST',
  })

  const response = await request.json()

  const dlURL = `${API_BASE_URL}/download/?videoId=${videoId}&type=${type}&format=${format?.text ?? null}`
  const downloadedBtn = `<i class="fa-solid fa-check"></i> VIDEO DOWNLOADED`

  if (response.status === 'accepted' || response.status === 'processing') {
    infoElem.innerText =
      "Video download started. Please wait as this may take some time. We'll automatically recheck and let you know when it's finished."

    const interval = setInterval(async () => {
      const finished = await checkFinished(videoId, type, format?.text ?? null)

      if (finished) {
        infoElem.innerHTML = `Video download finished. <a href="${dlURL}">Click here to download</a>`
        disableButton('dlbtn2', downloadedBtn)
        clearInterval(interval)
      }
    }, 20000) // 20s
  } else if (response.message.includes('already been downloaded')) {
    disableButton('dlbtn2', downloadedBtn)
    infoElem.innerHTML = `<a href="${dlURL}">Click here to download</a>`
  } else if (response.message.includes('concurrent downloads per IP')) {
    alert('Please wait for the current download(s) to finish before downloading another video.')
    window.location = '/'
  } else if (response.message.includes('Video too long for this format')) {
    alert(response.message)
    window.location = '/'
  }
}

async function getVideoInfo(videoId) {
  disableButton('dlbtn')
  const response = await fetch(`${API_BASE_URL}/info/?videoId=${videoId}`)

  if (!response.ok) {
    enableButton('dlbtn')
    return null
  }

  const videoInfo = await response.json()

  enableButton('dlbtn')
  return videoInfo
}

function populateFormats(formats) {
  const selectElement = document.getElementById('formats')

  formats.forEach((format) => {
    const option = document.createElement('option')

    option.text = format
    option.value = format

    selectElement.add(option)
  })
}

async function checkFinished(videoId, type, format) {
  const requestUrl = `${API_BASE_URL}/download/?videoId=${videoId}&type=${type}&format=${format}`
  const request = await fetch(requestUrl, {
    method: 'POST',
  })
  const response = await request.json()

  if (response.message.includes('being downloaded')) return false
  if (response.message.includes('been downloaded')) return true
}
