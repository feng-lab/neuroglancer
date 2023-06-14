import { ShaderProgram } from "./shader";
import { ShaderBuilder } from "./shader";
import { LightSources } from "./lightSource";

const LIGHT_COUNT = 5;

export const glsl_computeColorFromLight = `
vec4 computeColorFromLight(const in vec3 normalDirection, const in int lightIdx, const in vec3 position,
  const in float materialShininess, const in vec4 materialAmbient, const in vec4 materialSpecular,
  const in vec4 color) 
{
  vec3 lightDirection;
  float attenuation = 1.0;

  lightDirection = normalize(vec4(1.0, 1.0, 1.0, 0.0).xyz);

  vec4 retVal = vec4(0.);
  retVal += vec4(1.0, 1.0, 1.0, 1.0)/*lights_ambient*/ * materialAmbient;
  float NdotL = dot(normalDirection, lightDirection);
  if (NdotL > 0.0) {
    retVal += attenuation * vec4(0.5, 0.5, 0.5, 0.5)/*lights_diffuse*/ * NdotL * color;
    vec3 cameraDirection = normalize(-position);
    float NdotH = max(dot(reflect(-lightDirection,normalDirection), cameraDirection), 0.0);
    retVal += attenuation * vec4(0.3, 0.3, 0.3, 0.5)/*lights_specular*/ * materialSpecular * pow(NdotH, materialShininess);
  }
  return retVal;
}
`

export const glsl_applyLightingAndFog = `
vec4 apply_lighting_and_fog(const in vec4 sceneAmbient,
  const in float materialShininess, const in vec4 materialAmbient, const in vec4 materialSpecular,
  const in vec3 normalDirection, const in vec3 position, const in vec4 color, const in float alpha)
{
  vec4 finalColor = sceneAmbient * materialAmbient;

  finalColor += computeColorFromLight(normalDirection, 0, position, materialShininess, materialAmbient, materialSpecular, color);

  return vec4(finalColor.rgb * color.a * alpha, color.a * alpha);
}
`

export const gsls_LIGHTING = `

#if defined(USE_LINEAR_FOG) || defined(USE_EXPONENTIAL_FOG) || defined(USE_SQUARED_EXPONENTIAL_FOG)
uniform vec3 uFogColorTop;
uniform vec3 uFogColorBottom;
#endif
#if defined(USE_LINEAR_FOG)
uniform float uFogEnd;
uniform float uFogScale;
#endif
#if defined(USE_EXPONENTIAL_FOG)
uniform float uFogDensityLog2e;
#endif
#if defined(USE_SQUARED_EXPONENTIAL_FOG)
uniform float uFogDensityDensityLog2e;
#endif
`

export const gsls_MULTILIGHTING_computeColorFromLight = `

vec4 computeColorFromLight(const in vec3 normalDirection, const in int lightIdx, const in vec3 position,
                           const in float materialShininess, const in vec4 materialAmbient, const in vec4 materialSpecular,
                           const in vec4 color)
{
  highp vec3 lightDirection;
  highp float attenuation;
  if (0.0 == uLightsPosition[lightIdx].w)  // directional light
  {
    attenuation = 1.0;
    lightDirection = normalize(uLightsPosition[lightIdx].xyz);
  } else {    // spotlight or point light
    highp vec3 positionToLightSource = uLightsPosition[lightIdx].xyz - position;
    highp float distance = length(positionToLightSource);
    lightDirection = normalize(positionToLightSource);
    attenuation = 1.0 / (uLightsAttenuation[lightIdx].x
                         + uLightsAttenuation[lightIdx].y * distance
                         + uLightsAttenuation[lightIdx].z * distance * distance);

    if (uLightsSpotCutoff[lightIdx] <= 90.0) // spotlight
    {
      highp float clampedCosine = max(0.0, dot(-lightDirection, normalize(uLightsSpotDirection[lightIdx])));
      if (clampedCosine < cos(radians(uLightsSpotCutoff[lightIdx]))) // outside of spotlight cone
      {
        attenuation = 0.0;
      }
      else
      {
        attenuation = attenuation * pow(clampedCosine, uLightsSpotExponent[lightIdx]);
      }
    }
  }
  highp vec4 retVal = vec4(0.);
  retVal += uLightsAmbient[lightIdx] * materialAmbient;
  highp float NdotL = dot(normalDirection, lightDirection);
  if (NdotL > 0.0) {
    retVal += attenuation * uLightsDiffuse[lightIdx] * NdotL * color;
    highp vec3 cameraDirection = normalize(-position);
    highp float NdotH = max(dot(reflect(-lightDirection,normalDirection), cameraDirection), 0.0);
    retVal += attenuation * uLightsSpecular[lightIdx] * materialSpecular * pow(NdotH, materialShininess);
  }
  return retVal;
}
`

export const gsls_MULTILIGHTING_applyLightingAndFog = `
vec4 apply_lighting_and_fog(const in vec4 sceneAmbient,
                            const in float materialShininess, const in vec4 materialAmbient, const in vec4 materialSpecular,
                            const in vec3 normalDirection, const in vec3 position, const in vec4 color, const in float alpha)
{
  if (uLightingEnabled && LIGHT_COUNT > 0) {
    highp vec4 finalColor = sceneAmbient * materialAmbient;

    for (int index = 0; index < LIGHT_COUNT; index++) {
      finalColor += computeColorFromLight(normalDirection, index, position,
                                          materialShininess, materialAmbient, materialSpecular, color);
    }
    return vec4(finalColor.rgb * color.a * alpha, color.a * alpha);
  } else {
    return color;
  }
}
`

export function defineLightingShader(builder: ShaderBuilder) {
  builder.addUniform("bool", "uLightingEnabled");
  builder.addUniform("highp vec4", "uLightsPosition[LIGHT_COUNT]");
  builder.addUniform("highp vec4", "uLightsAmbient[LIGHT_COUNT]");
  builder.addUniform("highp vec4", "uLightsDiffuse[LIGHT_COUNT]");
  builder.addUniform("highp vec4", "uLightsSpecular[LIGHT_COUNT]");
  builder.addUniform("highp vec3", "uLightsAttenuation[LIGHT_COUNT]");
  builder.addUniform("highp float", "uLightsSpotCutoff[LIGHT_COUNT]");
  builder.addUniform("highp float", "uLightsSpotExponent[LIGHT_COUNT]");
  builder.addUniform("highp vec3", "uLightsSpotDirection[LIGHT_COUNT]");

  builder.addFragmentCode(gsls_MULTILIGHTING_computeColorFromLight);
  builder.addFragmentCode(gsls_MULTILIGHTING_applyLightingAndFog);
}

export function setLightingShader(shader: ShaderProgram, lightingEnabled: Boolean) {
  const { gl } = shader;
  //const {
  //  lightPositionArray,
  //  lightAmbientArray,
  //  lightDiffuseArray,
  //  lightSpecularArray,
  //  lightAttenuationArray,
  //  lightSpotCutoffArray,
  //  lightSpotExponentArray,
  //  lightSpotDirectionArray
  //} = getLightSourceArray();
  gl.uniform1i(shader.uniform("uLightingEnabled"), Number(lightingEnabled));

  for(let i = 0; i < LIGHT_COUNT; i++) {
    const lightSource = LightSources[i];
    gl.uniform4fv(gl.getUniformLocation(shader.program, `uLightsPosition[${i}]`), lightSource.lightPositions);
    gl.uniform4fv(gl.getUniformLocation(shader.program, `uLightsAmbient[${i}]`), lightSource.lightAmbients);
    gl.uniform4fv(gl.getUniformLocation(shader.program, `uLightsDiffuse[${i}]`), lightSource.lightDiffuses);
    gl.uniform4fv(gl.getUniformLocation(shader.program, `uLightsSpecular[${i}]`), lightSource.lightSpeculars);
    gl.uniform3fv(gl.getUniformLocation(shader.program, `uLightsAttenuation[${i}]`), lightSource.lightAttenuations);
    gl.uniform1f(gl.getUniformLocation(shader.program, `uLightsSpotCutoff[${i}]`), lightSource.lightSpotCutoff);
    gl.uniform1f(gl.getUniformLocation(shader.program, `uLightsSpotExponent[${i}]`), lightSource.lightSpotExponent);
    gl.uniform3fv(gl.getUniformLocation(shader.program, `uLightsSpotDirection[${i}]`), lightSource.lightSpotDirection);
  }
  

  //gl.uniform4fv(shader.uniform("uLightsPosition[LIGHT_COUNT]"), lightPositionArray);
  //gl.uniform4fv(shader.uniform("uLightsAmbient[LIGHT_COUNT]"), lightAmbientArray);
  //gl.uniform4fv(shader.uniform("uLightsDiffuse[LIGHT_COUNT]"), lightDiffuseArray);
  //gl.uniform4fv(shader.uniform("uLightsSpecular[LIGHT_COUNT]"), lightSpecularArray);
  //gl.uniform3fv(shader.uniform("uLightsAttenuation[LIGHT_COUNT]"), lightAttenuationArray);
  //gl.uniform1fv(shader.uniform("uLightsSpotCutoff[LIGHT_COUNT]"), lightSpotCutoffArray);
  //gl.uniform1fv(shader.uniform("uLightsSpotExponent[LIGHT_COUNT]"), lightSpotExponentArray);
  //gl.uniform3fv(shader.uniform("uLightsSpotDirection[LIGHT_COUNT]"), lightSpotDirectionArray);

}