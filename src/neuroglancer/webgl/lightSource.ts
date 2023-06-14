import { vec3, vec4 } from "../util/geom";

export interface LightSource {
  lightPositions: vec4;
  lightAmbients: vec4;
  lightDiffuses: vec4;
  lightSpeculars: vec4;
  lightAttenuations: vec3;
  lightSpotCutoff: number;
  lightSpotExponent: number;
  lightSpotDirection: vec3;
}
const KeyLight: LightSource = {
  lightPositions: vec4.fromValues(0.1116, 0.7660, 0.6330, 0.0),
  lightAmbients: vec4.fromValues(0.1, 0.1, 0.1, 1.0),
  lightDiffuses: vec4.fromValues(0.75, 0.75, 0.75, 1.0),
  lightSpeculars: vec4.fromValues(0.85, 0.85, 0.85, 1.0),
  lightAttenuations: vec3.fromValues(1., 0., 0.),
  lightSpotCutoff: 180.0,
  lightSpotExponent: 1.0,
  lightSpotDirection: vec3.fromValues(-0.1116, -0.7660, -0.6330)
}

const HeadLight: LightSource = {
  lightPositions: vec4.fromValues(0., 0., 1., 0.0),
  lightAmbients: vec4.fromValues(0.1 * 0.333, 0.1 * 0.333, 0.1 * 0.333, 1.0),
  lightDiffuses: vec4.fromValues(0.75 * 0.333, 0.75 * 0.333, 0.75 * 0.333, 1.0),
  lightSpeculars: vec4.fromValues(0., 0., 0., 1.0),
  lightAttenuations: vec3.fromValues(1., 0., 0.),
  lightSpotCutoff: 180.0,
  lightSpotExponent: 1.0,
  lightSpotDirection: vec3.fromValues(0., 0., -1.)
}

const FillLight: LightSource = {
  lightPositions: vec4.fromValues(-0.0449, -0.9659, 0.2549, 0.0),
  lightAmbients: vec4.fromValues(0.1 * 0.333, 0.1 * 0.333, 0.1 * 0.333, 1.0),
  lightDiffuses: vec4.fromValues(0.75 * 0.333, 0.75 * 0.333, 0.75 * 0.333, 1.0),
  lightSpeculars: vec4.fromValues(0.85 * 0.333, 0.85 * 0.333, 0.85 * 0.333, 1.0),
  lightAttenuations: vec3.fromValues(1., 0., 0.),
  lightSpotCutoff: 180.0,
  lightSpotExponent: 1.0,
  lightSpotDirection: vec3.fromValues(0.0449, 0.9659, -0.2549)
}
const BackLight1: LightSource = {
  lightPositions: vec4.fromValues(0.9397, 0., -0.3420, 0.0),
  lightAmbients: vec4.fromValues(0.1 * 0.27, 0.1 * 0.27, 0.1 * 0.27, 1.0),
  lightDiffuses: vec4.fromValues(0.75 * 0.27, 0.75 * 0.27, 0.75 * 0.27, 1.0),
  lightSpeculars: vec4.fromValues(0.85 * 0.27, 0.85 * 0.27, 0.85 * 0.27, 1.0),
  lightAttenuations: vec3.fromValues(1., 0., 0.),
  lightSpotCutoff: 180.0,
  lightSpotExponent: 1.0,
  lightSpotDirection: vec3.fromValues(-0.9397, 0., 0.3420)
}
const BackLight2: LightSource = {
  lightPositions: vec4.fromValues(-0.9397, 0., -0.3420, 0.0),
  lightAmbients: vec4.fromValues(0.1 * 0.27, 0.1 * 0.27, 0.1 * 0.27, 1.0),
  lightDiffuses: vec4.fromValues(0.75 * 0.27, 0.75 * 0.27, 0.75 * 0.27, 1.0),
  lightSpeculars: vec4.fromValues(0.85 * 0.27, 0.85 * 0.27, 0.85 * 0.27, 1.0),
  lightAttenuations: vec3.fromValues(1., 0., 0.),
  lightSpotCutoff: 180.0,
  lightSpotExponent: 1.0,
  lightSpotDirection: vec3.fromValues(0.9397, 0., 0.3420)
}

export const LightSources = [
  KeyLight,
  HeadLight,
  FillLight,
  BackLight1,
  BackLight2
]

export function getLightSourceArray() {
  return {
    lightPositionArray: new Float32Array([
      ...KeyLight.lightPositions,
      ...HeadLight.lightPositions,
      ...FillLight.lightPositions,
      ...BackLight1.lightPositions,
      ...BackLight2.lightPositions,
    ]),
    lightAmbientArray: new Float32Array([
      ...KeyLight.lightAmbients,
      ...HeadLight.lightAmbients,
      ...FillLight.lightAmbients,
      ...BackLight1.lightAmbients,
      ...BackLight2.lightAmbients,
    ]),
    lightDiffuseArray: new Float32Array([
      ...KeyLight.lightDiffuses,
      ...HeadLight.lightDiffuses,
      ...FillLight.lightDiffuses,
      ...BackLight1.lightDiffuses,
      ...BackLight2.lightDiffuses,
    ]),
    lightSpecularArray: new Float32Array([
      ...KeyLight.lightSpeculars,
      ...KeyLight.lightSpeculars,
      ...KeyLight.lightSpeculars,
      ...KeyLight.lightSpeculars,
      ...KeyLight.lightSpeculars,
    ]),
    lightAttenuationArray: new Float32Array([
      ...KeyLight.lightAttenuations,
      ...HeadLight.lightAttenuations,
      ...FillLight.lightAttenuations,
      ...BackLight1.lightAttenuations,
      ...BackLight2.lightAttenuations,
    ]),
    lightSpotCutoffArray: new Float32Array([
      KeyLight.lightSpotCutoff,
      HeadLight.lightSpotCutoff,
      FillLight.lightSpotCutoff,
      BackLight1.lightSpotCutoff,
      BackLight2.lightSpotCutoff,
    ]),
    lightSpotExponentArray: new Float32Array([
      KeyLight.lightSpotExponent,
      HeadLight.lightSpotExponent,
      FillLight.lightSpotExponent,
      BackLight1.lightSpotExponent,
      BackLight2.lightSpotExponent,
    ]),
    lightSpotDirectionArray: new Float32Array([
      ...KeyLight.lightSpotDirection,
      ...HeadLight.lightSpotDirection,
      ...FillLight.lightSpotDirection,
      ...BackLight1.lightSpotDirection,
      ...BackLight2.lightSpotDirection,
    ])
  }
}