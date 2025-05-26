<script lang="ts">
  import { DICT_FEATURES, thresholds } from '$lib/constants'
  import { findAngle, getState } from '$lib/utils'
  import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
  let webcamRunning = $state(false)
  let isPsLmReady = $state(false)
  const state_tracker = {
    state_seq: [] as string[],

    start_inactive_time: 0,
    start_inactive_time_front: 0,
    INACTIVE_TIME: 0.0,
    INACTIVE_TIME_FRONT: 0.0,

    // 0 --> Bend Backwards, 1 --> Bend Forward, 2 --> Keep shin straight, 3 --> Deep squat
    DISPLAY_TEXT: [false, false, false, false],
    COUNT_FRAMES: [0, 0, 0, 0],

    LOWER_HIPS: false,

    INCORRECT_POSTURE: false,

    prev_state: null as string | null,
    curr_state: null as string | null,

    SQUAT_COUNT: 0,
    IMPROPER_SQUAT: 0,
  }

  // function showFeedback(c_frame, dict_maps, lower_hips_disp) {
  //   if (lower_hips_disp) {
  //     console.log('LOWER YOUR HIPS')
  //   }

  //   c_frame.forEach((val, idx) => {
  //     if (val) {
  //       const [text, ,] = dict_maps[idx]
  //       console.log(text)
  //     }
  //   })
  // }
  let poseLandmarker: PoseLandmarker | undefined = undefined

  // Enable the live webcam view and start detection.
  function enableCam() {
    if (!poseLandmarker) {
      console.log('Wait! poseLandmaker not loaded yet.')
      return
    }
    webcamRunning = !webcamRunning

    // Activate the webcam stream.
    navigator.mediaDevices
      .getUserMedia({
        video: true,
      })
      .then(stream => {
        const video = document.getElementById('webcam') as HTMLVideoElement
        video.srcObject = stream
        video.addEventListener('loadeddata', predictWebcam)
      })
    let lastVideoTime = -1
    const canvasElement = document.getElementById('output_canvas') as HTMLCanvasElement
    const canvasCtx = canvasElement.getContext('2d')!
    const drawingUtils = new DrawingUtils(canvasCtx)
    const videoHeight = '360px'
    const videoWidth = '480px'
    const video = document.getElementById('webcam') as HTMLVideoElement
    async function predictWebcam() {
      canvasElement.style.height = videoHeight
      video.style.height = videoHeight
      canvasElement.style.width = videoWidth
      video.style.width = videoWidth
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
              let display_inactivity = false

              const end_time = performance.now() / 1000
              state_tracker.INACTIVE_TIME_FRONT +=
                end_time - state_tracker.start_inactive_time_front
              state_tracker.start_inactive_time_front = end_time

              if (state_tracker.INACTIVE_TIME_FRONT >= thresholds.INACTIVE_THRESH) {
                state_tracker.SQUAT_COUNT = 0
                state_tracker.IMPROPER_SQUAT = 0
                display_inactivity = true
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

              if (display_inactivity) {
                // Optionally play a sound or show a message
                state_tracker.INACTIVE_TIME_FRONT = 0.0
                state_tracker.start_inactive_time_front = performance.now() / 1000
              }

              // Draw correct/incorrect squat counts and camera alignment warning
              canvasCtx.font = '20px Arial'
              canvasCtx.fillStyle = 'rgba(18,185,0,0.8)'
              canvasCtx.fillRect(canvasElement.width * 0.68, 10, 180, 30)
              canvasCtx.fillStyle = 'rgb(255,255,230)'
              canvasCtx.fillText(
                'CORRECT: ' + state_tracker.SQUAT_COUNT,
                canvasElement.width * 0.68 + 10,
                32,
              )

              canvasCtx.fillStyle = 'rgba(221,0,0,0.8)'
              canvasCtx.fillRect(canvasElement.width * 0.68, 60, 180, 30)
              canvasCtx.fillStyle = 'rgb(255,255,230)'
              canvasCtx.fillText(
                'INCORRECT: ' + state_tracker.IMPROPER_SQUAT,
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
              state_tracker.start_inactive_time = performance.now() / 1000
              state_tracker.INACTIVE_TIME = 0.0
              state_tracker.prev_state = null
              state_tracker.curr_state = null
              // Camera is aligned properly.
            } else {
              state_tracker.INACTIVE_TIME_FRONT = 0.0
              state_tracker.start_inactive_time_front = performance.now() / 1000

              const dist_l_sh_hip = Math.abs(
                landmark[DICT_FEATURES.left.ankle].y - landmark[DICT_FEATURES.left.shoulder].y,
              )
              const dist_r_sh_hip = Math.abs(
                landmark[DICT_FEATURES.right.ankle].y - landmark[DICT_FEATURES.right.shoulder].y,
              )

              let shldr_coord,
                elbow_coord,
                wrist_coord,
                hip_coord,
                knee_coord,
                ankle_coord,
                foot_coord
              let multiplier

              if (dist_l_sh_hip > dist_r_sh_hip) {
                shldr_coord = landmark[DICT_FEATURES.left.shoulder]
                elbow_coord = landmark[DICT_FEATURES.left.elbow]
                wrist_coord = landmark[DICT_FEATURES.left.wrist]
                hip_coord = landmark[DICT_FEATURES.left.hip]
                knee_coord = landmark[DICT_FEATURES.left.knee]
                ankle_coord = landmark[DICT_FEATURES.left.ankle]
                foot_coord = landmark[DICT_FEATURES.left.ankle] // or DICT_FEATURES.left.foot if defined
                multiplier = -1
              } else {
                shldr_coord = landmark[DICT_FEATURES.right.shoulder]
                elbow_coord = landmark[DICT_FEATURES.right.elbow]
                wrist_coord = landmark[DICT_FEATURES.right.wrist]
                hip_coord = landmark[DICT_FEATURES.right.hip]
                knee_coord = landmark[DICT_FEATURES.right.knee]
                ankle_coord = landmark[DICT_FEATURES.right.ankle]
                foot_coord = landmark[DICT_FEATURES.right.ankle] // or DICT_FEATURES.right.foot if defined
                multiplier = 1
              }

              // -------- Vertical Angle calculation and drawing --------

              // Calculate hip vertical angle and draw arc and dotted line
              const hip_vertical_angle = findAngle(shldr_coord, { x: hip_coord.x, y: 0 }, hip_coord)
              console.log(hip_vertical_angle)

              // Calculate knee vertical angle and draw arc and dotted line
              const knee_vertical_angle = findAngle(
                hip_coord,
                { x: knee_coord.x, y: 0 },
                knee_coord,
              )
              console.log(knee_vertical_angle)

              // Calculate ankle vertical angle and draw arc and dotted line
              const ankle_vertical_angle = findAngle(
                knee_coord,
                { x: ankle_coord.x, y: 0 },
                ankle_coord,
              )
              console.log(ankle_vertical_angle)

              // --------- State tracking ---------
              /**
               * Updates the internal state sequence based on the provided input or event.
               * This function is typically used to manage and transition between different states
               * in a controlled sequence, ensuring the correct order of operations or animations.
               *
               * @private
               * @function
               * @param {...any} args - Arguments required to update the state sequence.
               * @returns {void}
               */
              const current_state = getState(Math.round(knee_vertical_angle))
              state_tracker.curr_state = current_state

              if (current_state === 's2') {
                if (
                  (!state_tracker.state_seq.includes('s3') &&
                    state_tracker.state_seq.filter(s => s === 's2').length === 0) ||
                  (state_tracker.state_seq.includes('s3') &&
                    state_tracker.state_seq.filter(s => s === 's2').length === 1)
                ) {
                  state_tracker.state_seq.push(current_state)
                }
              } else if (current_state === 's3') {
                if (
                  !state_tracker.state_seq.includes(current_state) &&
                  state_tracker.state_seq.includes('s2')
                ) {
                  state_tracker.state_seq.push(current_state)
                }
              }

              if (current_state === 's1') {
                if (state_tracker.state_seq.length === 3 && !state_tracker.INCORRECT_POSTURE) {
                  state_tracker.SQUAT_COUNT += 1
                  // Optionally play a sound: String(state_tracker.SQUAT_COUNT)
                } else if (
                  state_tracker.state_seq.includes('s2') &&
                  state_tracker.state_seq.length === 1
                ) {
                  state_tracker.IMPROPER_SQUAT += 1
                  // Optionally play a sound: 'incorrect'
                } else if (state_tracker.INCORRECT_POSTURE) {
                  state_tracker.IMPROPER_SQUAT += 1
                  // Optionally play a sound: 'incorrect'
                }

                state_tracker.state_seq = []
                state_tracker.INCORRECT_POSTURE = false
              } else {
                //  -------------------------------------- PERFORM FEEDBACK ACTIONS --------------------------------------
                if (hip_vertical_angle > thresholds.HIP_THRESH[1]) {
                  state_tracker.DISPLAY_TEXT[0] = true
                } else if (
                  hip_vertical_angle < thresholds.HIP_THRESH[0] &&
                  state_tracker.state_seq.filter(s => s === 's2').length === 1
                ) {
                  state_tracker.DISPLAY_TEXT[1] = true
                }

                if (
                  knee_vertical_angle > thresholds.KNEE_THRESH[0] &&
                  knee_vertical_angle < thresholds.KNEE_THRESH[1] &&
                  state_tracker.state_seq.filter(s => s === 's2').length === 1
                ) {
                  state_tracker.LOWER_HIPS = true
                } else if (knee_vertical_angle > thresholds.KNEE_THRESH[2]) {
                  state_tracker.DISPLAY_TEXT[3] = true
                  state_tracker.INCORRECT_POSTURE = true
                }

                if (ankle_vertical_angle > thresholds.ANKLE_THRESH) {
                  state_tracker.DISPLAY_TEXT[2] = true
                  state_tracker.INCORRECT_POSTURE = true
                }
              }

              // ----------------------------------- COMPUTE INACTIVITY ---------------------------------------------
              let display_inactivity = false

              if (state_tracker.curr_state === state_tracker.prev_state) {
                const end_time = performance.now() / 1000
                state_tracker.INACTIVE_TIME += end_time - state_tracker.start_inactive_time
                state_tracker.start_inactive_time = end_time

                if (state_tracker.INACTIVE_TIME >= thresholds.INACTIVE_THRESH) {
                  state_tracker.SQUAT_COUNT = 0
                  state_tracker.IMPROPER_SQUAT = 0
                  display_inactivity = true
                }
              } else {
                state_tracker.start_inactive_time = performance.now() / 1000
                state_tracker.INACTIVE_TIME = 0.0
              }

              // -------------------------------------------------------------------------------------------------------

              let hip_text_coord_x = hip_coord.x + 10
              let knee_text_coord_x = knee_coord.x + 15
              let ankle_text_coord_x = ankle_coord.x + 10

              // If you have a flip_frame logic, implement it here if needed

              if (state_tracker.state_seq.includes('s3') || current_state === 's1') {
                state_tracker.LOWER_HIPS = false
              }

              // Increment feedback frame count for each feedback type
              state_tracker.COUNT_FRAMES.forEach((_, idx) => {
                if (state_tracker.DISPLAY_TEXT[idx]) {
                  state_tracker.COUNT_FRAMES[idx] += 1
                } else {
                  state_tracker.COUNT_FRAMES[idx] = 0
                }
              })

              // Optionally show feedback (implement your own showFeedback if needed)
              // showFeedback(state_tracker.DISPLAY_TEXT, FEEDBACK_ID_MAP, state_tracker.LOWER_HIPS)

              if (display_inactivity) {
                // Optionally show a message or play a sound
                state_tracker.start_inactive_time = performance.now() / 1000
                state_tracker.INACTIVE_TIME = 0.0
              }

              state_tracker.prev_state = state_tracker.curr_state

              // You need to implement or import getState and updateStateSequence
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
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm',
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

<section id="demos" class={[isPsLmReady || 'invisible']}>
  <div id="liveView" class="videoView">
    <button id="webcamButton" class="mdc-button mdc-button--raised" onclick={enableCam}>
      {webcamRunning ? 'DISABLE' : 'ENABLE'} WEBCAM
    </button>
    <div style="position: relative;">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        id="webcam"
        style="width: 1280px; height: 720px; position: absolute"
        autoplay
        playsinline
      ></video>
      <canvas
        class="output_canvas"
        id="output_canvas"
        width="1280"
        height="720"
        style="position: absolute; left: 0px; top: 0px;"
      ></canvas>
    </div>
  </div>
</section>
