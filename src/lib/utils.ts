import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { thresholds } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null }

export function findAngle(
  p1: { x: number; y: number } | NormalizedLandmark,
  p2: { x: number; y: number } | NormalizedLandmark,
  ref_pt: { x: number; y: number } | NormalizedLandmark = { x: 0, y: 0 },
) {
  // Convert points to vectors relative to ref_pt
  const p1_ref = { x: p1.x - ref_pt.x, y: p1.y - ref_pt.y }
  const p2_ref = { x: p2.x - ref_pt.x, y: p2.y - ref_pt.y }

  // Dot product
  const dot = p1_ref.x * p2_ref.x + p1_ref.y * p2_ref.y

  // Norms
  const norm1 = Math.hypot(p1_ref.x, p1_ref.y)
  const norm2 = Math.hypot(p2_ref.x, p2_ref.y)

  // Cosine of angle, clipped to [-1, 1]
  const cos_theta = Math.max(-1, Math.min(1, dot / (norm1 * norm2)))

  // Angle in radians
  const theta = Math.acos(cos_theta)

  // Convert to degrees and cast to int
  const degree = Math.floor((180 / Math.PI) * theta)

  return degree
}

export function getState(knee_angle: number): string | null {
  let knee: number | null = null

  if (
    knee_angle >= thresholds.HIP_KNEE_VERT.NORMAL[0] &&
    knee_angle <= thresholds.HIP_KNEE_VERT.NORMAL[1]
  ) {
    knee = 1
  } else if (
    knee_angle >= thresholds.HIP_KNEE_VERT.TRANS[0] &&
    knee_angle <= thresholds.HIP_KNEE_VERT.TRANS[1]
  ) {
    knee = 2
  } else if (
    knee_angle >= thresholds.HIP_KNEE_VERT.PASS[0] &&
    knee_angle <= thresholds.HIP_KNEE_VERT.PASS[1]
  ) {
    knee = 3
  }

  return knee ? `s${knee}` : null
}
