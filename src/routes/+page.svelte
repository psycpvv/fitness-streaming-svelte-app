<script lang="ts">
  import { DICT_FEATURES, thresholds } from '$lib/constants'
  import { findAngle, getState } from '$lib/utils'
  import { Button } from '@/components/ui/button'
  import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
  let webcamRunning = $state(false)
  let isPsLmReady = $state(false)
  const FEEDBACK_ID_MAP: [string, number, string][] = [
    ['BEND BACKWARDS', 215, 'rgb(0,153,255)'],
    ['BEND FORWARD', 215, 'rgb(0,153,255)'],
    ['KNEE FALLING OVER TOE', 170, 'rgb(255,80,80)'],
    ['SQUAT TOO DEEP', 125, 'rgb(255,80,80)'],
  ]
  const stateTracker = {
    stateSeq: [] as string[],

    startInactiveTime: 0,
    startInactiveTimeFront: 0,
    inactiveTime: 0,
    inactiveTimeFront: 0,

    // 0 --> Bend Backwards, 1 --> Bend Forward, 2 --> Keep shin straight, 3 --> Deep squat
    displayText: [false, false, false, false],
    countFrames: [0, 0, 0, 0],

    lowerHips: false,

    incorrectPosture: false,

    prevState: null as string | null,
    currState: null as string | null,

    squatCount: 0,
    improperSquat: 0,
  }

  // function showFeedback(cFrame, dictMaps, lowerHipsDisp) {
  //   if (lowerHipsDisp) {
  //     console.log('LOWER YOUR HIPS')
  //   }

  //   cFrame.forEach((val, idx) => {
  //     if (val) {
  //       const [text, ,] = dictMaps[idx]
  //       console.log(text)
  //     }
  //   })
  // }
  let poseLandmarker: PoseLandmarker | undefined = undefined

  // Enable the live webcam view and start detection.
  async function enableCam() {
    if (!poseLandmarker) {
      console.log('Wait! poseLandmaker not loaded yet.')
      return
    }
    webcamRunning = !webcamRunning
    // Activate the webcam stream.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
    })
    const video = document.getElementById('webcam') as HTMLVideoElement
    video.srcObject = stream
    video.addEventListener('loadeddata', predictWebcam)

    let lastVideoTime = -1
    const canvasElement = document.getElementById('output_canvas') as HTMLCanvasElement
    const canvasCtx = canvasElement.getContext('2d')!
    const drawingUtils = new DrawingUtils(canvasCtx)
    const videoHeight = `${window.innerHeight}px`
    const videoWidth = `${(window.innerHeight / 9) * 16}px`
    canvasElement.style.height = videoHeight
    canvasElement.height = window.innerHeight
    canvasElement.width = (window.innerHeight / 9) * 16
    video.style.height = videoHeight
    canvasElement.style.width = videoWidth
    video.style.width = videoWidth
    async function predictWebcam() {
      if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime
        poseLandmarker?.detectForVideo(video, performance.now(), result => {
          canvasCtx.save()
          canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height)
          for (const landmark of result.landmarks) {
            const offsetAngle = findAngle(
              landmark[DICT_FEATURES.left.shoulder],
              landmark[DICT_FEATURES.right.shoulder],
              landmark[DICT_FEATURES.nose],
            )

            if (offsetAngle > thresholds.OFFSET_THRESH) {
              let displayInactivity = false

              const endTime = performance.now() / 1000
              stateTracker.inactiveTimeFront += endTime - stateTracker.startInactiveTimeFront
              stateTracker.startInactiveTimeFront = endTime

              if (stateTracker.inactiveTimeFront >= thresholds.INACTIVE_THRESH) {
                stateTracker.squatCount = 0
                stateTracker.improperSquat = 0
                displayInactivity = true
              }

              // Draw circles for nose, left shoulder, right shoulder
              drawingUtils.drawLandmarks([landmark[DICT_FEATURES.nose]], {
                color: 'white',
                radius: 7,
              })
              drawingUtils.drawLandmarks([landmark[DICT_FEATURES.left.shoulder]], {
                color: 'yellow',
                radius: 7,
              })
              drawingUtils.drawLandmarks([landmark[DICT_FEATURES.right.shoulder]], {
                color: 'magenta',
                radius: 7,
              })

              if (displayInactivity) {
                // Optionally play a sound or show a message
                stateTracker.inactiveTimeFront = 0
                stateTracker.startInactiveTimeFront = performance.now() / 1000
              }

              // Draw correct/incorrect squat counts and camera alignment warning
              canvasCtx.font = '20px Arial'
              canvasCtx.fillStyle = 'rgba(18,185,0,0.8)'
              canvasCtx.fillRect(canvasElement.width * 0.68, 10, 180, 30)
              canvasCtx.fillStyle = 'rgb(255,255,230)'
              canvasCtx.fillText(
                'CORRECT: ' + stateTracker.squatCount,
                canvasElement.width * 0.68 + 10,
                32,
              )

              canvasCtx.fillStyle = 'rgba(221,0,0,0.8)'
              canvasCtx.fillRect(canvasElement.width * 0.68, 60, 180, 30)
              canvasCtx.fillStyle = 'rgb(255,255,230)'
              canvasCtx.fillText(
                'INCORRECT: ' + stateTracker.improperSquat,
                canvasElement.width * 0.68 + 10,
                82,
              )

              canvasCtx.fillStyle = 'rgba(255,153,0,0.8)'
              canvasCtx.fillRect(30, canvasElement.height - 80, 350, 25)
              canvasCtx.fillStyle = 'rgb(255,255,230)'
              canvasCtx.font = '18px Arial'
              canvasCtx.fillText('CAMERA NOT ALIGNED PROPERLY!!!', 40, canvasElement.height - 62)

              canvasCtx.fillStyle = 'rgba(255,153,0,0.8)'
              canvasCtx.fillRect(30, canvasElement.height - 50, 250, 25)
              canvasCtx.fillStyle = 'rgb(255,255,230)'
              canvasCtx.fillText(
                'OFFSET ANGLE: ' + offsetAngle.toFixed(2),
                40,
                canvasElement.height - 32,
              )

              // Reset inactive times for side view
              stateTracker.startInactiveTime = performance.now() / 1000
              stateTracker.inactiveTime = 0
              stateTracker.prevState = null
              stateTracker.currState = null
              // Camera is aligned properly.
            } else {
              stateTracker.inactiveTimeFront = 0
              stateTracker.startInactiveTimeFront = performance.now() / 1000

              const distLShHip = Math.abs(
                landmark[DICT_FEATURES.left.ankle].y - landmark[DICT_FEATURES.left.shoulder].y,
              )
              const distRShHip = Math.abs(
                landmark[DICT_FEATURES.right.ankle].y - landmark[DICT_FEATURES.right.shoulder].y,
              )

              const [
                shldrCoord,
                elbowCoord,
                wristCoord,
                hipCoord,
                kneeCoord,
                ankleCoord,
                footCoord,
                multiplier,
              ] =
                distLShHip > distRShHip
                  ? [
                      landmark[DICT_FEATURES.left.shoulder],
                      landmark[DICT_FEATURES.left.elbow],
                      landmark[DICT_FEATURES.left.wrist],
                      landmark[DICT_FEATURES.left.hip],
                      landmark[DICT_FEATURES.left.knee],
                      landmark[DICT_FEATURES.left.ankle],
                      landmark[DICT_FEATURES.left.ankle], // or DICT_FEATURES.left.foot if defined
                      -1,
                    ]
                  : [
                      landmark[DICT_FEATURES.right.shoulder],
                      landmark[DICT_FEATURES.right.elbow],
                      landmark[DICT_FEATURES.right.wrist],
                      landmark[DICT_FEATURES.right.hip],
                      landmark[DICT_FEATURES.right.knee],
                      landmark[DICT_FEATURES.right.ankle],
                      landmark[DICT_FEATURES.right.ankle], // or DICT_FEATURES.right.foot if defined
                      1,
                    ]

              // -------- Vertical Angle calculation and drawing --------
              const hipVerticalAngle = findAngle(shldrCoord, { x: hipCoord.x, y: 0 }, hipCoord)
              const kneeVerticalAngle = findAngle(hipCoord, { x: kneeCoord.x, y: 0 }, kneeCoord)
              const ankleVerticalAngle = findAngle(kneeCoord, { x: ankleCoord.x, y: 0 }, ankleCoord)

              // --------- State tracking ---------
              const currentState = getState(Math.round(kneeVerticalAngle))
              stateTracker.currState = currentState

              /**
               * Updates the internal state sequence based on the provided input or event.
               * This function is typically used to manage and transition between different states
               * in a controlled sequence, ensuring the correct order of operations or animations.
               */
              if (currentState === 's2') {
                if (
                  (!stateTracker.stateSeq.includes('s3') &&
                    stateTracker.stateSeq.filter(s => s === 's2').length === 0) ||
                  (stateTracker.stateSeq.includes('s3') &&
                    stateTracker.stateSeq.filter(s => s === 's2').length === 1)
                ) {
                  stateTracker.stateSeq.push(currentState)
                }
              } else if (currentState === 's3') {
                if (
                  !stateTracker.stateSeq.includes(currentState) &&
                  stateTracker.stateSeq.includes('s2')
                ) {
                  stateTracker.stateSeq.push(currentState)
                }
              }

              if (currentState === 's1') {
                if (stateTracker.stateSeq.length === 3 && !stateTracker.incorrectPosture) {
                  stateTracker.squatCount += 1
                  // Optionally play a sound: String(stateTracker.squatCount)
                } else if (
                  stateTracker.stateSeq.includes('s2') &&
                  stateTracker.stateSeq.length === 1
                ) {
                  stateTracker.improperSquat += 1
                  // Optionally play a sound: 'incorrect'
                } else if (stateTracker.incorrectPosture) {
                  stateTracker.improperSquat += 1
                  // Optionally play a sound: 'incorrect'
                }

                stateTracker.stateSeq = []
                stateTracker.incorrectPosture = false
              } else {
                //  -------------------------------------- PERFORM FEEDBACK ACTIONS --------------------------------------
                if (hipVerticalAngle > thresholds.HIP_THRESH[1]) {
                  stateTracker.displayText[0] = true
                } else if (
                  hipVerticalAngle < thresholds.HIP_THRESH[0] &&
                  stateTracker.stateSeq.filter(s => s === 's2').length === 1
                ) {
                  stateTracker.displayText[1] = true
                }

                if (
                  kneeVerticalAngle > thresholds.KNEE_THRESH[0] &&
                  kneeVerticalAngle < thresholds.KNEE_THRESH[1] &&
                  stateTracker.stateSeq.filter(s => s === 's2').length === 1
                ) {
                  stateTracker.lowerHips = true
                } else if (kneeVerticalAngle > thresholds.KNEE_THRESH[2]) {
                  stateTracker.displayText[3] = true
                  stateTracker.incorrectPosture = true
                }

                if (ankleVerticalAngle > thresholds.ANKLE_THRESH) {
                  stateTracker.displayText[2] = true
                  stateTracker.incorrectPosture = true
                }
              }

              // ----------------------------------- COMPUTE INACTIVITY ---------------------------------------------
              let displayInactivity = false

              if (stateTracker.currState === stateTracker.prevState) {
                const endTime = performance.now() / 1000
                stateTracker.inactiveTime += endTime - stateTracker.startInactiveTime
                stateTracker.startInactiveTime = endTime

                if (stateTracker.inactiveTime >= thresholds.INACTIVE_THRESH) {
                  stateTracker.squatCount = 0
                  stateTracker.improperSquat = 0
                  displayInactivity = true
                }
              } else {
                stateTracker.startInactiveTime = performance.now() / 1000
                stateTracker.inactiveTime = 0
              }

              //  -------------------------------------------------------------------------------------------------------

              if (stateTracker.stateSeq.includes('s3') || currentState === 's1') {
                stateTracker.lowerHips = false
              }
              // Increment countFrames for active feedbacks
              stateTracker.displayText.forEach((val, idx) => {
                if (val) stateTracker.countFrames[idx] += 1
              })

              // Show feedback on canvas
              if (stateTracker.lowerHips) {
                canvasCtx.font = '18px Arial'
                canvasCtx.fillStyle = 'black'
                canvasCtx.fillRect(30, 80 - 18, 180, 25)
                canvasCtx.fillStyle = 'rgb(255,255,0)'
                canvasCtx.fillText('LOWER YOUR HIPS', 35, 80)
              }

              stateTracker.displayText.forEach((val, idx) => {
                if (val) {
                  const [text, y, bg] = FEEDBACK_ID_MAP[idx]
                  canvasCtx.font = '18px Arial'
                  canvasCtx.fillStyle = bg
                  canvasCtx.fillRect(30, y - 18, 250, 25)
                  canvasCtx.fillStyle = 'rgb(255,255,230)'
                  canvasCtx.fillText(text, 35, y)
                }
              })
              // Optionally show feedback (implement your own showFeedback if needed)
              // showFeedback(stateTracker.displayText, FEEDBACK_ID_MAP, stateTracker.lowerHips)

              if (displayInactivity) {
                // Optionally show a message or play a sound
                stateTracker.startInactiveTime = performance.now() / 1000
                stateTracker.inactiveTime = 0
              }

              canvasCtx.font = '20px Arial'
              canvasCtx.fillStyle = 'rgb(144,238,144)'
              canvasCtx.fillText(
                String(Math.round(hipVerticalAngle)),
                hipCoord.x * canvasElement.width - 10,
                hipCoord.y * canvasElement.height,
              )
              canvasCtx.fillText(
                String(Math.round(kneeVerticalAngle)),
                kneeCoord.x * canvasElement.width - 10,
                kneeCoord.y * canvasElement.height + 10,
              )
              canvasCtx.fillText(
                String(Math.round(ankleVerticalAngle)),
                ankleCoord.x * canvasElement.width - 10,
                ankleCoord.y * canvasElement.height,
              )

              canvasCtx.font = '20px Arial'
              canvasCtx.fillStyle = 'rgba(18,185,0,0.8)'
              canvasCtx.fillRect(canvasElement.width * 0.68, 10, 180, 30)
              canvasCtx.fillStyle = 'rgb(255,255,230)'
              canvasCtx.fillText(
                'CORRECT: ' + stateTracker.squatCount,
                canvasElement.width * 0.68 + 10,
                32,
              )

              canvasCtx.fillStyle = 'rgba(221,0,0,0.8)'
              canvasCtx.fillRect(canvasElement.width * 0.68, 60, 180, 30)
              canvasCtx.fillStyle = 'rgb(255,255,230)'
              canvasCtx.fillText(
                'INCORRECT: ' + stateTracker.improperSquat,
                canvasElement.width * 0.68 + 10,
                82,
              )

              // Reset feedback display after threshold frames
              stateTracker.displayText = stateTracker.displayText.map((val, idx) =>
                stateTracker.countFrames[idx] > thresholds.CNT_FRAME_THRESH ? false : val,
              )
              stateTracker.countFrames = stateTracker.countFrames.map((val, idx) =>
                stateTracker.countFrames[idx] > thresholds.CNT_FRAME_THRESH ? 0 : val,
              )
              stateTracker.prevState = currentState
            }
            drawingUtils.drawLandmarks(landmark, {
              radius: data => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
            })
            drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS)
          }
          canvasCtx.restore()
        })
      }

      // Call this function again to keep predicting when the browser is ready.
      if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam)
      }
    }
  }

  $effect(() => {
    // Before we can use PoseLandmarker class we must wait for it to finish
    // loading. Machine Learning models can be large and take a moment to
    // get everything needed to run.
    const createPoseLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10/wasm',
      )
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 2,
      })
      isPsLmReady = true
    }
    createPoseLandmarker()
  })
</script>

<section class={['', isPsLmReady || 'invisible']}>
  <Button
    class={[
      'fixed top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transform',
      webcamRunning && 'hidden',
    ]}
    onclick={enableCam}
  >
    {webcamRunning ? 'DISABLE' : 'ENABLE'} WEBCAM
  </Button>
  <div class="relative mx-auto">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video id="webcam" class="absolute left-1/2 -translate-x-1/2" autoplay playsinline></video>
    <canvas id="output_canvas" width="1280" height="720" class="absolute left-1/2 -translate-x-1/2"
    ></canvas>
  </div>
</section>
