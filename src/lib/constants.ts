export const thresholds = {
  HIP_KNEE_VERT: {
    NORMAL: [0, 32],
    TRANS: [35, 65],
    PASS: [70, 95],
  },
  HIP_THRESH: [10, 50],
  ANKLE_THRESH: 45,
  KNEE_THRESH: [50, 70, 95],
  OFFSET_THRESH: 35.0,
  INACTIVE_THRESH: 15.0,
  CNT_FRAME_THRESH: 50,
}

export const COLORS = {
  blue: '#007fff',
  red: '#ff3232',
  green: '#00ff7f',
  light_green: '#64e97f',
  yellow: '#ffff00',
  magenta: '#ff00ff',
  white: '#ffffff',
  cyan: '#00ffff',
  light_blue: '#66ccff',
}

export const DICT_FEATURES = {
  left: {
    shoulder: 11,
    elbow: 13,
    wrist: 15,
    hip: 23,
    knee: 25,
    ankle: 27,
    foot: 31,
  },
  right: {
    shoulder: 12,
    elbow: 14,
    wrist: 16,
    hip: 24,
    knee: 26,
    ankle: 28,
    foot: 32,
  },
  nose: 0,
}

export const FEEDBACK_ID_MAP = {
  0: ['BEND BACKWARDS', 215, [0, 153, 255]],
  1: ['BEND FORWARD', 215, [0, 153, 255]],
  2: ['KNEE FALLING OVER TOE', 170, [255, 80, 80]],
  3: ['SQUAT TOO DEEP', 125, [255, 80, 80]],
}
